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
  assert.match(source, /cr40f_chaveidempotente/);
  assert.match(source, /cr40f_canal.*100000001/);
  assert.match(source, /cr40f_status.*100000002/);
  assert.doesNotMatch(source, /emailMessage\/To.*cr40f_emailmicrosoft/);
  assert.doesNotMatch(source, /emailMessage\/To.*outputs\('Get_system_user'\)/);
});
