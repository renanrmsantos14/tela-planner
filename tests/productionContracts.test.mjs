import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Flow imediato cobre todos os eventos e usa array vazio válido", async () => {
  const source = await readSource("../scripts/create-planner-immediate-flow.ps1");

  assert.match(source, /startswith\([^\n]+notification:/i);
  assert.match(source, /PostMessageToConversation/);
  assert.match(source, /json\('\[\]'\)/);
  assert.doesNotMatch(source, /createArray\(\)/);
  assert.match(source, /item\/cr40f_Destinatario@odata\.bind/);
  assert.match(source, /__PLANNER_BASE_URL__/);
  assert.match(source, /Replace\('__PLANNER_BASE_URL__', \$EnvironmentUrl\.TrimEnd\('\/'\)\)/);
  assert.match(source, /\?data=taskId%3D/);
  assert.doesNotMatch(source, /https:\/\/org23b93544\.crm2\.dynamics\.com\/WebResources/);
});

test("prévia preserva o MIME persistido quando o Flow retorna rótulo incorreto", async () => {
  const source = await readSource("../src/dataverse.js");

  assert.match(
    source,
    /const mimeType = attachment\.mimeType \|\| result\.mimeType \|\| "application\/octet-stream";/,
  );
});
