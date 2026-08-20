export const STATUSES = [
  { id: "todo", label: "A fazer", tone: "neutral" },
  { id: "doing", label: "Em andamento", tone: "action" },
  { id: "waiting", label: "Aguardando", tone: "warning" },
  { id: "done", label: "Concluído", tone: "success" },
];

export const PRIORITIES = [
  { id: "high", label: "Alta", tone: "danger" },
  { id: "medium", label: "Média", tone: "warning" },
  { id: "low", label: "Baixa", tone: "neutral" },
];

export const QUOTE_STATUSES = ["Nova", "Em análise", "Aguardando fornecedor", "Respondida"];

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export const TASK_SOURCES = [
  { id: "manual", label: "Manual", tone: "neutral" },
  { id: "quote", label: "Cotação", tone: "action" },
  { id: "quality", label: "Qualidade", tone: "warning" },
];

export const statusById = (id) => STATUSES.find((item) => item.id === id) || STATUSES[0];
export const priorityById = (id) => PRIORITIES.find((item) => item.id === id) || PRIORITIES[1];
export const sourceById = (id) => TASK_SOURCES.find((item) => item.id === id) || TASK_SOURCES[0];

export function quoteTaskTitle(quote = {}) {
  const reference = String(quote.code || quote.title || "").trim();
  return `Acompanhar ${reference || "cotação"}`;
}

export function buildOptimisticTask(input, parentTaskId = null) {
  const quoteId = input.quoteId || null;
  const assigneeNames = normalizeAssigneeNames(input.assigneeNames || input.assigneeName);
  return {
    id: `optimistic-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
    title: String(input.title || "Nova tarefa").trim(),
    description: input.description || "",
    status: input.status || "todo",
    priority: input.priority || "medium",
    dueDate: input.dueDate || "",
    assigneeNames,
    assigneeName: assigneeNames.join(", "),
    teamName: input.teamName || "Sem equipe",
    quoteId,
    quoteCode: input.quoteCode || "",
    quoteTitle: input.quoteTitle || "",
    sourceType: input.sourceType || (quoteId ? "quote" : "manual"),
    sourceId: input.sourceId || quoteId,
    sourceCode: input.sourceCode || input.quoteCode || "",
    sourceLabel: input.sourceLabel || (quoteId ? "Pedido de cotação" : "Tarefa manual"),
    blockedReason: input.blockedReason || "",
    parentTaskId,
    comments: [],
    attachments: [],
    history: [],
    syncStatus: "syncing",
  };
}

export function normalizeAssigneeNames(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const unique = [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))];
  if (unique.length > 1) return unique.filter((item) => item !== "Não atribuído");
  return unique.length ? unique : ["Não atribuído"];
}

export function buildAssigneeOptions(employees = []) {
  return ["Não atribuído", ...new Set(employees.map((employee) => String(employee?.name || "").trim()).filter(Boolean))];
}

export function buildTaskCreationInput(input = {}) {
  if (input.quoteId) return { ...input, sourceType: "quote" };
  return { ...input, quoteId: undefined, sourceType: "manual", sourceId: undefined, sourceCode: undefined, quoteCode: undefined, quoteTitle: undefined };
}

export function mentionedEmployees(text, employees = []) {
  const normalizedText = normalizeText(text);
  return employees.filter((employee) => {
    const name = normalizeText(employee?.name);
    return name && normalizedText.includes(`@${name}`);
  });
}

function updateTaskInState(state, taskId, update) {
  return {
    ...state,
    tasks: state.tasks.map((task) => task.id === taskId ? update(task) : task),
  };
}

export function applyOptimisticTaskPatch(state, taskId, patch) {
  return updateTaskInState(state, taskId, (task) => ({ ...task, ...patch, syncStatus: "syncing" }));
}

export function addOptimisticComment(state, taskId, text) {
  const comment = {
    id: `optimistic-comment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text: String(text || "").trim(),
    createdAt: new Date().toISOString(),
    author: "Você",
    syncStatus: "syncing",
  };
  return updateTaskInState(state, taskId, (task) => ({ ...task, comments: [...(task.comments || []), comment] }));
}

export function addOptimisticAttachment(state, taskId, file) {
  const attachment = {
    id: `optimistic-attachment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file?.name || "Arquivo",
    link: "",
    createdAt: new Date().toISOString(),
    syncStatus: "syncing",
  };
  return updateTaskInState(state, taskId, (task) => ({ ...task, attachments: [...(task.attachments || []), attachment] }));
}

export function isOverdue(task, today = new Date()) {
  if (!task.dueDate || task.status === "done") return false;
  return new Date(`${task.dueDate}T23:59:59`) < today;
}

export function isDueToday(task, today = new Date()) {
  if (!task.dueDate || task.status === "done") return false;
  const date = new Date(`${task.dueDate}T12:00:00`);
  return date.toDateString() === today.toDateString();
}

export function isBlocked(task) {
  return task.status !== "done" && Boolean(String(task.blockedReason || "").trim());
}

export function formatDate(value) {
  if (!value) return "Sem prazo";
  return SHORT_DATE_FORMATTER.format(new Date(`${value}T12:00:00`)).replace(" de ", " ");
}

export function formatLongDate(value) {
  if (!value) return "Sem prazo definido";
  return LONG_DATE_FORMATTER.format(new Date(`${value}T12:00:00`));
}

export function filterTasks(tasks, filters) {
  const query = normalizeText(filters.query);
  const queryTokens = query.split(/\s+/).filter(Boolean);
  const selectedValues = (value) => Array.isArray(value) ? value : value ? [value] : [];
  const statusValues = selectedValues(filters.status);
  const assigneeValues = selectedValues(filters.assignee);
  const priorityValues = selectedValues(filters.priority);
  const sourceValues = selectedValues(filters.source);
  return tasks.filter((task) => {
    const assigneeSearch = [task.assigneeName, ...(Array.isArray(task.assigneeNames) ? task.assigneeNames : [])].filter(Boolean).join(" ");
    const matchesQuery = !query || [task.title, task.quoteTitle, assigneeSearch, task.teamName]
      .some((value) => {
        const normalizedValue = normalizeText(value);
        return normalizedValue.includes(query) || queryTokens.every((token) => normalizedValue.includes(token));
      });
    const matchesStatus = !statusValues.length || statusValues.includes(task.status);
    const matchesPriority = !priorityValues.length || priorityValues.includes(task.priority);
    const matchesSource = !sourceValues.length || sourceValues.includes(task.sourceType);
    const taskAssignees = task.assigneeNames || normalizeAssigneeNames(task.assigneeName);
    const matchesAssignee = !assigneeValues.length || assigneeValues.some((value) => taskAssignees.includes(value));
    const matchesTeam = !filters.team || task.teamName === filters.team;
    const matchesBlocked = !filters.blocked || isBlocked(task);
    return matchesQuery && matchesStatus && matchesPriority && matchesSource && matchesAssignee && matchesTeam && matchesBlocked;
  });
}

export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;
    return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
  });
}

export function taskStats(tasks, today = new Date()) {
  return tasks.reduce((stats, task) => {
    if (task.status !== "done") stats.open += 1;
    if (isOverdue(task, today)) stats.overdue += 1;
    if (isDueToday(task, today)) stats.today += 1;
    if (task.status === "waiting") stats.waiting += 1;
    return stats;
  }, { open: 0, overdue: 0, today: 0, waiting: 0 });
}
