export const QUOTE_STATUS_FLOW = Object.freeze([
  "Nova",
  "Em análise pelo financeiro",
  "Aguardando informação",
  "Cotada",
  "Respondida ao cliente",
]);

export const QUOTE_TERMINAL_STATUSES = Object.freeze([
  "Aceita pelo cliente",
  "Perdida",
  "Cancelada",
]);

const QUOTE_STATUS_TO_TASK_STATUS = Object.freeze({
  Nova: "todo",
  "Em análise pelo financeiro": "doing",
  "Aguardando informação": "waiting",
  Cotada: "done",
  "Respondida ao cliente": "done",
  "Aceita pelo cliente": "done",
  Perdida: "done",
  Cancelada: "done",
});

export function isQuoteTask(task = {}) {
  return Boolean(task.quoteId || task.sourceType === "quote");
}

export function isQuoteTerminalStatus(status) {
  return QUOTE_TERMINAL_STATUSES.includes(status);
}

export function taskStatusForQuoteStatus(status) {
  return QUOTE_STATUS_TO_TASK_STATUS[status] || "todo";
}

export function quoteStatusForTaskStatus(taskStatus, currentQuoteStatus = "") {
  if (taskStatus === "done") return ["Cotada", "Respondida ao cliente", ...QUOTE_TERMINAL_STATUSES].includes(currentQuoteStatus) ? currentQuoteStatus : "Cotada";
  if (taskStatus === "waiting") return currentQuoteStatus === "Respondida ao cliente" ? currentQuoteStatus : "Aguardando informação";
  if (taskStatus === "doing") return currentQuoteStatus === "Cotada" ? "Cotada" : "Em análise pelo financeiro";
  return "Nova";
}
