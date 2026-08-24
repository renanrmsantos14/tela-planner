param(
  [string]$EnvironmentUrl = 'https://org23b93544.crm2.dynamics.com',
  [string]$ConnectionReferenceLogicalName = 'new_sharedcommondataserviceforapps_25a23',
  [string]$FlowName = 'Planner | Notificação imediata',
  [string]$WorkflowId = ''
)

$ErrorActionPreference = 'Stop'

$token = az account get-access-token --resource $EnvironmentUrl --query accessToken -o tsv
if (-not $token) { throw 'Azure CLI não retornou token para o ambiente Dataverse.' }
$headers = @{
  Authorization = "Bearer $token"
  Accept = 'application/json'
  'Content-Type' = 'application/json; charset=utf-8'
  Prefer = 'return=representation'
}

$definition = @'
{
  "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "$authentication": { "defaultValue": {}, "type": "SecureObject" },
    "$connections": { "defaultValue": {}, "type": "Object" }
  },
  "triggers": {
    "When_a_row_is_added": {
      "type": "OpenApiConnectionWebhook",
      "inputs": {
        "parameters": {
          "subscriptionRequest/message": 1,
          "subscriptionRequest/entityname": "cr40f_plannertarefaevento",
          "subscriptionRequest/scope": 4,
          "subscriptionRequest/filterexpression": "cr40f_campo eq 'notification:mention'"
        },
        "host": {
          "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
          "operationId": "SubscribeWebhookTrigger",
          "connectionName": "shared_commondataserviceforapps"
        },
        "authentication": "@parameters('$authentication')"
      }
    }
  },
  "actions": {
    "Compose_Context": {
      "type": "Compose",
      "inputs": "@json(triggerOutputs()?['body/cr40f_valornovo'])"
    },
    "Compose_Recipients": {
      "type": "Compose",
      "inputs": "@coalesce(outputs('Compose_Context')?['mentionedEmployeeIds'], createArray())",
      "runAfter": { "Compose_Context": [ "Succeeded" ] }
    },
    "For_each_recipient": {
      "type": "Foreach",
      "foreach": "@outputs('Compose_Recipients')",
      "runAfter": { "Compose_Recipients": [ "Succeeded" ] },
      "actions": {
        "Condition_NotAuthor": {
          "type": "If",
          "expression": {
            "and": [
              { "not": { "equals": [ "@toLower(item())", "@toLower(outputs('Compose_Context')?['actorEmployeeId'])" ] } }
            ]
          },
          "actions": {
            "List_existing": {
              "type": "OpenApiConnection",
              "inputs": {
                "parameters": {
                  "entityName": "cr40f_plannernotificacaos",
                  "$filter": "cr40f_chavededupe eq '@{concat(triggerOutputs()?['body/cr40f_plannertarefaeventoid'], '|', item(), '|mention')}'",
                  "$top": 1,
                  "accept": "application/json;odata.metadata=minimal"
                },
                "host": {
                  "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
                  "operationId": "ListRecords",
                  "connectionName": "shared_commondataserviceforapps"
                },
                "authentication": "@parameters('$authentication')"
              }
            },
            "Condition_New": {
              "type": "If",
              "expression": {
                "and": [ { "equals": [ "@length(outputs('List_existing')?['body/value'])", 0 ] } ]
              },
              "actions": {
                "Create_notification": {
                  "type": "OpenApiConnection",
                  "inputs": {
                    "parameters": {
                      "entityName": "cr40f_plannernotificacaos",
                      "item/cr40f_titulo": "Você foi mencionado",
                      "item/cr40f_mensagem": "@triggerOutputs()?['body/cr40f_descricao']",
                      "item/cr40f_tipo": "mention",
                      "item/cr40f_ocorridoem": "@coalesce(triggerOutputs()?['body/cr40f_ocorridoem'], utcNow())",
                      "item/cr40f_chavededupe": "@concat(triggerOutputs()?['body/cr40f_plannertarefaeventoid'], '|', item(), '|mention')",
                      "item/cr40f_tarefa@odata.bind": "@concat('/cr40f_plannertarefas(', triggerOutputs()?['body/_cr40f_tarefa_value'], ')')",
                      "item/cr40f_destinatario@odata.bind": "@concat('/cr40f_funcionarioses(', item(), ')')",
                      "item/cr40f_eventoorigem@odata.bind": "@concat('/cr40f_plannertarefaeventos(', triggerOutputs()?['body/cr40f_plannertarefaeventoid'], ')')"
                    },
                    "host": {
                      "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
                      "operationId": "CreateRecord",
                      "connectionName": "shared_commondataserviceforapps"
                    },
                    "authentication": "@parameters('$authentication')"
                  }
                }
              },
              "runAfter": { "List_existing": [ "Succeeded" ] }
            }
          }
        }
      }
    }
  }
}
'@

$definition = $definition.Replace('new_sharedcommondataserviceforapps_25a23', $ConnectionReferenceLogicalName)
$clientData = @{ properties = @{ connectionReferences = @{ shared_commondataserviceforapps = @{ runtimeSource = 'embedded'; connection = @{ connectionReferenceLogicalName = $ConnectionReferenceLogicalName }; api = @{ name = 'shared_commondataserviceforapps' } } }; definition = ($definition | ConvertFrom-Json) }; schemaVersion = '1.0.0.0' } | ConvertTo-Json -Depth 50 -Compress
$payload = @{ category = 5; name = $FlowName; type = 1; primaryentity = 'none'; clientdata = $clientData } | ConvertTo-Json -Depth 50
$headers.Prefer = 'return=representation'
if (-not $WorkflowId) {
  $filter = [uri]::EscapeDataString("name eq '$($FlowName.Replace("'", "''"))'")
  $existing = (Invoke-RestMethod -Uri "$EnvironmentUrl/api/data/v9.2/workflows?`$select=workflowid&`$filter=$filter" -Headers $headers).value | Select-Object -First 1
  if ($existing) { $WorkflowId = $existing.workflowid }
}
$method = if ($WorkflowId) { 'Patch' } else { 'Post' }
$uri = if ($WorkflowId) { "$EnvironmentUrl/api/data/v9.2/workflows($WorkflowId)" } else { "$EnvironmentUrl/api/data/v9.2/workflows" }
$body = if ($WorkflowId) { @{ clientdata = $clientData } | ConvertTo-Json -Depth 50 } else { $payload }
$result = Invoke-WebRequest -Uri $uri -Headers $headers -Method $method -Body $body
$result.Headers['OData-EntityId']
