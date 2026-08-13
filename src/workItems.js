import { isOverdue } from "./domain.js";

const TERMINAL_QUALITY_STATUSES = new Set(["Resolvido", "Encerrado", "Cancelado", "Concluída", "Cancelada"]);

function qualityStatusGroup(item) {
  if (TERMINAL_QUALITY_STATUSES.has(item.status)) return "waiting";
  if (["Em tratamento", "Em andamento"].includes(item.status)) return "doing";
  return "todo";
}

function qualityDue(item) {
  return item.dueDate || "";
}

function qualityWorkItem(item) {
  const isAction = item.type === "action";
  const source = isAction ? "quality_action" : "quality_error";
  const statusGroup = qualityStatusGroup(item);
  return {
    id: `${source}:${item.id}`,
    source,
    sourceRecordId: item.id,
    sourceCode: item.code || "",
    title: item.title || (isAction ? "Ação operacional" : "Ocorrência operacional"),
    context: item.description || (isAction ? "Ação de qualidade" : "Ocorrência de qualidade"),
    assigneeEmployeeId: item.assigneeId || "",
    assigneeName: item.assigneeName || "Não atribuído",
    dueAt: qualityDue(item),
    priorityRank: Number(item.priorityRank || 1),
    sourceStatus: item.status || "",
    statusGroup,
    isOverdue: Boolean(qualityDue(item)) && !TERMINAL_QUALITY_STATUSES.has(item.status) && new Date(`${qualityDue(item)}T23:59:59`) < new Date(),
    quickTransitions: isAction ? ["doing", "waiting"] : ["doing", "waiting"],
    openTarget: { resource: "new_gestao_erros_operacionais.html", params: isAction ? { actionId: item.id } : { errorId: item.id } },
  };
}

export function normalizeWorkItems(state = {}) {
  const tasks = (state.tasks || []).map((task) => ({
    id: `task:${task.id}`,
    source: task.sourceType === "quote" ? "quote_followup" : "task",
    sourceRecordId: task.id,
    sourceCode: task.sourceCode || task.quoteCode || "",
    title: task.title,
    context: task.description || task.quoteTitle || "Tarefa Planner",
    assigneeEmployeeId: task.assigneeId || "",
    assigneeName: task.assigneeName || "Não atribuído",
    dueAt: task.dueDate || "",
    priorityRank: ({ urgent: 0, high: 1, medium: 2, low: 3 }[task.priority] ?? 2),
    sourceStatus: task.status,
    statusGroup: task.status === "done" ? "waiting" : task.status,
    isOverdue: isOverdue(task),
    quickTransitions: task.status === "done" ? [] : ["doing", "waiting", "done"],
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
    if (filters.source && filters.source !== "all" && item.source !== filters.source) return false;
    if (filters.assignee && filters.assignee !== "all" && item.assigneeEmployeeId !== filters.assignee && item.assigneeName !== filters.assignee) return false;
    if (filters.statusGroup && filters.statusGroup !== "all" && item.statusGroup !== filters.statusGroup) return false;
    if (query && ![item.title, item.context, item.assigneeName, item.sourceCode].join(" ").toLocaleLowerCase("pt-BR").includes(query)) return false;
    return true;
  });
}

export function workItemStats(items = []) {
  return items.reduce((stats, item) => {
    if (item.statusGroup !== "waiting") stats.open += 1;
    if (item.isOverdue) stats.overdue += 1;
    if (item.statusGroup === "doing") stats.doing += 1;
    if (item.statusGroup === "waiting") stats.waiting += 1;
    return stats;
  }, { open: 0, overdue: 0, doing: 0, waiting: 0 });
}
