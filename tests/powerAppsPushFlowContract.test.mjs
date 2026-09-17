import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function compileFlowDefinition(source) {
  const block = source.match(/\$definition = @'\r?\n([\s\S]*?)\r?\n'@/);
  assert.ok(block, "bloco JSON da definição não encontrado");
  return JSON.parse(
    block[1]
      .replaceAll("__POWER_APPS_APP_UNIQUE_NAME__", "cr40f_ModelDrivenBetinhos")
      .replaceAll("__POWER_APPS_APP_DISPLAY_NAME__", "App Betinhos Interno")
      .replaceAll("__POWER_APPS_PUSH_CHANNEL_VALUE__", "100000002"),
  );
}

function findAction(node, actionName) {
  if (!node || typeof node !== "object") return null;
  if (node.actions?.[actionName]) return node.actions[actionName];
  for (const value of Object.values(node)) {
    const found = findAction(value, actionName);
    if (found) return found;
  }
  return null;
}

test("Flow piloto configura push sem navegar para o formulário da tabela", async () => {
  const source = await readFile(new URL("../scripts/create-planner-immediate-flow.ps1", import.meta.url), "utf8");
  const definition = compileFlowDefinition(source);
  const push = findAction(definition, "Send_PowerApps_push");
  const getTask = findAction(definition, "Get_task");
  const notificationTitle = findAction(definition, "Compose_Notification_Title");
  const createNotification = findAction(definition, "Create_notification");
  assert.ok(push, "ação Send_PowerApps_push não encontrada");
  assert.equal(getTask.inputs.parameters.entityName, "cr40f_plannertarefas");
  assert.equal(getTask.inputs.parameters["$select"], "cr40f_titulo");
  assert.ok(notificationTitle, "rótulo contextual da notificação não encontrado");
  assert.equal(createNotification.inputs.parameters["item/cr40f_titulo"], "@outputs('Compose_Notification_Title')");
  assert.equal(push.inputs.host.operationId, "SendPushNotificationV2");
  assert.equal(push.inputs.host.apiId, "/providers/Microsoft.PowerApps/apis/shared_powerappsnotificationv2");
  assert.equal(push.inputs.parameters["payload/playerType"], "PowerApps");
  assert.deepEqual(JSON.parse(push.inputs.parameters["payload/app"]), {
    appIdentifier: "cr40f_ModelDrivenBetinhos",
    displayName: "App Betinhos Interno",
    type: "AppModule",
  });
  assert.equal(push.inputs.parameters["payload/openApp"], true);
  assert.match(push.inputs.parameters["payload/recipients"], /Get_system_user/);
  assert.equal(push.inputs.parameters["payload/dynamicParams/entityLogicalName"], "cr40f_plannertarefa");
  assert.equal(push.inputs.parameters["payload/dynamicParams/recordId"], undefined);
  assert.equal(
    push.inputs.parameters["payload/message"],
    "@if(equals(outputs('Compose_Type'), 'assignment'), outputs('Compose_Notification_Title'), concat(outputs('Compose_Notification_Title'), ': ', coalesce(triggerOutputs()?['body/cr40f_descricao'], 'Tarefa atualizada.')))",
  );
  assert.match(notificationTitle.inputs, /concat\('Nova tarefa: ', coalesce\(outputs\('Get_task'\)\?\['body\/cr40f_titulo'\]/);
  assert.match(createNotification.inputs.parameters["item/cr40f_mensagem"], /outputs\('Get_task'\)\?\['body\/cr40f_titulo'\]/);
  for (const label of [
    "Teste de notificação",
    "Você foi mencionado em uma tarefa",
    "Tarefa aguardando retorno",
    "Você foi adicionado como responsável",
    "Tarefa vence hoje",
    "Tarefa atrasada",
    "Prazo da tarefa alterado",
    "Status da tarefa alterado",
  ]) {
    assert.match(notificationTitle.inputs, new RegExp(label));
  }
  assert.equal(push.inputs.parameters.playerType, undefined);
  assert.equal(push.inputs.parameters.app, undefined);
  assert.match(source, /notification:test.*notification:assignment.*notification:mention.*notification:waiting.*notification:status.*notification:assignees.*notification:overdue_manual.*notification:deadline/);
  assert.match(source, /addedAssigneeIds/);
  assert.match(source, /collectionType.*due_today/);
  assert.match(source, /collectionType.*overdue/);
  assert.match(source, /\|PowerAppsPush/);
  assert.match(source, /PowerAppsNotificationConnectionReferenceLogicalName/);
  assert.match(source, /shared_powerappsnotificationv2/);
  assert.match(source, /new_sharedpowerappsnotificationv2_e540f/);
  assert.match(source, /PowerAppsAppUniqueName = 'cr40f_ModelDrivenBetinhos'/);
  assert.doesNotMatch(source, /appmoduleidunique/);
  assert.match(source, /uniquename eq '\$escapedAppUniqueName'/);
  assert.doesNotMatch(source, /PowerAppsAppId = '7c7c8fda-53d0-f011-8543-6045bd3a51ea'/);
  assert.match(source, /authentication = '@parameters\(''\$authentication''\)'/);
  assert.doesNotMatch(source, /authentication = "@parameters\('\$authentication'\)"/);
});

test("teste live informa destinatário e equipes não consultam cr40f_icone", async () => {
  const dataverse = await readFile(new URL("../src/dataverse.js", import.meta.url), "utf8");
  assert.match(dataverse, /notificationRecipientIds: \[testRecipient\.id\]/);
  assert.match(dataverse, /TEAM_TABLE}id,\$\{primaryName\}/);
  assert.doesNotMatch(dataverse, /TEAM_ICON_FIELD/);
  assert.match(dataverse, /cr40f_canal eq 100000002/);
  assert.doesNotMatch(dataverse, /cr40f_canal eq 'PowerAppsPush'/);
  assert.match(dataverse, /100000002: "PowerAppsPush"/);
});

test("disparos do piloto distinguem sucesso, falha e identidade ausente", async () => {
  const source = await readFile(new URL("../scripts/create-planner-immediate-flow.ps1", import.meta.url), "utf8");
  const definition = compileFlowDefinition(source);
  const sent = findAction(definition, "Create_dispatch_sent");
  const failed = findAction(definition, "Create_dispatch_failed");
  const withoutIdentity = findAction(definition, "Create_dispatch_without_identity");
  for (const action of [sent, failed, withoutIdentity]) {
    assert.equal(action.inputs.parameters["item/cr40f_canal"], 100000002);
    assert.equal(action.inputs.parameters["item/cr40f_categoria"], 100000000);
  }
  assert.match(source, /InsertOptionValue/);
  assert.match(source, /SolutionUniqueName = 'AppBetinhos'/);
  assert.match(source, /PowerAppsPush.*LanguageCode = 1046/);
  assert.match(source, /item\/cr40f_status.*100000001/);
  assert.match(source, /item\/cr40f_status.*100000002/);
  assert.match(source, /item\/cr40f_status.*100000003/);
  assert.match(source, /Create_dispatch_sent/);
  assert.match(source, /Create_dispatch_failed/);
  assert.match(source, /Create_dispatch_without_identity/);
});

test("Flow termina como Failed depois de enviar o e-mail de erro", async () => {
  const source = await readFile(new URL("../scripts/create-planner-immediate-flow.ps1", import.meta.url), "utf8");
  assert.match(source, /Terminate_Failed/);
  assert.match(source, /runAfter = \[ordered\]@\{ Send_Error_Email = @\('Succeeded'\) \}/);
  assert.match(source, /runStatus = 'Failed'/);
  assert.match(source, /code = 'PlannerPushFlowFailed'/);
});

test("filtro de autor tolera destinatário e actorEmployeeId nulos", async () => {
  const source = await readFile(new URL("../scripts/create-planner-immediate-flow.ps1", import.meta.url), "utf8");
  const definition = compileFlowDefinition(source);
  const condition = findAction(definition, "Condition_NotAuthor");
  const serialized = JSON.stringify(condition.expression);
  assert.match(serialized, /empty\(item\(\)\)/);
  assert.match(serialized, /toLower\(coalesce\(item\(\), ''\)\)/);
  assert.match(serialized, /toLower\(coalesce\(outputs\('Compose_Context'\)\?\['actorEmployeeId'\], ''\)\)/);
  assert.doesNotMatch(serialized, /toLower\(item\(\)\)/);
});

test("provisionamento repete chamadas transitórias do Dataverse com limite", async () => {
  const source = await readFile(new URL("../scripts/create-planner-immediate-flow.ps1", import.meta.url), "utf8");
  assert.match(source, /function Invoke-DataverseRequest/);
  assert.match(source, /\$attempt -le 3/);
  assert.match(source, /if \(\$attempt -eq 3\) \{ throw \}/);
});
