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
  { id: "urgent", label: "Urgente", tone: "danger" },
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

export const PERSONAL_TAG_COLORS = [
  "#1d5ce8",
  "#2d796f",
  "#b87900",
  "#b84b5b",
  "#7052a3",
  "#4f6b82",
];
export const DEFAULT_PERSONAL_TAG_COLOR = PERSONAL_TAG_COLORS[0];

export function normalizePersonalTag(value = {}, ownerUserId = "") {
  const source = value && typeof value === "object" ? value : {};
  const color = PERSONAL_TAG_COLORS.includes(source.color) ? source.color : DEFAULT_PERSONAL_TAG_COLOR;
  return {
    id: String(source.id || "").trim(),
    name: String(source.name || source.nome || "").trim().slice(0, 32),
    color,
    sortOrder: Number.isFinite(Number(source.sortOrder)) ? Math.max(0, Number(source.sortOrder)) : 0,
    archived: Boolean(source.archived),
    ownerUserId: String(source.ownerUserId || ownerUserId || "").replace(/[{}]/g, ""),
  };
}

export function normalizePersonalTagIds(value) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(values.map((item) => String(item || "").trim()).filter(Boolean))];
}

export function validatePersonalTag(input = {}, existing = []) {
  const name = String(input.name || "").trim().slice(0, 32);
  if (!name) return { valid: false, error: "Informe um nome para a tag." };
  const normalized = normalizeText(name);
  const duplicate = existing.some((tag) => normalizeText(tag.name) === normalized && tag.id !== input.id);
  if (duplicate) return { valid: false, error: "Você já tem uma tag com esse nome." };
  return { valid: true, error: "", value: normalizePersonalTag({ ...input, name }) };
}

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

export function responsibilityFromIds(ids = [], primaryId = "") {
  const uniqueIds = uniqueStrings(ids);
  const requestedPrimary = String(primaryId || "").trim();
  const primaryAssigneeId = uniqueIds.find((id) => sameIdentifier(id, requestedPrimary)) || uniqueIds[0] || "";
  const orderedIds = primaryAssigneeId
    ? [primaryAssigneeId, ...uniqueIds.filter((id) => !sameIdentifier(id, primaryAssigneeId))]
    : uniqueIds;
  return {
    assigneeIds: orderedIds,
    primaryAssigneeId,
    consultantIds: orderedIds.filter((id) => !sameIdentifier(id, primaryAssigneeId)),
  };
}

export function validateTeamComposition(memberIds = [], primaryMemberId = "") {
  const members = uniqueStrings(memberIds);
  if (!members.length) return { valid: false, error: "Inclua pelo menos um membro na equipe." };
  if (members.length > 1 && !members.some((id) => sameIdentifier(id, primaryMemberId))) {
    return { valid: false, error: "Escolha o responsável principal da equipe." };
  }
  return { valid: true, error: "", primaryMemberId: members.length === 1 ? members[0] : String(primaryMemberId).trim() };
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

export function isTaskVisibleToEmployee(task = {}, employee, teams = []) {
  if (!task.restrictedVisibility) return true;
  if (!employee?.id && !employee?.userId) return false;

  if (sameIdentifier(task.creatorEmployeeId, employee.id)
    || (task.creatorUserId && employee.userId && sameIdentifier(task.creatorUserId, employee.userId))) return true;

  const assigneeIds = task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []);
  if (assigneeIds.some((id) => sameIdentifier(id, employee.id))) return true;

  const assigneeNames = task.assigneeNames || normalizeAssigneeNames(task.assigneeName);
  if (assigneeNames.some((name) => normalizeText(name) === normalizeText(employee.name))) return true;

  const taskTeamIds = uniqueStrings(task.teamIds ?? task.teamId);
  const taskTeamNames = uniqueStrings(task.teamNames ?? task.teamName);
  return teams
    .filter((team) => taskTeamIds.some((id) => sameIdentifier(id, team.id)) || taskTeamNames.some((name) => normalizeText(name) === normalizeText(team.name)))
    .some((team) => (team.memberIds || team.members || []).some((id) => sameIdentifier(id, employee.id)));
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

export function quoteTitle(quote = {}) {
  const requester = String(quote.clientContact || "").trim();
  return requester ? `Cotação - ${requester}` : "Cotação";
}

export function isAutomaticQuoteTitle(quote = {}) {
  const title = String(quote.title || "").trim();
  return !title || title === "Cotação" || title === "Nova cotação" || title === quoteTitle(quote);
}

export function quoteTaskTitle(quote = {}) {
  return quoteTitle(quote);
}

export function isAutomaticQuoteTaskTitle(task = {}, quote = {}) {
  const title = String(task.title || "").trim();
  const previousAutomatic = quoteTitle(quote);
  const legacyAutomatic = `Acompanhar ${String(quote.code || quote.title || "cotação").trim()}`;
  return !title || title === previousAutomatic || title === legacyAutomatic;
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
  const responsibility = responsibilityFromIds(
    input.assigneeIds || [...(input.primaryAssigneeId ? [input.primaryAssigneeId] : []), ...(input.consultantIds || [])],
    input.primaryAssigneeId || input.assigneeId,
  );
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
    assigneeIds: responsibility.assigneeIds,
    primaryAssigneeId: responsibility.primaryAssigneeId,
    consultantIds: responsibility.consultantIds,
    primaryAssigneeName: optimisticAssigneeNames[0] || "",
    consultantNames: optimisticAssigneeNames.slice(1),
    assigneeName: optimisticAssigneeNames.join(", "),
    creatorEmployeeId: input.actorEmployeeId || "",
    creatorUserId: input.actorUserId || "",
    restrictedVisibility: Boolean(input.restrictedVisibility),
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
    returns: [],
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

export function hasTaskResponsible(task = {}) {
  const teamIds = uniqueStrings(task.teamIds ?? task.teamId);
  const assigneeIds = uniqueStrings(task.assigneeIds);
  if (task.assignmentMode === "team" && teamIds.length) return Boolean(task.primaryAssigneeId || assigneeIds.length);
  if (assigneeIds.length) return true;
  return normalizeAssigneeNames(task.assigneeNames ?? task.assigneeName)
    .some((name) => name !== "Não atribuído");
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
    iconName: String(team.iconName || team.icon || "users").trim() || "users",
    memberIds: [...new Set((team.memberIds || team.members || []).map((id) => String(id || "").trim()).filter(Boolean))],
    primaryMemberId: String(team.primaryMemberId || team.primaryAssigneeId || "").trim(),
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
    const normalizedTeams = teams.map(normalizeTeam);
    const selectedTeams = teamIds.map((id) => normalizedTeams.find((team) => sameIdentifier(team.id, id))).filter(Boolean);
    const memberIds = [...new Set(selectedTeams.flatMap((team) => team.memberIds).concat((selectedTeams.length ? [] : input.assigneeIds || []).map((id) => String(id || "")).filter(Boolean)))];
    const primaryTeam = selectedTeams[0];
    const responsibility = responsibilityFromIds(memberIds, primaryTeam?.primaryMemberId || memberIds[0]);
    const memberNames = memberIds.map((id) => employeeById.get(id)?.name).filter(Boolean);
    const teamNames = selectedTeams.map((team) => team.name).filter(Boolean);
    return {
      assignmentMode: "team",
      teamIds,
      teamNames: teamNames.length ? teamNames : uniqueStrings(input.teamNames ?? input.teamName),
      teamId: teamIds[0] || "",
      teamName: teamNames.length ? teamNames.join(", ") : String(input.teamName || "").trim(),
      assigneeIds: responsibility.assigneeIds,
      primaryAssigneeId: responsibility.primaryAssigneeId,
      consultantIds: responsibility.consultantIds,
      assigneeNames: memberNames.length ? [
        ...new Set([
          employeeById.get(responsibility.primaryAssigneeId)?.name,
          ...responsibility.consultantIds.map((id) => employeeById.get(id)?.name),
        ].filter(Boolean)),
      ] : normalizeAssigneeNames(input.assigneeNames || input.assigneeName),
      primaryAssigneeName: employeeById.get(responsibility.primaryAssigneeId)?.name || "",
      consultantNames: responsibility.consultantIds.map((id) => employeeById.get(id)?.name).filter(Boolean),
    };
  }
  const assigneeNames = normalizeAssigneeNames(input.assigneeNames || input.assigneeName).filter((name) => name !== "Não atribuído");
  const requestedIds = input.assigneeIds?.length
    ? input.assigneeIds
    : [...(input.primaryAssigneeId ? [input.primaryAssigneeId] : []), ...(input.consultantIds || [])].length
      ? [...(input.primaryAssigneeId ? [input.primaryAssigneeId] : []), ...(input.consultantIds || [])]
      : assigneeNames.map((name) => employeeByName.get(name)?.id);
  const responsibility = responsibilityFromIds(requestedIds, input.primaryAssigneeId || input.assigneeId);
  const resolvedNames = responsibility.assigneeIds.map((id) => employeeById.get(id)?.name).filter(Boolean);
  return {
    assignmentMode: "people",
    teamIds: [],
    teamNames: [],
    teamId: "",
    teamName: input.assignmentMode === "people" ? "" : String(input.teamName || "").trim(),
    assigneeIds: responsibility.assigneeIds,
    primaryAssigneeId: responsibility.primaryAssigneeId,
    consultantIds: responsibility.consultantIds,
    assigneeNames: resolvedNames.length ? resolvedNames : assigneeNames.length ? assigneeNames : ["Não atribuído"],
    primaryAssigneeName: employeeById.get(responsibility.primaryAssigneeId)?.name || "",
    consultantNames: responsibility.consultantIds.map((id) => employeeById.get(id)?.name).filter(Boolean),
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
  teams.forEach((team) => { team.primaryMemberId = team.memberIds[0] || ""; });
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
      if (!team) {
        const responsibility = responsibilityFromIds(task.assigneeIds, task.primaryAssigneeId || task.assigneeId);
        return { ...task, ...next, ...responsibility, assignmentMode: "people", teamIds: [], teamNames: [], teamId: "", teamName: "" };
      }
      const responsibility = responsibilityFromIds(task.assigneeIds, task.primaryAssigneeId || team.primaryMemberId);
      return { ...task, ...next, ...responsibility, assignmentMode: "team", teamIds: [team.id], teamNames: [team.name], teamId: team.id };
    }),
  };
}

export function buildTaskCreationInput(input = {}) {
  if (input.quoteId) return { ...input, sourceType: "quote" };
  return { ...input, quoteId: undefined, sourceType: "manual", sourceId: undefined, sourceCode: undefined, quoteCode: undefined, quoteTitle: undefined };
}

export function findCreatedMainTask(previousTasks = [], nextTasks = [], expectedTitle = "") {
  const previousIds = new Set(previousTasks.map((task) => String(task?.id || "")).filter(Boolean));
  const createdMainTasks = nextTasks.filter((task) => !task.parentTaskId && !previousIds.has(String(task.id || "")));
  const title = String(expectedTitle || "").trim();
  return createdMainTasks.find((task) => String(task.title || "").trim() === title)
    || createdMainTasks[0]
    || nextTasks.find((task) => !task.parentTaskId && String(task.title || "").trim() === title);
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

export function deriveExecutionActor(task, employees = null) {
  if (!task || task.status !== "doing") return null;
  const event = [...(task.history || [])]
    .filter((item) => item.field === "status" && item.nextValue === "doing")
    .sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")))
    .at(-1);
  if (!event) return null;
  const authorId = String(event.authorId || event.actorEmployeeId || "").replace(/[{}]/g, "").toLowerCase();
  const userId = String(event.authorUserId || "").replace(/[{}]/g, "").toLowerCase();
  const employee = (employees || []).find((item) =>
    (authorId && (String(item.userId || "").replace(/[{}]/g, "").toLowerCase() === authorId || String(item.id || "").replace(/[{}]/g, "").toLowerCase() === authorId)) ||
    (userId && String(item.userId || "").replace(/[{}]/g, "").toLowerCase() === userId));
  return {
    id: employee?.id || event.authorId || event.actorEmployeeId || "",
    userId: event.authorUserId || "",
    name: employees ? employee?.name || "Executor não identificado" : event.author || "Executor não identificado",
    occurredAt: event.createdAt || "",
    eventId: event.id || "",
  };
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

export function addOptimisticReturn(state, taskId, returnRecord) {
  return updateTaskInState(state, taskId, (task) => ({
    ...task,
    returns: [...(task.returns || []), { ...returnRecord, syncStatus: "syncing", attachments: returnRecord.attachments || [] }],
  }));
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
  const date = parseDisplayDate(value);
  if (!date) return "Sem prazo";
  return SHORT_DATE_FORMATTER.format(date).replace(" de ", " ");
}

export function formatLongDate(value) {
  const date = parseDisplayDate(value);
  if (!date) return "Sem prazo definido";
  return LONG_DATE_FORMATTER.format(date);
}

function parseDisplayDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  if (!text) return null;
  const dateKey = text.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  const date = dateKey ? new Date(`${dateKey}T12:00:00`) : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
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
  const personalTagValues = new Set(selectedValues(filters.personalTag));
  return tasks.filter((task) => {
    if (!isTaskVisibleToEmployee(task, employee, teams)) return false;
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
    if (personalTagValues.size && !normalizePersonalTagIds(task.personalTagIds).some((id) => personalTagValues.has(id))) return false;
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

const BOARD_PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

function taskActivityTimestamp(task) {
  const updatedTimestamp = Date.parse(task?.updatedAt || "");
  if (Number.isFinite(updatedTimestamp)) return updatedTimestamp;
  const historyTimestamp = (task?.history || [])
    .map((item) => Date.parse(item?.createdAt || ""))
    .filter(Number.isFinite)
    .reduce((latest, value) => Math.max(latest, value), 0);
  if (historyTimestamp) return historyTimestamp;
  const createdTimestamp = Date.parse(task?.createdAt || "");
  return Number.isFinite(createdTimestamp) ? createdTimestamp : 0;
}

function compareBoardTasks(left, right, key, employee, teams) {
  const leftDue = taskDisplayDueDate(left, employee, teams) || "9999-12-31";
  const rightDue = taskDisplayDueDate(right, employee, teams) || "9999-12-31";
  const leftPriority = BOARD_PRIORITY_RANK[left.priority] ?? 2;
  const rightPriority = BOARD_PRIORITY_RANK[right.priority] ?? 2;
  const leftTitle = normalizeText(left.title);
  const rightTitle = normalizeText(right.title);
  const leftCreated = Date.parse(left.createdAt || "") || 0;
  const rightCreated = Date.parse(right.createdAt || "") || 0;
  const compare = (a, b) => a === b ? 0 : a < b ? -1 : 1;
  const values = {
    dueDate: compare(leftDue, rightDue),
    priority: compare(leftPriority, rightPriority),
    updatedAt: compare(taskActivityTimestamp(left), taskActivityTimestamp(right)),
    createdAt: compare(leftCreated, rightCreated),
    title: leftTitle.localeCompare(rightTitle, "pt-BR"),
  };
  return values[key] || values.dueDate || values.priority || values.title || String(left.id || "").localeCompare(String(right.id || ""));
}

export function sortBoardTasks(tasks, sort = { key: "dueDate", direction: "asc" }, employee, teams = []) {
  const direction = sort?.direction === "desc" ? -1 : 1;
  return [...tasks].sort((left, right) => {
    if (left.status === "done" && right.status !== "done") return 1;
    if (left.status !== "done" && right.status === "done") return -1;
    return compareBoardTasks(left, right, sort?.key || "dueDate", employee, teams) * direction;
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
