import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const flowScripts = [
  "create-planner-email-flow.ps1",
  "create-planner-automatic-email-flow.ps1",
  "create-planner-immediate-flow.ps1",
  "create-planner-daily-flow.ps1",
];

test("Flows do Planner têm contrato obrigatório de alerta por e-mail", async () => {
  for (const scriptName of flowScripts) {
    const source = await readFile(new URL(`../scripts/${scriptName}`, import.meta.url), "utf8");

    assert.match(source, /Scope_Main/, scriptName);
    assert.match(source, /Scope_ErrorNotification/, scriptName);
    assert.match(source, /runAfter = \[ordered\]@\{ Scope_Main = @\('Failed', 'TimedOut', 'Skipped'\) \}/, scriptName);
    assert.match(source, /operationId = 'SendEmailV2'/, scriptName);
    assert.match(source, /'emailMessage\/To' = 'noreply@betinhos\.onmicrosoft\.com'/, scriptName);
    assert.match(source, /'emailMessage\/From' = 'noreply@betinhos\.com\.br'/, scriptName);
    assert.match(source, /'emailMessage\/Subject' = 'ERRO NO FLUXO/, scriptName);
  }
});
