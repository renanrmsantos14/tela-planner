export const STATUSES = [
  { id: "todo", label: "A fazer", tone: "neutral" },
  { id: "waiting", label: "Aguardando", tone: "warning" },
  { id: "doing", label: "Em andamento", tone: "action" },
  { id: "done", label: "Concluído", tone: "success" },
];

export const PRIORITIES = [
  { id: "low", label: "Baixa", tone: "neutral" },
  { id: "medium", label: "Média", tone: "warning" },
  { id: "high", label: "Alta", tone: "danger" },
];

export const QUOTE_STATUSES = ["Nova", "Em análise", "Aguardando fornecedor", "Respondida"];

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
const APP_TIME_ZONE = "America/Sao_Paulo";
const DATE_PART_FORMATTER = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

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

export const EMPTY_WAITING_CONTEXT = Object.freeze({
  subject: "",
  onType: "employee",
  onIds: [],
  onNames: [],
  onId: "",
  onName: "",
  expectedDate: "",
  note: "",
});

function uniqueStrings(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(values.flatMap((item) => String(item || "").split(",")).map((item) => item.trim()).filter(Boolean))];
}

export function normalizeWaitingContext(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const onType = ["employee", "team", "external"].includes(source.onType) ? source.onType : "employee";
  const onIds = uniqueStrings(source.onIds ?? source.onId);
  const onNames = uniqueStrings(source.onNames ?? source.onName);
  const externalName = source.onName ?? (Array.isArray(source.onNames) ? source.onNames.join(", ") : source.onNames);
  return {
    // Preserve o texto enquanto ele está sendo editado; trim em cada render
    // remove o espaço recém-digitado antes que o usuário consiga continuar.
    subject: String(source.subject ?? ""),
    onType,
    onIds,
    onNames,
    onId: onIds[0] || "",
    onName: onType === "external" ? String(externalName ?? "") : onNames.join(", "),
    expectedDate: String(source.expectedDate || "").slice(0, 10),
    note: String(source.note ?? ""),
  };
}

function sameIdentifier(left, right) {
  return String(left || "").replace(/[{}]/g, "").toLowerCase() === String(right || "").replace(/[{}]/g, "").toLowerCase();
}

export function waitingReturnTargetIds(task, teams = []) {
  const context = normalizeWaitingContext(task?.waitingContext);
  const targetIds = Array.isArray(context.onIds) && context.onIds.length
    ? context.onIds
    : context.onId ? [context.onId] : [];
  const targetNames = Array.isArray(context.onNames) && context.onNames.length
    ? context.onNames
    : context.onName ? [context.onName] : [];
  if (context.onType === "employee") return targetIds;
  if (context.onType === "external") return [];
  return teams
    .filter((team) => targetIds.some((id) => sameIdentifier(id, team.id)) || targetNames.some((name) => normalizeText(name) === normalizeText(team.name)))
    .flatMap((team) => team.memberIds || team.members || []);
}

export function isWaitingReturnResponsible(task, employee, teams = []) {
  if (task?.status !== "waiting" || !employee?.id) return false;
  const context = normalizeWaitingContext(task.waitingContext);
  const targetNames = Array.isArray(context.onNames) && context.onNames.length
    ? context.onNames
    : context.onName ? [context.onName] : [];
  return waitingReturnTargetIds(task, teams).some((id) => sameIdentifier(id, employee.id))
    || (context.onType === "employee" && targetNames.some((name) => normalizeText(name) === normalizeText(employee.name)));
}

export function canRegisterWaitingReturn(task, employee, teams = []) {
  if (task?.status !== "waiting" || !employee?.id) return false;
  return (task.creatorEmployeeId && sameIdentifier(task.creatorEmployeeId, employee.id))
    || (task.creatorUserId && employee.userId && sameIdentifier(task.creatorUserId, employee.userId))
    || isWaitingReturnResponsible(task, employee, teams);
}

export function taskDisplayDueDate(task, employee, teams = []) {
  const expectedDate = normalizeWaitingContext(task?.waitingContext).expectedDate;
  return expectedDate && isWaitingReturnResponsible(task, employee, teams) ? expectedDate : task?.dueDate || "";
}

export function validateWaitingContext(status, value) {
  if (status !== "waiting") return { allowed: true, error: "" };
  const context = normalizeWaitingContext(value);
  if (!context.subject.trim()) {
    return { allowed: false, error: "Informe o que está sendo aguardado." };
  }
  if (context.onType === "external") {
    if (!context.onNames.length) return { allowed: false, error: "Informe quem está sendo aguardado." };
    return { allowed: true, error: "" };
  }
  if (!context.onIds.length || !context.onNames.length) {
    return { allowed: false, error: "Informe de quem está sendo aguardado o retorno." };
  }
  return { allowed: true, error: "" };
}

export function waitingContextSummary(value) {
  const context = normalizeWaitingContext(value);
  const subject = context.subject.trim();
  if (!subject || !context.onNames.length) return "";
  const parts = [`Aguardando ${subject}`, context.onNames.join(", ")];
  if (context.expectedDate) parts.push(`até ${formatDate(context.expectedDate)}`);
  return parts.join(" · ");
}

export function quoteTaskTitle(quote = {}) {
  const reference = String(quote.code || quote.title || "").trim();
  return `Acompanhar ${reference || "cotação"}`;
}

export function buildOptimisticTask(input, parentTaskId = null) {
  const quoteId = input.quoteId || null;
  const assigneeNames = normalizeAssigneeNames(input.assigneeNames || input.assigneeName);
  const assignmentMode = input.assignmentMode === "team" ? "team" : "people";
  const teamIds = assignmentMode === "team" ? uniqueStrings(input.teamIds ?? input.teamId) : [];
  const optimisticAssigneeNames = assignmentMode === "team"
    ? normalizeAssigneeNames(input.assigneeNames || input.assigneeName)
    : assigneeNames;
  const optimisticTeamNames = assignmentMode === "team" ? uniqueStrings(input.teamNames ?? input.teamName) : [];
  return {
    id: `optimistic-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
    title: String(input.title || "Nova tarefa").trim(),
    description: input.description || "",
    status: input.status || "todo",
    priority: input.priority || "medium",
    dueDate: input.dueDate || "",
    assignmentMode,
    teamIds,
    teamNames: optimisticTeamNames,
    teamId: teamIds[0] || "",
    assigneeNames: optimisticAssigneeNames,
    assigneeName: optimisticAssigneeNames.join(", "),
    teamName: optimisticTeamNames.join(", ") || "Sem equipe",
    quoteId,
    quoteCode: input.quoteCode || "",
    quoteTitle: input.quoteTitle || "",
    sourceType: input.sourceType || (quoteId ? "quote" : "manual"),
    sourceId: input.sourceId || quoteId,
    sourceCode: input.sourceCode || input.quoteCode || "",
    sourceLabel: input.sourceLabel || (quoteId ? "Pedido de cotação" : "Tarefa manual"),
    parentTaskId,
    waitingContext: normalizeWaitingContext(input.waitingContext),
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
  const names = [...new Set(employees.map((employee) => String(employee?.name || "").trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }));
  return ["Não atribuído", ...names];
}

// "Não atribuído" é o fallback exibido quando nenhum responsável está selecionado,
// não um registro selecionável — por isso fica de fora das opções do seletor múltiplo.
export function buildEmployeeAssigneeOptions(employees = []) {
  return [...new Set(employees.map((employee) => String(employee?.name || "").trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }));
}

export function normalizeTeam(team = {}) {
  return {
    id: String(team.id || ""),
    name: String(team.name || "").trim(),
    memberIds: [...new Set((team.memberIds || team.members || []).map((id) => String(id || "").trim()).filter(Boolean))],
  };
}

export function teamResponsibilitySummary(team = {}, tasks = [], employees = []) {
  const normalizedTeam = normalizeTeam(team);
  const teamTasks = tasks.filter((task) => {
    if (["done", "cancelled"].includes(task?.status)) return false;
    if (task?.assignmentMode !== "team") return false;
    const taskTeamIds = uniqueStrings(task?.teamIds ?? task?.teamId);
    return taskTeamIds.some((id) => sameIdentifier(id, normalizedTeam.id))
      || (!taskTeamIds.length && normalizeText(task?.teamName) === normalizeText(normalizedTeam.name));
  });

  return {
    totalTaskCount: teamTasks.length,
    members: normalizedTeam.memberIds.map((memberId) => {
      const employee = employees.find((item) => sameIdentifier(item.id, memberId));
      return { id: memberId, name: employee?.name || "Membro sem cadastro", apelido: employee?.apelido || "" };
    }),
  };
}

export function resolveTaskAssignment(input = {}, teams = [], employees = []) {
  const requestedMode = input.assignmentMode === "team" ? "team" : "people";
  const employeeById = new Map(employees.map((employee) => [String(employee.id), employee]));
  const employeeByName = new Map(employees.map((employee) => [String(employee.name), employee]));
  const teamIds = uniqueStrings(input.teamIds ?? input.teamId);
  if (requestedMode === "team" && teamIds.length) {
    const selectedTeams = teams.map(normalizeTeam).filter((team) => teamIds.includes(team.id));
    const memberIds = [...new Set(selectedTeams.flatMap((team) => team.memberIds).concat((selectedTeams.length ? [] : input.assigneeIds || []).map((id) => String(id || "")).filter(Boolean)))];
    const memberNames = memberIds.map((id) => employeeById.get(id)?.name).filter(Boolean);
    const teamNames = selectedTeams.map((team) => team.name).filter(Boolean);
    return {
      assignmentMode: "team",
      teamIds,
      teamNames: teamNames.length ? teamNames : uniqueStrings(input.teamNames ?? input.teamName),
      teamId: teamIds[0] || "",
      teamName: teamNames.length ? teamNames.join(", ") : String(input.teamName || "").trim(),
      assigneeIds: memberIds,
      assigneeNames: memberNames.length ? memberNames : normalizeAssigneeNames(input.assigneeNames || input.assigneeName),
    };
  }
  const assigneeNames = normalizeAssigneeNames(input.assigneeNames || input.assigneeName).filter((name) => name !== "Não atribuído");
  const assigneeIds = [...new Set((input.assigneeIds || assigneeNames.map((name) => employeeByName.get(name)?.id)).filter(Boolean).map(String))];
  return {
    assignmentMode: "people",
    teamIds: [],
    teamNames: [],
    teamId: "",
    teamName: input.assignmentMode === "people" ? "" : String(input.teamName || "").trim(),
    assigneeIds,
    assigneeNames: assigneeNames.length ? assigneeNames : ["Não atribuído"],
  };
}

export function migrateLegacyTeams(tasks = [], employees = [], teamNames = []) {
  const names = [...new Set([
    ...teamNames,
    ...tasks.map((task) => task.teamName),
  ].map((name) => String(name || "").trim()).filter((name) => name && name !== "Sem equipe"))];
  const teams = names.map((name) => ({
    id: `team-${normalizeText(name).replace(/[^a-z0-9]+/g, "-")}`,
    name,
    memberIds: [...new Set(tasks.filter((task) => task.teamName === name).flatMap((task) => task.assigneeIds || employees.filter((employee) => (task.assigneeNames || []).includes(employee.name)).map((employee) => employee.id)))],
  }));
  const teamByName = new Map(teams.map((team) => [team.name, team]));
  return {
    teams,
    tasks: tasks.map((task) => {
      const team = teamByName.get(task.teamName);
      const waitingContext = normalizeWaitingContext(task.waitingContext);
      const waitingTeams = waitingContext.onType === "team"
        ? teams.filter((item) => waitingContext.onIds.includes(item.id) || waitingContext.onNames.includes(item.name))
        : [];
      const next = waitingTeams.length
        ? { waitingContext: { ...waitingContext, onIds: waitingTeams.map((item) => item.id), onNames: waitingTeams.map((item) => item.name), onId: waitingTeams[0]?.id || "", onName: waitingTeams.map((item) => item.name).join(", ") } }
        : { waitingContext };
      return team ? { ...task, ...next, assignmentMode: "team", teamIds: [team.id], teamNames: [team.name], teamId: team.id } : { ...task, ...next, assignmentMode: "people", teamIds: [], teamNames: [], teamId: "", teamName: "" };
    }),
  };
}

export function buildTaskCreationInput(input = {}) {
  if (input.quoteId) return { ...input, sourceType: "quote" };
  return { ...input, quoteId: undefined, sourceType: "manual", sourceId: undefined, sourceCode: undefined, quoteCode: undefined, quoteTitle: undefined };
}

export function mentionedEmployees(text, employees = []) {
  const normalizedText = normalizeText(text);
  if (/(^|[^a-z0-9_])@(all|todos)(?=$|[^a-z0-9_])/i.test(normalizedText)) return employees;
  return employees.filter((employee) => {
    const names = [employee?.name, employee?.apelido, employee?.mentionSearchText].filter(Boolean).map(normalizeText);
    return names.some((name) => new RegExp(`(^|[^a-z0-9_])@${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9_])`, "i").test(normalizedText));
  });
}

function dateKeyInAppTimeZone(value = new Date()) {
  const parts = DATE_PART_FORMATTER.formatToParts(value).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function shiftDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getDueBucket(task, today = new Date()) {
  if (!task?.dueDate || ["done", "cancelled"].includes(task.status)) return "none";
  const dueDate = String(task.dueDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return "none";
  const todayKey = dateKeyInAppTimeZone(today);
  if (dueDate < todayKey) return "overdue";
  if (dueDate === todayKey) return "today";
  if (dueDate === shiftDateKey(todayKey, 1)) return "tomorrow";
  return "upcoming";
}

export function getDueBucketForEmployee(task, employee, teams = [], today = new Date()) {
  return getDueBucket({ ...task, dueDate: taskDisplayDueDate(task, employee, teams) }, today);
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

export function addOptimisticAttachment(state, taskId, file, previewUrl = "") {
  const attachment = {
    id: `optimistic-attachment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file?.name || "Arquivo",
    link: "",
    mimeType: file?.type || "",
    size: file?.size || 0,
    previewUrl,
    createdAt: new Date().toISOString(),
    syncStatus: "syncing",
  };
  return updateTaskInState(state, taskId, (task) => ({ ...task, attachments: [...(task.attachments || []), attachment] }));
}

export function isOverdue(task, today = new Date()) {
  return getDueBucket(task, today) === "overdue";
}

export function isDueToday(task, today = new Date()) {
  return getDueBucket(task, today) === "today";
}

export function formatDate(value) {
  if (!value) return "Sem prazo";
  return SHORT_DATE_FORMATTER.format(new Date(`${value}T12:00:00`)).replace(" de ", " ");
}

export function formatLongDate(value) {
  if (!value) return "Sem prazo definido";
  return LONG_DATE_FORMATTER.format(new Date(`${value}T12:00:00`));
}

export function filterTasks(tasks, filters = {}, employee, teams = []) {
  const query = normalizeText(filters.query);
  const queryTokens = query.split(/\s+/).filter(Boolean);
  const selectedValues = (value) => Array.isArray(value) ? value : value ? [value] : [];
  const statusValues = new Set(selectedValues(filters.status));
  const assigneeValues = selectedValues(filters.assignee);
  const priorityValues = new Set(selectedValues(filters.priority));
  const sourceValues = new Set(selectedValues(filters.source));
  const teamValues = selectedValues(filters.team);
  return tasks.filter((task) => {
    if (statusValues.size && !statusValues.has(task.status)) return false;
    if (priorityValues.size && !priorityValues.has(task.priority)) return false;
    if (sourceValues.size && !sourceValues.has(task.sourceType)) return false;
    if (assigneeValues.length) {
      const taskAssignees = task.assigneeNames || normalizeAssigneeNames(task.assigneeName);
      const matchesWaitingReturn = employee && isWaitingReturnResponsible(task, employee, teams)
        && assigneeValues.some((value) => normalizeText(value) === normalizeText(employee.name));
      if (!assigneeValues.some((value) => taskAssignees.includes(value)) && !matchesWaitingReturn) return false;
    }
    if (teamValues.length) {
      const taskTeams = task.teamNames?.length ? task.teamNames : [task.teamName].filter(Boolean);
      if (!teamValues.some((value) => taskTeams.includes(value))) return false;
    }
    if (!query) return true;
    const assigneeSearch = [task.assigneeName, ...(Array.isArray(task.assigneeNames) ? task.assigneeNames : [])].filter(Boolean).join(" ");
    return [task.title, task.quoteTitle, assigneeSearch, task.teamName].some((value) => {
      const normalizedValue = normalizeText(value);
      return normalizedValue.includes(query) || queryTokens.every((token) => normalizedValue.includes(token));
    });
  });
}

export function sortTasks(tasks, employee, teams = []) {
  return [...tasks].sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;
    return (taskDisplayDueDate(a, employee, teams) || "9999-12-31").localeCompare(taskDisplayDueDate(b, employee, teams) || "9999-12-31");
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
