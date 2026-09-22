import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("../src/quotes/QuoteManagementDrawer.jsx", import.meta.url)), "utf8");
const styles = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");

test("composer remove destinatário e modos e mantém as ações ao lado do preview", () => {
  assert.doesNotMatch(source, /quote-v3-composer-sidebar|Preparar mensagem|id="quote-composer-email"|quote-composer-mode/);
  assert.match(source, /quote-v3-composer-actions[\s\S]*Copiar modelo completo[\s\S]*Baixar PDF[\s\S]*Baixar Word/);
  assert.match(styles, /grid-template-areas: "header" "viewport" "actions"/);
  assert.doesNotMatch(styles, /quote-v3-composer-sidebar|quote-v3-composer-options/);
});
