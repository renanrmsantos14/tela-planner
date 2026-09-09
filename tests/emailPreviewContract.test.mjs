import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("prévia local do e-mail mantém contrato compatível com Outlook", async () => {
  const source = await readFile(new URL("../public/email-preview.html", import.meta.url), "utf8");

  assert.match(source, /role="presentation"/);
  assert.match(source, /width="600"/);
  assert.match(source, /style="[^"]*font-family:Segoe UI,Arial,sans-serif/);
  assert.match(source, /emailMessage|SendEmailV2|Outlook Windows simulado/);
  assert.match(source, /xmlns:v="urn:schemas-microsoft-com:vml"/);
  assert.match(source, /Sem CSS externo ou JavaScript no e-mail/);
  assert.match(source, /data-viewport="mobile"/);
  assert.match(source, /data-stress="long"/);
  assert.match(source, /data-stress="dark"/);
  assert.match(source, /data-stress="dpi"/);
  assert.match(source, /DPI\/zoom 125%/);
  assert.match(source, /id="previewControls"/);
  assert.match(source, /aria-pressed="true"/);
  assert.match(source, /data-legend="status"/);
  for (const scenario of ["assignment", "mention", "waiting", "waiting_return", "status", "assignees", "deadline", "update", "overdue", "due_today", "due_soon", "contact_assignment", "contact_transfer", "test", "flow_error"]) {
    assert.match(source, new RegExp(`value="${scenario}"`));
  }
  assert.match(source, /id="emailScenario"/);
  assert.match(source, /id="emailCtaLabel"/);
  assert.match(source, /Abrir caso no Planner/);
  assert.match(source, /data=taskId%3Dtask-40/);
  assert.match(source, /data=contactId%3Dcontact-42/);
  assert.match(source, /data-tone/);
  assert.match(source, /flow_error/);
  for (const toneColor of ["#0d645d", "#2f6fbb", "#b7791f", "#b42318"]) {
    assert.match(source, new RegExp(toneColor.replace("#", "\\#")));
  }
  assert.match(source, /min-height:\s*44px/);
  assert.match(source, /prefers-reduced-motion/);
  assert.doesNotMatch(source, /<link[^>]+stylesheet/);
});
