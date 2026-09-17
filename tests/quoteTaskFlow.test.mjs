import test from "node:test";
import assert from "node:assert/strict";
import {
  QUOTE_STATUS_FLOW,
  QUOTE_TERMINAL_STATUSES,
  isQuoteTask,
  taskStatusForQuoteStatus,
  quoteStatusForTaskStatus,
} from "../src/quoteTaskFlow.js";

test("define o fluxo comercial único da cotação", () => {
  assert.deepEqual(QUOTE_STATUS_FLOW, [
    "Nova",
    "Em análise pelo financeiro",
    "Aguardando informação",
    "Cotada",
    "Respondida ao cliente",
  ]);
  assert.deepEqual(QUOTE_TERMINAL_STATUSES, [
    "Aceita pelo cliente",
    "Perdida",
    "Cancelada",
  ]);
});

test("mapeia status da cotação para o painel sem concluir ao enviar", () => {
  assert.equal(taskStatusForQuoteStatus("Nova"), "todo");
  assert.equal(taskStatusForQuoteStatus("Em análise pelo financeiro"), "doing");
  assert.equal(taskStatusForQuoteStatus("Aguardando informação"), "waiting");
  assert.equal(taskStatusForQuoteStatus("Cotada"), "doing");
  assert.equal(taskStatusForQuoteStatus("Respondida ao cliente"), "waiting");
  assert.equal(taskStatusForQuoteStatus("Perdida"), "done");
});

test("preserva etapa comercial ao reabrir uma tarefa encerrada", () => {
  assert.equal(quoteStatusForTaskStatus("done", "Perdida"), "Perdida");
  assert.equal(quoteStatusForTaskStatus("todo", ""), "Nova");
  assert.equal(isQuoteTask({ quoteId: "quote-1" }), true);
  assert.equal(isQuoteTask({ sourceType: "manual" }), false);
});

