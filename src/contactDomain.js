export const CONTACT_CHANNELS = Object.freeze([
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "E-mail" },
  { id: "phone", label: "Telefone" },
]);

export const CONTACT_STATUSES = Object.freeze([
  { id: "new", label: "Novo" },
  { id: "in_progress", label: "Em atendimento" },
  { id: "waiting", label: "Aguardando" },
  { id: "done", label: "Concluído" },
]);

export const CONTACT_PRIORITIES = Object.freeze([
  { id: "low", label: "Baixa" },
  { id: "medium", label: "Média" },
  { id: "high", label: "Alta" },
]);

export const CONTACT_STATUS_TRANSITIONS = Object.freeze({
  new: ["new", "in_progress", "waiting", "done"],
  in_progress: ["in_progress", "waiting", "done"],
  waiting: ["waiting", "in_progress", "done"],
  done: ["done", "in_progress"],
});

const CONTACT_STATUS_IDS = new Set(CONTACT_STATUSES.map((item) => item.id));
const CONTACT_PRIORITY_IDS = new Set(CONTACT_PRIORITIES.map((item) => item.id));
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
const LEGACY_STATUS_ALIASES = { resolved: "done", archived: "done" };

const text = (value) => String(value ?? "").trim();
const asList = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const unique = (values) => [...new Set(asList(values).map(text).filter(Boolean))];

function canonicalStatus(status) {
  return LEGACY_STATUS_ALIASES[status] || status;
}

function isArchivedContact(contact = {}) {
  return Boolean(contact.archivedAt || contact.status === "archived");
}

export function contactIsOverdue(contact = {}, today = new Date()) {
  const todayKey = new Date(today).toISOString().slice(0, 10);
  return Boolean(contact.dueDate && contact.dueDate < todayKey && contact.status !== "done" && !isArchivedContact(contact));
}

function validDate(value) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp);
}

export function contactStatusLabel(status) {
  const normalized = canonicalStatus(status);
  return CONTACT_STATUSES.find((item) => item.id === normalized)?.label || status || "Novo";
}

export function contactChannelLabel(channel) {
  return CONTACT_CHANNELS.find((item) => item.id === channel)?.label || channel || "Canal não informado";
}

export function contactPriorityLabel(priority) {
  return CONTACT_PRIORITIES.find((item) => item.id === priority)?.label || priority || "Média";
}

export function normalizeContact(input = {}, context = {}) {
  const now = context.now || new Date().toISOString();
  const owner = context.owner || {};
  const status = CONTACT_STATUS_IDS.has(canonicalStatus(input.status)) ? canonicalStatus(input.status) : "new";
  const priority = CONTACT_PRIORITY_IDS.has(input.priority) ? input.priority : "medium";
  const channel = input.externalConversationId || input.sourceUrl === "whatsapp-web"
    ? "whatsapp"
    : text(input.senderPhone)
      ? "phone"
      : text(input.senderEmail)
        ? "email"
        : "whatsapp";
  const receivedAt = input.receivedAt || now;
  const lastMessageAt = input.lastMessageAt || receivedAt;
  const message = text(input.lastMessage || input.message);
  const assignmentMode = input.assignmentMode === "team" ? "team" : "people";
  const teamIds = assignmentMode === "team" ? unique(input.teamIds ?? input.teamId) : [];
  const teamNames = assignmentMode === "team" ? unique(input.teamNames ?? input.teamName) : [];
  const assigneeIds = unique(input.assigneeIds ?? (input.ownerEmployeeId || owner.id ? [input.ownerEmployeeId || owner.id] : []));
  const assigneeNames = unique(input.assigneeNames ?? input.assigneeName ?? (input.ownerName || owner.name ? [input.ownerName || owner.name] : []));
  const ownerEmployeeId = text(input.ownerEmployeeId || assigneeIds[0]);
  const ownerName = assignmentMode === "team"
    ? text(input.ownerName) || teamNames.join(", ") || assigneeNames[0] || "Não atribuído"
    : text(input.ownerName || assigneeNames[0]) || "Não atribuído";
  const notes = Array.isArray(input.notes) ? input.notes : Array.isArray(input.internalNotes) ? input.internalNotes : [];
  return {
    id: text(input.id),
    subject: text(input.subject),
    senderName: text(input.senderName),
    senderPhone: text(input.senderPhone),
    senderEmail: text(input.senderEmail),
    channel,
    receivedAt,
    updatedAt: input.updatedAt || now,
    lastMessageAt,
    summary: text(input.summary),
    message,
    lastMessage: message,
    priority,
    status,
    assignmentMode,
    teamIds,
    teamNames,
    teamId: teamIds[0] || "",
    teamName: assignmentMode === "team" ? text(input.teamName) || teamNames.join(", ") : "",
    assigneeIds,
    assigneeNames,
    assigneeName: assigneeNames,
    ownerEmployeeId,
    ownerName,
    dueDate: text(input.dueDate),
    waitingNote: status === "waiting" ? text(input.waitingNote) || "Esperando resposta" : "",
    clientId: text(input.clientId),
    quoteId: text(input.quoteId),
    resolutionOutcome: text(input.resolutionOutcome),
    sourceUrl: text(input.sourceUrl),
    externalConversationId: text(input.externalConversationId),
    notes,
    internalNotes: notes,
    history: Array.isArray(input.history) ? input.history : [],
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
    linkedTaskIds: unique(input.linkedTaskIds),
    archivedAt: text(input.archivedAt) || (input.status === "archived" ? input.updatedAt || now : ""),
  };
}

export function validateContact(input = {}) {
  if (!text(input.subject)) return { allowed: false, error: "Informe o assunto do caso." };
  if (!text(input.senderName)) return { allowed: false, error: "Informe o remetente." };
  if (!CONTACT_STATUS_IDS.has(canonicalStatus(input.status))) return { allowed: false, error: "Selecione um status válido." };
  if (!CONTACT_PRIORITY_IDS.has(input.priority)) return { allowed: false, error: "Selecione uma prioridade válida." };
  if (!text(input.senderPhone) && !text(input.senderEmail)) return { allowed: false, error: "Informe pelo menos o telefone ou o e-mail do remetente." };
  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) return { allowed: false, error: "Informe um prazo válido." };
  if (canonicalStatus(input.status) === "done" && input.resolutionOutcome !== undefined && typeof input.resolutionOutcome !== "string") return { allowed: false, error: "O resultado da resolução é inválido." };
  return { allowed: true, error: "" };
}

export function canTransitionContactStatus(currentStatus, nextStatus) {
  return (CONTACT_STATUS_TRANSITIONS[canonicalStatus(currentStatus)] || []).includes(canonicalStatus(nextStatus));
}

export function filterContacts(contacts = [], filters = {}) {
  const query = text(filters.query).toLocaleLowerCase("pt-BR");
  const selected = (key) => new Set((filters[key] || []).map(text).filter(Boolean));
  const channels = selected("channel");
  const statuses = selected("status");
  const priorities = selected("priority");
  const owners = selected("owner");
  const teams = selected("team");
  return contacts.filter((contact) => {
    if (!filters.includeArchived && isArchivedContact(contact)) return false;
    if (!filters.includeCompleted && !filters.status?.length && canonicalStatus(contact.status) === "done" && !isArchivedContact(contact)) return false;
    if (filters.overdue && !contactIsOverdue(contact, filters.today)) return false;
    const searchable = [contact.subject, contact.senderName, contact.senderEmail, contact.senderPhone, contact.summary, contact.message, contact.lastMessage].join(" ").toLocaleLowerCase("pt-BR");
    const assigneeIds = unique(contact.assigneeIds || contact.ownerEmployeeId);
    const assigneeNames = unique(contact.assigneeNames || contact.assigneeName || contact.ownerName);
    const teamIds = unique(contact.teamIds || contact.teamId);
    const teamNames = unique(contact.teamNames || contact.teamName);
    const mine = filters.mine ? assigneeIds.includes(String(filters.mine)) || String(contact.ownerEmployeeId) === String(filters.mine) : true;
    return (!query || searchable.includes(query))
      && (!channels.size || channels.has(contact.channel))
      && (!statuses.size || statuses.has(canonicalStatus(contact.status)))
      && (!priorities.size || priorities.has(contact.priority))
      && (!owners.size || owners.has(contact.ownerEmployeeId) || owners.has(contact.ownerName) || assigneeIds.some((id) => owners.has(id)) || assigneeNames.some((name) => owners.has(name)))
      && (!teams.size || teamIds.some((id) => teams.has(id)) || teamNames.some((name) => teams.has(name)))
      && mine;
  });
}

function dueTimestamp(contact) {
  if (!contact.dueDate) return Number.POSITIVE_INFINITY;
  const value = new Date(`${contact.dueDate}T00:00:00`).getTime();
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

export function sortContacts(contacts = [], today = new Date()) {
  return [...contacts].sort((left, right) => {
    const overdueDelta = Number(contactIsOverdue(right, today)) - Number(contactIsOverdue(left, today));
    if (overdueDelta) return overdueDelta;
    const priorityDelta = (PRIORITY_ORDER[left.priority] ?? 1) - (PRIORITY_ORDER[right.priority] ?? 1);
    if (priorityDelta) return priorityDelta;
    const dueDelta = dueTimestamp(left) - dueTimestamp(right);
    if (dueDelta) return dueDelta;
    return new Date(right.lastMessageAt || right.receivedAt || 0).getTime() - new Date(left.lastMessageAt || left.receivedAt || 0).getTime();
  });
}

export function contactStats(contacts = [], today = new Date()) {
  const todayKey = new Date(today).toISOString().slice(0, 10);
  const visible = contacts.filter((contact) => !isArchivedContact(contact));
  const overdue = visible.filter((contact) => contact.dueDate && contact.dueDate < todayKey && contact.status !== "done");
  return {
    total: visible.length,
    new: visible.filter((contact) => contact.status === "new").length,
    inProgress: visible.filter((contact) => contact.status === "in_progress").length,
    waiting: visible.filter((contact) => contact.status === "waiting").length,
    overdue: overdue.length,
  };
}

export function contactPermissions(contact, user = {}) {
  const isOwner = Boolean(user?.employeeId && (
    contact?.ownerEmployeeId === user.employeeId ||
    unique(contact?.assigneeIds).includes(String(user.employeeId))
  ));
  const isManager = Boolean(user?.isManager);
  return {
    canEdit: isOwner || isManager,
    canTransfer: isOwner || isManager,
    canResolve: isOwner || isManager,
    canArchive: isOwner || isManager,
  };
}

export function createContactPayload(input = {}, currentEmployee = {}, now = new Date().toISOString()) {
  return normalizeContact({ ...input, status: input.status || "new", priority: input.priority || "medium" }, { owner: currentEmployee, now });
}

export function createContactEvent(type, contact, input = {}, now = new Date().toISOString()) {
  const assignmentLabel = input.teamName || asList(input.assigneeNames || input.assigneeName).join(", ") || input.ownerName;
  const labels = {
    created: "Caso criado.",
    transfer: `Responsáveis alterados para ${assignmentLabel || "novo responsável"}.`,
    status: `Status alterado para ${contactStatusLabel(input.status)}.`,
    resolution: input.resolutionOutcome ? `Caso concluído: ${input.resolutionOutcome}.` : "Caso concluído.",
    priority: `Prioridade alterada para ${contactPriorityLabel(input.priority)}.`,
    deadline: input.next ? `Prazo alterado para ${input.next}.` : "Prazo removido.",
    waiting: `Observação de Aguardando atualizada: ${input.waitingNote || "Esperando resposta"}.`,
    archived: "Caso arquivado.",
    note: "Nota interna adicionada.",
    attachment: "Anexo adicionado.",
    attachment_deleted: "Anexo removido.",
    task: "Task vinculada ao caso.",
  };
  return {
    id: input.id || `contact-event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    text: input.text || labels[type] || "Caso atualizado.",
    description: input.text || labels[type] || "Caso atualizado.",
    createdAt: now,
    author: input.author || "Você",
    actorEmployeeId: input.actorEmployeeId || "",
    previous: input.previous || "",
    next: input.next || "",
    reason: input.reason || "",
    fromEmployeeId: input.fromEmployeeId || "",
    toEmployeeId: input.toEmployeeId || "",
    fromAssigneeIds: unique(input.fromAssigneeIds),
    toAssigneeIds: unique(input.toAssigneeIds),
    fromTeamIds: unique(input.fromTeamIds),
    toTeamIds: unique(input.toTeamIds),
  };
}

export function buildLinkedTaskInput(contact = {}, input = {}) {
  return {
    title: input.title || contact.subject,
    description: input.description || [contact.summary, contact.message || contact.lastMessage].filter(Boolean).join("\n\n"),
    priority: input.priority || contact.priority || "medium",
    dueDate: input.dueDate ?? contact.dueDate ?? "",
    assignmentMode: input.assignmentMode || contact.assignmentMode || "people",
    teamIds: input.teamIds ?? (contact.teamIds || (contact.teamId ? [contact.teamId] : [])),
    teamNames: input.teamNames ?? (contact.teamNames || (contact.teamName ? [contact.teamName] : [])),
    teamId: input.teamId ?? contact.teamId ?? "",
    teamName: input.teamName ?? contact.teamName ?? "",
    assigneeIds: input.assigneeIds ?? contact.assigneeIds ?? (contact.ownerEmployeeId ? [contact.ownerEmployeeId] : []),
    assigneeNames: input.assigneeNames ?? input.assigneeName ?? contact.assigneeNames ?? contact.assigneeName ?? (contact.ownerName ? [contact.ownerName] : []),
    assigneeName: input.assigneeNames ?? input.assigneeName ?? contact.assigneeNames ?? contact.assigneeName ?? (contact.ownerName ? [contact.ownerName] : []),
    contactId: contact.id,
    sourceType: "contact",
    sourceId: contact.id,
    sourceLabel: "Caso de atendimento",
  };
}

export function isValidContactDate(value) {
  return !value || validDate(value);
}
