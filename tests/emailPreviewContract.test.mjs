import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("prévia local do e-mail mantém contrato compatível com Outlook", async () => {
  const source = await readFile(new URL("../public/email-preview.html", import.meta.url), "utf8");

  assert.match(source, /role="presentation"/);
  assert.match(source, /width="600"/);
  assert.match(source, /style="[^"]*font-family:Segoe UI,Arial,sans-serif/);
  assert.match(source, /emailMessage|SendEmailV2|Outlook desktop simulado/);
  assert.match(source, /xmlns:v="urn:schemas-microsoft-com:vml"/);
  assert.match(source, /Sem JavaScript no e-mail/);
  assert.match(source, /data-viewport="mobile"/);
  assert.doesNotMatch(source, /<link[^>]+stylesheet/);
});
