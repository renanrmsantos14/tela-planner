import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const quoteSources = [
  read("../src/QuotesView.jsx"),
  read("../src/quotes/HybridQuotesView.jsx"),
  read("../src/quotes/QuoteCreateDrawer.jsx"),
  read("../src/quotes/QuoteManagementDrawer.jsx"),
  read("../src/quotes/QuoteKanban.jsx"),
].join("\n");
const hybridInputSources = [
  read("../src/quotes/HybridQuotesView.jsx"),
  read("../src/quotes/QuoteFields.jsx"),
  read("../src/quotes/QuoteCreateDrawer.jsx"),
  read("../src/quotes/QuoteManagementDrawer.jsx"),
  read("../src/quotes/QuoteKanban.jsx"),
].join("\n");

test("cotações não usam prompt nativo e confirmam alterações não salvas", () => {
  assert.equal(quoteSources.includes("window.prompt"), false);
  assert.match(quoteSources, /Descartar alterações\?/);
  assert.match(quoteSources, /role="alertdialog"/);
});

test("cadastro expõe progresso, resumo de erros e bloqueio durante criação", () => {
  assert.match(quoteSources, /role="progressbar"/);
  assert.match(quoteSources, /quote-review-errors/);
  assert.match(quoteSources, /Criando cotação…/);
  assert.match(quoteSources, /aria-invalid/);
});

test("kanban oferece alternativa acessível ao arrastar", () => {
  assert.match(quoteSources, /Mover .* para/);
  assert.match(quoteSources, /Mover para…/);
  assert.match(quoteSources, /onDragStart/);
});

test("fluxo híbrido reutiliza o InputSelect do drawer do Planner", () => {
  assert.match(hybridInputSources, /InputSelect/);
  assert.equal(hybridInputSources.includes("<select"), false);
});

test("campos textuais usam o componente adaptado da Tela Formulário Geral", () => {
  const fields = read("../src/quotes/QuoteFields.jsx");
  assert.match(fields, /FormTextInput/);
  assert.match(fields, /FormTextArea/);
  assert.equal((fields.match(/<input/g) || []).length, 1);
  assert.equal((fields.match(/<textarea/g) || []).length, 1);
  assert.match(fields, /form-general-input/);
});

test("integração mantém flag V3 e carregamento sob demanda do histórico", () => {
  const app = read("../src/App.jsx");
  assert.match(app, /VITE_QUOTES_HYBRID_V3/);
  assert.match(app, /onEnsureTaskDetails/);
  assert.match(quoteSources, /Histórico indisponível/);
});
