param(
  [string]$EnvironmentUrl = 'https://org23b93544.crm2.dynamics.com',
  [string]$ConnectionReferenceLogicalName = 'new_sharedcommondataserviceforapps_25a23',
  [string]$TeamsConnectionReferenceLogicalName = 'new_sharedteams_80676',
  [string]$OutlookConnectionReferenceLogicalName = 'new_sharedoffice365_f87d5',
  [string]$PowerAppsNotificationConnectionReferenceLogicalName = 'new_sharedpowerappsnotificationv2_e540f',
  [string]$PowerAppsAppUniqueName = 'cr40f_ModelDrivenBetinhos',
  [string]$SolutionUniqueName = 'AppBetinhos',
  [string]$FlowName = 'Planner | Notificação imediata',
  [string]$WorkflowId = ''
)

$ErrorActionPreference = 'Stop'
$requiredParameters = @{
  PowerAppsNotificationConnectionReferenceLogicalName = $PowerAppsNotificationConnectionReferenceLogicalName
  PowerAppsAppUniqueName = $PowerAppsAppUniqueName
  SolutionUniqueName = $SolutionUniqueName
}
foreach ($requiredParameter in $requiredParameters.GetEnumerator()) {
  if ([string]::IsNullOrWhiteSpace($requiredParameter.Value)) { throw "Informe -$($requiredParameter.Key) para provisionar o push do Power Apps." }
}
$expectedFlowName = 'Planner | Notifica' + [char]0x00E7 + [char]0x00E3 + 'o imediata'

$token = az account get-access-token --resource $EnvironmentUrl --query accessToken -o tsv
if (-not $token) { throw 'Azure CLI não retornou token para o ambiente Dataverse.' }
$headers = @{
  Authorization = "Bearer $token"
  Accept = 'application/json'
  'Content-Type' = 'application/json; charset=utf-8'
  Prefer = 'return=representation'
}

function Invoke-DataverseRequest {
  param(
    [Parameter(Mandatory = $true)][string]$Uri,
    [string]$Method = 'Get',
    [AllowNull()][string]$Body
  )
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try {
      $request = @{ Uri = $Uri; Headers = $headers; Method = $Method }
      if ($PSBoundParameters.ContainsKey('Body')) { $request.Body = $Body }
      return Invoke-RestMethod @request
    } catch {
      if ($attempt -eq 3) { throw }
      Start-Sleep -Seconds (2 * $attempt)
    }
  }
}

$escapedAppUniqueName = $PowerAppsAppUniqueName.Replace("'", "''")
$appModulesUri = "$EnvironmentUrl/api/data/v9.2/appmodules?`$select=name,uniquename&`$filter=uniquename eq '$escapedAppUniqueName'"
$appModules = @((Invoke-DataverseRequest -Uri $appModulesUri -Method Get).value)
if ($appModules.Count -ne 1) { throw "Esperado exatamente um app model-driven com uniquename '$PowerAppsAppUniqueName'; encontrados: $($appModules.Count)." }
$powerAppsAppIdentifier = [string]$appModules[0].uniquename
$powerAppsAppDisplayName = [string]$appModules[0].name
if ([string]::IsNullOrWhiteSpace($powerAppsAppIdentifier)) { throw "O app '$PowerAppsAppUniqueName' não retornou uniquename." }
if ([string]::IsNullOrWhiteSpace($powerAppsAppDisplayName)) { throw "O app '$PowerAppsAppUniqueName' não retornou name." }
if ($powerAppsAppDisplayName -match '[\\\"]') { throw "O nome do app contém caractere não suportado no descriptor do push: '$powerAppsAppDisplayName'." }

$powerAppsPushChannelValue = 100000002
$channelMetadataUri = "$EnvironmentUrl/api/data/v9.2/EntityDefinitions(LogicalName='cr40f_plannerdisparo')/Attributes(LogicalName='cr40f_canal')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?`$select=LogicalName&`$expand=OptionSet"
$channelMetadata = Invoke-DataverseRequest -Uri $channelMetadataUri -Method Get
$pushChannelOption = $channelMetadata.OptionSet.Options | Where-Object {
  $labels = @($_.Label.LocalizedLabels | ForEach-Object { $_.Label })
  @($labels | Where-Object { ($_ -replace '\s', '').Equals('PowerAppsPush', [System.StringComparison]::OrdinalIgnoreCase) }).Count -gt 0
} | Select-Object -First 1

if ($pushChannelOption) {
  $powerAppsPushChannelValue = [int]$pushChannelOption.Value
} else {
  $valueCollision = $channelMetadata.OptionSet.Options | Where-Object { [int]$_.Value -eq $powerAppsPushChannelValue } | Select-Object -First 1
  if ($valueCollision) { throw "O valor $powerAppsPushChannelValue de cr40f_canal já está ocupado por outra opção." }

  $optionLabel = @{
    '@odata.type' = 'Microsoft.Dynamics.CRM.Label'
    LocalizedLabels = @(@{ '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'; Label = 'PowerAppsPush'; LanguageCode = 1046; IsManaged = $false })
    UserLocalizedLabel = @{ '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'; Label = 'PowerAppsPush'; LanguageCode = 1046; IsManaged = $false }
  }
  $insertOptionPayload = @{
    EntityLogicalName = 'cr40f_plannerdisparo'
    AttributeLogicalName = 'cr40f_canal'
    Value = $powerAppsPushChannelValue
    Label = $optionLabel
    SolutionUniqueName = $SolutionUniqueName
  } | ConvertTo-Json -Depth 10
  Invoke-DataverseRequest -Uri "$EnvironmentUrl/api/data/v9.2/InsertOptionValue" -Method Post -Body $insertOptionPayload | Out-Null

  $publishPayload = @{
    ParameterXml = '<importexportxml><entities><entity>cr40f_plannerdisparo</entity></entities></importexportxml>'
  } | ConvertTo-Json -Compress
  Invoke-DataverseRequest -Uri "$EnvironmentUrl/api/data/v9.2/PublishXml" -Method Post -Body $publishPayload | Out-Null
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
          "subscriptionRequest/filterexpression": "cr40f_campo eq 'notification:test' or cr40f_campo eq 'notification:assignment' or cr40f_campo eq 'notification:mention' or cr40f_campo eq 'notification:waiting' or cr40f_campo eq 'notification:status' or cr40f_campo eq 'notification:assignees' or cr40f_campo eq 'notification:overdue_manual' or cr40f_campo eq 'notification:deadline'"
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
      "inputs": "@if(equals(outputs('Compose_Context')?['collectionType'], 'manual_overdue'), 'overdue', coalesce(outputs('Compose_Context')?['collectionType'], replace(triggerOutputs()?['body/cr40f_campo'], 'notification:', ''), 'update'))",
      "runAfter": { "Compose_Context": [ "Succeeded" ] }
    },
    "Compose_Notification_Title": {
      "type": "Compose",
      "inputs": "@if(equals(outputs('Compose_Type'), 'test'), 'Teste de notificação', if(equals(outputs('Compose_Type'), 'assignment'), 'Nova tarefa atribuída a você', if(equals(outputs('Compose_Type'), 'mention'), 'Você foi mencionado em uma tarefa', if(equals(outputs('Compose_Type'), 'waiting'), 'Tarefa aguardando retorno', if(equals(outputs('Compose_Type'), 'assignees'), 'Você foi adicionado como responsável', if(equals(outputs('Compose_Type'), 'due_today'), 'Tarefa vence hoje', if(equals(outputs('Compose_Type'), 'overdue'), 'Tarefa atrasada', if(equals(outputs('Compose_Type'), 'deadline'), 'Prazo da tarefa alterado', if(equals(outputs('Compose_Type'), 'status'), 'Status da tarefa alterado', 'Atualização da tarefa')))))))))",
      "runAfter": { "Compose_Type": [ "Succeeded" ] }
    },
    "Compose_Recipients": {
      "type": "Compose",
      "inputs": "@if(equals(triggerOutputs()?['body/cr40f_campo'], 'notification:assignees'), coalesce(outputs('Compose_Context')?['addedAssigneeIds'], json('[]')), union(coalesce(outputs('Compose_Context')?['notificationRecipientIds'], json('[]')), coalesce(outputs('Compose_Context')?['mentionedEmployeeIds'], json('[]')), coalesce(outputs('Compose_Context')?['waitingTargetIds'], json('[]')), coalesce(outputs('Compose_Context')?['previousAssigneeIds'], json('[]')), coalesce(outputs('Compose_Context')?['assigneeIds'], json('[]')), if(empty(outputs('Compose_Context')?['creatorEmployeeId']), json('[]'), createArray(outputs('Compose_Context')?['creatorEmployeeId']))))",
      "runAfter": { "Compose_Notification_Title": [ "Succeeded" ] }
    },
    "For_each_recipient": {
      "type": "Foreach",
      "foreach": "@if(or(equals(triggerOutputs()?['body/cr40f_campo'], 'notification:test'), equals(triggerOutputs()?['body/cr40f_campo'], 'notification:assignment'), equals(triggerOutputs()?['body/cr40f_campo'], 'notification:mention'), equals(triggerOutputs()?['body/cr40f_campo'], 'notification:waiting'), equals(triggerOutputs()?['body/cr40f_campo'], 'notification:overdue_manual'), and(equals(triggerOutputs()?['body/cr40f_campo'], 'notification:assignees'), greater(length(coalesce(outputs('Compose_Context')?['addedAssigneeIds'], json('[]'))), 0)), and(equals(triggerOutputs()?['body/cr40f_campo'], 'notification:deadline'), or(equals(outputs('Compose_Context')?['collectionType'], 'due_today'), equals(outputs('Compose_Context')?['collectionType'], 'overdue')))), outputs('Compose_Recipients'), json('[]'))",
      "runAfter": { "Compose_Recipients": [ "Succeeded" ] },
      "actions": {
        "Condition_NotAuthor": {
          "type": "If",
          "expression": {
            "and": [
              { "not": { "equals": [ "@empty(item())", true ] } },
              { "not": { "equals": [ "@toLower(coalesce(item(), ''))", "@toLower(coalesce(outputs('Compose_Context')?['actorEmployeeId'], ''))" ] } }
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
                "and": [
                  { "equals": [ "@length(outputs('List_existing')?['body/value'])", 0 ] },
                  { "not": { "or": [
                    { "equals": [ "@outputs('Compose_Context')?['collectionType']", "due_today" ] },
                    { "equals": [ "@outputs('Compose_Context')?['collectionType']", "overdue" ] }
                  ] } }
                ]
              },
              "actions": {
                "Create_notification": {
                  "type": "OpenApiConnection",
                  "inputs": {
                    "parameters": {
                      "entityName": "cr40f_plannernotificacaos",
                      "item/cr40f_titulo": "@outputs('Compose_Notification_Title')",
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
                    "Send_PowerApps_push": {
                      "type": "OpenApiConnection",
                      "runAfter": { "Get_system_user": [ "Succeeded" ] },
                      "inputs": {
                        "parameters": {
                          "payload/playerType": "PowerApps",
                          "payload/app": "{\"appIdentifier\":\"__POWER_APPS_APP_UNIQUE_NAME__\",\"displayName\":\"__POWER_APPS_APP_DISPLAY_NAME__\",\"type\":\"AppModule\"}",
                          "payload/recipients": "@createArray(outputs('Get_system_user')?['body/internalemailaddress'])",
                          "payload/message": "@concat(outputs('Compose_Notification_Title'), ': ', coalesce(triggerOutputs()?['body/cr40f_descricao'], 'Tarefa atualizada.'))",
                          "payload/openApp": true,
                          "payload/dynamicParams/entityLogicalName": "cr40f_plannertarefa"
                        },
                        "host": {
                          "apiId": "/providers/Microsoft.PowerApps/apis/shared_powerappsnotificationv2",
                          "operationId": "SendPushNotificationV2",
                          "connectionName": "shared_powerappsnotificationv2"
                        },
                        "authentication": "@parameters('$authentication')"
                      }
                    },
                    "Create_dispatch_sent": {
                      "type": "OpenApiConnection",
                      "runAfter": { "Send_PowerApps_push": [ "Succeeded" ] },
                      "inputs": {
                        "parameters": {
                          "entityName": "cr40f_plannerdisparos",
                          "item/cr40f_name": "@concat('PowerAppsPush | ', coalesce(outputs('Get_system_user')?['body/internalemailaddress'], item()))",
                          "item/cr40f_Destinatario@odata.bind": "@concat('/cr40f_funcionarioses(', item(), ')')",
                          "item/cr40f_destinatariotexto": "@coalesce(outputs('Get_system_user')?['body/internalemailaddress'], item())",
                          "item/cr40f_canal": __POWER_APPS_PUSH_CHANNEL_VALUE__,
                          "item/cr40f_categoria": 100000000,
                          "item/cr40f_chaveidempotente": "@concat(triggerOutputs()?['body/cr40f_plannertarefaeventoid'], '|', item(), '|', outputs('Compose_Type'), '|PowerAppsPush')",
                          "item/cr40f_status": 100000001,
                          "item/cr40f_statustexto": "Enviado",
                          "item/cr40f_tentativa": 1,
                          "item/cr40f_enviadoem": "@utcNow()",
                          "item/cr40f_identificadorexterno": "@coalesce(outputs('Send_PowerApps_push')?['body/id'], outputs('Send_PowerApps_push')?['body/notificationId'], '')"
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
                      "runAfter": { "Send_PowerApps_push": [ "Failed", "TimedOut" ] },
                      "inputs": {
                        "parameters": {
                          "entityName": "cr40f_plannerdisparos",
                          "item/cr40f_name": "@concat('PowerAppsPush falhou | ', coalesce(outputs('Get_system_user')?['body/internalemailaddress'], item()))",
                          "item/cr40f_Destinatario@odata.bind": "@concat('/cr40f_funcionarioses(', item(), ')')",
                          "item/cr40f_destinatariotexto": "@coalesce(outputs('Get_system_user')?['body/internalemailaddress'], item())",
                          "item/cr40f_canal": __POWER_APPS_PUSH_CHANNEL_VALUE__,
                          "item/cr40f_categoria": 100000000,
                          "item/cr40f_chaveidempotente": "@concat(triggerOutputs()?['body/cr40f_plannertarefaeventoid'], '|', item(), '|', outputs('Compose_Type'), '|PowerAppsPush')",
                          "item/cr40f_status": 100000002,
                          "item/cr40f_statustexto": "Falha",
                          "item/cr40f_tentativa": 1,
                          "item/cr40f_erro": "@string(outputs('Send_PowerApps_push'))"
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
                            "item/cr40f_canal": __POWER_APPS_PUSH_CHANNEL_VALUE__,
                            "item/cr40f_categoria": 100000000,
                            "item/cr40f_chaveidempotente": "@concat(triggerOutputs()?['body/cr40f_plannertarefaeventoid'], '|', item(), '|', outputs('Compose_Type'), '|PowerAppsPush')",
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
$definition = $definition.Replace('__POWER_APPS_APP_UNIQUE_NAME__', $powerAppsAppIdentifier)
$definition = $definition.Replace('__POWER_APPS_APP_DISPLAY_NAME__', $powerAppsAppDisplayName)
$definition = $definition.Replace('__POWER_APPS_PUSH_CHANNEL_VALUE__', [string]$powerAppsPushChannelValue)
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
            'emailMessage/Subject' = 'ERRO NO FLUXO - Planner | Notificação imediata'
            'emailMessage/Body' = '<p>Ocorreu um erro no fluxo <strong>Planner | Notificação imediata</strong>.</p><p>Consulte o histórico de execução no Power Automate.</p>'
            'emailMessage/Importance' = 'High'
          }
          host = [ordered]@{
            apiId = '/providers/Microsoft.PowerApps/apis/shared_office365'
            operationId = 'SendEmailV2'
            connectionName = 'shared_office365'
          }
          authentication = '@parameters(''$authentication'')'
        }
      }
      Terminate_Failed = [ordered]@{
        type = 'Terminate'
        runAfter = [ordered]@{ Send_Error_Email = @('Succeeded') }
        inputs = [ordered]@{
          runStatus = 'Failed'
          runError = [ordered]@{
            code = 'PlannerPushFlowFailed'
            message = 'O fluxo de push falhou. O e-mail de erro foi enviado.'
          }
        }
      }
    }
  }
}
$definition = $definitionObject | ConvertTo-Json -Depth 100 -Compress
$clientData = @{ properties = @{ connectionReferences = @{
  shared_commondataserviceforapps = @{ runtimeSource = 'embedded'; connection = @{ connectionReferenceLogicalName = $ConnectionReferenceLogicalName }; api = @{ name = 'shared_commondataserviceforapps' } }
  shared_teams = @{ runtimeSource = 'embedded'; connection = @{ connectionReferenceLogicalName = $TeamsConnectionReferenceLogicalName }; api = @{ name = 'shared_teams' } }
  shared_office365 = @{ runtimeSource = 'embedded'; connection = @{ connectionReferenceLogicalName = $OutlookConnectionReferenceLogicalName }; api = @{ name = 'shared_office365' } }
  shared_powerappsnotificationv2 = @{ runtimeSource = 'embedded'; connection = @{ connectionReferenceLogicalName = $PowerAppsNotificationConnectionReferenceLogicalName }; api = @{ name = 'shared_powerappsnotificationv2' } }
}; definition = ($definition | ConvertFrom-Json) }; schemaVersion = '1.0.0.0' } | ConvertTo-Json -Depth 50 -Compress
$payload = @{ category = 5; name = $FlowName; type = 1; primaryentity = 'none'; clientdata = $clientData } | ConvertTo-Json -Depth 50
$headers.Prefer = 'return=representation'
if (-not $WorkflowId) {
  $existingFlows = @((Invoke-DataverseRequest -Uri "$EnvironmentUrl/api/data/v9.2/workflows?`$select=workflowid,name,statecode,statuscode,modifiedon&`$orderby=modifiedon desc&`$top=500").value | Where-Object { $_.name -eq $expectedFlowName })
  $target = $existingFlows | Where-Object { [int]$_.statecode -eq 1 } | Select-Object -First 1
  if (-not $target) { $target = $existingFlows | Select-Object -First 1 }
  if ($target) { $WorkflowId = $target.workflowid }
}
if ($WorkflowId) {
  $targetUri = "$EnvironmentUrl/api/data/v9.2/workflows($WorkflowId)"
  Invoke-DataverseRequest -Uri $targetUri -Method Patch -Body (@{ statecode = 0; statuscode = 1 } | ConvertTo-Json) | Out-Null
  Invoke-DataverseRequest -Uri $targetUri -Method Patch -Body (@{ clientdata = $clientData } | ConvertTo-Json -Depth 50) | Out-Null
} else {
  $created = Invoke-DataverseRequest -Uri "$EnvironmentUrl/api/data/v9.2/workflows" -Method Post -Body $payload
  $WorkflowId = $created.workflowid
  $targetUri = "$EnvironmentUrl/api/data/v9.2/workflows($WorkflowId)"
}

if (-not $existingFlows) {
  $existingFlows = @((Invoke-DataverseRequest -Uri "$EnvironmentUrl/api/data/v9.2/workflows?`$select=workflowid,name,statecode,statuscode&`$top=500").value | Where-Object { $_.name -eq $expectedFlowName })
}
foreach ($flow in $existingFlows | Where-Object { $_.workflowid -ne $WorkflowId -and [int]$_.statecode -eq 1 }) {
  Invoke-DataverseRequest -Uri "$EnvironmentUrl/api/data/v9.2/workflows($($flow.workflowid))" -Method Patch -Body (@{ statecode = 0; statuscode = 1 } | ConvertTo-Json) | Out-Null
}
Invoke-DataverseRequest -Uri $targetUri -Method Patch -Body (@{ statecode = 1; statuscode = 2 } | ConvertTo-Json) | Out-Null

$activeVersions = @()
for ($attempt = 1; $attempt -le 10 -and $activeVersions.Count -eq 0; $attempt++) {
  $versions = @((Invoke-DataverseRequest -Uri "$EnvironmentUrl/api/data/v9.2/workflows?`$select=workflowid,name,statecode,statuscode,modifiedon&`$orderby=modifiedon desc&`$top=500").value | Where-Object { $_.name -eq $expectedFlowName })
  foreach ($candidate in $versions) {
    if ([string]$candidate.statuscode -eq '2') { $activeVersions += $candidate }
  }
  if ($activeVersions.Count -eq 0) { Start-Sleep -Seconds 2 }
}
$activeVersion = $activeVersions | Select-Object -First 1
if (-not $activeVersion) { throw 'O Flow foi salvo, mas nenhuma versão ativa foi encontrada.' }
foreach ($flow in $activeVersions | Where-Object { $_.workflowid -ne $activeVersion.workflowid }) {
  Invoke-DataverseRequest -Uri "$EnvironmentUrl/api/data/v9.2/workflows($($flow.workflowid))" -Method Patch -Body (@{ statecode = 0; statuscode = 1 } | ConvertTo-Json) | Out-Null
}

Write-Output "Flow ativo: $($activeVersion.workflowid)"
