import { addAttachment as addMockAttachment, addComment as addMockComment, createTask as createMockTask, ensureQuoteTask as ensureMockQuoteTask, loadState as loadMockState, resetState as resetMockState, saveState as saveMockState, updateTask as updateMockTask } from "./mockStore.js";

const API_VERSION = "v9.2";
const QUOTE_TABLE = "cr40f_pedidodecotacao";
const QUALITY_ERROR_TABLE = "cr40f_errooperacional";
const QUALITY_ACTION_TABLE = "cr40f_acaooperacional";
const TASK_TABLE = "cr40f_plannertarefa";
const EVENT_TABLE = "cr40f_plannertarefaevento";
const RELATION_TABLE = "cr40f_plannertarearelacao";
const ANNOTATION_TABLE = "annotation";
const ENVIRONMENT_VARIABLE_DEFINITION_TABLE = "environmentvariabledefinition";
const ENVIRONMENT_VARIABLE_VALUE_TABLE = "environmentvariablevalue";
const FLOW_URL_SCHEMA = "new_FlowURLFlowSalvarArquivosOnedrive";
const DEV_DATAVERSE_URL = "https://org23b93544.crm2.dynamics.com";
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;
const ENTITY_SETS = Object.freeze({
  [QUOTE_TABLE]: "cr40f_pedidodecotacaos",
  [QUALITY_ERROR_TABLE]: "cr40f_errooperacionals",
  [QUALITY_ACTION_TABLE]: "cr40f_acaooperacionals",
  [TASK_TABLE]: "cr40f_plannertarefas",
  [EVENT_TABLE]: "cr40f_plannertarefaeventos",
  [RELATION_TABLE]: "cr40f_plannertarearelacaos",
  [ANNOTATION_TABLE]: "annotations",
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

function getFlowLink(result) {
  for (const key of ["shareLink", "link", "webUrl", "url", "fileLink", "sharedLink"]) {
    if (typeof result?.[key] === "string" && result[key].trim()) return result[key].trim();
  }
  const nested = extractFlowRecord(result?.body || result?.Body || result?.responseText);
  return nested ? getFlowLink(nested) : "";
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

async function resolveOneDriveFlowUrl(xrm) {
  const definitions = await retrieveMany(xrm, ENVIRONMENT_VARIABLE_DEFINITION_TABLE, `?$select=environmentvariabledefinitionid,defaultvalue&$filter=schemaname eq '${FLOW_URL_SCHEMA}'&$top=1`);
  const definition = definitions[0];
  if (!definition) return String(import.meta.env?.VITE_FLOW_SALVAR_ANEXOS_ONEDRIVE_URL || "").trim();
  const values = await retrieveMany(xrm, ENVIRONMENT_VARIABLE_VALUE_TABLE, `?$select=value&$filter=_environmentvariabledefinitionid_value eq ${definition.environmentvariabledefinitionid}&$top=1`);
  return String(values[0]?.value || definition.defaultvalue || import.meta.env?.VITE_FLOW_SALVAR_ANEXOS_ONEDRIVE_URL || "").trim();
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
    plannerTaskId: row.cr40f_plannertaskid || "",
    plannerLink: row.cr40f_linktarefaplanner || "",
    teamsLink: row.cr40f_linkmensagemteams || "",
  };
}

function normalizeQuality(row, type) {
  const isAction = type === "action";
  return { id: row[isAction ? "cr40f_acaooperacionalid" : "cr40f_errooperacionalid"], type, code: row.cr40f_codigo || "", title: row.cr40f_titulo || "", description: row.cr40f_descricao || "", status: row[isAction ? "cr40f_status@OData.Community.Display.V1.FormattedValue" : "cr40f_status@OData.Community.Display.V1.FormattedValue"] || "", dueDate: dateOnly(row[isAction ? "cr40f_prazo" : "cr40f_prazoresolucao"]) };
}

function normalizeTask(row, annotations = [], events = []) {
  const status = STATUS_BY_VALUE[row.cr40f_status] || "todo";
  const priority = PRIORITY_BY_VALUE[row.cr40f_prioridade] || "medium";
  const origin = Object.entries(ORIGIN_VALUES).find(([, value]) => value === row.cr40f_origem)?.[0] || "manual";
  const driveNotes = annotations.filter((item) => item.isdocument !== true && String(item.notetext || "").startsWith("Arquivo salvo no OneDrive:"));
  const comments = annotations.filter((item) => item.isdocument !== true && !String(item.notetext || "").startsWith("Arquivo salvo no OneDrive:")).map((item) => ({ id: item.annotationid, text: item.notetext || "", createdAt: item.createdon, author: item.createdbyName || "Sistema" }));
  const attachments = [...annotations.filter((item) => item.isdocument === true), ...driveNotes].map((item) => ({ id: item.annotationid, name: item.filename || "Anexo", link: String(item.notetext || "").replace(/^Arquivo salvo no OneDrive:\s*/, ""), createdAt: item.createdon }));
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

function normalizeRelation(row) {
  return { id: row.cr40f_plannertarearelacaoid, parentTaskId: row._cr40f_tarefapai_value || "", childTaskId: row._cr40f_subtarefa_value || "" };
}

async function loadLiveState(xrm) {
  const [quotes, rows, events, relations, qualityErrors, qualityActions] = await Promise.all([
    retrieveMany(xrm, QUOTE_TABLE, "?$select=cr40f_pedidodecotacaoid,cr40f_numerodacotacao,cr40f_titulo,cr40f_clienteempresa,cr40f_statuscotacao,cr40f_prazoresponder,cr40f_valorcotado,cr40f_plannertaskid,cr40f_linktarefaplanner,cr40f_linkmensagemteams&$filter=statecode eq 0&$orderby=modifiedon desc"),
    retrieveMany(xrm, TASK_TABLE, "?$select=cr40f_plannertarefaid,cr40f_name,cr40f_titulo,cr40f_descricao,cr40f_status,cr40f_prioridade,cr40f_prazo,_cr40f_responsavel_value,_cr40f_equipe_value,_cr40f_pedidocotacao_value,_cr40f_errooperacional_value,_cr40f_acaooperacional_value,cr40f_origem,cr40f_codigoorigem,cr40f_motivobloqueio&$filter=statecode eq 0&$orderby=modifiedon desc"),
    retrieveMany(xrm, EVENT_TABLE, "?$select=cr40f_plannertarefaeventoid,_cr40f_tarefa_value,cr40f_tipo,cr40f_descricao,cr40f_ocorridoem,_cr40f_autor_value&$orderby=cr40f_ocorridoem desc"),
    retrieveMany(xrm, RELATION_TABLE, "?$select=cr40f_plannertarearelacaoid,_cr40f_tarefapai_value,_cr40f_subtarefa_value&$filter=statecode eq 0"),
    retrieveMany(xrm, QUALITY_ERROR_TABLE, "?$select=cr40f_errooperacionalid,cr40f_codigo,cr40f_titulo,cr40f_descricao,cr40f_status,cr40f_prazoresolucao&$filter=statecode eq 0&$orderby=createdon desc"),
    retrieveMany(xrm, QUALITY_ACTION_TABLE, "?$select=cr40f_acaooperacionalid,cr40f_titulo,cr40f_descricao,cr40f_status,cr40f_prazo&$filter=statecode eq 0&$orderby=createdon desc"),
  ]);
  const annotations = await retrieveMany(xrm, ANNOTATION_TABLE, "?$select=annotationid,_objectid_value,notetext,filename,mimetype,isdocument,createdon,_createdby_value&$filter=isdocument eq false or isdocument eq true&$top=5000");
  const relationByChild = new Map(relations.map(normalizeRelation).map((item) => [item.childTaskId, item.parentTaskId]));
  const tasks = rows.map((row) => ({ ...normalizeTask(row, annotations.filter((item) => item._objectid_value === row.cr40f_plannertarefaid), events.filter((item) => item._cr40f_tarefa_value === row.cr40f_plannertarefaid)), parentTaskId: relationByChild.get(row.cr40f_plannertarefaid) || null }));
  const quoteById = new Map(quotes.map((row) => [row.cr40f_pedidodecotacaoid, normalizeQuote(row)]));
  return { quotes: [...quoteById.values()], quality: [...qualityErrors.map((row) => normalizeQuality(row, "error")), ...qualityActions.map((row) => normalizeQuality(row, "action"))], tasks: tasks.map((task) => ({ ...task, quoteCode: quoteById.get(task.quoteId)?.code || "", quoteTitle: quoteById.get(task.quoteId)?.title || "" })), lastUpdated: new Date().toISOString(), live: true };
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
  await bindLookup(xrm, payload, TASK_TABLE, "cr40f_errooperacional", QUALITY_ERROR_TABLE, input.qualityType === "error" ? input.qualityId : "");
  await bindLookup(xrm, payload, TASK_TABLE, "cr40f_acaooperacional", QUALITY_ACTION_TABLE, input.qualityType === "action" ? input.qualityId : "");
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
  if (!file) return loadLiveState(xrm);
  if (file.size > MAX_ATTACHMENT_SIZE) throw new Error("O anexo deve ter no máximo 5 MB.");
  const taskRows = await retrieveMany(xrm, TASK_TABLE, `?$select=cr40f_titulo,cr40f_codigoorigem&$filter=cr40f_plannertarefaid eq ${cleanId(taskId)}&$top=1`);
  const task = taskRows[0] || {};
  const fileName = sanitizePathSegment(file.name, "arquivo");
  const taskKey = sanitizePathSegment(task.cr40f_codigoorigem || taskId);
  const path = `Tarefas Planner/${String(apiUrl(xrm)).toLowerCase().includes(DEV_DATAVERSE_URL) ? "DEV/" : ""}${taskKey}/Anexos`;
  const flowUrl = await resolveOneDriveFlowUrl(xrm);
  if (!flowUrl) throw new Error(`URL do Flow não configurada: ${FLOW_URL_SCHEMA}.`);
  const base64 = file.base64 || await fileToBase64(file);
  const response = await fetch(flowUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caminhoCompleto: path, nomeArquivo: fileName, conteudoBase64: base64, mimeType: file.type || "application/octet-stream", metadados: { tarefaId: taskId, tarefa: task.cr40f_titulo || "", origem: "PLANNER_INTERNO" } }) });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`Flow OneDrive falhou: HTTP ${response.status}.`);
  const result = extractFlowRecord(responseText) || {};
  const link = getFlowLink(result);
  if (!link) throw new Error("Arquivo salvo no OneDrive, mas o Flow não retornou link.");
  const payload = { subject: fileName, filename: fileName, mimetype: file.type || "application/octet-stream", notetext: `Arquivo salvo no OneDrive: ${link}`, isdocument: false };
  await bindLookup(xrm, payload, ANNOTATION_TABLE, "objectid", TASK_TABLE, taskId);
  await request(xrm, `/${entitySetName(ANNOTATION_TABLE)}`, { method: "POST", body: JSON.stringify(payload) });
  return loadLiveState(xrm);
}

async function createLiveSubtask(xrm, state, parentId, input) {
  const nextState = await createLiveTask(xrm, state, { ...input, sourceType: input.sourceType || "manual", sourceCode: input.sourceCode || "" });
  const child = nextState.tasks.find((item) => item.title === input.title.trim() && !item.parentTaskId);
  if (!child) throw new Error("Dataverse criou a subtarefa, mas não foi possível localizar o ID.");
  const payload = { cr40f_tipo: 100000000, cr40f_name: `${parentId}-${child.id}` };
  await bindLookup(xrm, payload, RELATION_TABLE, "cr40f_tarefapai", TASK_TABLE, parentId);
  await bindLookup(xrm, payload, RELATION_TABLE, "cr40f_subtarefa", TASK_TABLE, child.id);
  await request(xrm, `/${entitySetName(RELATION_TABLE)}`, { method: "POST", body: JSON.stringify(payload) });
  return loadLiveState(xrm);
}

async function fileToBase64(file) {
  if (!file?.arrayBuffer) throw new Error("Arquivo inválido para anexar.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

async function ensureLiveQuoteTask(xrm, state, quote) {
  const existing = state.tasks.find((item) => item.quoteId === quote.id && !item.parentTaskId);
  if (existing || quote.plannerTaskId) return state;
  return createLiveTask(xrm, state, { title: `Acompanhar ${quote.code}`, quoteId: quote.id, quoteCode: quote.code, quoteTitle: quote.title, dueDate: quote.deadline, priority: "medium", sourceType: "quote", assigneeName: "Não atribuído", teamName: "Comercial", description: `Acompanhar a cotação ${quote.code} até a resposta ao cliente.` });
}

export function createDataStore() {
  const xrm = getXrm();
  if (!xrm) return {
    live: false,
    load: async () => loadMockState(),
    reset: async () => resetMockState(),
    createTask: async (state, input) => createMockTask(state, input),
    createSubtask: async (state, parentId, input) => createMockTask(state, { ...input, parentTaskId: parentId }),
    createQualityTask: async (state, item) => createMockTask(state, { title: item.title, description: item.description, dueDate: item.dueDate, sourceType: "quality", sourceId: item.id, sourceCode: item.code }),
    updateTask: async (state, id, patch) => updateMockTask(state, id, patch),
    addComment: async (state, id, text) => addMockComment(state, id, text),
    addAttachment: async (state, id, file) => addMockAttachment(state, id, file.name || file),
    ensureQuoteTask: async (state, quote) => ensureMockQuoteTask(state, quote),
    save: async (state) => saveMockState(state),
    openQuote: async () => false,
  };
  return {
    live: true,
    load: () => loadLiveState(xrm),
    createTask: (state, input) => createLiveTask(xrm, state, input),
    createSubtask: (state, parentId, input) => createLiveSubtask(xrm, state, parentId, input),
    createQualityTask: (state, item) => createLiveTask(xrm, state, { title: item.title, description: item.description, dueDate: item.dueDate, sourceType: "quality", sourceCode: item.code, qualityType: item.type, qualityId: item.id }),
    updateTask: (state, id, patch) => updateLiveTask(xrm, state, id, patch),
    addComment: (state, id, text) => addLiveComment(xrm, id, text),
    addAttachment: (state, id, file) => addLiveAttachment(xrm, id, file),
    ensureQuoteTask: (state, quote) => ensureLiveQuoteTask(xrm, state, quote),
    save: (state) => loadLiveState(xrm),
    reset: () => loadLiveState(xrm),
    openQuote: (id) => xrm.Navigation?.openForm?.({ entityName: QUOTE_TABLE, entityId: cleanId(id) }),
  };
}
