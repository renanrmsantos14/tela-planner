import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Flow de e-mail do Planner é restrito ao receptor de teste e idempotente", async () => {
  const source = await readFile(new URL("../scripts/create-planner-email-flow.ps1", import.meta.url), "utf8");
  assert.match(source, /noreply@betinhos\.onmicrosoft\.com/);
  assert.match(source, /shared_office365/);
  assert.match(source, /new_sharedoffice365_f87d5/);
  assert.match(source, /operationId.*SendEmailV2/);
  assert.match(source, /startswith\(cr40f_campo, 'notification:'\)/);
  assert.match(source, /outputs\('Compose_Type'\).*test.*decodeUriComponent\('%C3%A7'\).*decodeUriComponent\('%C3%A3'\)/);
  assert.match(source, /Destinat.*decodeUriComponent\('%C3%A1'\).*rio:/);
  assert.match(source, /cr40f_chaveidempotente/);
  assert.match(source, /cr40f_canal.*100000001/);
  assert.match(source, /cr40f_status.*100000002/);
  assert.match(source, /role=&quot;presentation&quot;/);
  assert.match(source, /Abrir tarefa no Planner &rarr;/);
  assert.match(source, /Detalhes do teste/);
  assert.match(source, /lang=&quot;pt-BR&quot;/);
  assert.doesNotMatch(source, /coalesce\(outputs\('Compose_Context'\)\?\['plannerBaseUrl'\], 'https:\/\/org23b93544\.crm2\.dynamics\.com'\)/);
  assert.match(source, /workflows\?`\$select=workflowid,name,statecode,statuscode/);
  assert.match(source, /Where-Object \{ \$_.name -eq \$FlowName \}/);
  assert.doesNotMatch(source, /emailMessage\/To.*cr40f_emailmicrosoft/);
  assert.doesNotMatch(source, /emailMessage\/To.*outputs\('Get_system_user'\)/);
});
