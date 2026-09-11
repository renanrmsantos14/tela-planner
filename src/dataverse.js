import {
  adminCleanup as adminCleanupMock,
  addAttachment as addMockAttachment,
  addContactAttachment as addMockContactAttachment,
  addContactNote as addMockContactNote,
  addComment as addMockComment,
  collectTask as collectMockTask,
  withDailyNotifications,
  resolveWaitingReturn as resolveMockWaitingReturn,
  createTask as createMockTask,
  createPersonalTag as createMockPersonalTag,
  importPlannerTasks as importMockPlannerTasks,
  createTeam as createMockTeam,
  deleteTeam as deleteMockTeam,
  deleteAttachment as deleteMockAttachment,
  deleteContactAttachment as deleteMockContactAttachment,
  deleteTask as deleteMockTask,
  ensureQuoteTask as ensureMockQuoteTask,
  createQuote as createMockQuote,
  updateQuote as updateMockQuote,
  markQuoteSent as markMockQuoteSent,
  setQuoteOutcome as setMockQuoteOutcome,
  loadState as loadMockState,
  markAllNotificationsRead as markAllMockNotificationsRead,
  markNotificationRead as markMockNotificationRead,
  archivePersonalTag as archiveMockPersonalTag,
  loadPersonalTags as loadMockPersonalTags,
  reorderPersonalTags as reorderMockPersonalTags,
  replaceTaskPersonalTags as replaceMockTaskPersonalTags,
  resetState as resetMockState,
  saveState as saveMockState,
  updateTask as updateMockTask,
  updatePersonalTag as updateMockPersonalTag,
  updateTeam as updateMockTeam,
  createContact as createMockContact,
  createContactFromWhatsAppIntake as createMockContactFromWhatsAppIntake,
  updateContact as updateMockContact,
  archiveContact as archiveMockContact,
} from "./mockStore.js";
import {
  applyOptimisticTaskPatch,
  canRegisterWaitingReturn,
  normalizeAssigneeNames,
  normalizeText,
  normalizePersonalTag,
  normalizePersonalTagIds,
  PERSONAL_TAG_COLORS,
  normalizeWaitingContext,
  responsibilityFromIds,
  resolveTaskAssignment,
  STATUSES,
  validateTeamComposition,
  validateWaitingContext,
  waitingContextSummary,
} from "./domain.js";
import { localDateKey, manualCollectionKey } from "./management.js";
import { normalizeContact } from "./contactDomain.js";

// Os nomes lógicos finais dependem da metadata DEV. Não preencha com nomes
// presumidos: o adapter live permanece desativado até a solução provisionar o contrato.
export const CONTACT_SCHEMA = Object.freeze({
  table: "",
  eventTable: "",
  taskLookup: "",
  fields: Object.freeze({}),
});

const CONTACT_SCHEMA_ERROR = "Metadata DEV de Contatos não configurada. Provisione a tabela, os eventos e o lookup da tarefa antes de usar o modo live.";
const requireContactSchema = () => {
  if (!CONTACT_SCHEMA.table || !CONTACT_SCHEMA.eventTable || !CONTACT_SCHEMA.taskLookup) throw new Error(CONTACT_SCHEMA_ERROR);
  return CONTACT_SCHEMA;
};

const API_VERSION = "v9.2";
const QUOTE_TABLE = "cr40f_pedidodecotacao";
const QUALITY_ERROR_TABLE = "cr40f_errooperacional";
const QUALITY_ACTION_TABLE = "cr40f_acaooperacional";
const TASK_TABLE = "cr40f_plannertarefa";
const TASK_RESTRICTED_VISIBILITY_FIELD = "cr40f_visibilidade_restrita";
const WAITING_CONTEXT_FIELDS = Object.freeze({
  subject: "cr40f_aguardandosujeito",
  onType: "cr40f_aguardandotipo",
  onId: "cr40f_aguardandoid",
  onName: "cr40f_aguardandonome",
  expectedDate: "cr40f_aguardandodataretorno",
  note: "cr40f_aguardandoobservacao",
});
const EMPLOYEE_TABLE = "cr40f_funcionarios";
const EMPLOYEE_ASSIGNEE_FIELD = "cr40f_cr40f_funcionarioresponsavel";
const EVENT_TABLE = "cr40f_plannertarefaevento";
const PLANNER_EVENTS_QUERY = "?$select=cr40f_plannertarefaeventoid,_cr40f_tarefa_value,cr40f_tipo,cr40f_campo,cr40f_descricao,cr40f_valornovo,cr40f_ocorridoem,_cr40f_autor_value,_createdby_value&$orderby=cr40f_ocorridoem desc";
const RELATION_TABLE = "cr40f_plannertarearelacao";
const ASSIGNEE_RELATION_TABLE = "cr40f_plannertarearesponsavel";
const TASK_TEAM_RELATION_TABLE = "cr40f_plannertarefaequipe";
const TEAM_TABLE = "cr40f_plannerequipe";
const TEAM_MEMBER_TABLE = "cr40f_plannerequipemembro";
const TEAM_PRIMARY_FIELD = "cr40f_responsavelprincipal";
const TASK_TEAM_FIELD = "cr40f_equipeplanner";
const NOTIFICATION_TABLE = "cr40f_plannernotificacao";
const EMAIL_DISPATCH_TABLE = "cr40f_plannerdisparo";
const PERSONAL_TAG_TABLE = "cr40f_plannertagpessoal";
const PERSONAL_TAG_TASK_TABLE = "cr40f_plannertagpessoaltarefa";
const ENVIRONMENT_VARIABLE_DEFINITION_TABLE = "environmentvariabledefinition";
const ENVIRONMENT_VARIABLE_VALUE_TABLE = "environmentvariablevalue";
const FLOW_URL_SCHEMA = "new_URLFlowsalvararquivosSharePoint";
const READ_FLOW_URL_SCHEMA = "new_URLFlowConsultarArquivosSharePoint";
const DELETE_FLOW_URL_SCHEMA = "new_URLFlowExcluirArquivoSharePoint";
const DEV_DATAVERSE_URL = "https://org23b93544.crm2.dynamics.com";
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1600;
const IMAGE_QUALITY = 0.82;
const OPTIMIZABLE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_OPTIMIZER_WORKER_SOURCE = `
  self.onmessage = async ({ data }) => {
    try {
      const bitmap = await createImageBitmap(data.file);
      const scale = Math.min(1, data.maxEdge / Math.max(bitmap.width, bitmap.height));
      if (scale === 1 && data.file.size <= 900 * 1024) {
        bitmap.close?.();
        self.postMessage({ unchanged: true });
        return;
      }
      const canvas = new OffscreenCanvas(
        Math.max(1, Math.round(bitmap.width * scale)),
        Math.max(1, Math.round(bitmap.height * scale)),
      );
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await canvas.convertToBlob({
        type: data.file.type,
        quality: data.file.type === "image/png" ? undefined : data.quality,
      });
      bitmap.close?.();
      const buffer = await blob.arrayBuffer();
      self.postMessage({ buffer, type: blob.type }, [buffer]);
    } catch (error) {
      self.postMessage({ error: error?.message || "Falha ao otimizar imagem." });
    }
  };
`;
const ENTITY_SETS = Object.freeze({
  [QUOTE_TABLE]: "cr40f_pedidodecotacaos",
  [QUALITY_ERROR_TABLE]: "cr40f_errooperacionals",
  [QUALITY_ACTION_TABLE]: "cr40f_acaooperacionals",
  [TASK_TABLE]: "cr40f_plannertarefas",
  [EMPLOYEE_TABLE]: "cr40f_funcionarioses",
  [EVENT_TABLE]: "cr40f_plannertarefaeventos",
  [RELATION_TABLE]: "cr40f_plannertarearelacaos",
  [ASSIGNEE_RELATION_TABLE]: "cr40f_plannertarearesponsavels",
  [TASK_TEAM_RELATION_TABLE]: "cr40f_plannertarefaequipes",
  [TEAM_TABLE]: "cr40f_plannerequipes",
  [TEAM_MEMBER_TABLE]: "cr40f_plannerequipemembros",
  [NOTIFICATION_TABLE]: "cr40f_plannernotificacaos",
  [EMAIL_DISPATCH_TABLE]: "cr40f_plannerdisparos",
  [PERSONAL_TAG_TABLE]: "cr40f_plannertagpessoals",
  [PERSONAL_TAG_TASK_TABLE]: "cr40f_plannertagpessoaltarefas",
  [ENVIRONMENT_VARIABLE_DEFINITION_TABLE]: "environmentvariabledefinitions",
  [ENVIRONMENT_VARIABLE_VALUE_TABLE]: "environmentvariablevalues",
  systemuser: "systemusers",
  team: "teams",
});
const ORIGIN_VALUES = { manual: 100000000, quote: 100000001, quality: 100000002 };
const STATUS_VALUES = { todo: 100000000, doing: 100000001, waiting: 100000002, done: 100000003, cancelled: 100000004 };
const PRIORITY_VALUES = { low: 100000000, medium: 100000001, high: 100000002, urgent: 100000003 };
const STATUS_BY_VALUE = Object.fromEntries(Object.entries(STATUS_VALUES).map(([key, value]) => [value, key]));
const PRIORITY_BY_VALUE = Object.fromEntries(Object.entries(PRIORITY_VALUES).map(([key, value]) => [value, key]));
const QUOTE_STATUS_VALUES = Object.freeze({
  "Nova": 100004000,
  "Em análise pelo financeiro": 100004001,
  "Aguardando informação": 100004002,
  "Cotada": 100004003,
  "Respondida ao cliente": 100004004,
  "Cancelada": 100004005,
  "Perdida": 100004006,
  "Convertida em serviço": 100004007,
});
const QUOTE_PRIORITY_VALUES = Object.freeze({ low: 100003000, medium: 100003001, high: 100003002, urgent: 100003003 });
const QUOTE_CHANNEL_VALUES = Object.freeze({ WhatsApp: 100001000, Telefone: 100001001, "E-mail": 100001002 });
const lookupCache = new Map();

function sanitizePathSegment(value, fallback = "sem-codigo") {
  const sanitized = String(value || "").trim().replace(/[<>:\"/\\|?*\x00-\x1F]/g, "-").replace(/\s+/g, " ").replace(/\.+$/g, "");
  return sanitized || fallback;
}

function extractFlowRecord(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" ? parsed : null; } catch { return null; }
}

export function entitySetName(logicalName) {
  const entitySet = ENTITY_SETS[logicalName];
  if (!entitySet) throw new Error(`Entity Set não mapeado para ${logicalName}.`);
  return entitySet;
}

function getXrm() {
  const candidates = [];
  try { candidates.push(parent?.Xrm); } catch {}
  try { candidates.push(window?.Xrm); } catch {}
  return candidates.find((candidate) => candidate?.Utility?.getGlobalContext && candidate.WebApi) || null;
}

function cleanId(value) {
  return String(value || "").replace(/[{}]/g, "");
}

function parseStoredList(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : value;
  } catch {
    return value;
  }
}

function parseChecklist(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseWaitingContext(row = {}) {
  return normalizeWaitingContext({
    subject: row[WAITING_CONTEXT_FIELDS.subject],
    onType: row[WAITING_CONTEXT_FIELDS.onType],
    onIds: parseStoredList(row[WAITING_CONTEXT_FIELDS.onId]),
    onNames: parseStoredList(row[WAITING_CONTEXT_FIELDS.onName]),
    expectedDate: dateOnly(row[WAITING_CONTEXT_FIELDS.expectedDate]),
    note: row[WAITING_CONTEXT_FIELDS.note],
  });
}

function waitingContextPayload(value) {
  const context = normalizeWaitingContext(value);
  return {
    [WAITING_CONTEXT_FIELDS.subject]: context.subject,
    [WAITING_CONTEXT_FIELDS.onType]: context.onType,
    [WAITING_CONTEXT_FIELDS.onId]: JSON.stringify(context.onIds),
    [WAITING_CONTEXT_FIELDS.onName]: JSON.stringify(context.onNames),
    [WAITING_CONTEXT_FIELDS.expectedDate]: context.expectedDate
      ? `${context.expectedDate}T12:00:00Z`
      : null,
    [WAITING_CONTEXT_FIELDS.note]: context.note,
  };
}

function waitingTargetIds(state, context) {
  const targetIds = Array.isArray(context?.onIds) ? context.onIds : context?.onId ? [context.onId] : [];
  const targetNames = Array.isArray(context?.onNames) ? context.onNames : context?.onName ? [context.onName] : [];
  if (context?.onType === "employee") return [...new Set(targetIds.filter(Boolean))];
  return [...new Set((state.teams || [])
    .filter((team) => targetIds.some((id) => String(team.id) === String(id)) || targetNames.some((name) => String(team.name).toLocaleLowerCase("pt-BR") === String(name).toLocaleLowerCase("pt-BR")))
    .flatMap((team) => team.memberIds || []))];
}

async function loadCurrentUserEmail(xrm) {
  const userId = cleanId(
    xrm.Utility?.getGlobalContext?.().userSettings?.userId,
  );
  if (!userId) return "";
  try {
    const rows = await retrieveMany(
      xrm,
      "systemuser",
      `?$select=internalemailaddress&$filter=systemuserid eq ${userId}&$top=1`,
    );
    return String(rows[0]?.internalemailaddress || "").trim().toLowerCase();
  } catch (error) {
    console.warn("[Planner] email do usuário atual indisponível", error);
    return "";
  }
}

function apiUrl(xrm) {
  const base = xrm.Utility.getGlobalContext().getClientUrl()?.replace(/\/$/, "");
  if (!base) throw new Error("Não foi possível obter a URL do ambiente Dataverse.");
  return `${base}/api/data/${API_VERSION}`;
}

function formatLookup(row, attribute, fallback = "Não atribuído") {
  return row[`_${attribute}_value@OData.Community.Display.V1.FormattedValue`] || fallback;
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

async function request(xrm, path, options = {}) {
  const retryable = (status) => status === 408 || status === 429 || status >= 500;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${apiUrl(xrm)}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        Prefer: 'odata.include-annotations="*",return=representation',
        ...(options.headers || {}),
      },
    });
    const body = await response.text();
    let parsed = null;
    try { parsed = body ? JSON.parse(body) : null; } catch { parsed = body; }
    if (response.ok) return parsed;
    if (!retryable(response.status) || attempt === 2) {
      const detail = parsed?.error?.message || body || response.statusText;
      throw new Error(`${options.method || "GET"} ${path} falhou: ${response.status} ${detail}`);
    }
    const retryAfter = Number(response.headers.get("Retry-After"));
    await new Promise((resolve) => window.setTimeout(resolve, Number.isFinite(retryAfter) ? retryAfter * 1000 : 400 * (attempt + 1)));
  }
}

async function retrieveMany(xrm, table, query) {
  const rows = [];
  let next = `/${entitySetName(table)}${query}`;
  while (next) {
    const result = await request(xrm, next);
    rows.push(...(result?.value || []));
    next = result?.["@odata.nextLink"] ? new URL(result["@odata.nextLink"]).pathname.replace(`/api/data/${API_VERSION}`, "") + new URL(result["@odata.nextLink"]).search : "";
  }
  return rows;
}

async function retrieveOptional(xrm, table, query, label) {
  try { return await retrieveMany(xrm, table, query); }
  catch (error) {
    console.warn(`[Planner] ${label || table} indisponível; usando fallback compatível`, error);
    return [];
  }
}

function plannerTaskQuery(includeTeamLookup = true, includeWaitingContext = true) {
  const fields = [
    "cr40f_plannertarefaid",
    "cr40f_name",
    "cr40f_titulo",
    "cr40f_descricao",
    "cr40f_checklistjson",
    "cr40f_status",
    "cr40f_prioridade",
    TASK_RESTRICTED_VISIBILITY_FIELD,
    "cr40f_prazo",
    ...(includeWaitingContext ? Object.values(WAITING_CONTEXT_FIELDS) : []),
    "_createdby_value",
    `_${EMPLOYEE_ASSIGNEE_FIELD}_value`,
    "_cr40f_equipe_value",
    ...(includeTeamLookup ? [`_${TASK_TEAM_FIELD}_value`] : []),
    "_cr40f_pedidocotacao_value",
    "_cr40f_errooperacional_value",
    "_cr40f_acaooperacional_value",
    "cr40f_origem",
    "cr40f_codigoorigem",
  ];
  return `?$select=${fields.join(",")}&$filter=statecode eq 0&$orderby=modifiedon desc`;
}

async function retrievePlannerTasks(xrm) {
  try {
    return await retrieveMany(xrm, TASK_TABLE, plannerTaskQuery(true));
  } catch (error) {
    console.warn("[Planner] consulta completa de tarefas indisponível; tentando contrato compatível", error);
    try {
      return await retrieveMany(xrm, TASK_TABLE, plannerTaskQuery(true, false));
    } catch (optionalFieldsError) {
      console.warn("[Planner] campos opcionais de Aguardando indisponíveis; carregando sem contexto de retorno", optionalFieldsError);
      return retrieveMany(xrm, TASK_TABLE, plannerTaskQuery(false, false));
    }
  }
}

async function resolveEnvironmentVariableUrl(xrm, schemaName, fallback = "") {
  const definitions = await retrieveMany(xrm, ENVIRONMENT_VARIABLE_DEFINITION_TABLE, `?$select=environmentvariabledefinitionid,defaultvalue&$filter=schemaname eq '${schemaName}'&$top=1`);
  const definition = definitions[0];
  if (!definition) return fallback.trim();
  const values = await retrieveMany(xrm, ENVIRONMENT_VARIABLE_VALUE_TABLE, `?$select=value&$filter=_environmentvariabledefinitionid_value eq ${definition.environmentvariabledefinitionid}&$top=1`);
  return String(values[0]?.value || definition.defaultvalue || fallback).trim();
}

async function resolveSharePointFlowUrl(xrm) {
  return resolveEnvironmentVariableUrl(xrm, FLOW_URL_SCHEMA, String(import.meta.env?.VITE_FLOW_SALVAR_ANEXOS_SHAREPOINT_URL || ""));
}

async function resolveSharePointReadFlowUrl(xrm) {
  return resolveEnvironmentVariableUrl(xrm, READ_FLOW_URL_SCHEMA);
}

async function resolveSharePointDeleteFlowUrl(xrm) {
  return resolveEnvironmentVariableUrl(xrm, DELETE_FLOW_URL_SCHEMA, String(import.meta.env?.VITE_FLOW_EXCLUIR_ANEXO_SHAREPOINT_URL || ""));
}

async function resolveLookupNavigation(xrm, entity, attribute, target) {
  const cacheKey = `${entity}:${attribute}:${target}`;
  if (lookupCache.has(cacheKey)) return lookupCache.get(cacheKey);
  const metadata = await request(xrm, `/EntityDefinitions(LogicalName='${entity}')/ManyToOneRelationships?$select=ReferencingAttribute,ReferencingEntityNavigationPropertyName,ReferencedEntity`);
  const relationship = (metadata?.value || []).find((item) => item.ReferencingAttribute?.toLowerCase() === attribute.toLowerCase() && item.ReferencedEntity?.toLowerCase() === target.toLowerCase());
  if (!relationship?.ReferencingEntityNavigationPropertyName) throw new Error(`Metadata incompleto: lookup ${entity}.${attribute} não aponta para ${target}.`);
  lookupCache.set(cacheKey, relationship.ReferencingEntityNavigationPropertyName);
  return relationship.ReferencingEntityNavigationPropertyName;
}

async function bindLookup(xrm, payload, entity, attribute, target, id) {
  if (!id) return;
  const navigation = await resolveLookupNavigation(xrm, entity, attribute, target);
  payload[`${navigation}@odata.bind`] = `/${entitySetName(target)}(${cleanId(id)})`;
}

function normalizeLivePersonalTag(row, currentUserId) {
  return normalizePersonalTag({
    id: row.cr40f_plannertagpessoalid,
    name: row.cr40f_nome || row.cr40f_name || "",
    color: row.cr40f_cor,
    sortOrder: row.cr40f_ordem,
    archived: row.cr40f_arquivada,
    ownerUserId: row._cr40f_usuario_value || currentUserId,
  }, currentUserId);
}

async function loadLivePersonalTagData(xrm, currentUserId) {
  if (!currentUserId) return { personalTags: [], personalTagAssignments: [] };
  try {
    const [tagRows, relationRows] = await Promise.all([
      retrieveMany(xrm, PERSONAL_TAG_TABLE, `?$select=cr40f_plannertagpessoalid,cr40f_name,cr40f_nome,cr40f_cor,cr40f_ordem,cr40f_arquivada,_cr40f_usuario_value&$filter=_cr40f_usuario_value eq ${cleanId(currentUserId)} and statecode eq 0&$orderby=cr40f_ordem asc,cr40f_nome asc`),
      retrieveMany(xrm, PERSONAL_TAG_TASK_TABLE, `?$select=cr40f_plannertagpessoaltarefaid,_cr40f_tag_value,_cr40f_tarefa_value,_cr40f_usuario_value&$filter=_cr40f_usuario_value eq ${cleanId(currentUserId)} and statecode eq 0`),
    ]);
    return {
      personalTags: tagRows.map((row) => normalizeLivePersonalTag(row, currentUserId)),
      personalTagAssignments: relationRows.map((row) => ({ id: row.cr40f_plannertagpessoaltarefaid, tagId: row._cr40f_tag_value || "", taskId: row._cr40f_tarefa_value || "", ownerUserId: row._cr40f_usuario_value || currentUserId })),
    };
  } catch (error) {
    console.warn("[Planner] tags pessoais indisponíveis; mantendo o Planner operacional", error);
    return { personalTags: [], personalTagAssignments: [], personalTagsUnavailable: true };
  }
}

function applyPersonalTagsToTasks(tasks = [], assignments = []) {
  const tagsByTask = new Map();
  assignments.forEach((item) => {
    const list = tagsByTask.get(item.taskId) || [];
    list.push(item.tagId);
    tagsByTask.set(item.taskId, list);
  });
  return tasks.map((task) => ({ ...task, personalTagIds: normalizePersonalTagIds(tagsByTask.get(task.id) || task.personalTagIds) }));
}

async function createLivePersonalTag(xrm, state, input = {}) {
  const ownerUserId = cleanId(input.ownerUserId || state.currentUserId);
  const existing = (state.personalTags || []).filter((tag) => tag.ownerUserId === ownerUserId);
  const name = String(input.name || "").trim().slice(0, 32);
  const duplicate = existing.some((tag) => normalizePersonalTag(tag).name.localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0);
  if (!name) throw new Error("Informe um nome para a tag.");
  if (duplicate) throw new Error("Você já tem uma tag com esse nome.");
  const payload = { cr40f_name: name, cr40f_nome: name, cr40f_cor: input.color || "#1d5ce8", cr40f_ordem: existing.length, cr40f_arquivada: false };
  await bindLookup(xrm, payload, PERSONAL_TAG_TABLE, "cr40f_usuario", "systemuser", ownerUserId);
  const created = await request(xrm, `/${entitySetName(PERSONAL_TAG_TABLE)}`, { method: "POST", body: JSON.stringify(payload) });
  if (!created?.cr40f_plannertagpessoalid) throw new Error("Dataverse criou a tag sem retornar o ID.");
  return loadLiveState(xrm);
}

async function updateLivePersonalTag(xrm, state, id, patch = {}) {
  const existing = (state.personalTags || []).find((tag) => tag.id === id);
  if (!existing) throw new Error("Tag pessoal não encontrada.");
  const name = patch.name === undefined ? existing.name : String(patch.name || "").trim().slice(0, 32);
  if (!name) throw new Error("Informe um nome para a tag.");
  const duplicate = (state.personalTags || []).some((tag) => tag.id !== id && tag.ownerUserId === existing.ownerUserId && normalizePersonalTag(tag).name.localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0);
  if (duplicate) throw new Error("Você já tem uma tag com esse nome.");
  const payload = { cr40f_name: name, cr40f_nome: name };
  if (patch.color !== undefined) payload.cr40f_cor = patch.color;
  if (patch.sortOrder !== undefined) payload.cr40f_ordem = Math.max(0, Number(patch.sortOrder) || 0);
  if (patch.archived !== undefined) payload.cr40f_arquivada = Boolean(patch.archived);
  await request(xrm, `/${entitySetName(PERSONAL_TAG_TABLE)}(${cleanId(id)})`, { method: "PATCH", body: JSON.stringify(payload) });
  return loadLiveState(xrm);
}

async function reorderLivePersonalTags(xrm, state, orderedIds = []) {
  await Promise.all(orderedIds.map((id, index) => request(xrm, `/${entitySetName(PERSONAL_TAG_TABLE)}(${cleanId(id)})`, { method: "PATCH", body: JSON.stringify({ cr40f_ordem: index }) })));
  return loadLiveState(xrm);
}

async function replaceLiveTaskPersonalTags(xrm, state, taskId, tagIds = {}, ownerUserId = state.currentUserId) {
  const ids = normalizePersonalTagIds(Array.isArray(tagIds) ? tagIds : tagIds.tagIds);
  const allowed = new Set((state.personalTags || []).filter((tag) => tag.ownerUserId === ownerUserId).map((tag) => tag.id));
  const nextIds = ids.filter((id) => allowed.has(id));
  const current = await retrieveMany(xrm, PERSONAL_TAG_TASK_TABLE, `?$select=cr40f_plannertagpessoaltarefaid&$filter=_cr40f_usuario_value eq ${cleanId(ownerUserId)} and _cr40f_tarefa_value eq ${cleanId(taskId)} and statecode eq 0`);
  await Promise.all(current.map((row) => request(xrm, `/${entitySetName(PERSONAL_TAG_TASK_TABLE)}(${cleanId(row.cr40f_plannertagpessoaltarefaid)})`, { method: "DELETE" })));
  await Promise.all(nextIds.map(async (tagId) => {
    const payload = { cr40f_name: `${cleanId(taskId)}-${cleanId(tagId)}-${cleanId(ownerUserId)}` };
    await bindLookup(xrm, payload, PERSONAL_TAG_TASK_TABLE, "cr40f_tarefa", TASK_TABLE, taskId);
    await bindLookup(xrm, payload, PERSONAL_TAG_TASK_TABLE, "cr40f_tag", PERSONAL_TAG_TABLE, tagId);
    await bindLookup(xrm, payload, PERSONAL_TAG_TASK_TABLE, "cr40f_usuario", "systemuser", ownerUserId);
    await request(xrm, `/${entitySetName(PERSONAL_TAG_TASK_TABLE)}`, { method: "POST", body: JSON.stringify(payload) });
  }));
  return loadLiveState(xrm);
}

export function normalizeMicrosoftEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function reconcileEmployeeUserLinks(xrm, employees = []) {
  const missingByEmail = new Map();
  employees.forEach((employee) => {
    if (employee._cr40f_usuariodataverse_value) return;
    const email = normalizeMicrosoftEmail(employee.cr40f_emailmicrosoft);
    if (!email) return;
    const matches = missingByEmail.get(email) || [];
    matches.push(employee);
    missingByEmail.set(email, matches);
  });

  await Promise.all([...missingByEmail.entries()].map(async ([email, matches]) => {
    try {
      const escapedEmail = email.replace(/'/g, "''");
      const users = await retrieveMany(
        xrm,
        "systemuser",
        `?$select=systemuserid,internalemailaddress,isdisabled&$filter=internalemailaddress eq '${escapedEmail}' and isdisabled eq false&$top=2`,
      );
      const exactUsers = users.filter(
        (user) => normalizeMicrosoftEmail(user.internalemailaddress) === email && !user.isdisabled,
      );
      if (exactUsers.length !== 1) {
        console.warn(`[Planner] vínculo Microsoft não aplicado para ${email}: ${exactUsers.length} usuário(s) ativo(s) correspondente(s).`);
        return;
      }
      const userId = cleanId(exactUsers[0].systemuserid);
      await Promise.all(matches.map(async (employee) => {
        const payload = {};
        await bindLookup(xrm, payload, EMPLOYEE_TABLE, "cr40f_usuariodataverse", "systemuser", userId);
        await request(xrm, `/${entitySetName(EMPLOYEE_TABLE)}(${cleanId(employee.cr40f_funcionariosid)})`, { method: "PATCH", body: JSON.stringify(payload) });
        employee._cr40f_usuariodataverse_value = userId;
      }));
    } catch (error) {
      console.warn(`[Planner] falha ao vincular usuário Microsoft para ${email}`, error);
    }
  }));

  return employees;
}

async function resolveIdByName(xrm, table, field, value) {
  if (!value || value === "Não atribuído" || value === "Sem equipe") return "";
  const escaped = String(value).replace(/'/g, "''");
  const rows = await retrieveMany(xrm, table, `?$select=${table === "systemuser" ? "systemuserid" : "teamid"}&$filter=${field} eq '${escaped}'${table === "systemuser" ? " and isdisabled eq false" : ""}&$top=2`);
  if (rows.length > 1) throw new Error(`Mais de um registro encontrado para ${value}. Selecione um responsável/equipe único.`);
  return rows[0]?.[table === "systemuser" ? "systemuserid" : "teamid"] || "";
}

async function markQuoteOrigin(xrm, quoteId, taskId = "") {
  if (!quoteId) return;
  const clientUrl = xrm.Utility?.getGlobalContext?.().getClientUrl?.() || window.location.origin;
  const patch = { cr40f_origemultimasincronizacao: "Planner", cr40f_ultimasincronizacao: new Date().toISOString() };
  if (taskId) { patch.cr40f_plannertaskid = taskId; patch.cr40f_linktarefaplanner = `${clientUrl}/WebResources/new_TelaPlanner.html?data=taskId=${cleanId(taskId)}`; }
  await request(xrm, `/${entitySetName(QUOTE_TABLE)}(${cleanId(quoteId)})`, { method: "PATCH", body: JSON.stringify(patch) });
}

function normalizeQuote(row) {
  return {
    id: row.cr40f_pedidodecotacaoid,
    code: row.cr40f_numerodacotacao || "",
    title: row.cr40f_titulo || "Sem título",
    client: row.cr40f_clienteempresa || "",
    status: row["cr40f_statuscotacao@OData.Community.Display.V1.FormattedValue"] || Object.entries(QUOTE_STATUS_VALUES).find(([, value]) => value === row.cr40f_statuscotacao)?.[0] || "",
    channel: row["cr40f_canalentrada@OData.Community.Display.V1.FormattedValue"] || Object.entries(QUOTE_CHANNEL_VALUES).find(([, value]) => value === row.cr40f_canalentrada)?.[0] || "",
    clientContact: row.cr40f_contatocliente || "",
    clientEmail: row.cr40f_emailcliente || "",
    clientPhone: row.cr40f_telefonewhatsapp || "",
    serviceType: row.cr40f_tiposervico || "",
    vehicleType: row.cr40f_tipoveiculo || "",
    origin: row.cr40f_origem || "",
    destination: row.cr40f_destino || "",
    serviceDate: row.cr40f_datahoraservico || "",
    returnDate: row.cr40f_datahoraretorno || "",
    passengers: row.cr40f_quantidadepassageiros == null ? "" : String(row.cr40f_quantidadepassageiros),
    hasReturn: Boolean(row.cr40f_retorno),
    notes: row.cr40f_observacoespedido || "",
    priority: Object.entries(QUOTE_PRIORITY_VALUES).find(([, value]) => value === row.cr40f_prioridade)?.[0] || "medium",
    commercialTerms: row.cr40f_condicaocomercial || "",
    responseSent: Boolean(row.cr40f_respostaenviadacliente),
    finalizationAt: row.cr40f_datahorafinalizacao || "",
    lossReason: row.cr40f_motivoperda || "",
    deadline: dateOnly(row.cr40f_prazoresponder),
    value: row.cr40f_valorcotado == null ? "" : String(row.cr40f_valorcotado),
    plannerTaskId: row.cr40f_plannertaskid || "",
    plannerLink: row.cr40f_linktarefaplanner || "",
    teamsLink: row.cr40f_linkmensagemteams || "",
  };
}

const QUOTE_SELECT = [
  "cr40f_pedidodecotacaoid", "cr40f_numerodacotacao", "cr40f_titulo", "cr40f_clienteempresa", "cr40f_contatocliente", "cr40f_telefonewhatsapp", "cr40f_emailcliente", "cr40f_canalentrada", "cr40f_tiposervico", "cr40f_tipoveiculo", "cr40f_origem", "cr40f_destino", "cr40f_datahoraservico", "cr40f_retorno", "cr40f_datahoraretorno", "cr40f_quantidadepassageiros", "cr40f_observacoespedido", "cr40f_prioridade", "cr40f_statuscotacao", "cr40f_prazoresponder", "cr40f_valorcotado", "cr40f_condicaocomercial", "cr40f_respostaenviadacliente", "cr40f_datahorafinalizacao", "cr40f_plannertaskid", "cr40f_linktarefaplanner", "cr40f_linkmensagemteams",
].join(",");

async function primaryNameAttribute(xrm, table) {
  const metadata = await request(xrm, `/EntityDefinitions(LogicalName='${table}')?$select=PrimaryNameAttribute`);
  if (!metadata?.PrimaryNameAttribute) throw new Error(`Metadata incompleto: ${table} sem atributo de nome principal.`);
  return metadata.PrimaryNameAttribute;
}

function normalizePlannerTeam(row, primaryName = "cr40f_nome") {
  return {
    id: row[`${TEAM_TABLE}id`] || row.cr40f_plannerequipeid || "",
    name: row[primaryName] || row[`${primaryName}@OData.Community.Display.V1.FormattedValue`] || "",
    iconName: "users",
    memberIds: [],
    primaryMemberId: row[`_${TEAM_PRIMARY_FIELD}_value`] || "",
  };
}

async function loadPlannerTeams(xrm) {
  try {
    const primaryName = await primaryNameAttribute(xrm, TEAM_TABLE);
    let teamRows;
    try {
      teamRows = await retrieveMany(xrm, TEAM_TABLE, `?$select=${TEAM_TABLE}id,${primaryName},_${TEAM_PRIMARY_FIELD}_value&$filter=statecode eq 0&$orderby=${primaryName} asc`);
    } catch (error) {
      console.warn("[Planner] lookup de principal da equipe indisponível; usando fallback legado", error);
      teamRows = await retrieveMany(xrm, TEAM_TABLE, `?$select=${TEAM_TABLE}id,${primaryName}&$filter=statecode eq 0&$orderby=${primaryName} asc`);
    }
    const memberRows = await retrieveMany(xrm, TEAM_MEMBER_TABLE, `?$select=${TEAM_MEMBER_TABLE}id,_cr40f_equipe_value,_cr40f_funcionario_value&$filter=statecode eq 0`);
    const teams = teamRows.map((row) => normalizePlannerTeam(row, primaryName));
    const membersByTeam = new Map();
    memberRows.forEach((row) => {
      const teamId = row._cr40f_equipe_value;
      if (!teamId) return;
      const ids = membersByTeam.get(teamId) || [];
      ids.push(row._cr40f_funcionario_value);
      membersByTeam.set(teamId, ids);
    });
    return teams.map((team) => {
      const memberIds = [...new Set((membersByTeam.get(team.id) || []).filter(Boolean))];
      return { ...team, memberIds, primaryMemberId: memberIds.includes(team.primaryMemberId) ? team.primaryMemberId : memberIds.length === 1 ? memberIds[0] : "" };
    });
  } catch (error) {
    console.warn("[Planner] equipes indisponíveis; metadata ainda não provisionada", error);
    return [];
  }
}

async function replacePlannerTeamMembers(xrm, teamId, memberIds = []) {
  const rows = await retrieveMany(xrm, TEAM_MEMBER_TABLE, `?$select=${TEAM_MEMBER_TABLE}id&$filter=_cr40f_equipe_value eq ${cleanId(teamId)}`);
  await Promise.all(rows.map((row) => request(xrm, `/${entitySetName(TEAM_MEMBER_TABLE)}(${cleanId(row[`${TEAM_MEMBER_TABLE}id`])})`, { method: "DELETE" })));
  await Promise.all([...new Set(memberIds.filter(Boolean).map(String))].map(async (employeeId) => {
    const payload = { cr40f_name: `${teamId}-${employeeId}` };
    await bindLookup(xrm, payload, TEAM_MEMBER_TABLE, "cr40f_equipe", TEAM_TABLE, teamId);
    await bindLookup(xrm, payload, TEAM_MEMBER_TABLE, "cr40f_funcionario", EMPLOYEE_TABLE, employeeId);
    await request(xrm, `/${entitySetName(TEAM_MEMBER_TABLE)}`, { method: "POST", body: JSON.stringify(payload) });
  }));
}

async function createLiveTeam(xrm, state, input) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Informe um nome para a equipe.");
  if ((state.teams || []).some((team) => team.name.localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0)) throw new Error("Já existe uma equipe com esse nome.");
  const composition = validateTeamComposition(input.memberIds || [], input.primaryMemberId);
  if (!composition.valid) throw new Error(composition.error);
  const primaryName = await primaryNameAttribute(xrm, TEAM_TABLE);
  const payload = { [primaryName]: name };
  await bindLookup(xrm, payload, TEAM_TABLE, TEAM_PRIMARY_FIELD, EMPLOYEE_TABLE, composition.primaryMemberId);
  const created = await request(xrm, `/${entitySetName(TEAM_TABLE)}`, { method: "POST", body: JSON.stringify(payload) });
  const id = created?.[`${TEAM_TABLE}id`] || created?.cr40f_plannerequipeid;
  if (!id) throw new Error("Dataverse criou equipe sem retornar o ID.");
  await replacePlannerTeamMembers(xrm, id, input.memberIds || []);
  return loadLiveState(xrm);
}

async function updateLiveTeam(xrm, state, id, patch) {
  const name = String(patch.name || "").trim();
  if (!name) throw new Error("Informe um nome para a equipe.");
  if ((state.teams || []).some((team) => team.id !== id && team.name.localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0)) throw new Error("Já existe uma equipe com esse nome.");
  const composition = validateTeamComposition(patch.memberIds || [], patch.primaryMemberId || state.teams?.find((team) => team.id === id)?.primaryMemberId);
  if (!composition.valid) throw new Error(composition.error);
  const primaryName = await primaryNameAttribute(xrm, TEAM_TABLE);
  const payload = { [primaryName]: name };
  await bindLookup(xrm, payload, TEAM_TABLE, TEAM_PRIMARY_FIELD, EMPLOYEE_TABLE, composition.primaryMemberId);
  await request(xrm, `/${entitySetName(TEAM_TABLE)}(${cleanId(id)})`, { method: "PATCH", body: JSON.stringify(payload) });
  await replacePlannerTeamMembers(xrm, id, patch.memberIds || []);
  const refreshedTeams = await loadPlannerTeams(xrm);
  await syncLiveTeamTasks(xrm, { ...state, teams: refreshedTeams }, id);
  return loadLiveState(xrm);
}

async function deleteLiveTeam(xrm, state, id) {
  if (!(state.teams || []).some((team) => team.id === id)) throw new Error("Equipe não encontrada.");
  await replacePlannerTeamMembers(xrm, id, []);
  await request(xrm, `/${entitySetName(TEAM_TABLE)}(${cleanId(id)})`, { method: "DELETE" });
  return loadLiveState(xrm);
}

async function resolveEmployeeIdByName(xrm, value) {
  if (!value || value === "Não atribuído") return "";
  const escaped = String(value).replace(/'/g, "''");
  const rows = await retrieveMany(xrm, EMPLOYEE_TABLE, `?$select=cr40f_funcionariosid&$filter=cr40f_nomecompleto eq '${escaped}' and statecode eq 0 and cr40f_status eq 0 and cr40f_funcao eq 202410001&$top=2`);
  if (!rows.length) throw new Error(`Funcionário "${value}" não encontrado. Verifique cadastro ativo, statecode=0, cr40f_status=0 e cr40f_funcao=202410001 no Dataverse.`);
  if (rows.length > 1) throw new Error(`Mais de um funcionário administrativo ativo corresponde a "${value}". Corrija nomes duplicados antes de salvar.`);
  return rows[0].cr40f_funcionariosid;
}

async function resolveAssigneeIds(xrm, input) {
  if (Array.isArray(input.assigneeIds)) return [...new Set(input.assigneeIds.filter(Boolean))];
  return (await Promise.all(normalizeAssigneeNames(input.assigneeNames || input.assigneeName).map((name) => resolveEmployeeIdByName(xrm, name)))).filter(Boolean);
}

function teamMemberIds(state, input) {
  const teamIds = Array.isArray(input.teamIds) ? input.teamIds : input.teamId ? [input.teamId] : [];
  return [...new Set((state.teams || [])
    .filter((team) => teamIds.some((id) => String(id) === String(team.id)))
    .flatMap((team) => team.memberIds || []))];
}

async function replaceTaskAssignees(xrm, taskId, input) {
  const ids = await resolveAssigneeIds(xrm, input);
  const relations = await retrieveMany(xrm, ASSIGNEE_RELATION_TABLE, `?$select=${ASSIGNEE_RELATION_TABLE}id&$filter=_cr40f_tarefa_value eq ${cleanId(taskId)}`);
  await Promise.all(relations.map((relation) => request(xrm, `/${entitySetName(ASSIGNEE_RELATION_TABLE)}(${cleanId(relation[`${ASSIGNEE_RELATION_TABLE}id`])})`, { method: "DELETE" })));
  await Promise.all(ids.map(async (employeeId) => {
    const payload = { cr40f_name: `${taskId}-${employeeId}` };
    await bindLookup(xrm, payload, ASSIGNEE_RELATION_TABLE, "cr40f_tarefa", TASK_TABLE, taskId);
    await bindLookup(xrm, payload, ASSIGNEE_RELATION_TABLE, "cr40f_funcionario", EMPLOYEE_TABLE, employeeId);
    await request(xrm, `/${entitySetName(ASSIGNEE_RELATION_TABLE)}`, { method: "POST", body: JSON.stringify(payload) });
  }));
}

async function replaceTaskTeams(xrm, taskId, input) {
  const teamIds = input.assignmentMode === "team"
    ? [...new Set((input.teamIds || (input.teamId ? [input.teamId] : [])).filter(Boolean).map(String))]
    : [];
  const relations = await retrieveMany(xrm, TASK_TEAM_RELATION_TABLE, `?$select=${TASK_TEAM_RELATION_TABLE}id&$filter=_cr40f_tarefa_value eq ${cleanId(taskId)}`);
  await Promise.all(relations.map((relation) => request(xrm, `/${entitySetName(TASK_TEAM_RELATION_TABLE)}(${cleanId(relation[`${TASK_TEAM_RELATION_TABLE}id`])})`, { method: "DELETE" })));
  await Promise.all(teamIds.map(async (teamId) => {
    const payload = { cr40f_name: `${taskId}-${teamId}` };
    await bindLookup(xrm, payload, TASK_TEAM_RELATION_TABLE, "cr40f_tarefa", TASK_TABLE, taskId);
    await bindLookup(xrm, payload, TASK_TEAM_RELATION_TABLE, "cr40f_equipe", TEAM_TABLE, teamId);
    await request(xrm, `/${entitySetName(TASK_TEAM_RELATION_TABLE)}`, { method: "POST", body: JSON.stringify(payload) });
  }));
}

async function syncLiveTeamTasks(xrm, state, teamId) {
  let nextState = state;
  const openTasks = (state.tasks || []).filter((task) => !["done", "cancelled"].includes(task.status)
    && task.assignmentMode === "team"
    && (task.teamIds || (task.teamId ? [task.teamId] : [])).some((id) => cleanId(id).toLowerCase() === cleanId(teamId).toLowerCase()));
  for (const task of openTasks) {
    nextState = await updateLiveTask(xrm, nextState, task.id, {
      assignmentMode: "team",
      teamIds: task.teamIds || [task.teamId],
      teamNames: task.teamNames || [],
      teamId: task.teamId || teamId,
    });
  }
  return nextState;
}

function normalizeQuality(row, type) {
  const isAction = type === "action";
  return { id: row[isAction ? "cr40f_acaooperacionalid" : "cr40f_errooperacionalid"], type, code: row.cr40f_codigo || "", title: row.cr40f_titulo || "", description: row.cr40f_descricao || "", status: row[isAction ? "cr40f_status@OData.Community.Display.V1.FormattedValue" : "cr40f_status@OData.Community.Display.V1.FormattedValue"] || "", dueDate: dateOnly(row[isAction ? "cr40f_prazo" : "cr40f_prazoresolucao"]), assigneeId: row._cr40f_responsavel_value || "", assigneeName: row["_cr40f_responsavel_value@OData.Community.Display.V1.FormattedValue"] || "" };
}

function normalizeEventDetails(events = []) {
  const comments = events.filter((item) => item.cr40f_campo === "comentario").map((item) => ({ id: item.cr40f_plannertarefaeventoid, authorId: cleanId(item._cr40f_autor_value || item._createdby_value), text: item.cr40f_valornovo || item.cr40f_descricao || "", createdAt: item.cr40f_ocorridoem, author: item.authorName || item["_cr40f_autor_value@OData.Community.Display.V1.FormattedValue"] || item["_createdby_value@OData.Community.Display.V1.FormattedValue"] || "Sistema" })).sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")));
  const returns = events.filter((item) => item.cr40f_campo === "retorno").map((item) => {
    let raw = {};
    try { raw = JSON.parse(item.cr40f_valornovo || "{}"); } catch { raw = {}; }
    return {
      id: raw.returnId || item.cr40f_plannertarefaeventoid,
      eventId: item.cr40f_plannertarefaeventoid,
      authorId: cleanId(raw.authorId || item._cr40f_autor_value || item._createdby_value),
      text: raw.text || item.cr40f_valornovo || item.cr40f_descricao || "",
      createdAt: raw.createdAt || item.cr40f_ocorridoem,
      author: raw.author || item.authorName || item["_cr40f_autor_value@OData.Community.Display.V1.FormattedValue"] || item["_createdby_value@OData.Community.Display.V1.FormattedValue"] || "Sistema",
    };
  }).sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")));
  const attachments = events.filter((item) => item.cr40f_campo === "anexo").map((item) => {
    try {
      const raw = JSON.parse(item.cr40f_valornovo || "{}");
      const sharePointId = raw.id || raw.identificador || raw.Identifier || raw.itemId || raw.ItemId || "";
      return {
        ...raw,
        returnId: raw.returnId || "",
        id: sharePointId || item.cr40f_plannertarefaeventoid,
        sharePointId,
        eventId: item.cr40f_plannertarefaeventoid,
        fileLocator: raw.fileLocator || raw.identificador || raw.Identifier || "",
        path: raw.path || raw.caminhoSharePoint || raw.caminhoCompleto || raw.Path || "",
        name: raw.name || raw.nomeArquivo || raw.Name || "Anexo",
        mimeType: raw.mimeType || raw.MediaType || "",
        size: raw.size ?? raw.tamanho ?? raw.Size,
        createdAt: item.cr40f_ocorridoem,
      };
    } catch {
      return { id: item.cr40f_plannertarefaeventoid, sharePointId: "", eventId: item.cr40f_plannertarefaeventoid, name: item.cr40f_valornovo || "Anexo", createdAt: item.cr40f_ocorridoem };
    }
  });
  const returnsWithAttachments = returns.map((returnItem) => ({
    ...returnItem,
    attachments: attachments.filter((attachment) => attachment.returnId === returnItem.id),
  }));
  const history = events.filter((item) => !["comentario", "retorno", "anexo", "notification:mention"].includes(item.cr40f_campo)).map((item) => ({ id: item.cr40f_plannertarefaeventoid, text: item.cr40f_descricao, createdAt: item.cr40f_ocorridoem, author: item.authorName || item["_cr40f_autor_value@OData.Community.Display.V1.FormattedValue"] || item["_createdby_value@OData.Community.Display.V1.FormattedValue"] || "Sistema" }));
  return { comments, returns: returnsWithAttachments, attachments, history };
}

function normalizeCollectionEvents(events = []) {
  return events.filter((item) => item.cr40f_campo === "notification:overdue_manual").flatMap((item) => {
    try {
      const context = JSON.parse(item.cr40f_valornovo || "{}");
      return [{ id: item.cr40f_plannertarefaeventoid, taskId: item._cr40f_tarefa_value || "", occurredAt: item.cr40f_ocorridoem || "", referenceDate: context.referenceDate || "", actorEmployeeId: context.actorEmployeeId || "" }];
    } catch { return []; }
  });
}

function normalizeTask(row, events = [], assignees = [], teamRelations = []) {
  const status = STATUS_BY_VALUE[row.cr40f_status] || "todo";
  const priority = PRIORITY_BY_VALUE[row.cr40f_prioridade] || "medium";
  const origin = Object.entries(ORIGIN_VALUES).find(([, value]) => value === row.cr40f_origem)?.[0] || "manual";
  const { comments, returns, attachments, history } = normalizeEventDetails(events);
  const relationTeams = teamRelations.filter((item) => item.taskId === row.cr40f_plannertarefaid);
  const plannerTeamIds = relationTeams.length ? relationTeams.map((item) => item.teamId) : (row[`_${TASK_TEAM_FIELD}_value`] ? [row[`_${TASK_TEAM_FIELD}_value`] ] : []);
  const plannerTeamNames = relationTeams.length ? relationTeams.map((item) => item.teamName).filter(Boolean) : (row[`_${TASK_TEAM_FIELD}_value@OData.Community.Display.V1.FormattedValue`] ? [row[`_${TASK_TEAM_FIELD}_value@OData.Community.Display.V1.FormattedValue`] ] : []);
  const plannerTeamId = plannerTeamIds[0] || "";
  const plannerTeamName = plannerTeamNames.join(", ");
  const relationAssigneeIds = assignees.map((item) => item.id).filter(Boolean);
  const primaryAssigneeId = row[`_${EMPLOYEE_ASSIGNEE_FIELD}_value`] || relationAssigneeIds[0] || "";
  const responsibility = responsibilityFromIds(relationAssigneeIds, primaryAssigneeId);
  const profileById = new Map(assignees.map((item) => [cleanId(item.id).toLowerCase(), item]));
  const orderedAssignees = responsibility.assigneeIds.map((id) => profileById.get(cleanId(id).toLowerCase())).filter(Boolean);
  const fallbackName = formatLookup(row, EMPLOYEE_ASSIGNEE_FIELD);
  return {
    id: row.cr40f_plannertarefaid,
    title: row.cr40f_titulo || row.cr40f_name || "Sem título",
    description: row.cr40f_descricao || "",
    checklist: parseChecklist(row.cr40f_checklistjson),
    status,
    priority,
    restrictedVisibility: Boolean(row[TASK_RESTRICTED_VISIBILITY_FIELD]),
    dueDate: dateOnly(row.cr40f_prazo),
    waitingContext: parseWaitingContext(row),
    assigneeNames: orderedAssignees.length ? orderedAssignees.map((item) => item.name) : normalizeAssigneeNames(fallbackName),
    assigneeProfiles: orderedAssignees.map((item) => ({ id: item.id, name: item.name, userId: item.userId || "" })),
    assigneeName: orderedAssignees.length ? orderedAssignees.map((item) => item.name).join(", ") : fallbackName,
    assigneeIds: responsibility.assigneeIds,
    assigneeId: responsibility.primaryAssigneeId,
    primaryAssigneeId: responsibility.primaryAssigneeId,
    consultantIds: responsibility.consultantIds,
    primaryAssigneeName: orderedAssignees.find((item) => cleanId(item.id).toLowerCase() === cleanId(responsibility.primaryAssigneeId).toLowerCase())?.name || (responsibility.primaryAssigneeId === row[`_${EMPLOYEE_ASSIGNEE_FIELD}_value`] ? fallbackName : ""),
    consultantNames: responsibility.consultantIds.map((id) => profileById.get(cleanId(id).toLowerCase())?.name).filter(Boolean),
    creatorUserId: row._createdby_value || "",
    assignmentMode: plannerTeamIds.length ? "team" : "people",
    teamIds: plannerTeamIds,
    teamNames: plannerTeamNames,
    teamName: plannerTeamName || formatLookup(row, "cr40f_equipe", "Sem equipe"),
    teamId: plannerTeamId,
    quoteId: row._cr40f_pedidocotacao_value || null,
    quoteCode: row.quoteCode || "",
    quoteTitle: row.quoteTitle || "",
    sourceType: origin,
    sourceId: row._cr40f_pedidocotacao_value || row._cr40f_errooperacional_value || row._cr40f_acaooperacional_value || null,
    sourceCode: row.cr40f_codigoorigem || "",
    sourceLabel: origin === "quote" ? "Pedido de cotação" : origin === "quality" ? "Qualidade" : "Tarefa manual",
    comments,
    returns,
    attachments,
    history,
  };
}

function normalizeRelation(row) {
  return { id: row.cr40f_plannertarearelacaoid, parentTaskId: row._cr40f_tarefapai_value || "", childTaskId: row._cr40f_subtarefa_value || "" };
}

function normalizeTaskTeamRelation(row) {
  return {
    id: row.cr40f_plannertarefaequipeid,
    taskId: row._cr40f_tarefa_value || "",
    teamId: row._cr40f_equipe_value || "",
    teamName: row["_cr40f_equipe_value@OData.Community.Display.V1.FormattedValue"] || "",
  };
}

function applyDynamicTeamAssignment(task, teams = [], employees = []) {
  if (task?.assignmentMode !== "team") return task;
  const teamIds = task.teamIds || (task.teamId ? [task.teamId] : []);
  const selectedTeams = teams.filter((team) => teamIds.some((id) => cleanId(id).toLowerCase() === cleanId(team.id).toLowerCase()));
  const memberIds = [...new Set(selectedTeams.flatMap((team) => team.memberIds || []))];
  const responsibility = responsibilityFromIds(memberIds, selectedTeams[0]?.primaryMemberId || memberIds[0]);
  const employeeById = new Map(employees.map((employee) => [cleanId(employee.id).toLowerCase(), employee]));
  const memberProfiles = responsibility.assigneeIds.map((id) => employeeById.get(cleanId(id).toLowerCase())).filter(Boolean);
  return {
    ...task,
    assigneeIds: responsibility.assigneeIds,
    assigneeProfiles: memberProfiles,
    assigneeNames: memberProfiles.map((employee) => employee.name),
    assigneeName: memberProfiles.map((employee) => employee.name).join(", ") || "Não atribuído",
    primaryAssigneeId: responsibility.primaryAssigneeId,
    consultantIds: responsibility.consultantIds,
    primaryAssigneeName: memberProfiles[0]?.name || "",
    consultantNames: memberProfiles.slice(1).map((employee) => employee.name),
  };
}

function measureStage(name, operation) {
  const startedAt = globalThis.performance?.now?.() || Date.now();
  return Promise.resolve().then(operation).then((result) => {
    const elapsed = Math.round((globalThis.performance?.now?.() || Date.now()) - startedAt);
    console.info(`[Planner] ${name}: ${elapsed} ms`);
    return result;
  }, (error) => {
    const elapsed = Math.round((globalThis.performance?.now?.() || Date.now()) - startedAt);
    console.warn(`[Planner] ${name}: falhou após ${elapsed} ms`, error);
    throw error;
  });
}

function buildCoreState(xrm, rows, relations, assigneeRelations, employees, currentUserEmail = "", teams = [], teamRelations = [], personalTagData = {}) {
  const employeeRecords = employees.map((row) => ({ id: row.cr40f_funcionariosid, name: row.cr40f_nomecompleto || row.new_apelido || "Sem nome", apelido: row.new_apelido || "", emailMicrosoft: row.cr40f_emailmicrosoft || "", mentionSearchText: [row.cr40f_nomecompleto, row.new_apelido].filter(Boolean).join(" "), userId: row._cr40f_usuariodataverse_value || "", externalNotificationsAvailable: Boolean(row._cr40f_usuariodataverse_value) }));
  const employeeById = new Map(employeeRecords.map((employee) => [cleanId(employee.id).toLowerCase(), employee]));
  const relationByChild = new Map(relations.map(normalizeRelation).map((item) => [item.childTaskId, item.parentTaskId]));
  const assigneesByTask = new Map();
  assigneeRelations.forEach((item) => {
    const list = assigneesByTask.get(item._cr40f_tarefa_value) || [];
    const employee = employeeById.get(cleanId(item._cr40f_funcionario_value).toLowerCase());
    list.push({ id: item._cr40f_funcionario_value, name: item["_cr40f_funcionario_value@OData.Community.Display.V1.FormattedValue"] || employee?.name || "Sem nome", userId: employee?.userId || "" });
    assigneesByTask.set(item._cr40f_tarefa_value, list);
  });
  const tasks = applyPersonalTagsToTasks(rows.map((row) => {
    const task = normalizeTask(row, [], assigneesByTask.get(row.cr40f_plannertarefaid) || [], teamRelations);
    const creator = employeeRecords.find((employee) => cleanId(employee.userId).toLowerCase() === cleanId(task.creatorUserId).toLowerCase());
    return { ...applyDynamicTeamAssignment(task, teams, employeeRecords), creatorEmployeeId: creator?.id || "", parentTaskId: relationByChild.get(row.cr40f_plannertarefaid) || null, detailsLoaded: false };
  }), personalTagData.personalTagAssignments || []);
  return { quotes: [], employees: employeeRecords, teams, currentUserEmail, currentUserId: cleanId(xrm.Utility?.getGlobalContext?.().userSettings?.userId), personalTags: personalTagData.personalTags || [], personalTagsUnavailable: Boolean(personalTagData.personalTagsUnavailable), quality: [], tasks, notifications: [], lastUpdated: new Date().toISOString(), live: true, loading: { core: false, quotes: true, quality: true, notifications: true } };
}

export async function loadCoreState(xrm) {
  const currentUserId = cleanId(xrm.Utility?.getGlobalContext?.().userSettings?.userId);
  const [rows, relations, assigneeRelations, employees, currentUserEmail, teams, teamRelations, personalTagData] = await Promise.all([
    measureStage("tarefas", () => retrievePlannerTasks(xrm)),
    measureStage("relações", () => retrieveMany(xrm, RELATION_TABLE, "?$select=cr40f_plannertarearelacaoid,_cr40f_tarefapai_value,_cr40f_subtarefa_value&$filter=statecode eq 0")),
    measureStage("responsáveis", () => retrieveMany(xrm, ASSIGNEE_RELATION_TABLE, "?$select=cr40f_plannertarearesponsavelid,_cr40f_tarefa_value,_cr40f_funcionario_value&$filter=statecode eq 0")),
    measureStage("funcionários", () => retrieveMany(xrm, EMPLOYEE_TABLE, "?$select=cr40f_funcionariosid,cr40f_nomecompleto,new_apelido,cr40f_emailmicrosoft,_cr40f_usuariodataverse_value&$filter=statecode eq 0 and cr40f_status eq 0 and cr40f_funcao eq 202410001&$orderby=cr40f_nomecompleto asc")),
    measureStage("identidade atual", () => loadCurrentUserEmail(xrm)),
    measureStage("equipes do Planner", () => loadPlannerTeams(xrm)),
    measureStage("equipes das tarefas", () => retrieveOptional(xrm, TASK_TEAM_RELATION_TABLE, "?$select=cr40f_plannertarefaequipeid,_cr40f_tarefa_value,_cr40f_equipe_value&$filter=statecode eq 0", "relação tarefa/equipe")),
    measureStage("tags pessoais", () => loadLivePersonalTagData(xrm, currentUserId)),
  ]);
  await measureStage("vínculos Microsoft", () => reconcileEmployeeUserLinks(xrm, employees));
  return buildCoreState(xrm, rows, relations, assigneeRelations, employees, currentUserEmail, teams, teamRelations.map(normalizeTaskTeamRelation), personalTagData);
}

export async function loadSupplementalState(xrm, state) {
  const quoteIds = [...new Set((state.tasks || []).map((task) => cleanId(task.quoteId)).filter(Boolean))];
  const quoteChunks = Array.from({ length: Math.ceil(quoteIds.length / 50) }, (_, index) => quoteIds.slice(index * 50, index * 50 + 50));
  const loadLinkedQuotes = () => {
    if (!quoteIds.length) return retrieveMany(xrm, QUOTE_TABLE, `?$select=${QUOTE_SELECT}&$filter=statecode eq 0&$orderby=modifiedon desc&$top=25`);
    return Promise.all(quoteChunks.map((chunk) => {
    const filter = chunk.map((id) => `cr40f_pedidodecotacaoid eq ${id}`).join(" or ");
    return retrieveMany(xrm, QUOTE_TABLE, `?$select=${QUOTE_SELECT}&$filter=statecode eq 0 and (${filter})`);
    })).then((pages) => pages.flat());
  };
  const [quotes, qualityErrors, qualityActions] = await Promise.all([
    measureStage("cotações vinculadas", loadLinkedQuotes),
    measureStage("erros operacionais", () => retrieveMany(xrm, QUALITY_ERROR_TABLE, "?$select=cr40f_errooperacionalid,cr40f_codigo,cr40f_titulo,cr40f_descricao,cr40f_status,cr40f_prazoresolucao,_cr40f_responsavel_value&$filter=statecode eq 0&$orderby=createdon desc")),
    measureStage("ações operacionais", () => retrieveMany(xrm, QUALITY_ACTION_TABLE, "?$select=cr40f_acaooperacionalid,cr40f_titulo,cr40f_descricao,cr40f_status,cr40f_prazo,_cr40f_responsavel_value&$filter=statecode eq 0&$orderby=createdon desc")),
  ]);
  const quoteRecords = quotes.map(normalizeQuote);
  const quoteById = new Map(quoteRecords.map((quote) => [quote.id, quote]));
  const employees = state.employees || [];
  const employeeById = new Map(employees.map((employee) => [cleanId(employee.id).toLowerCase(), employee]));
  const quality = [...qualityErrors.map((row) => normalizeQuality(row, "error")), ...qualityActions.map((row) => normalizeQuality(row, "action"))].map((item) => ({ ...item, assigneeProfiles: employeeById.has(cleanId(item.assigneeId).toLowerCase()) ? [employeeById.get(cleanId(item.assigneeId).toLowerCase())] : [] }));
  const tasks = state.tasks.map((task) => ({ ...task, quoteCode: quoteById.get(task.quoteId)?.code || "", quoteTitle: quoteById.get(task.quoteId)?.title || "" }));
  return { quotes: quoteRecords, quality, tasks, loading: { ...(state.loading || {}), quotes: false, quality: false } };
}

export async function loadTaskDetails(xrm, taskId) {
  const events = await measureStage(`detalhes ${cleanId(taskId).slice(0, 8)}`, () => retrieveMany(xrm, EVENT_TABLE, `${PLANNER_EVENTS_QUERY}&$filter=_cr40f_tarefa_value eq ${cleanId(taskId)}`));
  const details = normalizeEventDetails(events);
  return { taskId, ...details };
}

export async function searchQuotes(xrm, query) {
  const escaped = String(query || "").trim().replace(/'/g, "''");
  if (!escaped) return [];
  const filter = `contains(cr40f_numerodacotacao,'${escaped}') or contains(cr40f_titulo,'${escaped}') or contains(cr40f_clienteempresa,'${escaped}')`;
  const rows = await measureStage("busca de cotações", () => retrieveMany(xrm, QUOTE_TABLE, `?$select=${QUOTE_SELECT}&$filter=statecode eq 0 and (${filter})&$orderby=modifiedon desc&$top=25`));
  return rows.map(normalizeQuote);
}

async function loadLiveState(xrm) {
  const currentUserId = cleanId(xrm.Utility?.getGlobalContext?.().userSettings?.userId);
  const [quotes, rows, events, relations, assigneeRelations, qualityErrors, qualityActions, employees, currentUserEmail, teams, teamRelations, personalTagData] = await Promise.all([
    retrieveMany(xrm, QUOTE_TABLE, `?$select=${QUOTE_SELECT}&$filter=statecode eq 0&$orderby=modifiedon desc`),
    retrievePlannerTasks(xrm),
    retrieveMany(xrm, EVENT_TABLE, "?$select=cr40f_plannertarefaeventoid,_cr40f_tarefa_value,cr40f_tipo,cr40f_campo,cr40f_descricao,cr40f_valornovo,cr40f_ocorridoem,_cr40f_autor_value,_createdby_value&$orderby=cr40f_ocorridoem desc"),
    retrieveMany(xrm, RELATION_TABLE, "?$select=cr40f_plannertarearelacaoid,_cr40f_tarefapai_value,_cr40f_subtarefa_value&$filter=statecode eq 0"),
    retrieveMany(xrm, ASSIGNEE_RELATION_TABLE, "?$select=cr40f_plannertarearesponsavelid,_cr40f_tarefa_value,_cr40f_funcionario_value&$filter=statecode eq 0"),
    retrieveMany(xrm, QUALITY_ERROR_TABLE, "?$select=cr40f_errooperacionalid,cr40f_codigo,cr40f_titulo,cr40f_descricao,cr40f_status,cr40f_prazoresolucao,_cr40f_responsavel_value&$filter=statecode eq 0&$orderby=createdon desc"),
    retrieveMany(xrm, QUALITY_ACTION_TABLE, "?$select=cr40f_acaooperacionalid,cr40f_titulo,cr40f_descricao,cr40f_status,cr40f_prazo,_cr40f_responsavel_value&$filter=statecode eq 0&$orderby=createdon desc"),
    retrieveMany(xrm, EMPLOYEE_TABLE, "?$select=cr40f_funcionariosid,cr40f_nomecompleto,new_apelido,cr40f_emailmicrosoft,_cr40f_usuariodataverse_value&$filter=statecode eq 0 and cr40f_status eq 0 and cr40f_funcao eq 202410001&$orderby=cr40f_nomecompleto asc"),
    loadCurrentUserEmail(xrm),
    loadPlannerTeams(xrm),
    retrieveOptional(xrm, TASK_TEAM_RELATION_TABLE, "?$select=cr40f_plannertarefaequipeid,_cr40f_tarefa_value,_cr40f_equipe_value&$filter=statecode eq 0", "relação tarefa/equipe"),
    loadLivePersonalTagData(xrm, currentUserId),
  ]);
  await measureStage("vínculos Microsoft", () => reconcileEmployeeUserLinks(xrm, employees));
  const employeeRecords = employees.map((row) => ({ id: row.cr40f_funcionariosid, name: row.cr40f_nomecompleto || row.new_apelido || "Sem nome", apelido: row.new_apelido || "", emailMicrosoft: row.cr40f_emailmicrosoft || "", mentionSearchText: [row.cr40f_nomecompleto, row.new_apelido].filter(Boolean).join(" "), userId: row._cr40f_usuariodataverse_value || "", externalNotificationsAvailable: Boolean(row._cr40f_usuariodataverse_value) }));
  const employeeById = new Map(employeeRecords.map((employee) => [cleanId(employee.id).toLowerCase(), employee]));
  const relationByChild = new Map(relations.map(normalizeRelation).map((item) => [item.childTaskId, item.parentTaskId]));
  const assigneesByTask = new Map();
  assigneeRelations.forEach((item) => {
    const list = assigneesByTask.get(item._cr40f_tarefa_value) || [];
    const employee = employeeById.get(cleanId(item._cr40f_funcionario_value).toLowerCase());
    list.push({ id: item._cr40f_funcionario_value, name: item["_cr40f_funcionario_value@OData.Community.Display.V1.FormattedValue"] || employee?.name || "Sem nome", userId: employee?.userId || "" });
    assigneesByTask.set(item._cr40f_tarefa_value, list);
  });
  const eventsByTask = new Map();
  events.forEach((event) => { const list = eventsByTask.get(event._cr40f_tarefa_value) || []; list.push(event); eventsByTask.set(event._cr40f_tarefa_value, list); });
  const tasks = applyPersonalTagsToTasks(rows.map((row) => {
    const task = normalizeTask(row, eventsByTask.get(row.cr40f_plannertarefaid) || [], assigneesByTask.get(row.cr40f_plannertarefaid) || [], teamRelations.map(normalizeTaskTeamRelation));
    const creator = employeeRecords.find((employee) => cleanId(employee.userId).toLowerCase() === cleanId(task.creatorUserId).toLowerCase());
    return { ...applyDynamicTeamAssignment(task, teams, employeeRecords), creatorEmployeeId: creator?.id || "", parentTaskId: relationByChild.get(row.cr40f_plannertarefaid) || null };
  }), personalTagData.personalTagAssignments || []);
  const quoteById = new Map(quotes.map((row) => [row.cr40f_pedidodecotacaoid, normalizeQuote(row)]));
  const employeesWithProfiles = employeeRecords;
  const quality = [...qualityErrors.map((row) => normalizeQuality(row, "error")), ...qualityActions.map((row) => normalizeQuality(row, "action"))].map((item) => ({ ...item, assigneeProfiles: employeeById.has(cleanId(item.assigneeId).toLowerCase()) ? [employeesWithProfiles.find((employee) => cleanId(employee.id).toLowerCase() === cleanId(item.assigneeId).toLowerCase())] : [] }));
  const tasksWithProfiles = tasks.map((task) => ({ ...task, assigneeProfiles: task.assigneeProfiles?.length ? task.assigneeProfiles : task.assigneeIds.map((id) => employeesWithProfiles.find((employee) => cleanId(employee.id).toLowerCase() === cleanId(id).toLowerCase())).filter(Boolean), quoteCode: quoteById.get(task.quoteId)?.code || "", quoteTitle: quoteById.get(task.quoteId)?.title || "" }));
  return { quotes: [...quoteById.values()], employees: employeesWithProfiles, teams, currentUserEmail, currentUserId, personalTags: personalTagData.personalTags || [], personalTagsUnavailable: Boolean(personalTagData.personalTagsUnavailable), quality, tasks: tasksWithProfiles, notifications: [], collectionEvents: normalizeCollectionEvents(events), lastUpdated: new Date().toISOString(), live: true };
}

const EMAIL_DISPATCH_STATUSES = Object.freeze({
  pending: 100000000,
  sent: 100000001,
  failed: 100000002,
  noAddress: 100000003,
});

function normalizeEmailDispatch(row) {
  const statusValue = Number(row.cr40f_status);
  const status = Object.entries(EMAIL_DISPATCH_STATUSES).find(([, value]) => value === statusValue)?.[0] || "unknown";
  const key = String(row.cr40f_chaveidempotente || "");
  return {
    id: row.cr40f_plannerdisparoid || "",
    status,
    statusValue,
    statusText: row.cr40f_statustexto || "",
    recipientEmployeeId: row._cr40f_destinatario_value || "",
    recipientEmail: row.cr40f_destinatariotexto || "",
    error: row.cr40f_erro || "",
    attempt: Number(row.cr40f_tentativa || 0),
    sentAt: row.cr40f_enviadoem || "",
    createdAt: row.createdon || "",
    modifiedAt: row.modifiedon || "",
    idempotencyKey: key,
    eventId: cleanId(key.split("|")[0]),
    channel: ({ 100000000: "Teams", 100000001: "Email", 100000002: "PowerAppsPush" })[Number(row.cr40f_canal)] || String(row.cr40f_canal || ""),
  };
}

function notificationEmailDelivery(row, dispatches = []) {
  const eventId = cleanId(row._cr40f_eventoorigem_value);
  const recipientId = cleanId(row._cr40f_destinatario_value);
  const type = String(row.cr40f_tipo || "update");
  if (!eventId || !recipientId) return null;
  const expectedKeys = [
    `${eventId}|${recipientId}|${type}|PowerAppsPush`.toLowerCase(),
    `${eventId}|${recipientId}|${type}|Email`.toLowerCase(),
  ];
  const expectedKey = expectedKeys[0];
  const dispatch = dispatches.find((item) => expectedKeys.includes(item.idempotencyKey.toLowerCase()));
  if (dispatch) return dispatch;

  const occurredAt = new Date(row.cr40f_ocorridoem || row.createdon || 0).getTime();
  const isRecent = Number.isFinite(occurredAt) && occurredAt > Date.now() - (15 * 60 * 1000);
  return isRecent ? {
    status: "pending",
    statusText: "Aguardando confirmação do Flow",
    recipientEmployeeId: recipientId,
    recipientEmail: "",
    error: "",
    attempt: 0,
    sentAt: "",
    createdAt: row.cr40f_ocorridoem || row.createdon || "",
    modifiedAt: "",
    idempotencyKey: expectedKey,
    eventId,
  } : null;
}

function normalizeNotification(row, dispatches = []) {
  return {
    id: row.cr40f_plannernotificacaoid,
    taskId: row._cr40f_tarefa_value || "",
    recipientEmployeeId: row._cr40f_destinatario_value || "",
    eventOriginId: row._cr40f_eventoorigem_value || "",
    type: row.cr40f_tipo || "update",
    title: row.cr40f_titulo || row.cr40f_name || "Notificação",
    message: row.cr40f_mensagem || "",
    occurredAt: row.cr40f_ocorridoem || row.createdon || "",
    readAt: row.cr40f_lidoem || "",
    referenceDate: dateOnly(row.cr40f_datareferencia),
    dedupeKey: row.cr40f_chavededupe || "",
    emailDelivery: notificationEmailDelivery(row, dispatches),
  };
}

async function loadLiveEmailDispatches(xrm, employeeId) {
  if (!employeeId) return [];
  try {
    const rows = await retrieveMany(xrm, EMAIL_DISPATCH_TABLE, `?$select=cr40f_plannerdisparoid,cr40f_canal,cr40f_status,cr40f_statustexto,cr40f_destinatariotexto,cr40f_chaveidempotente,cr40f_erro,cr40f_tentativa,cr40f_enviadoem,createdon,modifiedon,_cr40f_destinatario_value&$filter=_cr40f_destinatario_value eq ${cleanId(employeeId)}&$orderby=createdon desc&$top=200`);
    return rows.map(normalizeEmailDispatch);
  } catch (error) {
    console.warn("[Planner] status de e-mail indisponível", error);
    return [];
  }
}

async function loadLiveNotifications(xrm, employeeId) {
  if (!employeeId) return [];
  try {
    const [rows, dispatches] = await Promise.all([
      retrieveMany(xrm, NOTIFICATION_TABLE, `?$select=cr40f_plannernotificacaoid,cr40f_name,cr40f_titulo,cr40f_mensagem,cr40f_tipo,cr40f_ocorridoem,cr40f_lidoem,cr40f_datareferencia,cr40f_chavededupe,_cr40f_tarefa_value,_cr40f_destinatario_value,_cr40f_eventoorigem_value&$filter=_cr40f_destinatario_value eq ${cleanId(employeeId)} and statecode eq 0&$orderby=cr40f_ocorridoem desc&$top=100`),
      loadLiveEmailDispatches(xrm, employeeId),
    ]);
    return rows.map((row) => normalizeNotification(row, dispatches));
  } catch (error) {
    console.warn("[Planner] notificações indisponíveis", error);
    throw new Error("Notificações indisponíveis no Dataverse. Verifique a tabela e as permissões.", { cause: error });
  }
}

function liveTaskRecipientIds(state, task) {
  if (task?.assignmentMode === "team") {
    const teamIds = task.teamIds || (task.teamId ? [task.teamId] : []);
    return [...new Set((state.teams || []).filter((team) => teamIds.some((id) => String(id) === String(team.id))).flatMap((team) => team.memberIds || []))];
  }
  return [...new Set((task?.assigneeIds || []).filter(Boolean).map(String))];
}

async function collectLiveTask(xrm, state, id, input = {}) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task || ["done", "cancelled"].includes(task.status)) throw new Error("A tarefa não está ativa.");
  const referenceDate = input.referenceDate || localDateKey(input.now || new Date());
  const dedupePrefix = manualCollectionKey(id, referenceDate);
  const [existingNotifications, existingEvents] = await Promise.all([
    retrieveMany(xrm, NOTIFICATION_TABLE, `?$select=cr40f_plannernotificacaoid&$filter=startswith(cr40f_chavededupe,'${dedupePrefix.replace(/'/g, "''")}')&$top=1`),
    retrieveMany(xrm, EVENT_TABLE, `?$select=${EVENT_TABLE}id,cr40f_valornovo&$filter=_cr40f_tarefa_value eq ${cleanId(id)} and cr40f_campo eq 'notification:overdue_manual'&$orderby=cr40f_ocorridoem desc&$top=20`),
  ]);
  const eventAlreadyCollected = existingEvents.some((event) => {
    try { return JSON.parse(event.cr40f_valornovo || "{}").referenceDate === referenceDate; } catch { return false; }
  });
  if (existingNotifications.length || eventAlreadyCollected) throw new Error("Esta tarefa já foi cobrada hoje.");
  const recipients = liveTaskRecipientIds(state, task);
  const occurredAt = input.occurredAt || new Date().toISOString();
  const context = {
    actorEmployeeId: input.actorEmployeeId || "",
    actorUserId: input.actorUserId || "",
    creatorEmployeeId: task.creatorEmployeeId || "",
    assigneeIds: recipients,
    notificationRecipientIds: recipients,
    referenceDate,
    collectionType: "manual_overdue",
  };
  await createEvent(xrm, id, 100000002, "Cobrança manual enviada ao responsável.", "notification:overdue_manual", "", JSON.stringify(context));
  return loadLiveState(xrm);
}

async function markLiveNotificationRead(xrm, notificationId, readAt = new Date().toISOString()) {
  await request(xrm, `/${entitySetName(NOTIFICATION_TABLE)}(${cleanId(notificationId)})`, { method: "PATCH", body: JSON.stringify({ cr40f_lidoem: readAt }) });
  return readAt;
}

export function withNotificationEnvironment(xrm, field, next) {
  if (!String(field || "").startsWith("notification:")) return next;
  try {
    const context = JSON.parse(next || "{}");
    const globalContext = xrm.Utility?.getGlobalContext?.();
    const clientUrl = globalContext?.getClientUrl?.()?.replace(/\/$/, "");
    const appUrl = globalContext?.getCurrentAppUrl?.()?.replace(/\/$/, "");
    if (!clientUrl || !context || Array.isArray(context) || typeof context !== "object") return next;
    return JSON.stringify({ ...context, plannerBaseUrl: clientUrl, plannerAppUrl: appUrl || "" });
  } catch {
    return next;
  }
}

async function createEvent(xrm, taskId, type, description, field = "", previous = "", next = "") {
  const payload = { cr40f_tipo: type, cr40f_descricao: description, cr40f_campo: field, cr40f_valoranterior: previous, cr40f_valornovo: withNotificationEnvironment(xrm, field, next), cr40f_ocorridoem: new Date().toISOString() };
  await bindLookup(xrm, payload, EVENT_TABLE, "cr40f_tarefa", TASK_TABLE, taskId);
  return request(xrm, `/${entitySetName(EVENT_TABLE)}`, { method: "POST", body: JSON.stringify(payload) });
}

function emailDispatchFeedback(dispatch, recipientEmail = "") {
  if (!dispatch) return { status: "pending", type: "pending", text: "Evento criado, mas o Flow ainda não confirmou o disparo." };
  if (dispatch.status === "sent") return { status: "sent", type: "success", text: `Push enviado${dispatch.recipientEmail || recipientEmail ? ` para ${dispatch.recipientEmail || recipientEmail}` : ""}.`, dispatch };
  if (dispatch.status === "failed") {
    const detail = String(dispatch.error || "O Flow registrou uma falha sem detalhes.").trim();
    return { status: "failed", type: "error", text: `Push não enviado. ${detail.slice(0, 220)}`, dispatch };
  }
  if (dispatch.status === "noAddress") return { status: "noAddress", type: "warning", text: "Push não enviado: o destinatário não tem identidade Microsoft vinculada.", dispatch };
  return { status: "pending", type: "pending", text: "Evento criado, mas o Flow ainda não confirmou o disparo.", dispatch };
}

async function waitForLiveEmailDispatch(xrm, eventId) {
  const escapedEventId = cleanId(eventId).replace(/'/g, "''");
  const query = `?$select=cr40f_plannerdisparoid,cr40f_canal,cr40f_status,cr40f_statustexto,cr40f_destinatariotexto,cr40f_chaveidempotente,cr40f_erro,cr40f_tentativa,cr40f_enviadoem,createdon,modifiedon,_cr40f_destinatario_value&$filter=startswith(cr40f_chaveidempotente,'${escapedEventId}|') and cr40f_canal eq 100000002&$orderby=createdon desc&$top=1`;
  const deadline = Date.now() + 10000;
  let lastError = null;
  while (Date.now() <= deadline) {
    try {
      const rows = await retrieveMany(xrm, EMAIL_DISPATCH_TABLE, query);
      if (rows[0]) return emailDispatchFeedback(normalizeEmailDispatch(rows[0]), rows[0].cr40f_destinatariotexto || "");
    } catch (error) {
      lastError = error;
      break;
    }
    if (Date.now() >= deadline) break;
    await new Promise((resolve) => globalThis.setTimeout(resolve, 1000));
  }
  if (lastError) return { status: "unknown", type: "error", text: `Evento criado, mas não foi possível confirmar o envio: ${lastError.message || "consulta indisponível"}` };
  return emailDispatchFeedback(null);
}

async function sendLiveNotificationTest(xrm, state, input = {}) {
  const taskId = cleanId(input.taskId);
  const task = (state.tasks || []).find((item) => cleanId(item.id) === taskId);
  if (!task) throw new Error("Selecione uma tarefa válida para o teste.");
  const message = String(input.message || "").trim() || "Teste de notificação do Planner.";
  const type = ["digest_daily", "digest_weekly", "update", "mention", "deadline", "status"].includes(input.type) ? input.type : "digest_daily";
  const typeLabel = type === "digest_weekly" ? "Resumo semanal" : type === "digest_daily" ? "Resumo diário" : type;
  const currentEmail = String(state.currentUserEmail || "").trim().toLowerCase();
  const testRecipient = (state.employees || []).find((employee) => String(employee.emailMicrosoft || "").trim().toLowerCase() === currentEmail);
  if (!testRecipient?.id) throw new Error("Seu usuário Microsoft não está vinculado a um funcionário ativo do Planner.");
  const event = await createEvent(
    xrm,
    taskId,
    100000001,
    `[Teste] ${typeLabel}: ${message}`,
    "notification:test",
    "",
    JSON.stringify({ testNotification: true, testType: type, collectionType: type, actorEmail: currentEmail, notificationRecipientIds: [testRecipient.id] }),
  );
  const eventId = cleanId(event?.cr40f_plannertarefaeventoid || event?.[`${EVENT_TABLE}id`]);
  const dispatch = eventId
    ? await waitForLiveEmailDispatch(xrm, eventId)
    : { status: "unknown", type: "error", text: "Evento criado, mas a API não devolveu o identificador para confirmar o e-mail." };
  return { state: await loadLiveState(xrm), emailDispatch: dispatch };
}

async function createLiveTask(xrm, state, input) {
  if (input.quoteId && !input.parentTaskId) {
  const activeMain = state.tasks.find((task) => task.quoteId === input.quoteId && !task.parentTaskId && !["done", "cancelled"].includes(task.status));
    if (activeMain) throw new Error("Esta cotação já possui um acompanhamento principal ativo.");
  }
  const status = input.status || "todo";
  const waitingContext = normalizeWaitingContext(input.waitingContext);
  const waitingValidation = validateWaitingContext(status, waitingContext);
  if (!waitingValidation.allowed) throw new Error(waitingValidation.error);
  const payload = { cr40f_titulo: input.title.trim(), cr40f_descricao: input.description || "", cr40f_status: STATUS_VALUES[status], cr40f_prioridade: PRIORITY_VALUES[input.priority] || PRIORITY_VALUES.medium, cr40f_prazo: input.dueDate ? `${input.dueDate}T12:00:00Z` : null, [TASK_RESTRICTED_VISIBILITY_FIELD]: Boolean(input.restrictedVisibility), ...waitingContextPayload(waitingContext), cr40f_origem: ORIGIN_VALUES[input.sourceType || (input.quoteId ? "quote" : "manual")], cr40f_codigoorigem: input.sourceCode || input.quoteCode || "" };
  if (input.contactId) {
    const schema = requireContactSchema();
    await bindLookup(xrm, payload, TASK_TABLE, schema.taskLookup, schema.table, input.contactId);
  }
  await bindLookup(xrm, payload, TASK_TABLE, "cr40f_pedidocotacao", QUOTE_TABLE, input.quoteId);
  await bindLookup(xrm, payload, TASK_TABLE, "cr40f_errooperacional", QUALITY_ERROR_TABLE, input.qualityType === "error" ? input.qualityId : "");
  await bindLookup(xrm, payload, TASK_TABLE, "cr40f_acaooperacional", QUALITY_ACTION_TABLE, input.qualityType === "action" ? input.qualityId : "");
  const assignment = resolveTaskAssignment(input, state.teams || [], state.employees || []);
  const assigneeIds = assignment.assigneeIds.length
    ? assignment.assigneeIds
    : [...new Set(await resolveAssigneeIds(xrm, input))];
  await bindLookup(xrm, payload, TASK_TABLE, EMPLOYEE_ASSIGNEE_FIELD, EMPLOYEE_TABLE, assigneeIds[0]);
  await bindLookup(xrm, payload, TASK_TABLE, TASK_TEAM_FIELD, TEAM_TABLE, input.assignmentMode === "team" ? (input.teamIds?.[0] || input.teamId) : "");
  const created = await request(xrm, `/${entitySetName(TASK_TABLE)}`, { method: "POST", body: JSON.stringify(payload) });
  const id = created?.cr40f_plannertarefaid;
  if (!id) throw new Error("Dataverse criou tarefa sem retornar o ID.");
  await replaceTaskAssignees(xrm, id, { ...input, ...assignment, assigneeIds });
  await replaceTaskTeams(xrm, id, input);
  await markQuoteOrigin(xrm, input.quoteId, id);
  await createEvent(xrm, id, 100000000, "Tarefa criada.");
  if (assigneeIds.length) {
    await createEvent(xrm, id, 100000003, "Responsáveis atribuídos.", "notification:assignment", "", JSON.stringify({ actorEmployeeId: input.actorEmployeeId || "", actorUserId: input.actorUserId || "", creatorEmployeeId: input.actorEmployeeId || "", assigneeIds, previousAssigneeIds: [] }));
  }
  if (status === "waiting") {
    await createEvent(xrm, id, 100000002, waitingContextSummary(waitingContext), "notification:waiting", "", JSON.stringify({ actorEmployeeId: input.actorEmployeeId || "", actorUserId: input.actorUserId || "", creatorEmployeeId: input.actorEmployeeId || "", assigneeIds, waitingContext, waitingTargetIds: waitingTargetIds(state, waitingContext) }));
  }
  return loadLiveState(xrm);
}

async function updateLiveTask(xrm, state, id, patch) {
  const existing = state.tasks.find((item) => item.id === id);
  const previousStatus = existing?.status || "";
  const previousDueDate = existing?.dueDate || "";
  const previousAssigneeIds = existing?.assigneeIds || [];
  const previousPrimaryAssigneeId = existing?.primaryAssigneeId || previousAssigneeIds[0] || "";
  const nextStatus = patch.status ?? previousStatus;
  const effectiveAssignmentMode = patch.assignmentMode ?? existing?.assignmentMode ?? "people";
  const waitingContext = patch.waitingContext === undefined
    ? normalizeWaitingContext(existing?.waitingContext)
    : normalizeWaitingContext(patch.waitingContext);
  const waitingValidation = validateWaitingContext(nextStatus, waitingContext);
  if (existing && previousStatus !== "waiting" && nextStatus === "waiting" && !waitingValidation.allowed) {
    throw new Error(waitingValidation.error);
  }
  const payload = {};
  if (patch.title !== undefined) payload.cr40f_titulo = patch.title.trim();
  if (patch.description !== undefined) payload.cr40f_descricao = patch.description;
  if (patch.status !== undefined) payload.cr40f_status = STATUS_VALUES[patch.status];
  if (patch.priority !== undefined) payload.cr40f_prioridade = PRIORITY_VALUES[patch.priority];
  if (patch.dueDate !== undefined) payload.cr40f_prazo = patch.dueDate ? `${patch.dueDate}T12:00:00Z` : null;
  if (patch.restrictedVisibility !== undefined) payload[TASK_RESTRICTED_VISIBILITY_FIELD] = Boolean(patch.restrictedVisibility);
  if (patch.waitingContext !== undefined || (patch.status !== undefined && nextStatus === "waiting")) Object.assign(payload, waitingContextPayload(waitingContext));
  const relationUpdates = [];
  let resolvedAssigneeIds = previousAssigneeIds;
  let resolvedPrimaryAssigneeId = previousPrimaryAssigneeId;
  if (patch.assigneeId !== undefined || patch.assigneeName !== undefined || patch.assigneeNames !== undefined || patch.assigneeIds !== undefined || patch.primaryAssigneeId !== undefined || patch.consultantIds !== undefined || patch.assignmentMode !== undefined || patch.teamIds !== undefined || patch.teamId !== undefined) {
    relationUpdates.push((async () => {
      const navigation = await resolveLookupNavigation(xrm, TASK_TABLE, EMPLOYEE_ASSIGNEE_FIELD, EMPLOYEE_TABLE);
      const assignment = resolveTaskAssignment({ ...existing, ...patch, assignmentMode: effectiveAssignmentMode }, state.teams || [], state.employees || []);
      const assigneeIds = assignment.assigneeIds.length
        ? assignment.assigneeIds
        : [...new Set(await resolveAssigneeIds(xrm, { ...existing, ...patch }))];
      resolvedAssigneeIds = assigneeIds;
      resolvedPrimaryAssigneeId = assignment.primaryAssigneeId || assigneeIds[0] || "";
      const employeeId = assigneeIds[0] || "";
      payload[`${navigation}@odata.bind`] = employeeId ? `/${entitySetName(EMPLOYEE_TABLE)}(${cleanId(employeeId)})` : null;
      await replaceTaskAssignees(xrm, id, { ...patch, ...assignment, assigneeIds });
    })());
  }
  if (patch.assignmentMode !== undefined || patch.teamIds !== undefined || patch.teamId !== undefined) {
    relationUpdates.push((async () => {
      const navigation = await resolveLookupNavigation(xrm, TASK_TABLE, TASK_TEAM_FIELD, TEAM_TABLE);
      const primaryTeamId = patch.teamIds?.[0] || patch.teamId;
      payload[`${navigation}@odata.bind`] = patch.assignmentMode === "team" && primaryTeamId ? `/${entitySetName(TEAM_TABLE)}(${cleanId(primaryTeamId)})` : null;
      await replaceTaskTeams(xrm, id, { ...existing, ...patch });
    })());
  }
  await Promise.all(relationUpdates);
  await Promise.all([
    request(xrm, `/${entitySetName(TASK_TABLE)}(${cleanId(id)})`, { method: "PATCH", body: JSON.stringify(payload) }),
    markQuoteOrigin(xrm, existing?.quoteId),
  ]);
  const statusChanged = patch.status !== undefined && nextStatus !== previousStatus;
  const dueDateChanged = patch.dueDate !== undefined && patch.dueDate !== previousDueDate;
  const waitingChanged = patch.waitingContext !== undefined && JSON.stringify(waitingContext) !== JSON.stringify(normalizeWaitingContext(existing?.waitingContext));
  const nextAssigneeIds = resolvedAssigneeIds;
  const assigneesChanged = (patch.assigneeNames !== undefined || patch.assigneeIds !== undefined || patch.primaryAssigneeId !== undefined || patch.consultantIds !== undefined || patch.assignmentMode !== undefined || patch.teamIds !== undefined || patch.teamId !== undefined) && (JSON.stringify([...previousAssigneeIds].sort()) !== JSON.stringify([...nextAssigneeIds].sort()) || resolvedPrimaryAssigneeId !== previousPrimaryAssigneeId);
  const eventContext = { actorEmployeeId: patch.actorEmployeeId || "", actorUserId: patch.actorUserId || "", creatorEmployeeId: existing?.creatorEmployeeId || "", assigneeIds: nextAssigneeIds, previousAssigneeIds };
  const eventWrites = [];
  if (patch.mentionedEmployeeIds?.length) eventWrites.push(createEvent(xrm, id, 100000001, "Menção na tarefa.", "notification:mention", "", JSON.stringify({ ...eventContext, mentionedEmployeeIds: patch.mentionedEmployeeIds })));
  if (statusChanged) eventWrites.push(createEvent(xrm, id, 100000002, nextStatus === "done" ? "Tarefa concluída." : `Status alterado para ${STATUSES.find((item) => item.id === nextStatus)?.label || nextStatus}.`, "status", previousStatus, nextStatus));
  if (statusChanged && nextStatus === "waiting") eventWrites.push(createEvent(xrm, id, 100000002, waitingContextSummary(waitingContext), "waitingContext", JSON.stringify(normalizeWaitingContext(existing?.waitingContext)), JSON.stringify(waitingContext)));
  if (waitingChanged && !statusChanged) eventWrites.push(createEvent(xrm, id, 100000002, `Contexto de Aguardando atualizado: ${waitingContextSummary(waitingContext)}.`, "waitingContext", JSON.stringify(normalizeWaitingContext(existing?.waitingContext)), JSON.stringify(waitingContext)));
  if (statusChanged && nextStatus === "done") eventWrites.push(createEvent(xrm, id, 100000002, "Tarefa concluída por outro responsável.", "notification:status", "", JSON.stringify({ ...eventContext, previousStatus, nextStatus })));
  if ((statusChanged && nextStatus === "waiting") || (waitingChanged && !statusChanged)) eventWrites.push(createEvent(xrm, id, 100000002, waitingContextSummary(waitingContext) || "Tarefa aguardando retorno.", "notification:waiting", "", JSON.stringify({ ...eventContext, previousStatus, nextStatus, waitingContext, waitingTargetIds: waitingTargetIds(state, waitingContext) })));
  if (dueDateChanged) eventWrites.push(createEvent(xrm, id, 100000002, `Prazo alterado de ${previousDueDate || "sem prazo"} para ${patch.dueDate || "sem prazo"}.${patch.deadlineChangeReason ? ` Motivo: ${patch.deadlineChangeReason}` : ""}`, "notification:deadline", previousDueDate, JSON.stringify({ ...eventContext, nextDueDate: patch.dueDate || "", reason: patch.deadlineChangeReason || "" })));
  if (assigneesChanged) eventWrites.push(createEvent(xrm, id, 100000002, "Responsáveis alterados.", "notification:assignees", JSON.stringify(previousAssigneeIds), JSON.stringify({ ...eventContext, addedAssigneeIds: nextAssigneeIds.filter((assigneeId) => !previousAssigneeIds.includes(assigneeId)), removedAssigneeIds: previousAssigneeIds.filter((assigneeId) => !nextAssigneeIds.includes(assigneeId)) })));
  if (!statusChanged && !dueDateChanged && !assigneesChanged && !waitingChanged) eventWrites.push(createEvent(xrm, id, patch.status !== undefined ? 100000002 : 100000001, "Tarefa atualizada."));
  await Promise.all(eventWrites);
  const confirmedPatch = Object.fromEntries(Object.entries(patch).filter(([key]) => !["actorEmployeeId", "actorUserId", "mentionedEmployeeIds", "deadlineChangeReason"].includes(key)));
  const nextState = applyOptimisticTaskPatch(state, id, confirmedPatch);
  return {
    ...nextState,
    tasks: nextState.tasks.map((task) => task.id === id ? { ...task, syncStatus: undefined, detailsLoaded: false, detailsLoading: false, detailsError: undefined } : task),
  };
}

async function addLiveComment(xrm, taskId, text, context = {}) {
  await createEvent(xrm, taskId, 100000001, "Comentário adicionado.", "comentario", "", text.trim());
  if (context.mentionedEmployeeIds?.length) await createEvent(xrm, taskId, 100000001, "Menção em comentário.", "notification:mention", "", JSON.stringify(context));
  return loadLiveState(xrm);
}

async function addLiveAttachment(xrm, state, taskId, file, metadata = {}) {
  if (!file) return state;
  const uploadFile = await optimizeAttachmentFile(file);
  if (uploadFile.size > MAX_ATTACHMENT_SIZE) throw new Error("O anexo deve ter no máximo 5 MB após a compressão.");
  const taskRows = await retrieveMany(xrm, TASK_TABLE, `?$select=cr40f_titulo,cr40f_codigoorigem&$filter=cr40f_plannertarefaid eq ${cleanId(taskId)}&$top=1`);
  const task = taskRows[0] || {};
  const fileName = sanitizePathSegment(uploadFile.name, "arquivo");
  const taskKey = sanitizePathSegment(task.cr40f_codigoorigem || taskId);
  const path = `Tarefas Planner/${String(apiUrl(xrm)).toLowerCase().includes(DEV_DATAVERSE_URL) ? "DEV/" : ""}${taskKey}/Anexos`;
  const flowUrl = await resolveSharePointFlowUrl(xrm);
  if (!flowUrl) throw new Error(`URL do Flow não configurada: ${FLOW_URL_SCHEMA}.`);
  const base64 = uploadFile.base64 || await fileToBase64(uploadFile);
  const response = await fetch(flowUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caminhoCompleto: path, nomeArquivo: fileName, conteudoBase64: base64, mimeType: uploadFile.type || "application/octet-stream", metadados: { tarefaId: taskId, tarefa: task.cr40f_titulo || "", origem: "PLANNER_INTERNO", ...metadata } }) });
  const responseText = await response.text();
  const result = extractFlowRecord(responseText) || {};
  if (!response.ok || result.sucesso !== true) throw new Error(result.erro || `Flow SharePoint falhou: HTTP ${response.status}.`);
  const sharePointId = result.identificador || result.Identifier || result.id || result.itemId || result.ItemId || "";
  const attachment = { name: result.nomeArquivo || result.Name || fileName, id: sharePointId, sharePointId, returnId: metadata.returnId || "", fileLocator: result.fileLocator || result.identificador || result.Identifier || "", path: result.caminhoSharePoint || result.caminhoCompleto || result.Path || "", mimeType: result.mimeType || result.MediaType || uploadFile.type || "application/octet-stream", size: result.tamanho ?? result.Size ?? uploadFile.size };
  if (!attachment.id && !attachment.fileLocator && !attachment.path) throw new Error("Flow SharePoint não retornou identificador ou caminho do arquivo.");
  await createEvent(xrm, taskId, 100000001, "Anexo adicionado.", "anexo", "", JSON.stringify(attachment));
  return {
    ...state,
    tasks: state.tasks.map((task) => task.id === taskId ? {
      ...task,
      attachments: [...(task.attachments || []), attachment],
      detailsLoaded: false,
      detailsLoading: false,
    } : task),
  };
}

async function resolveLiveWaitingReturn(xrm, state, id, input = {}) {
  const existing = state.tasks.find((taskItem) => taskItem.id === id);
  if (!existing || existing.status !== "waiting") {
    throw new Error("A tarefa não está aguardando um retorno.");
  }
  const text = String(input.text || "").trim();
  if (!text) throw new Error("Informe o retorno recebido.");
  const actor = (state.employees || []).find((employee) =>
    employee.id === input.actorEmployeeId || employee.userId === input.actorUserId,
  );
  if (!canRegisterWaitingReturn(existing, actor, state.teams || [])) {
    throw new Error("Você não pode registrar este retorno.");
  }
  const files = Array.isArray(input.files) ? input.files.filter(Boolean) : [];
  const returnId = input.returnId || `return-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const occurredAt = new Date().toISOString();
  for (const file of files) await addLiveAttachment(xrm, state, id, file, { returnId });
  await createEvent(xrm, id, 100000001, "Retorno registrado.", "retorno", "", JSON.stringify({ returnId, text, createdAt: occurredAt, authorId: input.actorUserId || input.actorEmployeeId || "", author: actor?.name || "Sistema" }));
  const next = await updateLiveTask(xrm, state, id, {
    status: "doing",
    actorEmployeeId: input.actorEmployeeId || "",
    actorUserId: input.actorUserId || "",
  });
  const nextTask = next.tasks.find((taskItem) => taskItem.id === id) || existing;
  const assigneeIds = nextTask.assigneeIds || [];
  await createEvent(
    xrm,
    id,
    100000002,
    "Retorno registrado. Tarefa retomada para Em andamento.",
    "notification:status",
    "waiting",
    JSON.stringify({
      actorEmployeeId: input.actorEmployeeId || "",
      actorUserId: input.actorUserId || "",
      creatorEmployeeId: nextTask.creatorEmployeeId || "",
      assigneeIds,
      previousStatus: "waiting",
      nextStatus: "doing",
      returnId,
      returnText: text,
    }),
  );
  return loadLiveState(xrm);
}

async function loadLiveAttachmentContent(xrm, attachment) {
  const flowUrl = await resolveSharePointReadFlowUrl(xrm);
  if (!flowUrl) throw new Error(`URL do Flow de consulta não configurada: ${READ_FLOW_URL_SCHEMA}.`);
  if (!attachment?.sharePointId && !attachment?.fileLocator && !attachment?.path) throw new Error("Anexo sem identificador ou caminho SharePoint.");
  const response = await fetch(flowUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: attachment.sharePointId || "", fileLocator: attachment.fileLocator || "", caminhoSharePoint: attachment.path || "", nomeArquivo: attachment.name || "" }) });
  const responseText = await response.text();
  const result = extractFlowRecord(responseText) || {};
  if (!response.ok || result.sucesso !== true || !result.conteudoBase64) throw new Error(result.erro || `Flow de consulta SharePoint falhou: HTTP ${response.status}.`);
  const mimeType = attachment.mimeType || result.mimeType || "application/octet-stream";
  return { ...attachment, mimeType, dataUrl: `data:${mimeType};base64,${result.conteudoBase64}` };
}

async function deleteLiveAttachment(xrm, state, taskId, attachment) {
  const flowUrl = await resolveSharePointDeleteFlowUrl(xrm);
  if (!flowUrl) throw new Error(`URL do Flow de exclusão não configurada: ${DELETE_FLOW_URL_SCHEMA}.`);
  if (!attachment?.sharePointId && !attachment?.fileLocator && !attachment?.path) throw new Error("Anexo sem identificador ou caminho SharePoint.");
  const response = await fetch(flowUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: attachment.sharePointId || attachment.fileLocator || attachment.path || "", fileLocator: attachment.fileLocator || "", caminhoSharePoint: attachment.path || "", nomeArquivo: attachment.name || "", tarefaId: taskId }) });
  const responseText = await response.text();
  const result = extractFlowRecord(responseText) || {};
  if (!response.ok || result.sucesso !== true) throw new Error(result.erro || `Flow de exclusão SharePoint falhou: HTTP ${response.status}.`);
  if (attachment.eventId) await request(xrm, `/${entitySetName(EVENT_TABLE)}(${cleanId(attachment.eventId)})`, { method: "DELETE" });
  return {
    ...state,
    tasks: state.tasks.map((task) => task.id === taskId ? {
      ...task,
      attachments: (task.attachments || []).filter((item) => item.id !== attachment.id),
      detailsLoaded: false,
      detailsLoading: false,
    } : task),
  };
}

async function createLiveSubtask(xrm, state, parentId, input) {
  const nextState = await createLiveTask(xrm, state, { ...input, parentTaskId: parentId, sourceType: input.sourceType || "manual", sourceCode: input.sourceCode || "" });
  const child = nextState.tasks.find((item) => item.title === input.title.trim() && !item.parentTaskId);
  if (!child) throw new Error("Dataverse criou a subtarefa, mas não foi possível localizar o ID.");
  const payload = { cr40f_tipo: 100000000, cr40f_name: `${parentId}-${child.id}` };
  await bindLookup(xrm, payload, RELATION_TABLE, "cr40f_tarefapai", TASK_TABLE, parentId);
  await bindLookup(xrm, payload, RELATION_TABLE, "cr40f_subtarefa", TASK_TABLE, child.id);
  await request(xrm, `/${entitySetName(RELATION_TABLE)}`, { method: "POST", body: JSON.stringify(payload) });
  return loadLiveState(xrm);
}

async function optimizeAttachmentFile(file) {
  if (!file?.type || !OPTIMIZABLE_IMAGE_TYPES.has(file.type) || typeof document === "undefined" || typeof globalThis.createImageBitmap !== "function") return file;
  if (typeof Worker === "function" && typeof OffscreenCanvas === "function") {
    let worker;
    let workerUrl;
    try {
      workerUrl = URL.createObjectURL(new Blob([IMAGE_OPTIMIZER_WORKER_SOURCE], { type: "text/javascript" }));
      worker = new Worker(workerUrl);
      return await new Promise((resolve, reject) => {
        worker.onmessage = ({ data }) => {
          if (data?.error) reject(new Error(data.error));
          else if (data?.unchanged) resolve(file);
          else {
            const blob = new Blob([data.buffer], { type: data.type || file.type });
            resolve(blob.size < file.size * 0.95 ? new File([blob], file.name, { type: blob.type, lastModified: file.lastModified }) : file);
          }
        };
        worker.onerror = () => reject(new Error("Falha no worker de otimização."));
        worker.postMessage({ file, maxEdge: MAX_IMAGE_EDGE, quality: IMAGE_QUALITY });
      });
    } catch {
      // Fallback abaixo cobre browsers embutidos sem suporte completo a Worker.
    } finally {
      worker?.terminate();
      if (workerUrl) URL.revokeObjectURL(workerUrl);
    }
  }
  try {
    const bitmap = await globalThis.createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 900 * 1024) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, file.type, file.type === "image/png" ? undefined : IMAGE_QUALITY));
    bitmap.close?.();
    if (!blob || blob.size >= file.size * 0.95) return file;
    return new File([blob], file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}

async function fileToBase64(file) {
  if (!file) throw new Error("Arquivo inválido para anexar.");
  if (file.base64) return file.base64;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",").slice(1).join(","));
    reader.onerror = () => reject(new Error("Não foi possível preparar o arquivo para envio."));
    reader.readAsDataURL(file);
  });
}

async function ensureLiveQuoteTask(xrm, state, quote) {
  const existing = state.tasks.find((item) => item.quoteId === quote.id && !item.parentTaskId);
  if (existing || quote.plannerTaskId) return state;
  const reference = String(quote.code || quote.title || "").trim();
  return createLiveTask(xrm, state, { title: `Acompanhar ${reference || "cotação"}`, quoteId: quote.id, quoteCode: quote.code || "", quoteTitle: quote.title || "", dueDate: quote.deadline, priority: "medium", sourceType: "quote", assigneeName: "Não atribuído", teamName: "Financeiro", description: `Acompanhar a cotação ${reference || "selecionada"} até a resposta ao cliente.` });
}

function quoteDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function quoteMoney(value) {
  if (value === "" || value === null || value === undefined) return null;
  const raw = String(value).trim();
  const number = typeof value === "number" ? value : Number(raw.includes(",") ? raw.replace(/[^0-9,-]/g, "").replace(/\./g, "").replace(",", ".") : raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function quotePayload(input = {}, includeUnset = false) {
  const payload = {};
  const has = (key) => includeUnset || Object.prototype.hasOwnProperty.call(input, key);
  const set = (key, field, value) => { if (has(key)) payload[field] = value; };
  set("title", "cr40f_titulo", input.title == null ? "" : String(input.title).trim());
  set("client", "cr40f_clienteempresa", input.client == null ? "" : String(input.client).trim());
  set("clientContact", "cr40f_contatocliente", input.clientContact == null ? "" : String(input.clientContact).trim());
  set("clientPhone", "cr40f_telefonewhatsapp", input.clientPhone == null ? "" : String(input.clientPhone).trim());
  set("clientEmail", "cr40f_emailcliente", input.clientEmail == null ? "" : String(input.clientEmail).trim());
  set("channel", "cr40f_canalentrada", QUOTE_CHANNEL_VALUES[input.channel] ?? input.channel);
  set("serviceType", "cr40f_tiposervico", input.serviceType == null ? "" : String(input.serviceType).trim());
  set("vehicleType", "cr40f_tipoveiculo", input.vehicleType == null ? "" : String(input.vehicleType).trim());
  set("origin", "cr40f_origem", input.origin == null ? "" : String(input.origin).trim());
  set("destination", "cr40f_destino", input.destination == null ? "" : String(input.destination).trim());
  if (has("serviceDate")) payload.cr40f_datahoraservico = quoteDateTime(input.serviceDate);
  if (has("returnDate")) payload.cr40f_datahoraretorno = quoteDateTime(input.returnDate);
  if (has("hasReturn") || has("returnDate")) payload.cr40f_retorno = Boolean(input.hasReturn || input.returnDate);
  if (has("passengers")) payload.cr40f_quantidadepassageiros = input.passengers === "" ? null : Number(input.passengers);
  set("notes", "cr40f_observacoespedido", input.notes == null ? "" : String(input.notes));
  if (has("priority")) payload.cr40f_prioridade = QUOTE_PRIORITY_VALUES[input.priority] ?? input.priority;
  if (has("status")) payload.cr40f_statuscotacao = QUOTE_STATUS_VALUES[input.status] ?? input.status;
  if (has("deadline")) payload.cr40f_prazoresponder = input.deadline ? `${input.deadline}T12:00:00Z` : null;
  if (has("value")) payload.cr40f_valorcotado = quoteMoney(input.value);
  set("commercialTerms", "cr40f_condicaocomercial", input.commercialTerms == null ? "" : String(input.commercialTerms));
  if (has("responseSent")) payload.cr40f_respostaenviadacliente = Boolean(input.responseSent);
  if (has("finalizationAt")) payload.cr40f_datahorafinalizacao = quoteDateTime(input.finalizationAt);
  if (input.lossReason && !payload.cr40f_motivoperda) {
    const existingNotes = String(payload.cr40f_observacoespedido || "").trim();
    payload.cr40f_observacoespedido = `${existingNotes}${existingNotes ? "\n" : ""}Motivo da perda: ${String(input.lossReason).trim()}`;
  }
  return payload;
}

async function resolveFinanceTeamId(xrm, state) {
  const existing = (state.teams || []).find((team) => String(team.name || "").trim().toLowerCase() === "financeiro");
  if (existing?.id) return existing.id;
  const primaryName = await primaryNameAttribute(xrm, TEAM_TABLE);
  return resolveIdByName(xrm, TEAM_TABLE, primaryName, "Financeiro");
}

async function createLiveQuote(xrm, state, input = {}) {
  const payload = quotePayload(input, true);
  const created = await request(xrm, `/${entitySetName(QUOTE_TABLE)}`, { method: "POST", body: JSON.stringify(payload) });
  const quoteId = cleanId(created?.cr40f_pedidodecotacaoid || created?.[`${QUOTE_TABLE}id`]);
  if (!quoteId) throw new Error("Dataverse criou a cotação sem retornar o ID.");
  try {
    const nextState = await loadLiveState(xrm);
    const taskState = await createLiveTask(xrm, nextState, { title: `Acompanhar ${created.cr40f_numerodacotacao || input.title || "cotação"}`, quoteId, quoteCode: created.cr40f_numerodacotacao || "", quoteTitle: input.title || "", dueDate: input.deadline || "", priority: input.priority || "medium", sourceType: "quote", assigneeIds: input.assigneeIds || [], assigneeNames: input.assigneeNames || [], assignmentMode: "people", description: `Acompanhar a cotação ${created.cr40f_numerodacotacao || "selecionada"} até a resposta ao cliente.` });
    const createdQuote = (taskState.quotes || []).find((quote) => cleanId(quote.id) === quoteId);
    const linkedTask = (taskState.tasks || []).find((task) => cleanId(task.quoteId) === quoteId && !task.parentTaskId);
    const teamId = await resolveFinanceTeamId(xrm, taskState);
    if (linkedTask && teamId) await replaceTaskTeams(xrm, linkedTask.id, { assignmentMode: "team", teamIds: [teamId] });
    if (createdQuote && linkedTask) await request(xrm, `/${entitySetName(QUOTE_TABLE)}(${quoteId})`, { method: "PATCH", body: JSON.stringify({ cr40f_plannertaskid: linkedTask.id }) });
    return loadLiveState(xrm);
  } catch (error) {
    try { await request(xrm, `/${entitySetName(QUOTE_TABLE)}(${quoteId})`, { method: "DELETE" }); } catch (cleanupError) { console.warn("[Planner] falha ao desfazer cotação sem tarefa", cleanupError); }
    throw new Error(`Cotação criada, mas não foi possível criar o acompanhamento no Planner. ${error.message || "Tente novamente."}`);
  }
}

async function updateLiveQuote(xrm, state, id, patch = {}) {
  const quoteId = cleanId(id);
  const existing = (state.quotes || []).find((quote) => cleanId(quote.id) === quoteId);
  if (!existing) throw new Error("Cotação não encontrada.");
  await request(xrm, `/${entitySetName(QUOTE_TABLE)}(${quoteId})`, { method: "PATCH", body: JSON.stringify(quotePayload(patch)) });
  const task = (state.tasks || []).find((item) => cleanId(item.quoteId) === quoteId && !item.parentTaskId);
  if (task) {
    const terminal = ["Perdida", "Cancelada", "Convertida em serviço"].includes(patch.status);
    await updateLiveTask(xrm, state, task.id, { title: patch.title ? `Acompanhar ${patch.code || existing.code || "cotação"}` : undefined, dueDate: patch.deadline, priority: patch.priority, status: terminal ? "done" : undefined, assigneeIds: patch.assigneeIds, assigneeNames: patch.assigneeNames });
  }
  return loadLiveState(xrm);
}

async function markLiveQuoteSent(xrm, state, id) {
  return updateLiveQuote(xrm, state, id, { responseSent: true, status: "Respondida ao cliente", finalizationAt: new Date().toISOString() });
}

async function setLiveQuoteOutcome(xrm, state, id, outcome, reason = "") {
  if (outcome === "Perdida" && !String(reason).trim()) throw new Error("Informe o motivo da perda.");
  const existing = (state.quotes || []).find((quote) => cleanId(quote.id) === cleanId(id));
  const notes = outcome === "Perdida" ? `${String(existing?.notes || "").trim()}${existing?.notes ? "\n" : ""}Motivo da perda: ${String(reason).trim()}` : undefined;
  return updateLiveQuote(xrm, state, id, { status: outcome, lossReason: reason, notes, finalizationAt: new Date().toISOString() });
}

async function deleteLiveTask(xrm, state, id) {
  const task = state.tasks.find((item) => item.id === id);
  const assigneeRelations = await retrieveMany(xrm, ASSIGNEE_RELATION_TABLE, `?$select=${ASSIGNEE_RELATION_TABLE}id&$filter=_cr40f_tarefa_value eq ${cleanId(id)}`);
  const teamRelations = await retrieveOptional(xrm, TASK_TEAM_RELATION_TABLE, `?$select=${TASK_TEAM_RELATION_TABLE}id&$filter=_cr40f_tarefa_value eq ${cleanId(id)}`, "relações de equipe da tarefa");
  await Promise.all(assigneeRelations.map((relation) => request(xrm, `/${entitySetName(ASSIGNEE_RELATION_TABLE)}(${cleanId(relation[`${ASSIGNEE_RELATION_TABLE}id`])})`, { method: "DELETE" })));
  await Promise.all(teamRelations.map((relation) => request(xrm, `/${entitySetName(TASK_TEAM_RELATION_TABLE)}(${cleanId(relation[`${TASK_TEAM_RELATION_TABLE}id`])})`, { method: "DELETE" })));
  if (task?.parentTaskId) {
    const relations = await retrieveMany(xrm, RELATION_TABLE, `?$select=${RELATION_TABLE}id&$filter=_cr40f_subtarefa_value eq ${cleanId(id)}`);
    await Promise.all(relations.map((relation) => request(xrm, `/${entitySetName(RELATION_TABLE)}(${cleanId(relation[`${RELATION_TABLE}id`])})`, { method: "DELETE" })));
  }
  await request(xrm, `/${entitySetName(TASK_TABLE)}(${cleanId(id)})`, { method: "DELETE" });
  return loadLiveState(xrm);
}

async function adminCleanupLive(xrm, state, action) {
  const adminRequest = typeof action === "string" ? { action } : action;
  const actionId = adminRequest?.action;
  if (actionId === "completed_tasks" || actionId === "all_tasks") {
    const tasks = actionId === "completed_tasks" ? (state.tasks || []).filter((task) => task.status === "done") : (state.tasks || []);
    let nextState = state;
    for (const task of tasks) nextState = await deleteLiveTask(xrm, nextState, task.id);
    return nextState;
  }
  if (actionId === "all_tags") {
    for (const tag of state.personalTags || []) {
      const relations = await retrieveMany(xrm, PERSONAL_TAG_TASK_TABLE, `?$select=${PERSONAL_TAG_TASK_TABLE}id&$filter=_cr40f_tag_value eq ${cleanId(tag.id)}`);
      await Promise.all(relations.map((relation) => request(xrm, `/${entitySetName(PERSONAL_TAG_TASK_TABLE)}(${cleanId(relation[`${PERSONAL_TAG_TASK_TABLE}id`])})`, { method: "DELETE" })));
      await request(xrm, `/${entitySetName(PERSONAL_TAG_TABLE)}(${cleanId(tag.id)})`, { method: "DELETE" });
    }
    return { ...state, personalTags: [], tasks: (state.tasks || []).map((task) => ({ ...task, personalTagIds: [] })) };
  }
  if (actionId === "notifications") {
    await Promise.all((state.notifications || []).map((notification) => request(xrm, `/${entitySetName(NOTIFICATION_TABLE)}(${cleanId(notification.id)})`, { method: "DELETE" })));
    return { ...state, notifications: [] };
  }
  const scopedTasks = () => (state.tasks || []).filter((task) => (task.assigneeIds || []).includes(adminRequest.employeeId) && (!adminRequest.status || task.status === adminRequest.status) && (!adminRequest.teamId || (task.teamIds || []).includes(adminRequest.teamId) || task.teamId === adminRequest.teamId));
  if (actionId === "user_tasks") {
    let nextState = state;
    for (const task of scopedTasks()) nextState = await deleteLiveTask(xrm, nextState, task.id);
    return nextState;
  }
  if (actionId === "remove_user_assignments") {
    let nextState = state;
    for (const task of scopedTasks()) {
      const assigneeIds = (task.assigneeIds || []).filter((id) => id !== adminRequest.employeeId);
      const assigneeNames = assigneeIds.map((id) => (state.employees || []).find((employee) => employee.id === id)?.name).filter(Boolean);
      nextState = await updateLiveTask(xrm, nextState, task.id, { assigneeIds, assigneeNames });
    }
    return nextState;
  }
  if (actionId === "user_notifications") {
    const rows = await retrieveMany(xrm, NOTIFICATION_TABLE, `?$select=cr40f_plannernotificacaoid&$filter=_cr40f_destinatario_value eq ${cleanId(adminRequest.employeeId)}`);
    await Promise.all(rows.map((row) => request(xrm, `/${entitySetName(NOTIFICATION_TABLE)}(${cleanId(row.cr40f_plannernotificacaoid)})`, { method: "DELETE" })));
    return { ...state, notifications: (state.notifications || []).filter((item) => item.recipientEmployeeId !== adminRequest.employeeId) };
  }
  if (actionId === "user_tags") {
    if (!adminRequest.userId) throw new Error("O funcionário selecionado não possui usuário Dataverse vinculado.");
    const tags = await retrieveMany(xrm, PERSONAL_TAG_TABLE, `?$select=cr40f_plannertagpessoalid&$filter=_cr40f_usuario_value eq ${cleanId(adminRequest.userId)}`);
    for (const tag of tags) {
      const id = tag.cr40f_plannertagpessoalid;
      const relations = await retrieveMany(xrm, PERSONAL_TAG_TASK_TABLE, `?$select=${PERSONAL_TAG_TASK_TABLE}id&$filter=_cr40f_tag_value eq ${cleanId(id)}`);
      await Promise.all(relations.map((relation) => request(xrm, `/${entitySetName(PERSONAL_TAG_TASK_TABLE)}(${cleanId(relation[`${PERSONAL_TAG_TASK_TABLE}id`])})`, { method: "DELETE" })));
      await request(xrm, `/${entitySetName(PERSONAL_TAG_TABLE)}(${cleanId(id)})`, { method: "DELETE" });
    }
    return loadLiveState(xrm);
  }
  if (actionId === "user_contacts" || actionId === "all_contacts") {
    requireContactSchema();
    throw new Error("A tabela live de Contatos ainda não está provisionada neste Planner.");
  }
  if (actionId === "all_teams") {
    let nextState = state;
    for (const team of state.teams || []) nextState = await deleteLiveTeam(xrm, nextState, team.id);
    return nextState;
  }
  if (actionId === "task_activity") {
    const events = await retrieveMany(xrm, EVENT_TABLE, "?$select=cr40f_plannertarefaeventoid,cr40f_campo&$filter=statecode eq 0");
    await Promise.all(events.filter((event) => event.cr40f_campo !== "anexo").map((event) => request(xrm, `/${entitySetName(EVENT_TABLE)}(${cleanId(event.cr40f_plannertarefaeventoid)})`, { method: "DELETE" })));
    return loadLiveState(xrm);
  }
  if (actionId === "task_attachments") {
    const events = await retrieveMany(xrm, EVENT_TABLE, "?$select=cr40f_plannertarefaeventoid,_cr40f_tarefa_value,cr40f_campo,cr40f_valornovo&$filter=cr40f_campo eq 'anexo' and statecode eq 0");
    for (const event of events) {
      let attachment = {};
      try { attachment = JSON.parse(event.cr40f_valornovo || "{}"); } catch { attachment = {}; }
      await deleteLiveAttachment(xrm, state, event._cr40f_tarefa_value, { ...attachment, eventId: event.cr40f_plannertarefaeventoid });
    }
    return loadLiveState(xrm);
  }
  if (actionId === "task_assignments") {
    let nextState = state;
    for (const task of state.tasks || []) nextState = await updateLiveTask(xrm, nextState, task.id, { assignmentMode: "people", assigneeIds: [], assigneeNames: [], teamIds: [], teamNames: [] });
    return nextState;
  }
  if (actionId === "task_due_dates") {
    let nextState = state;
    for (const task of (state.tasks || []).filter((item) => item.dueDate)) nextState = await updateLiveTask(xrm, nextState, task.id, { dueDate: "", waitingContext: { ...normalizeWaitingContext(task.waitingContext), dueDate: "" } });
    return nextState;
  }
  if (actionId === "all_planner_data") {
    let nextState = state;
    for (const step of ["task_attachments", "notifications", "all_tags", "all_tasks", "all_teams"]) nextState = await adminCleanupLive(xrm, nextState, step);
    return nextState;
  }
  throw new Error("Ação administrativa inválida.");
}

async function importLivePlannerTasks(xrm, state, rows = []) {
  const apiRows = Array.isArray(rows) ? rows : [];
  const taskAssigneeNavigation = await resolveLookupNavigation(xrm, TASK_TABLE, EMPLOYEE_ASSIGNEE_FIELD, EMPLOYEE_TABLE);
  const relationTaskNavigation = await resolveLookupNavigation(xrm, ASSIGNEE_RELATION_TABLE, "cr40f_tarefa", TASK_TABLE);
  const relationEmployeeNavigation = await resolveLookupNavigation(xrm, ASSIGNEE_RELATION_TABLE, "cr40f_funcionario", EMPLOYEE_TABLE);
  const eventTaskNavigation = await resolveLookupNavigation(xrm, EVENT_TABLE, "cr40f_tarefa", TASK_TABLE);
  const results = [];
  let workingState = state;
  const ownerUserId = workingState.currentUserId || "";
  const importedNames = [...new Map(apiRows.flatMap((row) => row.tags || []).map((name) => [normalizeText(name), String(name || "").trim().slice(0, 32)]).filter(([key, name]) => key && name)).values()];
  for (const [index, name] of importedNames.entries()) {
    const existing = (workingState.personalTags || []).find((tag) => normalizeText(tag.name) === normalizeText(name));
    if (existing) {
      if (existing.archived) workingState = await updateLivePersonalTag(xrm, workingState, existing.id, { archived: false });
      continue;
    }
    workingState = await createLivePersonalTag(xrm, workingState, { name, color: PERSONAL_TAG_COLORS[index % PERSONAL_TAG_COLORS.length], ownerUserId });
  }
  const tagIdsByName = new Map((workingState.personalTags || []).map((tag) => [normalizeText(tag.name), tag.id]));

  for (const row of apiRows) {
    const sourceCode = row.sourceCode || `MSPLANNER:${row.plannerTaskId}`;
    try {
      const escapedSourceCode = String(sourceCode).replace(/'/g, "''");
      const existing = await retrieveMany(xrm, TASK_TABLE, `?$select=cr40f_plannertarefaid&$filter=cr40f_codigoorigem eq '${escapedSourceCode}'&$top=1`);
      if (existing[0]?.cr40f_plannertarefaid) {
        results.push({ plannerTaskId: row.plannerTaskId, result: "already_exists", dataverseTaskId: existing[0].cr40f_plannertarefaid });
        continue;
      }
      const payload = {
        cr40f_titulo: String(row.title || "Sem título").trim(),
        cr40f_descricao: row.description || "",
        cr40f_checklistjson: JSON.stringify(row.checklist || []),
        cr40f_status: row.statusChoice,
        cr40f_prioridade: row.priorityChoice,
        cr40f_prazo: row.dueDate || null,
        cr40f_origem: 100000000,
        cr40f_codigoorigem: sourceCode,
      };
      const firstEmployeeId = row.assignments?.find((assignment) => assignment.employeeId)?.employeeId || "";
      if (firstEmployeeId) payload[`${taskAssigneeNavigation}@odata.bind`] = `/cr40f_funcionarioses(${cleanId(firstEmployeeId)})`;
      const created = await request(xrm, `/${entitySetName(TASK_TABLE)}`, { method: "POST", body: JSON.stringify(payload) });
      const taskId = created?.cr40f_plannertarefaid;
      if (!taskId) throw new Error("Dataverse criou a tarefa sem retornar o ID.");

      const tagIds = (row.tags || []).map((name) => tagIdsByName.get(normalizeText(name))).filter(Boolean);
      if (tagIds.length) workingState = await replaceLiveTaskPersonalTags(xrm, workingState, taskId, tagIds, ownerUserId);

      for (const assignment of (row.assignments || []).filter((item) => item.employeeId)) {
        const relationPayload = {
          cr40f_name: `${taskId}-${assignment.employeeId}`,
          [`${relationTaskNavigation}@odata.bind`]: `/${entitySetName(TASK_TABLE)}(${cleanId(taskId)})`,
          [`${relationEmployeeNavigation}@odata.bind`]: `/${entitySetName(EMPLOYEE_TABLE)}(${cleanId(assignment.employeeId)})`,
        };
        await request(xrm, `/${entitySetName(ASSIGNEE_RELATION_TABLE)}`, { method: "POST", body: JSON.stringify(relationPayload) });
      }
      const eventPayload = {
        cr40f_tipo: 100000000,
        cr40f_descricao: "Tarefa importada do Microsoft Planner.",
        cr40f_ocorridoem: new Date().toISOString(),
        [`${eventTaskNavigation}@odata.bind`]: `/${entitySetName(TASK_TABLE)}(${cleanId(taskId)})`,
      };
      await request(xrm, `/${entitySetName(EVENT_TABLE)}`, { method: "POST", body: JSON.stringify(eventPayload) });
      results.push({ plannerTaskId: row.plannerTaskId, result: "created", dataverseTaskId: taskId });
    } catch (error) {
      results.push({ plannerTaskId: row.plannerTaskId, result: "error", error: error.message || "Falha desconhecida." });
    }
  }

  const nextState = await loadLiveState(xrm);
  return {
    nextState,
    results,
    createdCount: results.filter((item) => item.result === "created").length,
    existingCount: results.filter((item) => item.result === "already_exists").length,
    errorCount: results.filter((item) => item.result === "error").length,
    errors: results.filter((item) => item.result === "error"),
  };
}

function createMockDataStore() {
  const withMode = (state) => ({ ...state, live: false });
  const withoutMode = ({ live: _live, ...state }) => state;
  const persist = (state) => withMode(saveMockState(withoutMode(state)));

  return {
    live: false,
    load: async () => withMode(loadMockState()),
    loadCore: async () => ({ ...withMode(loadMockState()), loading: { core: false, quotes: false, quality: false, photos: false } }),
    loadContacts: async (state) => (state?.contacts || loadMockState().contacts || []).map((item) => normalizeContact(item)),
    loadSupplemental: async (state) => ({ ...state, loading: { ...(state.loading || {}), quotes: false, quality: false } }),
    loadNotifications: async (employeeId) => (withDailyNotifications(loadMockState()).notifications || []).filter((item) => !employeeId || item.recipientEmployeeId === employeeId),
    markNotificationRead: async (state, notificationId) => withMode(markMockNotificationRead(state, notificationId)),
    markAllNotificationsRead: async (state, employeeId) => withMode(markAllMockNotificationsRead(state, employeeId)),
    loadTaskDetails: async (taskId) => ({ taskId, detailsLoaded: true }),
    loadAttachmentContent: async () => { throw new Error("Prévia de anexo disponível somente no ambiente conectado."); },
    loadPhotos: async () => ({ loading: { photos: false } }),
    searchQuotes: async () => [],
    createTeam: async (state, input) => withMode(createMockTeam(state, input)),
    updateTeam: async (state, id, patch) => withMode(updateMockTeam(state, id, patch)),
    deleteTeam: async (state, id) => withMode(deleteMockTeam(state, id)),
    loadPersonalTags: async (state, ownerUserId) => loadMockPersonalTags(state, ownerUserId),
    createPersonalTag: async (state, input) => withMode(createMockPersonalTag(state, input)),
    updatePersonalTag: async (state, id, patch) => withMode(updateMockPersonalTag(state, id, patch)),
    archivePersonalTag: async (state, id) => withMode(archiveMockPersonalTag(state, id)),
    adminCleanup: async (state, action) => withMode(adminCleanupMock(state, action)),
    reorderPersonalTags: async (state, orderedIds) => withMode(reorderMockPersonalTags(state, orderedIds)),
    replaceTaskPersonalTags: async (state, taskId, tagIds, ownerUserId) => withMode(replaceMockTaskPersonalTags(state, taskId, tagIds, ownerUserId)),
    createTask: async (state, input) => withMode(createMockTask(state, input)),
    importPlannerTasks: async (state, rows = []) => {
      const result = importMockPlannerTasks(state, rows);
      return { ...result, nextState: withMode(result.nextState) };
    },
    createContact: async (state, input) => withMode(createMockContact(state, input)),
    createContactFromWhatsAppIntake: async (state, input) => {
      const result = createMockContactFromWhatsAppIntake(state, input);
      return { ...result, state: withMode(result.state) };
    },
    updateContact: async (state, id, patch) => withMode(updateMockContact(state, id, patch)),
    archiveContact: async (state, id, context) => withMode(archiveMockContact(state, id, context)),
    addContactNote: async (state, id, input, context) => withMode(addMockContactNote(state, id, input, context)),
    addContactAttachment: async (state, id, file, previewUrl = "") => withMode(addMockContactAttachment(state, id, { name: file?.name || "Arquivo", mimeType: file?.type || "", size: file?.size || 0, previewUrl })),
    deleteContactAttachment: async (state, id, attachment) => withMode(deleteMockContactAttachment(state, id, attachment?.id)),
    loadRelatedTasks: async (state, contactId) => (state?.tasks || []).filter((task) => task.contactId === contactId || (state.contacts || []).find((contact) => contact.id === contactId)?.linkedTaskIds?.includes(task.id)),
    createSubtask: async (state, parentId, input) => withMode(createMockTask(state, { ...input, parentTaskId: parentId })),
    createQualityTask: async (state, item) => withMode(createMockTask(state, { title: item.title, description: item.description, dueDate: item.dueDate, sourceType: "quality", sourceId: item.id, sourceCode: item.code, sourceLabel: item.type === "error" ? "Erro operacional" : "Ação operacional" })),
    updateTask: async (state, id, patch) => withMode(updateMockTask(state, id, patch)),
    resolveWaitingReturn: async (state, id, input) => withMode(resolveMockWaitingReturn(state, id, input)),
    collectTask: async (state, id, input) => withMode(collectMockTask(state, id, input)),
    sendNotificationTest: async () => { throw new Error("O envio de teste exige o ambiente Dataverse conectado."); },
    deleteTask: async (state, id) => withMode(deleteMockTask(state, id)),
    addComment: async (state, id, text, context) => withMode(addMockComment(state, id, text, context)),
    addAttachment: async (state, id, file, previewUrl = "") => withMode(addMockAttachment(state, id, { name: file?.name || "Arquivo", mimeType: file?.type || "", size: file?.size || 0, previewUrl })),
    deleteAttachment: async (state, taskId, attachment) => withMode(deleteMockAttachment(state, taskId, attachment?.id)),
    ensureQuoteTask: async (state, quote) => withMode(ensureMockQuoteTask(state, quote)),
    createQuote: async (state, input) => withMode(createMockQuote(state, input)),
    updateQuote: async (state, id, patch) => withMode(updateMockQuote(state, id, patch)),
    markQuoteSent: async (state, id) => withMode(markMockQuoteSent(state, id)),
    setQuoteOutcome: async (state, id, outcome, reason) => withMode(setMockQuoteOutcome(state, id, outcome, reason)),
    save: async (state) => persist(state),
    reset: async () => withMode(resetMockState()),
    openQuote: () => undefined,
    openSource: () => undefined,
  };
}

function registerAttachmentLoader(store) {
  if (typeof globalThis !== "undefined") globalThis.__plannerAttachmentLoader = store.loadAttachmentContent;
  return store;
}

export function createDataStore() {
  const xrm = getXrm();
  if (!xrm) return registerAttachmentLoader(createMockDataStore());
  return registerAttachmentLoader({
    live: true,
    load: () => loadLiveState(xrm),
    loadCore: () => loadCoreState(xrm),
    loadContacts: async () => { requireContactSchema(); return []; },
    loadSupplemental: (state) => loadSupplementalState(xrm, state),
    loadNotifications: (employeeId) => loadLiveNotifications(xrm, employeeId),
    collectTask: (state, id, input) => collectLiveTask(xrm, state, id, input),
    sendNotificationTest: (state, input) => sendLiveNotificationTest(xrm, state, input),
    markNotificationRead: async (state, notificationId) => { const readAt = await markLiveNotificationRead(xrm, notificationId); return { ...state, notifications: (state.notifications || []).map((item) => item.id === notificationId ? { ...item, readAt } : item) }; },
    markAllNotificationsRead: async (state, employeeId) => {
      const unread = (state.notifications || []).filter((item) => item.recipientEmployeeId === employeeId && !item.readAt);
      await Promise.all(unread.map((item) => markLiveNotificationRead(xrm, item.id)));
      const readAt = new Date().toISOString();
      return { ...state, notifications: (state.notifications || []).map((item) => item.recipientEmployeeId === employeeId ? { ...item, readAt: item.readAt || readAt } : item) };
    },
    loadTaskDetails: (taskId) => loadTaskDetails(xrm, taskId),
    loadAttachmentContent: (attachment) => loadLiveAttachmentContent(xrm, attachment),
    loadPhotos: async () => ({ loading: { photos: false } }),
    searchQuotes: (query) => searchQuotes(xrm, query),
    createTeam: (state, input) => createLiveTeam(xrm, state, input),
    updateTeam: (state, id, patch) => updateLiveTeam(xrm, state, id, patch),
    deleteTeam: (state, id) => deleteLiveTeam(xrm, state, id),
    loadPersonalTags: async (state) => state.personalTags || [],
    createPersonalTag: (state, input) => createLivePersonalTag(xrm, state, input),
    updatePersonalTag: (state, id, patch) => updateLivePersonalTag(xrm, state, id, patch),
    archivePersonalTag: (state, id) => updateLivePersonalTag(xrm, state, id, { archived: true }),
    adminCleanup: (state, action) => adminCleanupLive(xrm, state, action),
    reorderPersonalTags: (state, orderedIds) => reorderLivePersonalTags(xrm, state, orderedIds),
    replaceTaskPersonalTags: (state, taskId, tagIds, ownerUserId) => replaceLiveTaskPersonalTags(xrm, state, taskId, tagIds, ownerUserId),
    createTask: (state, input) => createLiveTask(xrm, state, input),
    importPlannerTasks: (state, rows) => importLivePlannerTasks(xrm, state, rows),
    createContact: async () => { requireContactSchema(); return null; },
    createContactFromWhatsAppIntake: async () => {
      requireContactSchema();
      throw new Error("Intake do WhatsApp no adapter live ainda exige o mapeamento dos campos de Contatos, eventos, lookup da Task e chave externa.");
    },
    updateContact: async () => { requireContactSchema(); return null; },
    archiveContact: async () => { requireContactSchema(); return null; },
    addContactNote: async () => { requireContactSchema(); return null; },
    addContactAttachment: async () => { requireContactSchema(); return null; },
    deleteContactAttachment: async () => { requireContactSchema(); return null; },
    loadRelatedTasks: async () => { requireContactSchema(); return []; },
    createSubtask: (state, parentId, input) => createLiveSubtask(xrm, state, parentId, input),
    createQualityTask: (state, item) => createLiveTask(xrm, state, { title: item.title, description: item.description, dueDate: item.dueDate, sourceType: "quality", sourceCode: item.code, qualityType: item.type, qualityId: item.id }),
    updateTask: (state, id, patch) => updateLiveTask(xrm, state, id, patch),
    resolveWaitingReturn: (state, id, input) => resolveLiveWaitingReturn(xrm, state, id, input),
    deleteTask: (state, id) => deleteLiveTask(xrm, state, id),
    addComment: (state, id, text, context) => addLiveComment(xrm, id, text, context),
    addAttachment: (state, id, file) => addLiveAttachment(xrm, state, id, file),
    deleteAttachment: (state, taskId, attachment) => deleteLiveAttachment(xrm, state, taskId, attachment),
    ensureQuoteTask: (state, quote) => ensureLiveQuoteTask(xrm, state, quote),
    createQuote: (state, input) => createLiveQuote(xrm, state, input),
    updateQuote: (state, id, patch) => updateLiveQuote(xrm, state, id, patch),
    markQuoteSent: (state, id) => markLiveQuoteSent(xrm, state, id),
    setQuoteOutcome: (state, id, outcome, reason) => setLiveQuoteOutcome(xrm, state, id, outcome, reason),
    save: (state) => loadLiveState(xrm),
    reset: () => loadLiveState(xrm),
    openQuote: (id) => xrm.Navigation?.openForm?.({ entityName: QUOTE_TABLE, entityId: cleanId(id) }),
    openSource: ({ source, sourceRecordId }) => {
      const resource = source === "quality_error" || source === "quality_action" ? "new_gestao_erros_operacionais.html" : source === "quote_followup" ? "cr40f_TelaPedirCotacao.html" : "new_TelaPlanner.html";
      const params = source === "quality_error" ? `errorId=${cleanId(sourceRecordId)}` : source === "quality_action" ? `actionId=${cleanId(sourceRecordId)}` : source === "quote_followup" ? `view=recent&recordId=${cleanId(sourceRecordId)}` : `taskId=${cleanId(sourceRecordId)}`;
      return xrm.Navigation?.openWebResource?.(resource, { data: params });
    },
  });
}
