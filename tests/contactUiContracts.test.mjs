import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("contatos expõe Inbox, Kanban, seção Aguardando e filtros do MVP", async () => {
  const source = await readSource("../src/ContactsView.jsx");

  assert.match(source, /function ContactViewSelector\(\{ view, onChange \}\)/);
  assert.match(source, /aria-label="Visualização Inbox"/);
  assert.match(source, /aria-label="Visualização Kanban"/);
  assert.match(source, /className="contact-waiting-section"/);
  assert.match(source, /CONTACT_STATUSES\.map\(\(column\)/);
  assert.match(source, /onDrop=\{\(event\) => handleDrop\(event, column\.id\)\}/);
  assert.match(source, /Minhas pendências/);
  assert.match(source, /Arquivados/);
});

test("card mantém somente conclusão rápida com confirmação em dois passos", async () => {
  const source = await readSource("../src/ContactsView.jsx");

  assert.match(source, /setConfirming\(true\)/);
  assert.match(source, /window\.setTimeout\(\(\) => \{.*setConfirming\(false\)/s);
  assert.match(source, /onComplete\(contact\)/);
  assert.doesNotMatch(source, /onDoubleClick/);
});

test("drawer reutiliza responsáveis, seletor pesquisável e anexos", async () => {
  const source = await readSource("../src/ContactsView.jsx");
  const styles = await readSource("../src/styles.css");

  assert.match(source, /<AssignmentFields form=\{draft\}/);
  assert.match(source, /<SearchableSelect value=\{draft\.channel\}/);
  assert.match(source, /AttachmentSectionComponent/);
  assert.match(source, /MAX_CONTACT_ATTACHMENT_SIZE = 5 \* 1024 \* 1024/);
  assert.match(styles, /@media \(max-width: 820px\) \{[\s\S]*\.contact-kanban/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.contact-complete-action/);
});
