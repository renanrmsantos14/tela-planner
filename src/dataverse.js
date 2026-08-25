import {
  addAttachment as addMockAttachment,
  addComment as addMockComment,
  createTask as createMockTask,
  deleteAttachment as deleteMockAttachment,
  deleteTask as deleteMockTask,
  ensureQuoteTask as ensureMockQuoteTask,
  loadState as loadMockState,
  markAllNotificationsRead as markAllMockNotificationsRead,
  markNotificationRead as markMockNotificationRead,
  resetState as resetMockState,
  saveState as saveMockState,
  updateTask as updateMockTask,
} from "./mockStore.js";
import { normalizeAssigneeNames, STATUSES } from "./domain.js";

const API_VERSION = "v9.2";
const QUOTE_TABLE = "cr40f_pedidodecotacao";
const QUALITY_ERROR_TABLE = "cr40f_errooperacional";
const QUALITY_ACTION_TABLE = "cr40f_acaooperacional";
const TASK_TABLE = "cr40f_plannertarefa";
const EMPLOYEE_TABLE = "cr40f_funcionarios";
const EMPLOYEE_ASSIGNEE_FIELD = "cr40f_cr40f_funcionarioresponsavel";
const EVENT_TABLE = "cr40f_plannertarefaevento";
const RELATION_TABLE = "cr40f_plannertarearelacao";
const ASSIGNEE_RELATION_TABLE = "cr40f_plannertarearesponsavel";
const NOTIFICATION_TABLE = "cr40f_plannernotificacao";
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
  [NOTIFICATION_TABLE]: "cr40f_plannernotificacaos",
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
    status: row["cr40f_statuscotacao@OData.Community.Display.V1.FormattedValue"] || "",
    deadline: dateOnly(row.cr40f_prazoresponder),
    value: row.cr40f_valorcotado == null ? "" : String(row.cr40f_valorcotado),
    plannerTaskId: row.cr40f_plannertaskid || "",
    plannerLink: row.cr40f_linktarefaplanner || "",
    teamsLink: row.cr40f_linkmensagemteams || "",
  };
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

function normalizeQuality(row, type) {
  const isAction = type === "action";
  return { id: row[isAction ? "cr40f_acaooperacionalid" : "cr40f_errooperacionalid"], type, code: row.cr40f_codigo || "", title: row.cr40f_titulo || "", description: row.cr40f_descricao || "", status: row[isAction ? "cr40f_status@OData.Community.Display.V1.FormattedValue" : "cr40f_status@OData.Community.Display.V1.FormattedValue"] || "", dueDate: dateOnly(row[isAction ? "cr40f_prazo" : "cr40f_prazoresolucao"]), assigneeId: row._cr40f_responsavel_value || "", assigneeName: row["_cr40f_responsavel_value@OData.Community.Display.V1.FormattedValue"] || "" };
}

function normalizeEventDetails(events = []) {
  const comments = events.filter((item) => item.cr40f_campo === "comentario").map((item) => ({ id: item.cr40f_plannertarefaeventoid, authorId: cleanId(item._cr40f_autor_value || item._createdby_value), text: item.cr40f_valornovo || item.cr40f_descricao || "", createdAt: item.cr40f_ocorridoem, author: item.authorName || item["_cr40f_autor_value@OData.Community.Display.V1.FormattedValue"] || item["_createdby_value@OData.Community.Display.V1.FormattedValue"] || "Sistema" })).sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")));
  const attachments = events.filter((item) => item.cr40f_campo === "anexo").map((item) => {
    try {
      const raw = JSON.parse(item.cr40f_valornovo || "{}");
      const sharePointId = raw.id || raw.identificador || raw.Identifier || raw.itemId || raw.ItemId || "";
      return {
        ...raw,
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
  const history = events.map((item) => ({ id: item.cr40f_plannertarefaeventoid, text: item.cr40f_descricao, createdAt: item.cr40f_ocorridoem, author: item.authorName || item["_cr40f_autor_value@OData.Community.Display.V1.FormattedValue"] || item["_createdby_value@OData.Community.Display.V1.FormattedValue"] || "Sistema" }));
  return { comments, attachments, history };
}

function normalizeTask(row, events = [], assignees = []) {
  const status = STATUS_BY_VALUE[row.cr40f_status] || "todo";
  const priority = PRIORITY_BY_VALUE[row.cr40f_prioridade] || "medium";
  const origin = Object.entries(ORIGIN_VALUES).find(([, value]) => value === row.cr40f_origem)?.[0] || "manual";
  const { comments, attachments, history } = normalizeEventDetails(events);
  return {
    id: row.cr40f_plannertarefaid,
    title: row.cr40f_titulo || row.cr40f_name || "Sem título",
    description: row.cr40f_descricao || "",
    status,
    priority,
    dueDate: dateOnly(row.cr40f_prazo),
    assigneeNames: assignees.length ? assignees.map((item) => item.name) : normalizeAssigneeNames(formatLookup(row, EMPLOYEE_ASSIGNEE_FIELD)),
    assigneeProfiles: assignees.length ? assignees.map((item) => ({ id: item.id, name: item.name, userId: item.userId || "" })) : [],
    assigneeName: assignees.length ? assignees.map((item) => item.name).join(", ") : formatLookup(row, EMPLOYEE_ASSIGNEE_FIELD),
    assigneeIds: assignees.length ? assignees.map((item) => item.id) : [row[`_${EMPLOYEE_ASSIGNEE_FIELD}_value`] || ""].filter(Boolean),
    assigneeId: assignees[0]?.id || row[`_${EMPLOYEE_ASSIGNEE_FIELD}_value`] || "",
    creatorUserId: row._createdby_value || "",
    teamName: formatLookup(row, "cr40f_equipe", "Sem equipe"),
    teamId: row._cr40f_equipe_value || "",
    quoteId: row._cr40f_pedidocotacao_value || null,
    quoteCode: row.quoteCode || "",
    quoteTitle: row.quoteTitle || "",
    sourceType: origin,
    sourceId: row._cr40f_pedidocotacao_value || row._cr40f_errooperacional_value || row._cr40f_acaooperacional_value || null,
    sourceCode: row.cr40f_codigoorigem || "",
    sourceLabel: origin === "quote" ? "Pedido de cotação" : origin === "quality" ? "Qualidade" : "Tarefa manual",
    comments,
    attachments,
    history,
  };
}

function normalizeRelation(row) {
  return { id: row.cr40f_plannertarearelacaoid, parentTaskId: row._cr40f_tarefapai_value || "", childTaskId: row._cr40f_subtarefa_value || "" };
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

function buildCoreState(xrm, rows, relations, assigneeRelations, employees) {
  const employeeRecords = employees.map((row) => ({ id: row.cr40f_funcionariosid, name: row.cr40f_nomecompleto || row.new_apelido || "Sem nome", apelido: row.new_apelido || "", mentionSearchText: [row.cr40f_nomecompleto, row.new_apelido].filter(Boolean).join(" "), userId: row._cr40f_usuariodataverse_value || "", externalNotificationsAvailable: Boolean(row._cr40f_usuariodataverse_value) }));
  const employeeById = new Map(employeeRecords.map((employee) => [cleanId(employee.id).toLowerCase(), employee]));
  const relationByChild = new Map(relations.map(normalizeRelation).map((item) => [item.childTaskId, item.parentTaskId]));
  const assigneesByTask = new Map();
  assigneeRelations.forEach((item) => {
    const list = assigneesByTask.get(item._cr40f_tarefa_value) || [];
    const employee = employeeById.get(cleanId(item._cr40f_funcionario_value).toLowerCase());
    list.push({ id: item._cr40f_funcionario_value, name: item["_cr40f_funcionario_value@OData.Community.Display.V1.FormattedValue"] || employee?.name || "Sem nome", userId: employee?.userId || "" });
    assigneesByTask.set(item._cr40f_tarefa_value, list);
  });
  const tasks = rows.map((row) => {
    const task = normalizeTask(row, [], assigneesByTask.get(row.cr40f_plannertarefaid) || []);
    const creator = employeeRecords.find((employee) => cleanId(employee.userId).toLowerCase() === cleanId(task.creatorUserId).toLowerCase());
    return { ...task, creatorEmployeeId: creator?.id || "", parentTaskId: relationByChild.get(row.cr40f_plannertarefaid) || null, detailsLoaded: false };
  });
  return { quotes: [], employees: employeeRecords, quality: [], tasks, notifications: [], lastUpdated: new Date().toISOString(), live: true, loading: { core: false, quotes: true, quality: true, notifications: true } };
}

export async function loadCoreState(xrm) {
  const [rows, relations, assigneeRelations, employees] = await Promise.all([
    measureStage("tarefas", () => retrieveMany(xrm, TASK_TABLE, `?$select=cr40f_plannertarefaid,cr40f_name,cr40f_titulo,cr40f_descricao,cr40f_status,cr40f_prioridade,cr40f_prazo,_createdby_value,_${EMPLOYEE_ASSIGNEE_FIELD}_value,_cr40f_equipe_value,_cr40f_pedidocotacao_value,_cr40f_errooperacional_value,_cr40f_acaooperacional_value,cr40f_origem,cr40f_codigoorigem&$filter=statecode eq 0&$orderby=modifiedon desc`)),
    measureStage("relações", () => retrieveMany(xrm, RELATION_TABLE, "?$select=cr40f_plannertarearelacaoid,_cr40f_tarefapai_value,_cr40f_subtarefa_value&$filter=statecode eq 0")),
    measureStage("responsáveis", () => retrieveMany(xrm, ASSIGNEE_RELATION_TABLE, "?$select=cr40f_plannertarearesponsavelid,_cr40f_tarefa_value,_cr40f_funcionario_value&$filter=statecode eq 0")),
    measureStage("funcionários", () => retrieveMany(xrm, EMPLOYEE_TABLE, "?$select=cr40f_funcionariosid,cr40f_nomecompleto,new_apelido,_cr40f_usuariodataverse_value&$filter=statecode eq 0 and cr40f_status eq 0 and cr40f_funcao eq 202410001&$orderby=cr40f_nomecompleto asc")),
  ]);
  return buildCoreState(xrm, rows, relations, assigneeRelations, employees);
}

export async function loadSupplementalState(xrm, state) {
  const quoteIds = [...new Set((state.tasks || []).map((task) => cleanId(task.quoteId)).filter(Boolean))];
  const quoteChunks = Array.from({ length: Math.ceil(quoteIds.length / 50) }, (_, index) => quoteIds.slice(index * 50, index * 50 + 50));
  const loadLinkedQuotes = () => {
    if (!quoteIds.length) return retrieveMany(xrm, QUOTE_TABLE, "?$select=cr40f_pedidodecotacaoid,cr40f_numerodacotacao,cr40f_titulo,cr40f_clienteempresa,cr40f_statuscotacao,cr40f_prazoresponder,cr40f_valorcotado,cr40f_plannertaskid,cr40f_linktarefaplanner,cr40f_linkmensagemteams&$filter=statecode eq 0&$orderby=modifiedon desc&$top=25");
    return Promise.all(quoteChunks.map((chunk) => {
    const filter = chunk.map((id) => `cr40f_pedidodecotacaoid eq ${id}`).join(" or ");
    return retrieveMany(xrm, QUOTE_TABLE, `?$select=cr40f_pedidodecotacaoid,cr40f_numerodacotacao,cr40f_titulo,cr40f_clienteempresa,cr40f_statuscotacao,cr40f_prazoresponder,cr40f_valorcotado,cr40f_plannertaskid,cr40f_linktarefaplanner,cr40f_linkmensagemteams&$filter=statecode eq 0 and (${filter})`);
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
  const events = await measureStage(`detalhes ${cleanId(taskId).slice(0, 8)}`, () => retrieveMany(xrm, EVENT_TABLE, `?$select=cr40f_plannertarefaeventoid,_cr40f_tarefa_value,cr40f_tipo,cr40f_campo,cr40f_descricao,cr40f_valornovo,cr40f_ocorridoem,_cr40f_autor_value,_createdby_value&$filter=_cr40f_tarefa_value eq ${cleanId(taskId)}&$orderby=cr40f_ocorridoem desc`));
  const details = normalizeEventDetails(events);
  return { taskId, ...details };
}

export async function searchQuotes(xrm, query) {
  const escaped = String(query || "").trim().replace(/'/g, "''");
  if (!escaped) return [];
  const filter = `contains(cr40f_numerodacotacao,'${escaped}') or contains(cr40f_titulo,'${escaped}') or contains(cr40f_clienteempresa,'${escaped}')`;
  const rows = await measureStage("busca de cotações", () => retrieveMany(xrm, QUOTE_TABLE, `?$select=cr40f_pedidodecotacaoid,cr40f_numerodacotacao,cr40f_titulo,cr40f_clienteempresa,cr40f_statuscotacao,cr40f_prazoresponder,cr40f_valorcotado,cr40f_plannertaskid,cr40f_linktarefaplanner,cr40f_linkmensagemteams&$filter=statecode eq 0 and (${filter})&$orderby=modifiedon desc&$top=25`));
  return rows.map(normalizeQuote);
}

async function loadLiveState(xrm) {
  const [quotes, rows, events, relations, assigneeRelations, qualityErrors, qualityActions, employees] = await Promise.all([
    retrieveMany(xrm, QUOTE_TABLE, "?$select=cr40f_pedidodecotacaoid,cr40f_numerodacotacao,cr40f_titulo,cr40f_clienteempresa,cr40f_statuscotacao,cr40f_prazoresponder,cr40f_valorcotado,cr40f_plannertaskid,cr40f_linktarefaplanner,cr40f_linkmensagemteams&$filter=statecode eq 0&$orderby=modifiedon desc"),
    retrieveMany(xrm, TASK_TABLE, `?$select=cr40f_plannertarefaid,cr40f_name,cr40f_titulo,cr40f_descricao,cr40f_status,cr40f_prioridade,cr40f_prazo,_createdby_value,_${EMPLOYEE_ASSIGNEE_FIELD}_value,_cr40f_equipe_value,_cr40f_pedidocotacao_value,_cr40f_errooperacional_value,_cr40f_acaooperacional_value,cr40f_origem,cr40f_codigoorigem&$filter=statecode eq 0&$orderby=modifiedon desc`),
    retrieveMany(xrm, EVENT_TABLE, "?$select=cr40f_plannertarefaeventoid,_cr40f_tarefa_value,cr40f_tipo,cr40f_campo,cr40f_descricao,cr40f_valornovo,cr40f_ocorridoem,_cr40f_autor_value,_createdby_value&$orderby=cr40f_ocorridoem desc"),
    retrieveMany(xrm, RELATION_TABLE, "?$select=cr40f_plannertarearelacaoid,_cr40f_tarefapai_value,_cr40f_subtarefa_value&$filter=statecode eq 0"),
    retrieveMany(xrm, ASSIGNEE_RELATION_TABLE, "?$select=cr40f_plannertarearesponsavelid,_cr40f_tarefa_value,_cr40f_funcionario_value,_cr40f_funcionario_value&$filter=statecode eq 0"),
    retrieveMany(xrm, QUALITY_ERROR_TABLE, "?$select=cr40f_errooperacionalid,cr40f_codigo,cr40f_titulo,cr40f_descricao,cr40f_status,cr40f_prazoresolucao,_cr40f_responsavel_value&$filter=statecode eq 0&$orderby=createdon desc"),
    retrieveMany(xrm, QUALITY_ACTION_TABLE, "?$select=cr40f_acaooperacionalid,cr40f_titulo,cr40f_descricao,cr40f_status,cr40f_prazo,_cr40f_responsavel_value&$filter=statecode eq 0&$orderby=createdon desc"),
    retrieveMany(xrm, EMPLOYEE_TABLE, "?$select=cr40f_funcionariosid,cr40f_nomecompleto,new_apelido,_cr40f_usuariodataverse_value&$filter=statecode eq 0 and cr40f_status eq 0 and cr40f_funcao eq 202410001&$orderby=cr40f_nomecompleto asc"),
  ]);
  const employeeRecords = employees.map((row) => ({ id: row.cr40f_funcionariosid, name: row.cr40f_nomecompleto || row.new_apelido || "Sem nome", apelido: row.new_apelido || "", mentionSearchText: [row.cr40f_nomecompleto, row.new_apelido].filter(Boolean).join(" "), userId: row._cr40f_usuariodataverse_value || "", externalNotificationsAvailable: Boolean(row._cr40f_usuariodataverse_value) }));
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
  const tasks = rows.map((row) => {
    const task = normalizeTask(row, eventsByTask.get(row.cr40f_plannertarefaid) || [], assigneesByTask.get(row.cr40f_plannertarefaid) || []);
    const creator = employeeRecords.find((employee) => cleanId(employee.userId).toLowerCase() === cleanId(task.creatorUserId).toLowerCase());
    return { ...task, creatorEmployeeId: creator?.id || "", parentTaskId: relationByChild.get(row.cr40f_plannertarefaid) || null };
  });
  const quoteById = new Map(quotes.map((row) => [row.cr40f_pedidodecotacaoid, normalizeQuote(row)]));
  const employeesWithProfiles = employeeRecords;
  const quality = [...qualityErrors.map((row) => normalizeQuality(row, "error")), ...qualityActions.map((row) => normalizeQuality(row, "action"))].map((item) => ({ ...item, assigneeProfiles: employeeById.has(cleanId(item.assigneeId).toLowerCase()) ? [employeesWithProfiles.find((employee) => cleanId(employee.id).toLowerCase() === cleanId(item.assigneeId).toLowerCase())] : [] }));
  const tasksWithProfiles = tasks.map((task) => ({ ...task, assigneeProfiles: task.assigneeProfiles?.length ? task.assigneeProfiles : task.assigneeIds.map((id) => employeesWithProfiles.find((employee) => cleanId(employee.id).toLowerCase() === cleanId(id).toLowerCase())).filter(Boolean), quoteCode: quoteById.get(task.quoteId)?.code || "", quoteTitle: quoteById.get(task.quoteId)?.title || "" }));
  return { quotes: [...quoteById.values()], employees: employeesWithProfiles, quality, tasks: tasksWithProfiles, notifications: [], lastUpdated: new Date().toISOString(), live: true };
}

function normalizeNotification(row) {
  return { id: row.cr40f_plannernotificacaoid, taskId: row._cr40f_tarefa_value || "", recipientEmployeeId: row._cr40f_destinatario_value || "", type: row.cr40f_tipo || "update", title: row.cr40f_titulo || row.cr40f_name || "Notificação", message: row.cr40f_mensagem || "", occurredAt: row.cr40f_ocorridoem || row.createdon || "", readAt: row.cr40f_lidoem || "", referenceDate: dateOnly(row.cr40f_datareferencia), dedupeKey: row.cr40f_chavededupe || "" };
}

async function loadLiveNotifications(xrm, employeeId) {
  if (!employeeId) return [];
  try {
    const rows = await retrieveMany(xrm, NOTIFICATION_TABLE, `?$select=cr40f_plannernotificacaoid,cr40f_name,cr40f_titulo,cr40f_mensagem,cr40f_tipo,cr40f_ocorridoem,cr40f_lidoem,cr40f_datareferencia,cr40f_chavededupe,_cr40f_tarefa_value,_cr40f_destinatario_value&$filter=_cr40f_destinatario_value eq ${cleanId(employeeId)} and statecode eq 0&$orderby=cr40f_ocorridoem desc&$top=100`);
    return rows.map(normalizeNotification);
  } catch (error) {
    console.warn("[Planner] notificações indisponíveis", error);
    return [];
  }
}

async function markLiveNotificationRead(xrm, notificationId, readAt = new Date().toISOString()) {
  await request(xrm, `/${entitySetName(NOTIFICATION_TABLE)}(${cleanId(notificationId)})`, { method: "PATCH", body: JSON.stringify({ cr40f_lidoem: readAt }) });
  return readAt;
}

async function createEvent(xrm, taskId, type, description, field = "", previous = "", next = "") {
  const payload = { cr40f_tipo: type, cr40f_descricao: description, cr40f_campo: field, cr40f_valoranterior: previous, cr40f_valornovo: next, cr40f_ocorridoem: new Date().toISOString() };
  await bindLookup(xrm, payload, EVENT_TABLE, "cr40f_tarefa", TASK_TABLE, taskId);
  await request(xrm, `/${entitySetName(EVENT_TABLE)}`, { method: "POST", body: JSON.stringify(payload) });
}

async function createLiveTask(xrm, state, input) {
  if (input.quoteId && !input.parentTaskId) {
  const activeMain = state.tasks.find((task) => task.quoteId === input.quoteId && !task.parentTaskId && !["done", "cancelled"].includes(task.status));
    if (activeMain) throw new Error("Esta cotação já possui um acompanhamento principal ativo.");
  }
  const payload = { cr40f_titulo: input.title.trim(), cr40f_descricao: input.description || "", cr40f_status: STATUS_VALUES.todo, cr40f_prioridade: PRIORITY_VALUES[input.priority] || PRIORITY_VALUES.medium, cr40f_prazo: input.dueDate ? `${input.dueDate}T12:00:00Z` : null, cr40f_origem: ORIGIN_VALUES[input.sourceType || (input.quoteId ? "quote" : "manual")], cr40f_codigoorigem: input.sourceCode || input.quoteCode || "" };
  const teamId = input.teamId || await resolveIdByName(xrm, "team", "name", input.teamName);
  await bindLookup(xrm, payload, TASK_TABLE, "cr40f_pedidocotacao", QUOTE_TABLE, input.quoteId);
  await bindLookup(xrm, payload, TASK_TABLE, "cr40f_errooperacional", QUALITY_ERROR_TABLE, input.qualityType === "error" ? input.qualityId : "");
  await bindLookup(xrm, payload, TASK_TABLE, "cr40f_acaooperacional", QUALITY_ACTION_TABLE, input.qualityType === "action" ? input.qualityId : "");
  const assigneeIds = await resolveAssigneeIds(xrm, input);
  await bindLookup(xrm, payload, TASK_TABLE, EMPLOYEE_ASSIGNEE_FIELD, EMPLOYEE_TABLE, assigneeIds[0]);
  await bindLookup(xrm, payload, TASK_TABLE, "cr40f_equipe", "team", teamId);
  const created = await request(xrm, `/${entitySetName(TASK_TABLE)}`, { method: "POST", body: JSON.stringify(payload) });
  const id = created?.cr40f_plannertarefaid;
  if (!id) throw new Error("Dataverse criou tarefa sem retornar o ID.");
  await replaceTaskAssignees(xrm, id, { ...input, assigneeIds });
  await markQuoteOrigin(xrm, input.quoteId, id);
  await createEvent(xrm, id, 100000000, "Tarefa criada.");
  if (assigneeIds.length) {
    await createEvent(xrm, id, 100000003, "Responsáveis atribuídos.", "notification:assignment", "", JSON.stringify({ actorEmployeeId: input.actorEmployeeId || "", actorUserId: input.actorUserId || "", creatorEmployeeId: input.actorEmployeeId || "", assigneeIds, previousAssigneeIds: [] }));
  }
  return loadLiveState(xrm);
}

async function updateLiveTask(xrm, state, id, patch) {
  const existing = state.tasks.find((item) => item.id === id);
  const previousStatus = existing?.status || "";
  const previousDueDate = existing?.dueDate || "";
  const previousAssigneeIds = existing?.assigneeIds || [];
  const nextStatus = patch.status ?? previousStatus;
  const payload = {};
  if (patch.title !== undefined) payload.cr40f_titulo = patch.title.trim();
  if (patch.description !== undefined) payload.cr40f_descricao = patch.description;
  if (patch.status !== undefined) payload.cr40f_status = STATUS_VALUES[patch.status];
  if (patch.priority !== undefined) payload.cr40f_prioridade = PRIORITY_VALUES[patch.priority];
  if (patch.dueDate !== undefined) payload.cr40f_prazo = patch.dueDate ? `${patch.dueDate}T12:00:00Z` : null;
  if (patch.assigneeId !== undefined || patch.assigneeName !== undefined || patch.assigneeNames !== undefined) {
    const navigation = await resolveLookupNavigation(xrm, TASK_TABLE, EMPLOYEE_ASSIGNEE_FIELD, EMPLOYEE_TABLE);
    const assigneeIds = await resolveAssigneeIds(xrm, patch);
    const employeeId = assigneeIds[0] || "";
    payload[`${navigation}@odata.bind`] = employeeId ? `/${entitySetName(EMPLOYEE_TABLE)}(${cleanId(employeeId)})` : null;
    await replaceTaskAssignees(xrm, id, { ...patch, assigneeIds });
  }
  if (patch.teamId !== undefined || patch.teamName !== undefined) await bindLookup(xrm, payload, TASK_TABLE, "cr40f_equipe", "team", patch.teamId || await resolveIdByName(xrm, "team", "name", patch.teamName));
  await request(xrm, `/${entitySetName(TASK_TABLE)}(${cleanId(id)})`, { method: "PATCH", body: JSON.stringify(payload) });
  await markQuoteOrigin(xrm, existing?.quoteId);
  const statusChanged = patch.status !== undefined && nextStatus !== previousStatus;
  const dueDateChanged = patch.dueDate !== undefined && patch.dueDate !== previousDueDate;
  const nextAssigneeIds = patch.assigneeIds || await resolveAssigneeIds(xrm, patch);
  const assigneesChanged = patch.assigneeNames !== undefined && JSON.stringify([...previousAssigneeIds].sort()) !== JSON.stringify([...nextAssigneeIds].sort());
  const eventContext = { actorEmployeeId: patch.actorEmployeeId || "", actorUserId: patch.actorUserId || "", creatorEmployeeId: existing?.creatorEmployeeId || "", assigneeIds: nextAssigneeIds, previousAssigneeIds };
  if (patch.mentionedEmployeeIds?.length) await createEvent(xrm, id, 100000001, "Menção na tarefa.", "notification:mention", "", JSON.stringify({ ...eventContext, mentionedEmployeeIds: patch.mentionedEmployeeIds }));
  if (statusChanged) await createEvent(xrm, id, 100000002, nextStatus === "done" ? "Tarefa concluída." : `Status alterado para ${STATUSES.find((item) => item.id === nextStatus)?.label || nextStatus}.`, "status", previousStatus, nextStatus);
  if (statusChanged && ["done", "waiting"].includes(nextStatus)) await createEvent(xrm, id, 100000002, nextStatus === "done" ? "Tarefa concluída por outro responsável." : "Tarefa aguardando retorno.", "notification:status", "", JSON.stringify({ ...eventContext, previousStatus, nextStatus }));
  if (dueDateChanged) await createEvent(xrm, id, 100000002, `Prazo alterado de ${previousDueDate || "sem prazo"} para ${patch.dueDate || "sem prazo"}.${patch.deadlineChangeReason ? ` Motivo: ${patch.deadlineChangeReason}` : ""}`, "notification:deadline", previousDueDate, JSON.stringify({ ...eventContext, nextDueDate: patch.dueDate || "", reason: patch.deadlineChangeReason || "" }));
  if (assigneesChanged) await createEvent(xrm, id, 100000002, "Responsáveis alterados.", "notification:assignees", JSON.stringify(previousAssigneeIds), JSON.stringify({ ...eventContext, addedAssigneeIds: nextAssigneeIds.filter((assigneeId) => !previousAssigneeIds.includes(assigneeId)), removedAssigneeIds: previousAssigneeIds.filter((assigneeId) => !nextAssigneeIds.includes(assigneeId)) }));
  if (!statusChanged && !dueDateChanged && !assigneesChanged) await createEvent(xrm, id, patch.status !== undefined ? 100000002 : 100000001, "Tarefa atualizada.");
  return loadLiveState(xrm);
}

async function addLiveComment(xrm, taskId, text, context = {}) {
  await createEvent(xrm, taskId, 100000001, "Comentário adicionado.", "comentario", "", text.trim());
  if (context.mentionedEmployeeIds?.length) await createEvent(xrm, taskId, 100000001, "Menção em comentário.", "notification:mention", "", JSON.stringify(context));
  return loadLiveState(xrm);
}

async function addLiveAttachment(xrm, taskId, file) {
  if (!file) return loadLiveState(xrm);
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
  const response = await fetch(flowUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caminhoCompleto: path, nomeArquivo: fileName, conteudoBase64: base64, mimeType: uploadFile.type || "application/octet-stream", metadados: { tarefaId: taskId, tarefa: task.cr40f_titulo || "", origem: "PLANNER_INTERNO" } }) });
  const responseText = await response.text();
  const result = extractFlowRecord(responseText) || {};
  if (!response.ok || result.sucesso !== true) throw new Error(result.erro || `Flow SharePoint falhou: HTTP ${response.status}.`);
  const sharePointId = result.identificador || result.Identifier || result.id || result.itemId || result.ItemId || "";
  const attachment = { name: result.nomeArquivo || result.Name || fileName, id: sharePointId, sharePointId, fileLocator: result.fileLocator || result.identificador || result.Identifier || "", path: result.caminhoSharePoint || result.caminhoCompleto || result.Path || "", mimeType: result.mimeType || result.MediaType || uploadFile.type || "application/octet-stream", size: result.tamanho ?? result.Size ?? uploadFile.size };
  if (!attachment.id && !attachment.fileLocator && !attachment.path) throw new Error("Flow SharePoint não retornou identificador ou caminho do arquivo.");
  await createEvent(xrm, taskId, 100000001, "Anexo adicionado.", "anexo", "", JSON.stringify(attachment));
  return loadTaskDetails(xrm, taskId);
}

async function loadLiveAttachmentContent(xrm, attachment) {
  const flowUrl = await resolveSharePointReadFlowUrl(xrm);
  if (!flowUrl) throw new Error(`URL do Flow de consulta não configurada: ${READ_FLOW_URL_SCHEMA}.`);
  if (!attachment?.sharePointId && !attachment?.fileLocator && !attachment?.path) throw new Error("Anexo sem identificador ou caminho SharePoint.");
  const response = await fetch(flowUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: attachment.sharePointId || "", fileLocator: attachment.fileLocator || "", caminhoSharePoint: attachment.path || "", nomeArquivo: attachment.name || "" }) });
  const responseText = await response.text();
  const result = extractFlowRecord(responseText) || {};
  if (!response.ok || result.sucesso !== true || !result.conteudoBase64) throw new Error(result.erro || `Flow de consulta SharePoint falhou: HTTP ${response.status}.`);
  const mimeType = result.mimeType || attachment.mimeType || "application/octet-stream";
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
  return loadLiveState(xrm);
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
  return createLiveTask(xrm, state, { title: `Acompanhar ${reference || "cotação"}`, quoteId: quote.id, quoteCode: quote.code || "", quoteTitle: quote.title || "", dueDate: quote.deadline, priority: "medium", sourceType: "quote", assigneeName: "Não atribuído", teamName: "Comercial", description: `Acompanhar a cotação ${reference || "selecionada"} até a resposta ao cliente.` });
}

async function deleteLiveTask(xrm, state, id) {
  const task = state.tasks.find((item) => item.id === id);
  const assigneeRelations = await retrieveMany(xrm, ASSIGNEE_RELATION_TABLE, `?$select=${ASSIGNEE_RELATION_TABLE}id&$filter=_cr40f_tarefa_value eq ${cleanId(id)}`);
  await Promise.all(assigneeRelations.map((relation) => request(xrm, `/${entitySetName(ASSIGNEE_RELATION_TABLE)}(${cleanId(relation[`${ASSIGNEE_RELATION_TABLE}id`])})`, { method: "DELETE" })));
  if (task?.parentTaskId) {
    const relations = await retrieveMany(xrm, RELATION_TABLE, `?$select=${RELATION_TABLE}id&$filter=_cr40f_subtarefa_value eq ${cleanId(id)}`);
    await Promise.all(relations.map((relation) => request(xrm, `/${entitySetName(RELATION_TABLE)}(${cleanId(relation[`${RELATION_TABLE}id`])})`, { method: "DELETE" })));
  }
  await request(xrm, `/${entitySetName(TASK_TABLE)}(${cleanId(id)})`, { method: "DELETE" });
  return loadLiveState(xrm);
}

function createMockDataStore() {
  const withMode = (state) => ({ ...state, live: false });
  const withoutMode = ({ live: _live, ...state }) => state;
  const persist = (state) => withMode(saveMockState(withoutMode(state)));

  return {
    live: false,
    load: async () => withMode(loadMockState()),
    loadCore: async () => ({ ...withMode(loadMockState()), loading: { core: false, quotes: false, quality: false, photos: false } }),
    loadSupplemental: async (state) => ({ ...state, loading: { ...(state.loading || {}), quotes: false, quality: false } }),
    loadNotifications: async (employeeId) => (loadMockState().notifications || []).filter((item) => !employeeId || item.recipientEmployeeId === employeeId),
    markNotificationRead: async (state, notificationId) => withMode(markMockNotificationRead(state, notificationId)),
    markAllNotificationsRead: async (state, employeeId) => withMode(markAllMockNotificationsRead(state, employeeId)),
    loadTaskDetails: async (taskId) => ({ taskId, detailsLoaded: true }),
    loadAttachmentContent: async () => { throw new Error("Prévia de anexo disponível somente no ambiente conectado."); },
    loadPhotos: async () => ({ loading: { photos: false } }),
    searchQuotes: async () => [],
    createTask: async (state, input) => withMode(createMockTask(state, input)),
    createSubtask: async (state, parentId, input) => withMode(createMockTask(state, { ...input, parentTaskId: parentId })),
    createQualityTask: async (state, item) => withMode(createMockTask(state, { title: item.title, description: item.description, dueDate: item.dueDate, sourceType: "quality", sourceId: item.id, sourceCode: item.code, sourceLabel: item.type === "error" ? "Erro operacional" : "Ação operacional" })),
    updateTask: async (state, id, patch) => withMode(updateMockTask(state, id, patch)),
    deleteTask: async (state, id) => withMode(deleteMockTask(state, id)),
    addComment: async (state, id, text, context) => withMode(addMockComment(state, id, text, context)),
    addAttachment: async (state, id, file, previewUrl = "") => withMode(addMockAttachment(state, id, { name: file?.name || "Arquivo", mimeType: file?.type || "", size: file?.size || 0, previewUrl })),
    deleteAttachment: async (state, taskId, attachment) => withMode(deleteMockAttachment(state, taskId, attachment?.id)),
    ensureQuoteTask: async (state, quote) => withMode(ensureMockQuoteTask(state, quote)),
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
    loadSupplemental: (state) => loadSupplementalState(xrm, state),
    loadNotifications: (employeeId) => loadLiveNotifications(xrm, employeeId),
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
    createTask: (state, input) => createLiveTask(xrm, state, input),
    createSubtask: (state, parentId, input) => createLiveSubtask(xrm, state, parentId, input),
    createQualityTask: (state, item) => createLiveTask(xrm, state, { title: item.title, description: item.description, dueDate: item.dueDate, sourceType: "quality", sourceCode: item.code, qualityType: item.type, qualityId: item.id }),
    updateTask: (state, id, patch) => updateLiveTask(xrm, state, id, patch),
    deleteTask: (state, id) => deleteLiveTask(xrm, state, id),
    addComment: (state, id, text, context) => addLiveComment(xrm, id, text, context),
    addAttachment: (state, id, file) => addLiveAttachment(xrm, id, file),
    deleteAttachment: (state, taskId, attachment) => deleteLiveAttachment(xrm, state, taskId, attachment),
    ensureQuoteTask: (state, quote) => ensureLiveQuoteTask(xrm, state, quote),
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
