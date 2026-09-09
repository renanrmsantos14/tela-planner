import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("módulo de teste de notificações usa o evento controlado", async () => {
  const component = await readFile(new URL("../src/NotificationTestPanel.jsx", import.meta.url), "utf8");
  const dataverse = await readFile(new URL("../src/dataverse.js", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(component, /Módulo de teste de notificações/);
  assert.match(component, /noreply@betinhos\.onmicrosoft\.com/);
  assert.match(component, /Enviar notificação de teste/);
  assert.match(component, /disabled=\{!live/);
  assert.match(dataverse, /sendLiveNotificationTest/);
  assert.match(dataverse, /"notification:test"/);
  assert.match(dataverse, /testNotification: true/);
  assert.match(app, /<NotificationTestPanel live=\{live\} tasks=\{tasks\}/);
  assert.match(app, /onSendNotificationTest=\{sendNotificationTest\}/);
});
