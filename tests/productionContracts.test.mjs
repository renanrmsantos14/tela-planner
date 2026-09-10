import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Flow piloto de push cobre teste e atribuição com array vazio válido", async () => {
  const source = await readSource("../scripts/create-planner-immediate-flow.ps1");

  assert.match(source, /notification:test.*notification:assignment/);
  assert.match(source, /SendPushNotificationV2/);
  assert.match(source, /shared_powerappsnotificationv2/);
  assert.match(source, /json\('\[\]'\)/);
  assert.doesNotMatch(source, /createArray\(\)/);
  assert.match(source, /item\/cr40f_Destinatario@odata\.bind/);
  assert.match(source, /dynamicParams/);
  assert.match(source, /entityId/);
  assert.match(source, /\|PowerAppsPush/);
});

test("eventos de notificação carregam o ambiente atual do WebResource", async () => {
  const dataverse = await import("../src/dataverse.js");
  assert.equal(typeof dataverse.withNotificationEnvironment, "function");
  const xrm = {
    Utility: {
      getGlobalContext: () => ({
        getClientUrl: () => "https://org.example.crm.dynamics.com/",
        getCurrentAppUrl: () => "https://org.example.crm.dynamics.com/main.aspx?appid=APP-ID",
      }),
    },
  };

  const context = JSON.parse(dataverse.withNotificationEnvironment(xrm, "notification:test", "{}"));
  assert.equal(context.plannerBaseUrl, "https://org.example.crm.dynamics.com");
  assert.equal(context.plannerAppUrl, "https://org.example.crm.dynamics.com/main.aspx?appid=APP-ID");
});

test("prévia preserva o MIME persistido quando o Flow retorna rótulo incorreto", async () => {
  const source = await readSource("../src/dataverse.js");

  assert.match(
    source,
    /const mimeType = attachment\.mimeType \|\| result\.mimeType \|\| "application\/octet-stream";/,
  );
});

test("download de anexo preserva o nome exibido do arquivo", async () => {
  const source = await readSource("../src/App.jsx");

  assert.match(source, /downloadLink\.download = attachment\.name \|\| "Anexo";/);
  assert.match(source, /downloadLink\.click\(\);/);
  assert.doesNotMatch(source, /popup\.location\.href = blobUrl;/);
});

test("subtarefas simples aparecem na criação, no drawer e opcionalmente no card", async () => {
  const source = await readSource("../src/App.jsx");

  assert.match(source, /function InlineSubtasksEditor\(\{ items, setItems \}\)/);
  assert.match(source, /className="creation-subtasks"/);
  assert.match(source, /aria-label="Título da subtarefa"/);
  assert.match(source, /<InlineSubtasksEditor items=\{subtasks\} setItems=\{setSubtasks\} \/>/);
  assert.match(source, /subtasks = \[\]/);
  assert.match(source, /attachments: draftAttachments,\s+subtasks,/);
  assert.match(source, /store\.createSubtask\(currentState, parent\.id/);
  assert.match(source, /onAddSubtask\(taskItem\.id, title, true\)/);
  assert.match(source, /Mostrar no quadro/);
  assert.match(source, /className="subtask-remove-confirm"/);
  assert.match(source, /setPendingDeleteIndex\(index\)/);
  assert.match(source, /onDelete\(subtask\.id\)/);
  assert.match(source, /\(showChecklistOnCard \|\| importedChecklist\.length > 0\) && checklistItems\.length > 0/);
  assert.match(source, /checklistVisibility\[selected\.id\]/);
});
