import { isOverdue, normalizeAssigneeNames } from "./domain.js";

const TERMINAL_QUALITY_STATUSES = new Set(["resolvido", "encerrado", "cancelado", "concluida", "cancelada"]);
const TASK_STATUS_LABELS = Object.freeze({ todo: "A fazer", doing: "Em andamento", waiting: "Aguardando", done: "Concluído", cancelled: "Cancelado" });

function cleanText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return !text || /\b(undefined|null)\b/i.test(text) ? fallback : text;
}

function foldStatus(value) {
  return cleanText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function isTerminalQualityStatus(value) {
  return TERMINAL_QUALITY_STATUSES.has(foldStatus(value));
}

function taskTitle(task) {
  const title = cleanText(task.title);
  if (title) return title;
  const reference = cleanText(task.sourceCode || task.quoteCode || task.quoteTitle, "cotação");
  return task.sourceType === "quote" || task.quoteId ? `Acompanhar ${reference}` : "Tarefa sem título";
}

function taskContext(task) {
  return cleanText(task.description) || cleanText(task.quoteTitle) || "Tarefa Planner";
}

function qualityStatusGroup(item) {
  if (isTerminalQualityStatus(item.status)) return "done";
  if (["em tratamento", "em andamento"].includes(foldStatus(item.status))) return "doing";
  return "todo";
}

function qualityDue(item) {
  return cleanText(item.dueDate);
}

function qualityWorkItem(item) {
  const isAction = item.type === "action";
  const source = isAction ? "quality_action" : "quality_error";
  const statusGroup = qualityStatusGroup(item);
  const isTerminal = statusGroup === "done";
  return {
    id: `${source}:${item.id}`,
    source,
    sourceRecordId: item.id,
    sourceCode: cleanText(item.code),
    title: cleanText(item.title, isAction ? "Ação operacional" : "Ocorrência operacional"),
    context: cleanText(item.description) || (isAction ? "Ação de qualidade" : "Ocorrência de qualidade"),
    assigneeEmployeeId: item.assigneeId || "",
    assigneeName: cleanText(item.assigneeName, "Não atribuído"),
    dueAt: qualityDue(item),
    priorityRank: Number(item.priorityRank || 1),
    sourceStatus: cleanText(item.status),
    statusGroup,
    statusLabel: cleanText(item.status, TASK_STATUS_LABELS[statusGroup]),
    isTerminal,
    isOverdue: Boolean(qualityDue(item)) && !isTerminal && new Date(`${qualityDue(item)}T23:59:59`) < new Date(),
    quickTransitions: isTerminal ? [] : ["doing", "waiting"],
    openTarget: { resource: "new_gestao_erros_operacionais.html", params: isAction ? { actionId: item.id } : { errorId: item.id } },
  };
}

export function normalizeWorkItems(state = {}) {
  const tasks = (state.tasks || []).map((task) => ({
    id: `task:${task.id}`,
    source: task.sourceType === "quote" ? "quote_followup" : "task",
    sourceRecordId: task.id,
    sourceCode: cleanText(task.sourceCode || task.quoteCode),
    title: taskTitle(task),
    context: taskContext(task),
    assigneeEmployeeId: task.assigneeId || task.assigneeIds?.[0] || "",
    assigneeNames: task.assigneeNames || normalizeAssigneeNames(task.assigneeName),
    assigneeName: cleanText(task.assigneeName, "Não atribuído"),
    dueAt: cleanText(task.dueDate),
    priorityRank: ({ urgent: 0, high: 1, medium: 2, low: 3 }[task.priority] ?? 2),
    sourceStatus: cleanText(task.status),
    statusGroup: task.status,
    statusLabel: TASK_STATUS_LABELS[task.status] || cleanText(task.status, "A fazer"),
    isTerminal: ["done", "cancelled"].includes(task.status),
    isOverdue: !["done", "cancelled"].includes(task.status) && isOverdue(task),
    quickTransitions: ["done", "cancelled"].includes(task.status) ? [] : ["doing", "waiting", "done"],
    openTarget: task.quoteId
      ? { resource: "cr40f_TelaPedirCotacao.html", params: { view: "recent", recordId: task.quoteId } }
      : { resource: "new_TelaPlanner.html", params: { taskId: task.id } },
    parentTaskId: task.parentTaskId || null,
  }));
  return [...tasks, ...(state.quality || []).map(qualityWorkItem)];
}

export function sortWorkItems(items = []) {
  return [...items].sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    const aDue = a.dueAt || "9999-12-31";
    const bDue = b.dueAt || "9999-12-31";
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
    return String(a.title || "").localeCompare(String(b.title || ""), "pt-BR");
  });
}

export function filterWorkItems(items = [], filters = {}) {
  const query = String(filters.query || "").trim().toLocaleLowerCase("pt-BR");
  return items.filter((item) => {
    if (filters.includeTerminal !== true && item.isTerminal) return false;
    if (filters.source && filters.source !== "all" && item.source !== filters.source) return false;
    if (filters.assignee && filters.assignee !== "all" && item.assigneeEmployeeId !== filters.assignee && item.assigneeName !== filters.assignee) return false;
    if (filters.statusGroup && filters.statusGroup !== "all" && item.statusGroup !== filters.statusGroup) return false;
    if (query && ![item.title, item.context, item.assigneeName, item.sourceCode].join(" ").toLocaleLowerCase("pt-BR").includes(query)) return false;
    return true;
  });
}

export function workItemStats(items = []) {
  return items.reduce((stats, item) => {
    if (item.isTerminal) return stats;
    stats.open += 1;
    if (item.isOverdue) stats.overdue += 1;
    if (item.statusGroup === "doing") stats.doing += 1;
    if (item.statusGroup === "waiting") stats.waiting += 1;
    return stats;
  }, { open: 0, overdue: 0, doing: 0, waiting: 0 });
}
