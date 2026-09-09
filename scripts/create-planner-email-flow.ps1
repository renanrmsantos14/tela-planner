param(
  [string]$EnvironmentUrl = 'https://org23b93544.crm2.dynamics.com',
  [string]$DataverseConnectionReferenceLogicalName = 'new_sharedcommondataserviceforapps_25a23',
  [string]$OutlookConnectionReferenceLogicalName = 'new_sharedoffice365_f87d5',
  [string]$FlowName = 'Planner | Notificação por e-mail - Teste',
  [string]$TestRecipientEmail = 'noreply@betinhos.onmicrosoft.com',
  [string]$WorkflowId = ''
)

$ErrorActionPreference = 'Stop'

function Repair-Utf8Text([string]$Value) {
  if (-not $Value -or $Value -notmatch "$([char]0xC3)|$([char]0xC2)|$([char]0xE2)|$([char]0xFFFD)") { return $Value }
  return [Text.Encoding]::UTF8.GetString([Text.Encoding]::Default.GetBytes($Value))
}

$FlowName = Repair-Utf8Text $FlowName

if ($TestRecipientEmail -notmatch '^[^@;\s]+@[^@;\s]+$') {
  throw "TestRecipientEmail inválido: use um único endereço de e-mail."
}

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
      "inputs": "@json(coalesce(triggerOutputs()?['body/cr40f_valornovo'], '{}'))"
    },
    "Compose_Type": {
      "type": "Compose",
      "inputs": "@coalesce(outputs('Compose_Context')?['collectionType'], replace(triggerOutputs()?['body/cr40f_campo'], 'notification:', ''), 'update')",
      "runAfter": { "Compose_Context": [ "Succeeded" ] }
    },
    "Compose_Type_Label": {
      "type": "Compose",
      "inputs": "@if(equals(outputs('Compose_Type'), 'assignment'), 'Nova tarefa atribuída', if(equals(outputs('Compose_Type'), 'mention'), 'Você foi mencionado', if(equals(outputs('Compose_Type'), 'overdue'), 'Cobrança de tarefa atrasada', if(equals(outputs('Compose_Type'), 'deadline'), 'Prazo da tarefa alterado', if(equals(outputs('Compose_Type'), 'status'), 'Status da tarefa alterado', if(equals(outputs('Compose_Type'), 'test'), 'Teste de notificação', 'Atualização da tarefa'))))))",
      "runAfter": { "Compose_Type": [ "Succeeded" ] }
    },
    "Compose_Message": {
      "type": "Compose",
      "inputs": "@replace(replace(replace(coalesce(triggerOutputs()?['body/cr40f_descricao'], 'Sem descrição.'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;')",
      "runAfter": { "Compose_Type_Label": [ "Succeeded" ] }
    },
    "Compose_Test_Recipient": {
      "type": "Compose",
      "inputs": "__TEST_RECIPIENT__",
      "runAfter": { "Compose_Message": [ "Succeeded" ] }
    },
    "Compose_Idempotency_Key": {
      "type": "Compose",
      "inputs": "@concat(triggerOutputs()?['body/cr40f_plannertarefaeventoid'], '|', outputs('Compose_Test_Recipient'), '|', outputs('Compose_Type'), '|Email')",
      "runAfter": { "Compose_Test_Recipient": [ "Succeeded" ] }
    },
    "List_Test_Recipient": {
      "type": "OpenApiConnection",
      "inputs": {
        "parameters": {
          "entityName": "cr40f_funcionarioses",
          "$select": "cr40f_funcionariosid,cr40f_nomecompleto,cr40f_emailmicrosoft",
          "$filter": "cr40f_emailmicrosoft eq '@{outputs('Compose_Test_Recipient')}' and statecode eq 0",
          "$top": 1,
          "accept": "application/json;odata.metadata=minimal"
        },
        "host": {
          "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
          "operationId": "ListRecords",
          "connectionName": "shared_commondataserviceforapps"
        },
        "authentication": "@parameters('$authentication')"
      },
      "runAfter": { "Compose_Idempotency_Key": [ "Succeeded" ] }
    },
    "List_existing_email_dispatch": {
      "type": "OpenApiConnection",
      "inputs": {
        "parameters": {
          "entityName": "cr40f_plannerdisparos",
          "$filter": "cr40f_chaveidempotente eq '@{outputs('Compose_Idempotency_Key')}'",
          "$top": 1,
          "accept": "application/json;odata.metadata=minimal"
        },
        "host": {
          "apiId": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
          "operationId": "ListRecords",
          "connectionName": "shared_commondataserviceforapps"
        },
        "authentication": "@parameters('$authentication')"
      },
      "runAfter": { "List_Test_Recipient": [ "Succeeded" ] }
    },
    "Condition_Should_Send": {
      "type": "If",
      "expression": {
        "and": [
          { "equals": [ "@length(outputs('List_existing_email_dispatch')?['body/value'])", 0 ] },
          { "greater": [ "@length(outputs('List_Test_Recipient')?['body/value'])", 0 ] }
        ]
      },
      "actions": {
        "Send_Email": {
          "type": "OpenApiConnection",
          "inputs": {
            "parameters": {
              "emailMessage/To": "@outputs('Compose_Test_Recipient')",
              "emailMessage/Subject": "@concat('[Planner teste] ', outputs('Compose_Type_Label'))",
              "emailMessage/Body": "@concat('<div style=\"font-family:Segoe UI,Arial,sans-serif;font-size:14px\"><h2>', outputs('Compose_Type_Label'), '</h2><p>', outputs('Compose_Message'), '</p><p><strong>Campo:</strong> ', coalesce(triggerOutputs()?['body/cr40f_campo'], 'não informado'), '<br><strong>Evento:</strong> ', triggerOutputs()?['body/cr40f_plannertarefaeventoid'], '</p><p><a href=&quot;', coalesce(outputs('Compose_Context')?['plannerBaseUrl'], 'https://org23b93544.crm2.dynamics.com'), '/WebResources/new_TelaPlanner.html?data=taskId%3D', triggerOutputs()?['body/_cr40f_tarefa_value'], '&quot;>Abrir tarefa no Planner</a></p><p style=\"color:#667085;font-size:12px\">E-mail de teste do Planner. Destinatário fixo: ', outputs('Compose_Test_Recipient'), '</p></div>')",
              "emailMessage/Importance": "Normal"
            },
            "host": {
              "apiId": "/providers/Microsoft.PowerApps/apis/shared_office365",
              "operationId": "SendEmailV2",
              "connectionName": "shared_office365"
            },
            "authentication": "@parameters('$authentication')"
          }
        },
        "Create_dispatch_sent": {
          "type": "OpenApiConnection",
          "runAfter": { "Send_Email": [ "Succeeded" ] },
          "inputs": {
            "parameters": {
              "entityName": "cr40f_plannerdisparos",
              "item/cr40f_name": "@concat('Email teste | ', outputs('Compose_Type'))",
              "item/cr40f_destinatario@odata.bind": "@concat('/cr40f_funcionarioses(', first(outputs('List_Test_Recipient')?['body/value'])?['cr40f_funcionariosid'], ')')",
              "item/cr40f_destinatariotexto": "@outputs('Compose_Test_Recipient')",
              "item/cr40f_canal": 100000001,
              "item/cr40f_categoria": 100000000,
              "item/cr40f_chaveidempotente": "@outputs('Compose_Idempotency_Key')",
              "item/cr40f_status": 100000001,
              "item/cr40f_statustexto": "Enviado",
              "item/cr40f_tentativa": 1,
              "item/cr40f_enviadoem": "@utcNow()",
              "item/cr40f_identificadorexterno": "@coalesce(outputs('Send_Email')?['body/id'], '')"
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
          "runAfter": { "Send_Email": [ "Failed", "TimedOut" ] },
          "inputs": {
            "parameters": {
              "entityName": "cr40f_plannerdisparos",
              "item/cr40f_name": "@concat('Email teste falhou | ', outputs('Compose_Type'))",
              "item/cr40f_destinatario@odata.bind": "@concat('/cr40f_funcionarioses(', first(outputs('List_Test_Recipient')?['body/value'])?['cr40f_funcionariosid'], ')')",
              "item/cr40f_destinatariotexto": "@outputs('Compose_Test_Recipient')",
              "item/cr40f_canal": 100000001,
              "item/cr40f_categoria": 100000000,
              "item/cr40f_chaveidempotente": "@outputs('Compose_Idempotency_Key')",
              "item/cr40f_status": 100000002,
              "item/cr40f_statustexto": "Falha",
              "item/cr40f_tentativa": 1,
              "item/cr40f_erro": "@string(outputs('Send_Email'))"
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
          "Terminate_without_send": {
            "type": "Terminate",
            "inputs": { "runStatus": "Cancelled" }
          }
        }
      },
      "runAfter": { "List_existing_email_dispatch": [ "Succeeded" ] }
    }
  },
  "outputs": {}
}
'@

$definition = Repair-Utf8Text $definition
$definition = $definition.Replace('__TEST_RECIPIENT__', $TestRecipientEmail)
$clientData = @{
  properties = @{
    connectionReferences = @{
      shared_commondataserviceforapps = @{
        runtimeSource = 'embedded'
        connection = @{ connectionReferenceLogicalName = $DataverseConnectionReferenceLogicalName }
        api = @{ name = 'shared_commondataserviceforapps' }
      }
      shared_office365 = @{
        runtimeSource = 'embedded'
        connection = @{ connectionReferenceLogicalName = $OutlookConnectionReferenceLogicalName }
        api = @{ name = 'shared_office365' }
      }
    }
    definition = ($definition | ConvertFrom-Json)
  }
  schemaVersion = '1.0.0.0'
} | ConvertTo-Json -Depth 100 -Compress

$payload = @{ category = 5; name = $FlowName; type = 1; primaryentity = 'none'; clientdata = $clientData } | ConvertTo-Json -Depth 100
$activeWorkflowQueryUri = "$EnvironmentUrl/api/data/v9.2/workflows?`$select=workflowid,name,statecode,statuscode&`$filter=statecode eq 1"
$inactiveWorkflowQueryUri = "$EnvironmentUrl/api/data/v9.2/workflows?`$select=workflowid,name,statecode,statuscode&`$filter=statecode eq 0"
$activeFlows = @((Invoke-RestMethod -Uri $activeWorkflowQueryUri -Headers $headers).value)
$inactiveFlows = @((Invoke-RestMethod -Uri $inactiveWorkflowQueryUri -Headers $headers).value)
$existingFlows = @($activeFlows | Where-Object { $_.name -eq $FlowName })
$existingFlows += @($inactiveFlows | Where-Object { $_.name -eq $FlowName })
if (-not $WorkflowId) {
  $target = $existingFlows | Where-Object { [int]$_.statecode -eq 1 } | Select-Object -First 1
  if (-not $target) { $target = $existingFlows | Select-Object -First 1 }
  if ($target) { $WorkflowId = $target.workflowid }
}

if ($WorkflowId) {
  $targetUri = "$EnvironmentUrl/api/data/v9.2/workflows($WorkflowId)"
  Invoke-RestMethod -Uri $targetUri -Headers $headers -Method Patch -Body (@{ statecode = 0; statuscode = 1 } | ConvertTo-Json) | Out-Null
  Invoke-RestMethod -Uri $targetUri -Headers $headers -Method Patch -Body (@{ clientdata = $clientData } | ConvertTo-Json -Depth 100) | Out-Null
} else {
  $created = Invoke-RestMethod -Uri "$EnvironmentUrl/api/data/v9.2/workflows" -Headers $headers -Method Post -Body $payload
  $WorkflowId = $created.workflowid
  $targetUri = "$EnvironmentUrl/api/data/v9.2/workflows($WorkflowId)"
}

Invoke-RestMethod -Uri $targetUri -Headers $headers -Method Patch -Body (@{ statecode = 1; statuscode = 2 } | ConvertTo-Json) | Out-Null

foreach ($flow in $activeFlows | Where-Object { $_.name -eq $FlowName -and $_.workflowid -ne $WorkflowId }) {
  Invoke-RestMethod -Uri "$EnvironmentUrl/api/data/v9.2/workflows($($flow.workflowid))" -Headers $headers -Method Patch -Body (@{ statecode = 0; statuscode = 1 } | ConvertTo-Json) | Out-Null
}

Write-Output "Flow ativo: $WorkflowId"
Write-Output "Destinatário de teste: $TestRecipientEmail"
