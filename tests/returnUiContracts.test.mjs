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
