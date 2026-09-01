param(
  [string]$EnvironmentUrl = 'https://org23b93544.crm2.dynamics.com',
  [string]$ConnectionReferenceLogicalName = 'new_sharedcommondataserviceforapps_25a23',
  [string]$FlowName = 'Planner | Cobrança diária',
  [string]$WorkflowId = ''
)

$ErrorActionPreference = 'Stop'
$token = az account get-access-token --resource $EnvironmentUrl --query accessToken -o tsv
if (-not $token) { throw 'Azure CLI não retornou token para o ambiente Dataverse.' }
$headers = @{ Authorization = "Bearer $token"; Accept = 'application/json'; 'Content-Type' = 'application/json; charset=utf-8'; Prefer = 'return=representation' }

# Fluxo idempotente: D0 notifica responsáveis; cada dia útil atrasado repete a cobrança
# e inclui o criador no primeiro dia útil após o vencimento. O Teams usa o mesmo
# registro interno como origem e deve ser configurado na ação de resumo da solução.
$definition = @'
{
  "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
  "contentVersion": "1.0.0.0",
  "parameters": { "$authentication": { "defaultValue": {}, "type": "SecureObject" }, "$connections": { "defaultValue": {}, "type": "Object" } },
  "triggers": {
    "Recurrence": {
      "type": "Recurrence",
      "recurrence": { "frequency": "Week", "interval": 1, "schedule": { "weekDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], "hours": [8], "minutes": [0] }, "timeZone": "E. South America Standard Time" }
    }
  },
  "actions": {
    "List_open_tasks": {
      "type": "OpenApiConnection",
      "inputs": { "parameters": { "entityName": "cr40f_plannertarefas", "$filter": "statecode eq 0 and cr40f_status ne 100000003 and cr40f_status ne 100000004 and cr40f_prazo ne null", "accept": "application/json;odata.metadata=minimal" }, "host": { "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps", "operationId": "ListRecords", "connectionName": "shared_commondataserviceforapps" }, "authentication": "@parameters('$authentication')" }
    },
    "Initialize_today": { "type": "InitializeVariable", "inputs": { "variables": [{ "name": "Today", "type": "string", "value": "@formatDateTime(convertTimeZone(utcNow(),'UTC','E. South America Standard Time'),'yyyy-MM-dd')" }] }, "runAfter": { "List_open_tasks": ["Succeeded"] } },
    "For_each_task": {
      "type": "Foreach",
      "foreach": "@outputs('List_open_tasks')?['body/value']",
      "runAfter": { "Initialize_today": ["Succeeded"] },
      "actions": {
        "Condition_due": {
          "type": "If",
          "expression": { "and": [{ "lessOrEquals": ["@formatDateTime(items('For_each_task')?['cr40f_prazo'],'yyyy-MM-dd')", "@variables('Today')"] }] },
          "actions": {
            "List_assignees": {
              "type": "OpenApiConnection",
              "inputs": { "parameters": { "entityName": "cr40f_plannertarearesponsavels", "$filter": "_cr40f_tarefa_value eq @{items('For_each_task')?['cr40f_plannertarefaid']}", "accept": "application/json;odata.metadata=minimal" }, "host": { "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps", "operationId": "ListRecords", "connectionName": "shared_commondataserviceforapps" }, "authentication": "@parameters('$authentication')" }
            },
            "For_each_assignee": {
              "type": "Foreach",
              "foreach": "@outputs('List_assignees')?['body/value']",
              "runAfter": { "List_assignees": ["Succeeded"] },
              "actions": {
                "Create_notification_if_missing": {
                  "type": "If",
                  "expression": { "equals": ["@length(outputs('Find_existing_notification')?['body/value'])", 0] },
                  "runAfter": { "Find_existing_notification": ["Succeeded"] },
                  "actions": {
                    "Create_notification": {
                      "type": "OpenApiConnection",
                      "inputs": { "parameters": { "entityName": "cr40f_plannernotificacaos", "item/cr40f_titulo": "@if(equals(formatDateTime(items('For_each_task')?['cr40f_prazo'],'yyyy-MM-dd'),variables('Today')),'Tarefa vence hoje','Tarefa atrasada')", "item/cr40f_mensagem": "@items('For_each_task')?['cr40f_titulo']", "item/cr40f_tipo": "@if(equals(formatDateTime(items('For_each_task')?['cr40f_prazo'],'yyyy-MM-dd'),variables('Today')),'due_today','overdue')", "item/cr40f_ocorridoem": "@utcNow()", "item/cr40f_datareferencia": "@variables('Today')", "item/cr40f_chavededupe": "@concat(items('For_each_assignee')?['_cr40f_funcionario_value'],'|',items('For_each_task')?['cr40f_plannertarefaid'],'|',if(equals(formatDateTime(items('For_each_task')?['cr40f_prazo'],'yyyy-MM-dd'),variables('Today')),'due_today','overdue'),'|',variables('Today'))", "item/cr40f_tarefa@odata.bind": "@concat('/cr40f_plannertarefas(',items('For_each_task')?['cr40f_plannertarefaid'],')')", "item/cr40f_destinatario@odata.bind": "@concat('/cr40f_funcionarioses(',items('For_each_assignee')?['_cr40f_funcionario_value'],')')" }, "host": { "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps", "operationId": "CreateRecord", "connectionName": "shared_commondataserviceforapps" }, "authentication": "@parameters('$authentication')" }
                    }
                  }
                },
                "Find_existing_notification": {
                  "type": "OpenApiConnection",
                  "inputs": { "parameters": { "entityName": "cr40f_plannernotificacaos", "$filter": "cr40f_chavededupe eq '@{concat(items('For_each_assignee')?['_cr40f_funcionario_value'],'|',items('For_each_task')?['cr40f_plannertarefaid'],'|',if(equals(formatDateTime(items('For_each_task')?['cr40f_prazo'],'yyyy-MM-dd'),variables('Today')),'due_today','overdue'),'|',variables('Today'))}'", "$top": 1, "accept": "application/json;odata.metadata=minimal" }, "host": { "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps", "operationId": "ListRecords", "connectionName": "shared_commondataserviceforapps" }, "authentication": "@parameters('$authentication')" }
                }
              }
            }
          }
        }
      }
    }
  }
}
'@

$definition = $definition.Replace('new_sharedcommondataserviceforapps_25a23', $ConnectionReferenceLogicalName)
$clientData = @{ properties = @{ connectionReferences = @{ shared_commondataserviceforapps = @{ runtimeSource = 'embedded'; connection = @{ connectionReferenceLogicalName = $ConnectionReferenceLogicalName }; api = @{ name = 'shared_commondataserviceforapps' } } }; definition = ($definition | ConvertFrom-Json) }; schemaVersion = '1.0.0.0' } | ConvertTo-Json -Depth 100 -Compress
$payload = @{ category = 5; name = $FlowName; type = 1; primaryentity = 'none'; clientdata = $clientData } | ConvertTo-Json -Depth 100
$filter = [uri]::EscapeDataString("name eq '$($FlowName.Replace("'", "''"))'")
$existing = (Invoke-RestMethod -Uri "$EnvironmentUrl/api/data/v9.2/workflows?`$select=workflowid&`$filter=$filter" -Headers $headers).value | Select-Object -First 1
if ($existing) { $WorkflowId = $existing.workflowid }
$method = if ($WorkflowId) { 'Patch' } else { 'Post' }
$uri = if ($WorkflowId) { "$EnvironmentUrl/api/data/v9.2/workflows($WorkflowId)" } else { "$EnvironmentUrl/api/data/v9.2/workflows" }
$body = if ($WorkflowId) { @{ clientdata = $clientData } | ConvertTo-Json -Depth 100 } else { $payload }
(Invoke-WebRequest -Uri $uri -Headers $headers -Method $method -Body $body).Headers['OData-EntityId']
