import { getDueBucket, normalizeAssigneeNames, taskDisplayDueDate, waitingReturnTargetIds } from "./domain.js";

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
    assigneeProfiles: item.assigneeProfiles || [],
    dueAt: qualityDue(item),
    dueBucket: qualityDue(item) && !isTerminal ? getDueBucket({ dueDate: qualityDue(item), status: statusGroup }) : "none",
    priority: cleanText(item.priority),
    priorityRank: Number(item.priorityRank || 1),
    teamName: cleanText(item.teamName),
    sourceStatus: cleanText(item.status),
    statusGroup,
    statusLabel: cleanText(item.status, TASK_STATUS_LABELS[statusGroup]),
    isTerminal,
    isOverdue: Boolean(qualityDue(item)) && !isTerminal && getDueBucket({ dueDate: qualityDue(item), status: statusGroup }) === "overdue",
    quickTransitions: isTerminal ? [] : ["doing", "waiting"],
    openTarget: { resource: "new_gestao_erros_operacionais.html", params: isAction ? { actionId: item.id } : { errorId: item.id } },
  };
}

export function normalizeWorkItems(state = {}, employee) {
  const tasks = (state.tasks || []).map((task) => {
    const dueAt = taskDisplayDueDate(task, employee, state.teams);
    return {
      id: `task:${task.id}`,
      source: task.sourceType === "quote" ? "quote_followup" : "task",
      sourceRecordId: task.id,
      sourceCode: cleanText(task.sourceCode || task.quoteCode),
      title: taskTitle(task),
      context: taskContext(task),
      assigneeEmployeeId: task.assigneeId || task.assigneeIds?.[0] || "",
      assigneeIds: task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []),
      assigneeNames: task.assigneeNames || normalizeAssigneeNames(task.assigneeName),
      assigneeName: cleanText(task.assigneeName, "Não atribuído"),
      assigneeProfiles: task.assigneeProfiles || [],
      dueAt: cleanText(dueAt),
      dueBucket: getDueBucket({ ...task, dueDate: dueAt }),
      waitingTargetIds: waitingReturnTargetIds(task, state.teams),
      priority: cleanText(task.priority),
      priorityRank: ({ urgent: 0, high: 1, medium: 2, low: 3 }[task.priority] ?? 2),
      teamName: cleanText(task.teamName),
      sourceStatus: cleanText(task.status),
      statusGroup: task.status,
      statusLabel: TASK_STATUS_LABELS[task.status] || cleanText(task.status, "A fazer"),
      isTerminal: ["done", "cancelled"].includes(task.status),
      isOverdue: getDueBucket({ ...task, dueDate: dueAt }) === "overdue",
      quickTransitions: ["done", "cancelled"].includes(task.status) ? [] : ["doing", "waiting", "done"],
      openTarget: task.quoteId
        ? { resource: "cr40f_TelaPedirCotacao.html", params: { view: "recent", recordId: task.quoteId } }
        : { resource: "new_TelaPlanner.html", params: { taskId: task.id } },
      parentTaskId: task.parentTaskId || null,
    };
  });
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
  const selectedValues = (value) => Array.isArray(value) ? value : value ? [value] : [];
  const statusValues = new Set(selectedValues(filters.status));
  const assigneeValues = selectedValues(filters.assignee);
  const priorityValues = new Set(selectedValues(filters.priority));
  const sourceValues = new Set(selectedValues(filters.source));
  return items.filter((item) => {
    const assigneeNames = item.assigneeNames || (item.assigneeName ? [item.assigneeName] : []);
    if (assigneeValues.length && !assigneeValues.some((value) => String(value) === String(item.assigneeEmployeeId) || assigneeNames.includes(value) || String(item.assigneeName || "").includes(String(value)))) return false;
    if (statusValues.size && !statusValues.has(item.statusGroup)) return false;
    if (priorityValues.size && !priorityValues.has(item.priority)) return false;
    if (sourceValues.size) {
      const matchesSource = sourceValues.has(item.source)
        || (sourceValues.has("manual") && item.source === "task")
        || (sourceValues.has("quote") && item.source === "quote_followup")
        || (sourceValues.has("quality") && ["quality_error", "quality_action"].includes(item.source));
      if (!matchesSource) return false;
    }
    if (filters.team && item.teamName !== filters.team) return false;
    return !query || [item.title, item.context, item.assigneeName, item.sourceCode, item.teamName].join(" ").toLocaleLowerCase("pt-BR").includes(query);
  });
}

export function isAssignedToEmployee(item, employee) {
  if (!employee) return false;
  const employeeId = String(employee.id || "");
  const employeeName = String(employee.name || "");
  const assigneeIds = [item.assigneeEmployeeId, ...(item.assigneeIds || []), ...(item.waitingTargetIds || [])].filter(Boolean).map(String);
  const assigneeNames = item.assigneeNames || (item.assigneeName ? [item.assigneeName] : []);
  return assigneeIds.includes(employeeId) || assigneeNames.includes(employeeName);
}

export function workItemStats(items = []) {
  return items.reduce((stats, item) => {
    if (item.isTerminal) return stats;
    stats.open += 1;
    if (item.isOverdue) stats.overdue += 1;
    if (item.dueBucket === "today") stats.today += 1;
    if (item.dueBucket === "tomorrow") stats.tomorrow += 1;
    if (item.isOverdue || ["today", "tomorrow"].includes(item.dueBucket)) stats.alertCount += 1;
    if (item.statusGroup === "doing") stats.doing += 1;
    if (item.statusGroup === "waiting") stats.waiting += 1;
    return stats;
  }, { open: 0, overdue: 0, today: 0, tomorrow: 0, doing: 0, waiting: 0, alertCount: 0 });
}
