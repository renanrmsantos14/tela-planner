import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const quoteSources = [
  read("../src/QuotesView.jsx"),
  read("../src/quotes/HybridQuotesView.jsx"),
  read("../src/quotes/QuoteCreateDrawer.jsx"),
  read("../src/quotes/QuoteManagementDrawer.jsx"),
  read("../src/quotes/QuoteKanban.jsx"),
  read("../src/KanbanBoard.jsx"),
].join("\n");

test("cotações não usam prompt nativo e confirmam alterações não salvas", () => {
  assert.equal(quoteSources.includes("window.prompt"), false);
  assert.match(quoteSources, /Descartar alterações\?/);
  assert.match(quoteSources, /role="alertdialog"/);
});

test("cadastro expõe progresso e bloqueio durante criação sem etapa de revisão", () => {
  assert.match(quoteSources, /role="progressbar"/);
  assert.match(quoteSources, /Criando cotação…/);
  assert.match(quoteSources, /setErrors\(result\.errors\)/);
  assert.doesNotMatch(read("../src/quotes/QuoteCreateDrawer.jsx"), /QuoteReview|id="review"|Revisão/);
});

test("formulário exibe dados comerciais apenas após cotar", () => {
  const fields = read("../src/quotes/QuoteFields.jsx");
  const workspace = read("../src/QuotesView.jsx");
  assert.match(fields, /showCommercialResult/);
  assert.match(fields, /quote-value/);
  assert.match(fields, /quote-commercial-terms/);
  assert.match(workspace, /Informar dados comerciais/);
  assert.match(workspace, /\["Cotada", "Respondida ao cliente"\]\.includes\(draft\.status\)/);
  assert.match(read("../src/quotes/HybridQuotesView.jsx"), /AttachmentSectionComponent[\s\S]*itemLabel="à cotação"[\s\S]*showPreview=\{false\}/);
});

test("footer do cadastro não exibe botão cancelar", () => {
  const drawer = read("../src/quotes/QuoteCreateDrawer.jsx");
  assert.doesNotMatch(drawer, /quote-v3-drawer-footer[^\n]*>.*Cancelar/);
});

test("contato da cotação não exibe canal e exige um meio de contato", () => {
  const fields = read("../src/quotes/QuoteFields.jsx");
  const workspace = read("../src/QuotesView.jsx");
  assert.doesNotMatch(fields, /quote-channel|label="Canal"/);
  assert.match(fields, /label="Telefone \/ WhatsApp"/);
  assert.match(fields, /label="E-mail"/);
  assert.doesNotMatch(workspace, /Canal de entrada/);
});

test("ordena passageiros após veículo e deixa data do serviço opcional", () => {
  const fields = read("../src/quotes/QuoteFields.jsx");
  const workspace = read("../src/QuotesView.jsx");
  assert.match(fields, /quote-vehicle[\s\S]*quote-passengers/);
  assert.doesNotMatch(fields, /id="quote-passengers" label="Número de passageiros" wide/);
  assert.doesNotMatch(fields, /id="quote-passengers"[^>]*required/);
  assert.doesNotMatch(fields, /quote-service-date[^\n]*required/);
  assert.match(workspace, /Tipo de veículo[\s\S]*Passageiros[\s\S]*Data e hora do serviço/);
  assert.doesNotMatch(workspace, /Data e hora do serviço" required/);
});

test("kanban de cotações move por arraste sem seletor nos cards", () => {
  const kanban = read("../src/quotes/QuoteKanban.jsx");
  assert.doesNotMatch(kanban, /Mover para…|quote-kanban-move/);
  assert.match(kanban, /onDragStart/);
  assert.match(kanban, /onMove={handleBoardMove}/);
  assert.match(kanban, /formatMoney\(quote\.value\)/);
  assert.match(kanban, /quote-kanban-value-content/);
});

test("kanban de cotações replica o motor e a composição do quadro de tarefas", () => {
  const kanban = read("../src/KanbanBoard.jsx");
  const quotes = read("../src/quotes/QuoteKanban.jsx");
  assert.match(quotes, /<KanbanBoard/);
  assert.match(quotes, /className={`task-card quote-kanban-card/);
  assert.match(kanban, /className="board-grid"/);
  assert.match(kanban, /className={`board-column/);
  assert.match(kanban, /card-drop-placeholder/);
  assert.match(kanban, /ResizeObserver/);
  assert.match(kanban, /requestAnimationFrame/);
});

test("card de cotação registra retorno pela tarefa vinculada", () => {
  const kanban = read("../src/quotes/QuoteKanban.jsx");
  const hybrid = read("../src/quotes/HybridQuotesView.jsx");
  assert.match(kanban, /canRegisterWaitingReturn\(task, currentEmployee, teams\)/);
  assert.match(kanban, /task-quick-action task-return-action/);
  assert.match(kanban, /stopPropagation\(\)/);
  assert.match(kanban, /onKeyDown=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(kanban, /onRegisterWaitingReturn\?\.\(task\.id\)/);
  assert.match(hybrid, /<QuoteKanban[^>]*currentEmployee=\{currentEmployee\}[^>]*teams=\{state\.teams\}[^>]*onRegisterWaitingReturn=\{onRegisterWaitingReturn\}/);
});

test("filtros de cotações reutilizam o multiselect da aba Tarefas", () => {
  const hybrid = read("../src/quotes/HybridQuotesView.jsx");
  assert.match(hybrid, /SearchableMultiSelect/);
  assert.equal((hybrid.match(/<SearchableMultiSelect/g) || []).length, 4);
});

test("campos textuais usam o componente adaptado da Tela Formulário Geral", () => {
  const fields = read("../src/quotes/QuoteFields.jsx");
  assert.match(fields, /FormTextInput/);
  assert.match(fields, /FormTextArea/);
  assert.equal((fields.match(/<input/g) || []).length, 1);
  assert.equal((fields.match(/<textarea/g) || []).length, 1);
  assert.match(fields, /form-general-input/);
});

test("app usa select compartilhado e prévia estática não usa select nativo", () => {
  const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return path.endsWith(".jsx") && entry.name !== "SearchableSelect.jsx" ? [path] : [];
  });
  for (const path of walk(fileURLToPath(new URL("../src/", import.meta.url)))) {
    assert.doesNotMatch(readFileSync(path, "utf8"), /<select\b/i, path);
  }
  assert.doesNotMatch(read("../public/email-preview.html"), /<select\b/i);
});

test("integração mantém flag V3 e carregamento sob demanda do histórico", () => {
  const app = read("../src/App.jsx");
  assert.match(app, /VITE_QUOTES_HYBRID_V3/);
  assert.match(app, /onEnsureTaskDetails/);
  assert.match(quoteSources, /Histórico indisponível/);
});
