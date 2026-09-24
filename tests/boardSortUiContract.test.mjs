import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("rótulos do quadro correspondem à direção real do comparador", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");

  assert.match(source, /\["dueDate", "Prazo", "Mais próximo primeiro", "Mais distante primeiro"\]/);
  assert.match(source, /\["priority", "Prioridade", "Mais alta primeiro", "Mais baixa primeiro"\]/);
  assert.match(source, /\["updatedAt", "Atualização", "Mais antiga primeiro", "Mais recente primeiro"\]/);
  assert.match(source, /\["createdAt", "Criação", "Mais antiga primeiro", "Mais recente primeiro"\]/);
  assert.match(source, /\["title", "Título", "A–Z", "Z–A"\]/);
});
