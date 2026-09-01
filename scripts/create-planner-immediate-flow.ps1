param(
  [string]$EnvironmentUrl = 'https://org23b93544.crm2.dynamics.com',
  [string]$ConnectionReferenceLogicalName = 'new_sharedcommondataserviceforapps_25a23',
  [string]$TeamsConnectionReferenceLogicalName = 'new_sharedteams_80676',
  [string]$FlowName = 'Planner | Notificação imediata',
  [string]$WorkflowId = ''
)

$ErrorActionPreference = 'Stop'
$expectedFlowName = 'Planner | Notifica' + [char]0x00E7 + [char]0x00E3 + 'o imediata'

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
          "subscriptionRequest/filterexpression": "startswith(cr40f_campo, 'notification:')"
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
    "Compose_Type": {
      "type": "Compose",
      "inputs": "@coalesce(outputs('Compose_Context')?['collectionType'], replace(triggerOutputs()?['body/cr40f_campo'], 'notification:', ''), 'update')",
      "runAfter": { "Compose_Context": [ "Succeeded" ] }
    },
    "Compose_Recipients": {
      "type": "Compose",
      "inputs": "@union(coalesce(outputs('Compose_Context')?['notificationRecipientIds'], json('[]')), coalesce(outputs('Compose_Context')?['mentionedEmployeeIds'], json('[]')), coalesce(outputs('Compose_Context')?['waitingTargetIds'], json('[]')), coalesce(outputs('Compose_Context')?['previousAssigneeIds'], json('[]')), coalesce(outputs('Compose_Context')?['assigneeIds'], json('[]')), if(empty(outputs('Compose_Context')?['creatorEmployeeId']), json('[]'), createArray(outputs('Compose_Context')?['creatorEmployeeId'])))",
      "runAfter": { "Compose_Type": [ "Succeeded" ] }
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
                  "$filter": "cr40f_chavededupe eq '@{concat(triggerOutputs()?['body/cr40f_plannertarefaeventoid'], '|', item(), '|', outputs('Compose_Type'))}'",
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
                      "item/cr40f_titulo": "@if(equals(outputs('Compose_Type'), 'overdue'), 'Cobrança de prazo', if(equals(outputs('Compose_Type'), 'assignment'), 'Nova tarefa atribuída', 'Atualização da tarefa'))",
                      "item/cr40f_mensagem": "@triggerOutputs()?['body/cr40f_descricao']",
                      "item/cr40f_tipo": "@outputs('Compose_Type')",
                      "item/cr40f_ocorridoem": "@coalesce(triggerOutputs()?['body/cr40f_ocorridoem'], utcNow())",
                      "item/cr40f_chavededupe": "@concat(triggerOutputs()?['body/cr40f_plannertarefaeventoid'], '|', item(), '|', outputs('Compose_Type'))",
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
                },
                "Get_recipient": {
                  "type": "OpenApiConnection",
                  "runAfter": { "Create_notification": [ "Succeeded" ] },
                  "inputs": {
                    "parameters": {
                      "entityName": "cr40f_funcionarioses",
                      "recordId": "@item()",
                      "$select": "_cr40f_usuariodataverse_value",
                      "accept": "application/json;odata.metadata=minimal"
                    },
                    "host": {
                      "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
                      "operationId": "GetItem",
                      "connectionName": "shared_commondataserviceforapps"
                    },
                    "authentication": "@parameters('$authentication')"
                  }
                },
                "Condition_has_identity": {
                  "type": "If",
                  "runAfter": { "Get_recipient": [ "Succeeded" ] },
                  "expression": {
                    "and": [ { "not": { "equals": [ "@empty(outputs('Get_recipient')?['body/_cr40f_usuariodataverse_value'])", true ] } } ]
                  },
                  "actions": {
                    "Get_system_user": {
                      "type": "OpenApiConnection",
                      "inputs": {
                        "parameters": {
                          "entityName": "systemusers",
                          "recordId": "@outputs('Get_recipient')?['body/_cr40f_usuariodataverse_value']",
                          "$select": "internalemailaddress",
                          "accept": "application/json;odata.metadata=minimal"
                        },
                        "host": {
                          "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
                          "operationId": "GetItem",
                          "connectionName": "shared_commondataserviceforapps"
                        },
                        "authentication": "@parameters('$authentication')"
                      }
                    },
                    "Post_Teams_message": {
                      "type": "OpenApiConnection",
                      "runAfter": { "Get_system_user": [ "Succeeded" ] },
                      "inputs": {
                        "parameters": {
                          "poster": "Flow bot",
                          "location": "Chat with Flow bot",
                          "body/recipient": "@outputs('Get_system_user')?['body/internalemailaddress']",
                          "body/messageBody": "<p><strong>@{if(equals(outputs('Compose_Type'), 'assignment'), 'Nova tarefa atribuída', 'Atualização da tarefa')}</strong></p><p>@{triggerOutputs()?['body/cr40f_descricao']}</p><p><a href=\"@{concat('https://org23b93544.crm2.dynamics.com/WebResources/new_TelaPlanner.html?data=taskId=', triggerOutputs()?['body/_cr40f_tarefa_value'])}\">Abrir tarefa</a></p>"
                        },
                        "host": {
                          "apiId": "/providers/Microsoft.PowerApps/apis/shared_teams",
                          "operationId": "PostMessageToConversation",
                          "connectionName": "shared_teams"
                        },
                        "authentication": "@parameters('$authentication')"
                      }
                    },
                    "Create_dispatch_sent": {
                      "type": "OpenApiConnection",
                      "runAfter": { "Post_Teams_message": [ "Succeeded" ] },
                      "inputs": {
                        "parameters": {
                          "entityName": "cr40f_plannerdisparos",
                          "item/cr40f_name": "@concat('Teams | ', coalesce(outputs('Get_system_user')?['body/internalemailaddress'], item()))",
                          "item/cr40f_Destinatario@odata.bind": "@concat('/cr40f_funcionarioses(', item(), ')')",
                          "item/cr40f_destinatariotexto": "@coalesce(outputs('Get_system_user')?['body/internalemailaddress'], item())",
                          "item/cr40f_canal": 100000000,
                          "item/cr40f_categoria": 100000000,
                          "item/cr40f_chaveidempotente": "@concat(triggerOutputs()?['body/cr40f_plannertarefaeventoid'], '|', item(), '|', outputs('Compose_Type'), '|Teams')",
                          "item/cr40f_status": 100000001,
                          "item/cr40f_statustexto": "Enviado",
                          "item/cr40f_tentativa": 1,
                          "item/cr40f_enviadoem": "@utcNow()",
                          "item/cr40f_identificadorexterno": "@coalesce(outputs('Post_Teams_message')?['body/id'], outputs('Post_Teams_message')?['body/messageId'], '')"
                        },
                        "host": {
                          "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
                          "operationId": "CreateRecord",
                          "connectionName": "shared_commondataserviceforapps"
                        },
                        "authentication": "@parameters('$authentication')"
                      }
                    },
                    "Create_dispatch_failed": {
                      "type": "OpenApiConnection",
                      "runAfter": { "Post_Teams_message": [ "Failed", "TimedOut" ] },
                      "inputs": {
                        "parameters": {
                          "entityName": "cr40f_plannerdisparos",
                          "item/cr40f_name": "@concat('Teams falhou | ', coalesce(outputs('Get_system_user')?['body/internalemailaddress'], item()))",
                          "item/cr40f_Destinatario@odata.bind": "@concat('/cr40f_funcionarioses(', item(), ')')",
                          "item/cr40f_destinatariotexto": "@coalesce(outputs('Get_system_user')?['body/internalemailaddress'], item())",
                          "item/cr40f_canal": 100000000,
                          "item/cr40f_categoria": 100000000,
                          "item/cr40f_chaveidempotente": "@concat(triggerOutputs()?['body/cr40f_plannertarefaeventoid'], '|', item(), '|', outputs('Compose_Type'), '|Teams')",
                          "item/cr40f_status": 100000002,
                          "item/cr40f_statustexto": "Falha",
                          "item/cr40f_tentativa": 1,
                          "item/cr40f_erro": "@string(outputs('Post_Teams_message'))"
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
                  "else": {
                    "actions": {
                      "Create_dispatch_without_identity": {
                        "type": "OpenApiConnection",
                        "inputs": {
                          "parameters": {
                            "entityName": "cr40f_plannerdisparos",
                            "item/cr40f_name": "@concat('Sem identidade | ', item())",
                            "item/cr40f_Destinatario@odata.bind": "@concat('/cr40f_funcionarioses(', item(), ')')",
                            "item/cr40f_destinatariotexto": "@item()",
                            "item/cr40f_canal": 100000000,
                            "item/cr40f_categoria": 100000000,
                            "item/cr40f_chaveidempotente": "@concat(triggerOutputs()?['body/cr40f_plannertarefaeventoid'], '|', item(), '|', outputs('Compose_Type'), '|Teams')",
                            "item/cr40f_status": 100000003,
                            "item/cr40f_statustexto": "Sem identidade",
                            "item/cr40f_tentativa": 0
                          },
                          "host": {
                            "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
                            "operationId": "CreateRecord",
                            "connectionName": "shared_commondataserviceforapps"
                          },
                          "authentication": "@parameters('$authentication')"
                        }
                      }
                    }
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
$clientData = @{ properties = @{ connectionReferences = @{
  shared_commondataserviceforapps = @{ runtimeSource = 'embedded'; connection = @{ connectionReferenceLogicalName = $ConnectionReferenceLogicalName }; api = @{ name = 'shared_commondataserviceforapps' } }
  shared_teams = @{ runtimeSource = 'embedded'; connection = @{ connectionReferenceLogicalName = $TeamsConnectionReferenceLogicalName }; api = @{ name = 'shared_teams' } }
}; definition = ($definition | ConvertFrom-Json) }; schemaVersion = '1.0.0.0' } | ConvertTo-Json -Depth 50 -Compress
$payload = @{ category = 5; name = $FlowName; type = 1; primaryentity = 'none'; clientdata = $clientData } | ConvertTo-Json -Depth 50
$headers.Prefer = 'return=representation'
if (-not $WorkflowId) {
  $existingFlows = @((Invoke-RestMethod -Uri "$EnvironmentUrl/api/data/v9.2/workflows?`$select=workflowid,name,statecode,statuscode,modifiedon&`$orderby=modifiedon desc&`$top=500" -Headers $headers).value | Where-Object { $_.name -eq $expectedFlowName })
  $target = $existingFlows | Where-Object { [int]$_.statecode -eq 1 } | Select-Object -First 1
  if (-not $target) { $target = $existingFlows | Select-Object -First 1 }
  if ($target) { $WorkflowId = $target.workflowid }
}
if ($WorkflowId) {
  $targetUri = "$EnvironmentUrl/api/data/v9.2/workflows($WorkflowId)"
  Invoke-RestMethod -Uri $targetUri -Headers $headers -Method Patch -Body (@{ statecode = 0; statuscode = 1 } | ConvertTo-Json) | Out-Null
  Invoke-RestMethod -Uri $targetUri -Headers $headers -Method Patch -Body (@{ clientdata = $clientData } | ConvertTo-Json -Depth 50) | Out-Null
} else {
  $created = Invoke-RestMethod -Uri "$EnvironmentUrl/api/data/v9.2/workflows" -Headers $headers -Method Post -Body $payload
  $WorkflowId = $created.workflowid
  $targetUri = "$EnvironmentUrl/api/data/v9.2/workflows($WorkflowId)"
}

if (-not $existingFlows) {
  $existingFlows = @((Invoke-RestMethod -Uri "$EnvironmentUrl/api/data/v9.2/workflows?`$select=workflowid,name,statecode,statuscode&`$top=500" -Headers $headers).value | Where-Object { $_.name -eq $expectedFlowName })
}
foreach ($flow in $existingFlows | Where-Object { $_.workflowid -ne $WorkflowId -and [int]$_.statecode -eq 1 }) {
  Invoke-RestMethod -Uri "$EnvironmentUrl/api/data/v9.2/workflows($($flow.workflowid))" -Headers $headers -Method Patch -Body (@{ statecode = 0; statuscode = 1 } | ConvertTo-Json) | Out-Null
}
Invoke-RestMethod -Uri $targetUri -Headers $headers -Method Patch -Body (@{ statecode = 1; statuscode = 2 } | ConvertTo-Json) | Out-Null

$activeVersions = @()
for ($attempt = 1; $attempt -le 10 -and $activeVersions.Count -eq 0; $attempt++) {
  $versions = @((Invoke-RestMethod -Uri "$EnvironmentUrl/api/data/v9.2/workflows?`$select=workflowid,name,statecode,statuscode,modifiedon&`$orderby=modifiedon desc&`$top=500" -Headers $headers).value | Where-Object { $_.name -eq $expectedFlowName })
  foreach ($candidate in $versions) {
    if ([string]$candidate.statuscode -eq '2') { $activeVersions += $candidate }
  }
  if ($activeVersions.Count -eq 0) { Start-Sleep -Seconds 2 }
}
$activeVersion = $activeVersions | Select-Object -First 1
if (-not $activeVersion) { throw 'O Flow foi salvo, mas nenhuma versão ativa foi encontrada.' }
foreach ($flow in $activeVersions | Where-Object { $_.workflowid -ne $activeVersion.workflowid }) {
  Invoke-RestMethod -Uri "$EnvironmentUrl/api/data/v9.2/workflows($($flow.workflowid))" -Headers $headers -Method Patch -Body (@{ statecode = 0; statuscode = 1 } | ConvertTo-Json) | Out-Null
}

Write-Output "Flow ativo: $($activeVersion.workflowid)"
