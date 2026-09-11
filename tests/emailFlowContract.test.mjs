import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function compileFlowDefinition(source, testUserEmail = "usuario@example.com") {
  const block = source.match(/\$definition = @'\r?\n([\s\S]*?)\r?\n'@/);
  assert.ok(block, "bloco JSON da definição não encontrado");
  let json = block[1].replaceAll("__TEST_USER_EMAIL__", testUserEmail);
  const replacements = source.matchAll(/\$definition = \$definition\.Replace\('((?:''|[^'])*)', '((?:''|[^'])*)'\)/g);
  for (const [, encodedFrom, encodedTo] of replacements) {
    const from = encodedFrom.replaceAll("''", "'");
    const to = encodedTo.replaceAll("''", "'");
    json = json.replaceAll(from, to);
  }
  return JSON.parse(json);
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

test("HTML compilado do Flow usa atributos válidos e CTA no shell do Power Apps", async () => {
  const source = await readFile(new URL("../scripts/create-planner-email-flow.ps1", import.meta.url), "utf8");
  const definition = compileFlowDefinition(source);
  const sendEmail = findAction(definition, "Send_Email");
  const composeCta = findAction(definition, "Compose_Cta_Url");
  assert.ok(sendEmail, "ação Send_Email não encontrada");
  assert.ok(composeCta, "ação Compose_Cta_Url não encontrada");
  const body = sendEmail.inputs.parameters["emailMessage/Body"];

  assert.match(body, /<table role="presentation"/);
  assert.match(body, /<a href="/);
  assert.doesNotMatch(body, /&quot;/);
  assert.match(body, /Compose_Cta_Url/);
  assert.match(composeCta.inputs, /plannerAppUrl/);
  assert.match(composeCta.inputs, /main\.aspx/);
  assert.doesNotMatch(composeCta.inputs, /outputs\('Compose_Cta_Url'\)/);
});

test("HTML compilado do Flow automático preserva o mesmo CTA válido", async () => {
  const source = await readFile(new URL("../scripts/create-planner-automatic-email-flow.ps1", import.meta.url), "utf8");
  const definition = compileFlowDefinition(source);
  const sendEmail = findAction(definition, "Send_Email");
  const composeCta = findAction(definition, "Compose_Cta_Url");
  assert.ok(sendEmail, "ação Send_Email não encontrada");
  assert.ok(composeCta, "ação Compose_Cta_Url não encontrada");
  const body = sendEmail.inputs.parameters["emailMessage/Body"];

  assert.match(body, /<a href="/);
  assert.doesNotMatch(body, /&quot;/);
  assert.match(body, /Compose_Cta_Url/);
  assert.match(composeCta.inputs, /plannerAppUrl/);
  assert.match(composeCta.inputs, /main\.aspx/);
  assert.doesNotMatch(composeCta.inputs, /outputs\('Compose_Cta_Url'\)/);
});

test("Flow de teste resolve o e-mail operacional a partir do usuário Microsoft", async () => {
  const source = await readFile(new URL("../scripts/create-planner-email-flow.ps1", import.meta.url), "utf8");
  assert.match(source, /shared_office365/);
  assert.match(source, /new_sharedoffice365_f87d5/);
  assert.match(source, /operationId.*SendEmailV2/);
  assert.match(source, /emailMessage\/From.*noreply@betinhos\.com\.br/);
  assert.match(source, /Scope_ErrorNotification/);
  assert.match(source, /Scope_Main.*@\('Failed', 'TimedOut', 'Skipped'\)/s);
  assert.match(source, /emailMessage\/Subject.*ERRO NO FLUXO/);
  assert.match(source, /cr40f_campo eq 'notification:test'/);
  assert.match(source, /outputs\('Compose_Type'\).*test.*decodeUriComponent\('%C3%A7'\).*decodeUriComponent\('%C3%A3'\)/);
  assert.match(source, /Destinat.*decodeUriComponent\('%C3%A1'\).*rio:/);
  assert.match(source, /cr40f_chaveidempotente/);
  assert.match(source, /cr40f_canal.*100000001/);
  assert.match(source, /cr40f_status.*100000002/);
  assert.match(source, /Compose_Test_User_Email/);
  assert.match(source, /actorEmail/);
  assert.match(source, /cr40f_emailmicrosoft eq/);
  assert.match(source, /cr40f_emailbetinhos/);
  assert.match(source, /cr40f_status.*100000003/);
  assert.match(source, /Condition_No_Operational_Email/);
  assert.match(source, /item\/cr40f_Destinatario@odata\.bind/);
  assert.doesNotMatch(source, /item\/cr40f_destinatario@odata\.bind/);
  assert.match(source, /role=&quot;presentation&quot;/);
  assert.match(source, /border-collapse:collapse/);
  assert.match(source, /width:600px;max-width:600px/);
  assert.match(source, /color:#ffffff!important/);
  assert.match(source, /Abrir tarefa no Planner &rarr;/);
  assert.match(source, /Detalhes do teste/);
  assert.match(source, /background-color:#e6f2f0;border-left:5px solid #0d645d/);
  assert.match(source, /color:#075b55;font-size:28px/);
  assert.match(source, /lang=&quot;pt-BR&quot;/);
  assert.doesNotMatch(source, /coalesce\(outputs\('Compose_Context'\)\?\['plannerBaseUrl'\], 'https:\/\/org23b93544\.crm2\.dynamics\.com'\)/);
  assert.match(source, /workflows\?`\$select=workflowid,name,statecode,statuscode/);
  assert.match(source, /Where-Object \{ \$_.name -eq \$FlowName \}/);
  assert.doesNotMatch(source, /TestRecipientEmail/);
  assert.doesNotMatch(source, /cr40f_emailbetinhos eq/);
});

test("Flow automático de e-mail replica destinatários das notificações e não envia ao autor", async () => {
  const source = await readFile(new URL("../scripts/create-planner-automatic-email-flow.ps1", import.meta.url), "utf8");
  assert.match(source, /Planner \| Notifica.*autom.*tica por e-mail/);
  assert.match(source, /ConvertTo-Utf8JsonBytes/);
  assert.match(source, /startswith\(cr40f_campo, 'notification:'\)/);
  assert.match(source, /Compose_Recipients/);
  assert.match(source, /notificationRecipientIds/);
  assert.match(source, /cr40f_emailbetinhos/);
  assert.doesNotMatch(source, /cr40f_emailmicrosoft/);
  assert.match(source, /Condition_NotAuthor/);
  assert.match(source, /operationId.*SendEmailV2/);
  assert.match(source, /emailMessage\/From.*noreply@betinhos\.com\.br/);
  assert.match(source, /Scope_ErrorNotification/);
  assert.match(source, /Scope_Main.*@\('Failed', 'TimedOut', 'Skipped'\)/s);
  assert.match(source, /emailMessage\/Subject.*ERRO NO FLUXO/);
  assert.match(source, /cr40f_chaveidempotente/);
  assert.match(source, /\|Email/);
  assert.match(source, /item\/cr40f_canal.*100000001/);
  assert.match(source, /item\/cr40f_Destinatario@odata\.bind/);
  assert.doesNotMatch(source, /item\/cr40f_destinatario@odata\.bind/);
  assert.match(source, /role=&quot;presentation&quot;/);
  assert.match(source, /border-collapse:collapse/);
  assert.match(source, /width:600px;max-width:600px/);
  assert.match(source, /color:#ffffff!important/);
  assert.match(source, /background-color:#e6f2f0;border-left:5px solid #0d645d/);
  assert.match(source, /color:#075b55;font-size:28px/);
  assert.match(source, /outputs\('Compose_Context'\)\?\['plannerBaseUrl'\]/);
  assert.doesNotMatch(source, /coalesce\(outputs\('Compose_Context'\)\?\['plannerBaseUrl'\], 'https:\/\/org23b93544\.crm2\.dynamics\.com'\)/);
});

test("Flow diário monta resumo individual e semanal com idempotência", async () => {
  const source = await readFile(new URL("../scripts/create-planner-daily-flow.ps1", import.meta.url), "utf8");
  assert.match(source, /Recurrence[\s\S]*weekDays.*Monday.*Friday[\s\S]*hours.*8/);
  assert.match(source, /E\. South America Standard Time/);
  assert.match(source, /List_active_employees/);
  assert.match(source, /cr40f_emailbetinhos/);
  assert.match(source, /cr40f_plannertarefaequipe/);
  assert.match(source, /cr40f_plannerequipemembro/);
  assert.match(source, /ResumoSemanal/);
  assert.match(source, /ResumoDiario/);
  assert.match(source, /Atrasadas/);
  assert.match(source, /Vencem hoje/);
  assert.match(source, /Indicadores/);
  assert.match(source, /Condition_No_Operational_Email/);
  assert.match(source, /cr40f_chaveidempotente/);
  assert.match(source, /SendEmailV2/);
  assert.match(source, /_cr40f_cr40f_funcionarioresponsavel_value/);
  assert.match(source, /createArray\(items\('For_each_task'\)\?\['_cr40f_cr40f_funcionarioresponsavel_value'\]\)/);
});
