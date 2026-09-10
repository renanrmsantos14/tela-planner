param(
  [string]$EnvironmentUrl = 'https://org23b93544.crm2.dynamics.com',
  [string]$ConnectionReferenceLogicalName = 'new_sharedcommondataserviceforapps_25a23',
  [string]$OutlookConnectionReferenceLogicalName = 'new_sharedoffice365_f87d5',
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
      "inputs": { "parameters": { "entityName": "cr40f_plannertarefas", "$select": "cr40f_plannertarefaid,cr40f_titulo,cr40f_prazo,cr40f_status,cr40f_prioridade,cr40f_status@OData.Community.Display.V1.FormattedValue,cr40f_prioridade@OData.Community.Display.V1.FormattedValue,_cr40f_cr40f_funcionarioresponsavel_value,_cr40f_equipeplanner_value", "$filter": "statecode eq 0 and cr40f_status ne 100000003 and cr40f_status ne 100000004 and cr40f_prazo ne null", "accept": "application/json;odata.metadata=minimal", "x-ms-page-size": 5000 }, "host": { "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps", "operationId": "ListRecords", "connectionName": "shared_commondataserviceforapps" }, "authentication": "@parameters('$authentication')" }
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
$definitionObject = $definition | ConvertFrom-Json
$mainActions = $definitionObject.actions
$definitionObject.actions = [ordered]@{
  Scope_Main = [ordered]@{
    type = 'Scope'
    actions = $mainActions
  }
  Scope_ErrorNotification = [ordered]@{
    type = 'Scope'
    runAfter = [ordered]@{ Scope_Main = @('Failed', 'TimedOut', 'Skipped') }
    actions = [ordered]@{
      Send_Error_Email = [ordered]@{
        type = 'OpenApiConnection'
        inputs = [ordered]@{
          parameters = [ordered]@{
            'emailMessage/To' = 'noreply@betinhos.onmicrosoft.com'
            'emailMessage/From' = 'noreply@betinhos.com.br'
            'emailMessage/Subject' = 'ERRO NO FLUXO - Planner | Cobrança diária'
            'emailMessage/Body' = '<p>Ocorreu um erro no fluxo <strong>Planner | Cobrança diária</strong>.</p><p>Consulte o histórico de execução no Power Automate.</p>'
            'emailMessage/Importance' = 'High'
          }
          host = [ordered]@{
            apiId = '/providers/Microsoft.PowerApps/apis/shared_office365'
            operationId = 'SendEmailV2'
            connectionName = 'shared_office365'
          }
          authentication = "@parameters('$authentication')"
        }
      }
    }
  }
}
$digestActions = @'
{
  "List_active_employees": {
    "type": "OpenApiConnection",
    "runAfter": { "List_open_tasks": [ "Succeeded" ] },
    "inputs": { "parameters": { "entityName": "cr40f_funcionarios", "$select": "cr40f_funcionariosid,cr40f_nomecompleto,cr40f_emailbetinhos", "$filter": "statecode eq 0 and cr40f_status eq 0 and cr40f_funcao eq 202410001", "x-ms-page-size": 5000 }, "host": { "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps", "operationId": "ListRecords", "connectionName": "shared_commondataserviceforapps" }, "authentication": "@parameters('$authentication')" }
  },
  "List_task_team_relations": {
    "type": "OpenApiConnection",
    "runAfter": { "List_active_employees": [ "Succeeded" ] },
    "inputs": { "parameters": { "entityName": "cr40f_plannertarefaequipe", "$select": "_cr40f_tarefa_value,_cr40f_equipe_value", "$filter": "statecode eq 0", "x-ms-page-size": 5000 }, "host": { "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps", "operationId": "ListRecords", "connectionName": "shared_commondataserviceforapps" }, "authentication": "@parameters('$authentication')" }
  },
  "List_team_members": {
    "type": "OpenApiConnection",
    "runAfter": { "List_task_team_relations": [ "Succeeded" ] },
    "inputs": { "parameters": { "entityName": "cr40f_plannerequipemembro", "$select": "_cr40f_equipe_value,_cr40f_funcionario_value", "$filter": "statecode eq 0", "x-ms-page-size": 5000 }, "host": { "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps", "operationId": "ListRecords", "connectionName": "shared_commondataserviceforapps" }, "authentication": "@parameters('$authentication')" }
  },
  "Initialize_today": { "type": "InitializeVariable", "runAfter": { "List_team_members": [ "Succeeded" ] }, "inputs": { "variables": [{ "name": "Today", "type": "string", "value": "@formatDateTime(convertTimeZone(utcNow(),'UTC','E. South America Standard Time'),'yyyy-MM-dd')" }] } },
  "For_each_employee": {
    "type": "Foreach",
    "foreach": "@outputs('List_active_employees')?['body/value']",
    "runAfter": { "Initialize_today": [ "Succeeded" ] },
    "runtimeConfiguration": { "concurrency": { "repetitions": 1 } },
    "actions": {
      "Compose_employee_id": { "type": "Compose", "inputs": "@items('For_each_employee')?['cr40f_funcionariosid']" },
      "Filter_direct_tasks": { "type": "Query", "runAfter": { "Compose_employee_id": [ "Succeeded" ] }, "inputs": { "from": "@outputs('List_open_tasks')?['body/value']", "where": "@and(equals(item()?['_cr40f_cr40f_funcionarioresponsavel_value'],outputs('Compose_employee_id')),or(less(formatDateTime(item()?['cr40f_prazo'],'yyyy-MM-dd'),variables('Today')),and(greaterOrEquals(formatDateTime(item()?['cr40f_prazo'],'yyyy-MM-dd'),variables('Today')),lessOrEquals(formatDateTime(item()?['cr40f_prazo'],'yyyy-MM-dd'),addDays(variables('Today'),if(equals(dayOfWeek(variables('Today')),1),4,0))))))" } },
      "Select_employee_teams": { "type": "Select", "runAfter": { "Compose_employee_id": [ "Succeeded" ] }, "inputs": { "from": "@filter(outputs('List_team_members')?['body/value'],equals(item()?['_cr40f_funcionario_value'],outputs('Compose_employee_id')))", "select": "@item()?['_cr40f_equipe_value']" } },
      "Filter_team_tasks": { "type": "Query", "runAfter": { "Select_employee_teams": [ "Succeeded" ] }, "inputs": { "from": "@outputs('List_open_tasks')?['body/value']", "where": "@and(not(empty(item()?['_cr40f_equipeplanner_value'])),contains(string(outputs('Select_employee_teams')),string(item()?['_cr40f_equipeplanner_value'])),or(less(formatDateTime(item()?['cr40f_prazo'],'yyyy-MM-dd'),variables('Today')),and(greaterOrEquals(formatDateTime(item()?['cr40f_prazo'],'yyyy-MM-dd'),variables('Today')),lessOrEquals(formatDateTime(item()?['cr40f_prazo'],'yyyy-MM-dd'),addDays(variables('Today'),if(equals(dayOfWeek(variables('Today')),1),4,0))))))" } },
      "Compose_report_tasks": { "type": "Compose", "runAfter": { "Filter_direct_tasks": [ "Succeeded" ], "Filter_team_tasks": [ "Succeeded" ] }, "inputs": "@union(body('Filter_direct_tasks'),body('Filter_team_tasks'))" },
      "Condition_has_tasks": {
        "type": "If",
        "runAfter": { "Compose_report_tasks": [ "Succeeded" ] },
        "expression": { "and": [{ "greater": [ "@length(outputs('Compose_report_tasks'))", 0 ] }, { "not": { "equals": [ "@empty(items('For_each_employee')?['cr40f_emailbetinhos'])", true ] } }] },
        "actions": {
          "Compose_report_kind": { "type": "Compose", "inputs": "@if(equals(dayOfWeek(variables('Today')),1),'ResumoSemanal','ResumoDiario')" },
          "List_existing_digest": { "type": "OpenApiConnection", "runAfter": { "Compose_report_kind": [ "Succeeded" ] }, "inputs": { "parameters": { "entityName": "cr40f_plannerdisparos", "$filter": "cr40f_chaveidempotente eq '@{concat(outputs('Compose_employee_id'),'|',variables('Today'),'|',if(equals(outputs('Compose_report_kind'),'ResumoSemanal'),'ResumoSemanal',''),'|Email')}'", "$top": 1 }, "host": { "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps", "operationId": "ListRecords", "connectionName": "shared_commondataserviceforapps" }, "authentication": "@parameters('$authentication')" } },
          "Condition_not_sent": {
            "type": "If", "runAfter": { "List_existing_digest": [ "Succeeded" ] }, "expression": { "equals": [ "@length(outputs('List_existing_digest')?['body/value'])", 0 ] },
            "actions": {
              "Select_task_html": { "type": "Select", "inputs": { "from": "@outputs('Compose_report_tasks')", "select": "@concat('<tr><td style=\"padding:12px 0;border-bottom:1px solid #eef1f5\"><a href=\"',concat('https://',uriHost(outputs('List_open_tasks')?['body/@odata.context']),'/main.aspx?pagetype=entityrecord&etn=cr40f_plannertarefa&id=',item()?['cr40f_plannertarefaid']),'\" style=\"color:#14213d;font-weight:700;text-decoration:none\">',item()?['cr40f_titulo'],'</a><br><span style=\"color:#667085;font-size:13px\">Prazo: ',formatDateTime(item()?['cr40f_prazo'],'dd/MM/yyyy'),' · Status: ',coalesce(item()?['cr40f_status@OData.Community.Display.V1.FormattedValue'],item()?['cr40f_status']),' · Prioridade: ',coalesce(item()?['cr40f_prioridade@OData.Community.Display.V1.FormattedValue'],item()?['cr40f_prioridade']),'</span></td></tr>')" } },
              "Send_digest_email": { "type": "OpenApiConnection", "runAfter": { "Select_task_html": [ "Succeeded" ] }, "inputs": { "parameters": { "emailMessage/To": "@items('For_each_employee')?['cr40f_emailbetinhos']", "emailMessage/From": "noreply@betinhos.com.br", "emailMessage/Subject": "@if(equals(outputs('Compose_report_kind'),'ResumoSemanal'),concat('[Planner] Sua semana — ',formatDateTime(variables('Today'),'dd/MM'),' a ',formatDateTime(addDays(variables('Today'),4),'dd/MM')),concat('[Planner] Suas tarefas de hoje — ',formatDateTime(variables('Today'),'dd/MM'))) ", "emailMessage/Body": "@concat('<!DOCTYPE html><html lang=\"pt-BR\"><body style=\"font-family:Segoe UI,Arial,sans-serif;background:#f5f7fa;color:#172033\"><table role=\"presentation\" width=\"600\" align=\"center\" cellpadding=\"0\" cellspacing=\"0\" style=\"background:#fff;padding:32px\"><tr><td><p style=\"font-weight:700;letter-spacing:1.8px\">BETINHOS / PLANNER</p><h1>',if(equals(outputs('Compose_report_kind'),'ResumoSemanal'),'Sua semana','Suas tarefas de hoje'),'</h1><p>',if(equals(outputs('Compose_report_kind'),'ResumoSemanal'),'Relatório semanal com prioridades e indicadores.','Resumo das suas pendências operacionais.'),'</p><p>',if(equals(outputs('Compose_report_kind'),'ResumoSemanal'),'Indicadores: total da semana · atrasadas · em andamento · aguardando · prioridades alta/urgente.','Contadores: atrasadas · vencem hoje.'),'</p><p>',if(equals(outputs('Compose_report_kind'),'ResumoSemanal'),'Atrasadas · Prioridades da semana · Demais tarefas da semana','Atrasadas · Vencem hoje'),'</p><table role=\"presentation\" width=\"100%\">',join(body('Select_task_html'),''),'</table><p style=\"margin-top:28px\"><a href=\"',concat('https://',uriHost(outputs('List_open_tasks')?['body/@odata.context']),'/main.aspx'),'\" style=\"display:inline-block;padding:14px 22px;background:#14213d;color:#fff;text-decoration:none\">Abrir meu Planner</a></p></td></tr></table></body></html>')", "emailMessage/Importance": "Normal" }, "host": { "apiId": "/providers/Microsoft.PowerApps/apis/shared_office365", "operationId": "SendEmailV2", "connectionName": "shared_office365" }, "authentication": "@parameters('$authentication')" } },
              "Create_digest_dispatch": { "type": "OpenApiConnection", "runAfter": { "Send_digest_email": [ "Succeeded" ] }, "inputs": { "parameters": { "entityName": "cr40f_plannerdisparos", "item/cr40f_name": "@concat(outputs('Compose_report_kind'),' | ',items('For_each_employee')?['cr40f_emailbetinhos'])", "item/cr40f_canal": 100000001, "item/cr40f_status": 100000001, "item/cr40f_statustexto": "Enviado", "item/cr40f_destinatariotexto": "@items('For_each_employee')?['cr40f_emailbetinhos']", "item/cr40f_chaveidempotente": "@concat(outputs('Compose_employee_id'),'|',variables('Today'),'|',if(equals(outputs('Compose_report_kind'),'ResumoSemanal'),'ResumoSemanal',''),'|Email')", "item/cr40f_enviadoem": "@utcNow()", "item/cr40f_tentativa": 1 }, "host": { "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps", "operationId": "CreateRecord", "connectionName": "shared_commondataserviceforapps" }, "authentication": "@parameters('$authentication')" } }
            }
          }
        }
      }
    }
  },
  "For_each_missing_email": {
    "type": "Foreach",
    "foreach": "@filter(outputs('List_active_employees')?['body/value'],empty(item()?['cr40f_emailbetinhos']))",
    "runAfter": { "For_each_employee": [ "Succeeded" ] },
    "actions": {
      "Condition_No_Operational_Email": {
        "type": "If",
        "expression": { "equals": [ "@empty(items('For_each_missing_email')?['cr40f_emailbetinhos'])", true ] },
        "actions": {
          "Create_no_address_dispatch": { "type": "OpenApiConnection", "inputs": { "parameters": { "entityName": "cr40f_plannerdisparos", "item/cr40f_name": "@concat('Resumo | sem endereço | ',items('For_each_missing_email')?['cr40f_nomecompleto'])", "item/cr40f_canal": 100000001, "item/cr40f_status": 100000003, "item/cr40f_statustexto": "Sem endereço de e-mail", "item/cr40f_destinatariotexto": "", "item/cr40f_chaveidempotente": "@concat(items('For_each_missing_email')?['cr40f_funcionariosid'],'|',variables('Today'),'|SemEndereco|Email')", "item/cr40f_tentativa": 0 }, "host": { "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps", "operationId": "CreateRecord", "connectionName": "shared_commondataserviceforapps" }, "authentication": "@parameters('$authentication')" } }
        }
      }
    }
  }
}
'@ | ConvertFrom-Json
$digestActions.PSObject.Properties | ForEach-Object { $mainActions | Add-Member -MemberType NoteProperty -Name $_.Name -Value $_.Value -Force }
$definition = $definitionObject | ConvertTo-Json -Depth 100 -Compress
$clientData = @{ properties = @{ connectionReferences = @{
  shared_commondataserviceforapps = @{ runtimeSource = 'embedded'; connection = @{ connectionReferenceLogicalName = $ConnectionReferenceLogicalName }; api = @{ name = 'shared_commondataserviceforapps' } }
  shared_office365 = @{ runtimeSource = 'embedded'; connection = @{ connectionReferenceLogicalName = $OutlookConnectionReferenceLogicalName }; api = @{ name = 'shared_office365' } }
}; definition = ($definition | ConvertFrom-Json) }; schemaVersion = '1.0.0.0' } | ConvertTo-Json -Depth 100 -Compress
$payload = @{ category = 5; name = $FlowName; type = 1; primaryentity = 'none'; clientdata = $clientData } | ConvertTo-Json -Depth 100
$filter = [uri]::EscapeDataString("name eq '$($FlowName.Replace("'", "''"))'")
$existing = (Invoke-RestMethod -Uri "$EnvironmentUrl/api/data/v9.2/workflows?`$select=workflowid&`$filter=$filter" -Headers $headers).value | Select-Object -First 1
if ($existing) { $WorkflowId = $existing.workflowid }
$method = if ($WorkflowId) { 'Patch' } else { 'Post' }
$uri = if ($WorkflowId) { "$EnvironmentUrl/api/data/v9.2/workflows($WorkflowId)" } else { "$EnvironmentUrl/api/data/v9.2/workflows" }
$body = if ($WorkflowId) { @{ clientdata = $clientData } | ConvertTo-Json -Depth 100 } else { $payload }
if ($WorkflowId) {
  Invoke-RestMethod -Uri $uri -Headers $headers -Method Patch -Body $body | Out-Null
} else {
  $created = Invoke-RestMethod -Uri $uri -Headers $headers -Method Post -Body $body
  $WorkflowId = $created.workflowid
}
Write-Output "Flow atualizado: $WorkflowId (o estado de ativação não foi alterado)"
