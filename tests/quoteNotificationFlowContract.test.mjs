import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("cotação usa destinatários acionáveis no push e identifica o código", async () => {
  const dataverse = await readFile(new URL("../src/dataverse.js", import.meta.url), "utf8");
  const pushFlow = await readFile(new URL("../scripts/create-planner-immediate-flow.ps1", import.meta.url), "utf8");

  assert.match(dataverse, /quoteNotificationContext = quoteTask/);
  assert.match(dataverse, /notificationRecipientIds: quoteTask \? \[\.\.\.new Set\(\[\.\.\.nextAssigneeIds, \.\.\.waitingTargets\]\)\]/);
  assert.match(dataverse, /nextStatus === "done" && !quoteTask/);
  assert.match(pushFlow, /notification:waiting.*notificationRecipientIds/);
  assert.match(pushFlow, /sourceType.*quote/);
  assert.match(pushFlow, /sourceCode/);
  assert.match(pushFlow, /collectionType.*due_today/);
  assert.match(pushFlow, /collectionType.*overdue/);
});

test("cotação não recebe e-mail imediato de cobrança manual", async () => {
  const source = await readFile(new URL("../scripts/create-planner-automatic-email-flow.ps1", import.meta.url), "utf8");
  assert.match(source, /sourceType.*quote/);
  assert.match(source, /equals\(outputs\('Compose_Context'\)\?\['sourceType'\],'quote'\),json\('\[\]'\)/);
});

test("resumo diário limita a janela a atrasadas e vencem hoje", async () => {
  const source = await readFile(new URL("../scripts/create-planner-daily-flow.ps1", import.meta.url), "utf8");
  assert.match(source, /Compose_report_kind.*ResumoDiario/);
  assert.match(source, /Filter_direct_tasks[\s\S]*equals\(formatDateTime\(item\(\)\?\['cr40f_prazo'\],'yyyy-MM-dd'\),variables\('Today'\)\)/);
  assert.match(source, /Filter_assigned_tasks[\s\S]*equals\(formatDateTime\(item\(\)\?\['cr40f_prazo'\],'yyyy-MM-dd'\),variables\('Today'\)\)/);
});
