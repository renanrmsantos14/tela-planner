import { addAttachment as addMockAttachment, addComment as addMockComment, createTask as createMockTask, ensureQuoteTask as ensureMockQuoteTask, loadState as loadMockState, resetState as resetMockState, saveState as saveMockState, updateTask as updateMockTask } from "./mockStore.js";

const API_VERSION = "v9.2";
const QUOTE_TABLE = "cr40f_pedidodecotacao";
const TASK_TABLE = "cr40f_plannertarefa";
const EVENT_TABLE = "cr40f_plannertarefaevento";
const RELATION_TABLE = "cr40f_plannertarearelacao";
const ANNOTATION_TABLE = "annotation";
const ENTITY_SETS = Object.freeze({
  [QUOTE_TABLE]: "cr40f_pedidodecotacaos",
  [TASK_TABLE]: "cr40f_plannertarefas",
  [EVENT_TABLE]: "cr40f_plannertarefaeventos",
  [RELATION_TABLE]: "cr40f_plannertarearelacaos",
  [ANNOTATION_TABLE]: "annotations",
  systemuser: "systemusers",
  team: "teams",
});
const ORIGIN_VALUES = { manual: 100000000, quote: 100000001, quality: 100000002 };
const STATUS_VALUES = { todo: 100000000, doing: 100000001, waiting: 100000002, done: 100000003, cancelled: 100000004 };
const PRIORITY_VALUES = { low: 100000000, medium: 100000001, high: 100000002, urgent: 100000003 };
const STATUS_BY_VALUE = Object.fromEntries(Object.entries(STATUS_VALUES).map(([key, value]) => [value, key]));
const PRIORITY_BY_VALUE = Object.fromEntries(Object.entries(PRIORITY_VALUES).map(([key, value]) => [value, key]));
const lookupCache = new Map();

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
  if (!response.ok) {
    const detail = parsed?.error?.message || body || response.statusText;
    throw new Error(`${options.method || "GET"} ${path} falhou: ${response.status} ${detail}`);
  }
  return parsed;
}

async function retrieveMany(xrm, table, query) {
  const result = await request(xrm, `/${entitySetName(table)}${query}`);
  return result?.value || [];
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

async function markQuoteOrigin(xrm, quoteId) {
  if (!quoteId) return;
  await request(xrm, `/${entitySetName(QUOTE_TABLE)}(${cleanId(quoteId)})`, { method: "PATCH", body: JSON.stringify({ cr40f_origemultimasincronizacao: "Planner", cr40f_ultimasincronizacao: new Date().toISOString() }) });
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
  };
}

function normalizeTask(row, annotations = [], events = []) {
  const status = STATUS_BY_VALUE[row.cr40f_status] || "todo";
  const priority = PRIORITY_BY_VALUE[row.cr40f_prioridade] || "medium";
  const origin = Object.entries(ORIGIN_VALUES).find(([, value]) => value === row.cr40f_origem)?.[0] || "manual";
  const comments = annotations.filter((item) => item.isdocument !== true).map((item) => ({ id: item.annotationid, text: item.notetext || "", createdAt: item.createdon, author: item.createdbyName || "Sistema" }));
  const attachments = annotations.filter((item) => item.isdocument === true).map((item) => ({ id: item.annotationid, name: item.filename || "Anexo", createdAt: item.createdon }));
  return {
    id: row.cr40f_plannertarefaid,
    title: row.cr40f_titulo || row.cr40f_name || "Sem título",
    description: row.cr40f_descricao || "",
    status,
    priority,
    dueDate: dateOnly(row.cr40f_prazo),
    assigneeName: formatLookup(row, "cr40f_responsavel"),
    assigneeId: row._cr40f_responsavel_value || "",
    teamName: formatLookup(row, "cr40f_equipe", "Sem equipe"),
    teamId: row._cr40f_equipe_value || "",
    quoteId: row._cr40f_pedidocotacao_value || null,
    quoteCode: row.quoteCode || "",
    quoteTitle: row.quoteTitle || "",
    sourceType: origin,
    sourceId: row._cr40f_pedidocotacao_value || row._cr40f_errooperacional_value || row._cr40f_acaooperacional_value || null,
    sourceCode: row.cr40f_codigoorigem || "",
    sourceLabel: origin === "quote" ? "Pedido de cotação" : origin === "quality" ? "Qualidade" : "Tarefa manual",
    blockedReason: row.cr40f_motivobloqueio || "",
    comments,
    attachments,
    history: events.map((item) => ({ id: item.cr40f_plannertarefaeventoid, text: item.cr40f_descricao, createdAt: item.cr40f_ocorridoem, author: item.authorName || "Sistema" })),
  };
}

async function loadLiveState(xrm) {
  const [quotes, rows, events] = await Promise.all([
    retrieveMany(xrm, QUOTE_TABLE, "?$select=cr40f_pedidodecotacaoid,cr40f_numerodacotacao,cr40f_titulo,cr40f_clienteempresa,cr40f_statuscotacao,cr40f_prazoresponder,cr40f_valorcotado&$filter=statecode eq 0&$orderby=modifiedon desc&$top=500"),
    retrieveMany(xrm, TASK_TABLE, "?$select=cr40f_plannertarefaid,cr40f_name,cr40f_titulo,cr40f_descricao,cr40f_status,cr40f_prioridade,cr40f_prazo,_cr40f_responsavel_value,_cr40f_equipe_value,_cr40f_pedidocotacao_value,_cr40f_errooperacional_value,_cr40f_acaooperacional_value,cr40f_origem,cr40f_codigoorigem,cr40f_motivobloqueio&$filter=statecode eq 0&$orderby=modifiedon desc&$top=500"),
    retrieveMany(xrm, EVENT_TABLE, "?$select=cr40f_plannertarefaeventoid,_cr40f_tarefa_value,cr40f_tipo,cr40f_descricao,cr40f_ocorridoem,_cr40f_autor_value&$orderby=cr40f_ocorridoem desc&$top=5000"),
  ]);
  const annotations = await retrieveMany(xrm, ANNOTATION_TABLE, "?$select=annotationid,_objectid_value,notetext,filename,isdocument,createdon,_createdby_value&$filter=isdocument eq false or isdocument eq true&$top=5000");
  const tasks = rows.map((row) => normalizeTask(row, annotations.filter((item) => item._objectid_value === row.cr40f_plannertarefaid), events.filter((item) => item._cr40f_tarefa_value === row.cr40f_plannertarefaid)));
  const quoteById = new Map(quotes.map((row) => [row.cr40f_pedidodecotacaoid, normalizeQuote(row)]));
  return { quotes: [...quoteById.values()], tasks: tasks.map((task) => ({ ...task, quoteCode: quoteById.get(task.quoteId)?.code || "", quoteTitle: quoteById.get(task.quoteId)?.title || "" })), lastUpdated: new Date().toISOString(), live: true };
}

async function createEvent(xrm, taskId, type, description, field = "", previous = "", next = "") {
  const payload = { cr40f_tipo: type, cr40f_descricao: description, cr40f_campo: field, cr40f_valoranterior: previous, cr40f_valornovo: next, cr40f_ocorridoem: new Date().toISOString() };
  await bindLookup(xrm, payload, EVENT_TABLE, "cr40f_tarefa", TASK_TABLE, taskId);
  await request(xrm, `/${entitySetName(EVENT_TABLE)}`, { method: "POST", body: JSON.stringify(payload) });
}

async function createLiveTask(xrm, state, input) {
  const payload = { cr40f_titulo: input.title.trim(), cr40f_descricao: input.description || "", cr40f_status: STATUS_VALUES.todo, cr40f_prioridade: PRIORITY_VALUES[input.priority] || PRIORITY_VALUES.medium, cr40f_prazo: input.dueDate ? `${input.dueDate}T12:00:00Z` : null, cr40f_origem: ORIGIN_VALUES[input.sourceType || (input.quoteId ? "quote" : "manual")], cr40f_codigoorigem: input.sourceCode || input.quoteCode || "", cr40f_motivobloqueio: input.blockedReason || "" };
  const assigneeId = input.assigneeId || await resolveIdByName(xrm, "systemuser", "fullname", input.assigneeName);
  const teamId = input.teamId || await resolveIdByName(xrm, "team", "name", input.teamName);
  await bindLookup(xrm, payload, TASK_TABLE, "cr40f_pedidocotacao", QUOTE_TABLE, input.quoteId);
  await bindLookup(xrm, payload, TASK_TABLE, "cr40f_responsavel", "systemuser", assigneeId);
  await bindLookup(xrm, payload, TASK_TABLE, "cr40f_equipe", "team", teamId);
  const created = await request(xrm, `/${entitySetName(TASK_TABLE)}`, { method: "POST", body: JSON.stringify(payload) });
  const id = created?.cr40f_plannertarefaid;
  if (!id) throw new Error("Dataverse criou tarefa sem retornar o ID.");
  await markQuoteOrigin(xrm, input.quoteId);
  await createEvent(xrm, id, 100000000, "Tarefa criada.");
  return loadLiveState(xrm);
}

async function updateLiveTask(xrm, state, id, patch) {
  const payload = {};
  if (patch.title !== undefined) payload.cr40f_titulo = patch.title.trim();
  if (patch.description !== undefined) payload.cr40f_descricao = patch.description;
  if (patch.status !== undefined) payload.cr40f_status = STATUS_VALUES[patch.status];
  if (patch.priority !== undefined) payload.cr40f_prioridade = PRIORITY_VALUES[patch.priority];
  if (patch.dueDate !== undefined) payload.cr40f_prazo = patch.dueDate ? `${patch.dueDate}T12:00:00Z` : null;
  if (patch.blockedReason !== undefined) payload.cr40f_motivobloqueio = patch.blockedReason;
  if (patch.assigneeId !== undefined || patch.assigneeName !== undefined) await bindLookup(xrm, payload, TASK_TABLE, "cr40f_responsavel", "systemuser", patch.assigneeId || await resolveIdByName(xrm, "systemuser", "fullname", patch.assigneeName));
  if (patch.teamId !== undefined || patch.teamName !== undefined) await bindLookup(xrm, payload, TASK_TABLE, "cr40f_equipe", "team", patch.teamId || await resolveIdByName(xrm, "team", "name", patch.teamName));
  await request(xrm, `/${entitySetName(TASK_TABLE)}(${cleanId(id)})`, { method: "PATCH", body: JSON.stringify(payload) });
  const existing = state.tasks.find((item) => item.id === id);
  await markQuoteOrigin(xrm, existing?.quoteId);
  await createEvent(xrm, id, patch.status !== undefined ? 100000002 : 100000001, "Tarefa atualizada.");
  return loadLiveState(xrm);
}

async function addLiveComment(xrm, taskId, text) {
  const payload = { subject: "Comentário da tarefa", notetext: text.trim(), isdocument: false };
  await bindLookup(xrm, payload, ANNOTATION_TABLE, "objectid", TASK_TABLE, taskId);
  await request(xrm, `/${entitySetName(ANNOTATION_TABLE)}`, { method: "POST", body: JSON.stringify(payload) });
  return loadLiveState(xrm);
}

async function addLiveAttachment(xrm, taskId, file) {
  const payload = { subject: file.name, filename: file.name, mimetype: file.type || "application/octet-stream", documentbody: file.base64, isdocument: true };
  await bindLookup(xrm, payload, ANNOTATION_TABLE, "objectid", TASK_TABLE, taskId);
  await request(xrm, `/${entitySetName(ANNOTATION_TABLE)}`, { method: "POST", body: JSON.stringify(payload) });
  return loadLiveState(xrm);
}

async function ensureLiveQuoteTask(xrm, state, quote) {
  const existing = state.tasks.find((item) => item.quoteId === quote.id && !item.parentTaskId);
  if (existing) return state;
  return createLiveTask(xrm, state, { title: `Acompanhar ${quote.code}`, quoteId: quote.id, quoteCode: quote.code, quoteTitle: quote.title, dueDate: quote.deadline, priority: "medium", sourceType: "quote", assigneeName: "Não atribuído", teamName: "Comercial", description: `Acompanhar a cotação ${quote.code} até a resposta ao cliente.` });
}

export function createDataStore() {
  const xrm = getXrm();
  if (!xrm) return {
    live: false,
    load: async () => loadMockState(),
    reset: async () => resetMockState(),
    createTask: async (state, input) => createMockTask(state, input),
    updateTask: async (state, id, patch) => updateMockTask(state, id, patch),
    addComment: async (state, id, text) => addMockComment(state, id, text),
    addAttachment: async (state, id, file) => addMockAttachment(state, id, file.name || file),
    ensureQuoteTask: async (state, quote) => ensureMockQuoteTask(state, quote),
    save: async (state) => saveMockState(state),
  };
  return {
    live: true,
    load: () => loadLiveState(xrm),
    createTask: (state, input) => createLiveTask(xrm, state, input),
    updateTask: (state, id, patch) => updateLiveTask(xrm, state, id, patch),
    addComment: (state, id, text) => addLiveComment(xrm, id, text),
    addAttachment: (state, id, file) => addLiveAttachment(xrm, id, file),
    ensureQuoteTask: (state, quote) => ensureLiveQuoteTask(xrm, state, quote),
    save: (state) => loadLiveState(xrm),
    reset: () => loadLiveState(xrm),
  };
}
