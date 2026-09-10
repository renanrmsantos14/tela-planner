import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function compileFlowDefinition(source) {
  const block = source.match(/\$definition = @'\r?\n([\s\S]*?)\r?\n'@/);
  assert.ok(block, "bloco JSON da definição não encontrado");
  return JSON.parse(block[1].replaceAll("__POWER_APPS_APP_ID__", "app-test-id"));
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

test("Flow piloto usa Power Apps Notification V2 com destinatário Microsoft e taskId", async () => {
  const source = await readFile(new URL("../scripts/create-planner-immediate-flow.ps1", import.meta.url), "utf8");
  const definition = compileFlowDefinition(source);
  const push = findAction(definition, "Send_PowerApps_push");
  assert.ok(push, "ação Send_PowerApps_push não encontrada");
  assert.equal(push.inputs.host.operationId, "SendPushNotificationV2");
  assert.equal(push.inputs.host.apiId, "/providers/Microsoft.PowerApps/apis/shared_powerappsnotificationv2");
  assert.equal(push.inputs.parameters.playerType, "Power Apps");
  assert.equal(push.inputs.parameters.openApp, true);
  assert.match(push.inputs.parameters.recipients, /Get_system_user/);
  assert.match(push.inputs.parameters.dynamicParams, /entityName/);
  assert.match(push.inputs.parameters.dynamicParams, /entityId/);
  assert.match(source, /notification:test.*notification:assignment/);
  assert.match(source, /\|PowerAppsPush/);
  assert.match(source, /PowerAppsNotificationConnectionReferenceLogicalName/);
  assert.match(source, /shared_powerappsnotificationv2/);
});

test("teste live informa destinatário e equipes não consultam cr40f_icone", async () => {
  const dataverse = await readFile(new URL("../src/dataverse.js", import.meta.url), "utf8");
  assert.match(dataverse, /notificationRecipientIds: \[testRecipient\.id\]/);
  assert.match(dataverse, /TEAM_TABLE}id,\$\{primaryName\}/);
  assert.doesNotMatch(dataverse, /TEAM_ICON_FIELD/);
});

test("disparos do piloto distinguem sucesso, falha e identidade ausente", async () => {
  const source = await readFile(new URL("../scripts/create-planner-immediate-flow.ps1", import.meta.url), "utf8");
  assert.match(source, /item\/cr40f_canal.*PowerAppsPush/);
  assert.match(source, /item\/cr40f_status.*100000001/);
  assert.match(source, /item\/cr40f_status.*100000002/);
  assert.match(source, /item\/cr40f_status.*100000003/);
  assert.match(source, /Create_dispatch_sent/);
  assert.match(source, /Create_dispatch_failed/);
  assert.match(source, /Create_dispatch_without_identity/);
});
