import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("módulo de teste de notificações usa o evento controlado", async () => {
  const component = await readFile(new URL("../src/NotificationTestPanel.jsx", import.meta.url), "utf8");
  const dataverse = await readFile(new URL("../src/dataverse.js", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(component, /Módulo de teste de notificações/);
  assert.match(component, /e-mail operacional do usuário/);
  assert.match(component, /Enviar notificação de teste/);
  assert.match(component, /ainda não confirmou o disparo/);
  assert.match(component, /disabled=\{!live/);
  assert.match(dataverse, /sendLiveNotificationTest/);
  assert.match(dataverse, /"notification:test"/);
  assert.match(dataverse, /testNotification: true/);
  assert.match(dataverse, /cr40f_plannerdisparo/);
  assert.match(dataverse, /waitForLiveEmailDispatch/);
  assert.match(dataverse, /E-mail não enviado/);
  assert.match(dataverse, /emailDelivery/);
  assert.match(app, /<NotificationTestPanel live=\{live\} tasks=\{tasks\}/);
  assert.match(app, /onSendNotificationTest=\{sendNotificationTest\}/);
  assert.match(app, /notification-email-delivery/);
});
