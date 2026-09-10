import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("drawer separa retornos de comentários e anexos gerais", async () => {
  const app = await read("src/App.jsx");
  const styles = await read("src/styles.css");

  assert.match(app, /<h3>Retornos<\/h3>/);
  assert.match(app, /<h3>Comentários<\/h3>/);
  assert.match(app, /item\.returnId/);
  assert.match(app, /Abrir prévia/);
  assert.match(app, /Remover \$\{attachment\.name \|\| "evidência"\}/);
  assert.match(app, /Mostrar \{olderReturnsCount\}/);
  assert.match(styles, /\.return-card\.is-latest/);
});

test("histórico da tarefa permanece como última seção do corpo do drawer", async () => {
  const app = await read("src/App.jsx");
  const styles = await read("src/styles.css");
  const drawerBody = app.slice(app.indexOf('<div className="drawer-body" ref={drawerBodyRef}'));
  const historyIndex = drawerBody.indexOf('<section className="drawer-section history-section">');
  const bodyEndIndex = drawerBody.indexOf('<\/div>\n        <footer className="drawer-footer">');

  assert.ok(historyIndex >= 0, "histórico da tarefa deve existir no drawer");
  assert.ok(bodyEndIndex >= 0, "corpo do drawer deve terminar antes do rodapé");
  assert.ok(historyIndex < bodyEndIndex, "histórico deve ser a última seção antes do rodapé");
  assert.equal(drawerBody.slice(historyIndex).match(/<section className="drawer-section/g)?.length, 1);
  assert.match(styles, /\.task-drawer \.drawer-body > \.history-section \{ order: 99; \}/);
});

test("retorno live usa evento tipado e vínculo de evidência", async () => {
  const dataverse = await read("src/dataverse.js");

  assert.match(dataverse, /"retorno"/);
  assert.match(dataverse, /returnId/);
  assert.match(dataverse, /returnsWithAttachments/);
});

test("drawer carrega detalhes uma vez por tarefa selecionada", async () => {
  const app = await read("src/App.jsx");
  const dataverse = await read("src/dataverse.js");

  assert.match(app, /store\.loadTaskDetails\(selectedId\)/);
  assert.match(app, /task\.detailsLoaded \|\| task\.detailsLoading/);
  assert.match(dataverse, /export async function loadTaskDetails/);
});
