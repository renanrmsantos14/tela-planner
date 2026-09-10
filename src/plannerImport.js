export const IMPORT_STATUS = Object.freeze({
  todo: 100000000,
  doing: 100000001,
  done: 100000003,
});

export const IMPORT_PRIORITY = Object.freeze({
  low: 100000000,
  medium: 100000001,
  high: 100000002,
  urgent: 100000003,
});

const STATUS_LABELS = Object.freeze({ todo: "A fazer", doing: "Em andamento", done: "Concluído" });
const PRIORITY_LABELS = Object.freeze({ low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente" });

function asArray(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function collectionFrom(value, keys = []) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of keys) if (Array.isArray(value[key])) return value[key];
  if (Array.isArray(value.value)) return value.value;
  return [];
}

function parseJson(text, label) {
  if (!String(text || "").trim()) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return { __parseError: `${label}: JSON inválido (${error.message}).` };
  }
}

function flattenPages(input, keys) {
  return collectionFrom(input, keys).flatMap((item) => item?.value && Array.isArray(item.value) ? item.value : [item]);
}

function firstNonEmpty(...values) {
  return values.find((value) => String(value ?? "").trim()) || "";
}

function normalizeStatus(percentComplete) {
  const percent = Number(percentComplete || 0);
  if (percent >= 100) return "done";
  if (percent > 0) return "doing";
  return "todo";
}

function normalizePriority(priority) {
  switch (Number(priority)) {
    case 1: return "urgent";
    case 3: return "high";
    case 9: return "low";
    default: return "medium";
  }
}

function normalizeMapping(input) {
  const map = new Map();
  if (Array.isArray(input)) {
    input.forEach((item) => {
      const graphUserId = firstNonEmpty(item?.graphUserId, item?.userId, item?.microsoftId);
      const employeeId = firstNonEmpty(item?.employeeId, item?.dataverseEmployeeId);
      if (graphUserId && employeeId) map.set(graphUserId.toLowerCase(), employeeId);
    });
    return map;
  }
  if (!input || typeof input !== "object") return map;
  Object.entries(input).forEach(([graphUserId, employeeId]) => {
    if (graphUserId.trim() && String(employeeId || "").trim()) map.set(graphUserId.toLowerCase(), String(employeeId).trim());
  });
  return map;
}

function normalizeChecklist(details) {
  const checklist = details?.checklist;
  if (!checklist || typeof checklist !== "object") return [];
  return Object.entries(checklist)
    .map(([id, item]) => ({ id, title: String(item?.title || "").trim(), done: Boolean(item?.isChecked) }))
    .filter((item) => item.title);
}

function normalizeDetails(input) {
  const entries = [];
  const candidates = Array.isArray(input)
    ? input
    : Array.isArray(input?.responses)
      ? [input]
      : collectionFrom(input, ["details"]);
  candidates.forEach((item) => {
    if (Array.isArray(item?.responses)) {
      item.responses.forEach((response) => {
        const taskId = firstNonEmpty(response?.id, response?.taskId);
        const details = response?.body;
        if (taskId && details && typeof details === "object" && Number(response?.status || 200) < 300) entries.push([taskId, details]);
      });
      return;
    }
    const taskId = firstNonEmpty(item?.taskId, item?.id, item?.plannerTaskId);
    const details = item?.details || item;
    if (taskId && details && typeof details === "object") entries.push([taskId, details]);
  });
  return new Map(entries);
}

function hasNextPage(input) {
  if (!input) return false;
  if (Array.isArray(input)) return input.some((page) => Boolean(page?.["@odata.nextLink"]));
  return Boolean(input?.["@odata.nextLink"]);
}

export function analyzePlannerImport({ planId = "", tasksText = "", bucketsText = "", detailsText = "", employeeMapText = "" } = {}) {
  const errors = [];
  const warnings = [];
  const parsedTasks = parseJson(tasksText, "Tarefas");
  const parsedBuckets = parseJson(bucketsText, "Buckets");
  const parsedDetails = parseJson(detailsText, "Detalhes");
  const parsedEmployeeMap = parseJson(employeeMapText, "Mapeamento de responsáveis");
  [parsedTasks, parsedBuckets, parsedDetails, parsedEmployeeMap].forEach((value) => {
    if (value?.__parseError) errors.push(value.__parseError);
  });

  const tasks = flattenPages(parsedTasks, ["tasks"]);
  const buckets = flattenPages(parsedBuckets, ["buckets"]);
  const detailsByTaskId = normalizeDetails(parsedDetails);
  const employeeMap = normalizeMapping(parsedEmployeeMap);
  const bucketIds = new Set(buckets.map((bucket) => String(bucket?.id || "")).filter(Boolean));
  const uniqueTasks = [...new Map(tasks.filter((task) => task?.id).map((task) => [String(task.id), task])).values()];
  const rows = [];
  const unresolvedAssignees = new Map();
  let detailsRequired = 0;
  let detailsLoaded = 0;
  let checklistTaskCount = 0;

  uniqueTasks.forEach((task) => {
    const taskId = String(task.id);
    const details = detailsByTaskId.get(taskId);
    const needsDetails = Boolean(task.hasDescription || Number(task.checklistItemCount || 0) > 0);
    if (needsDetails) detailsRequired += 1;
    if (details) detailsLoaded += 1;
    const checklist = normalizeChecklist(details);
    if (checklist.length) checklistTaskCount += 1;
    const assignments = Object.keys(task.assignments || {}).map((graphUserId) => {
      const employeeId = employeeMap.get(graphUserId.toLowerCase()) || "";
      if (!employeeId) unresolvedAssignees.set(graphUserId, (unresolvedAssignees.get(graphUserId) || 0) + 1);
      return { graphUserId, employeeId };
    });
    rows.push({
      plannerTaskId: taskId,
      planId: String(task.planId || planId),
      bucketId: String(task.bucketId || ""),
      title: String(task.title || "Sem título").trim(),
      description: String(details?.description || ""),
      checklist,
      status: normalizeStatus(task.percentComplete),
      statusChoice: IMPORT_STATUS[normalizeStatus(task.percentComplete)],
      priority: normalizePriority(task.priority),
      priorityChoice: IMPORT_PRIORITY[normalizePriority(task.priority)],
      dueDate: task.dueDateTime || null,
      assignments,
      sourceType: "manual",
      sourceCode: `MSPLANNER:${taskId}`,
    });
  });

  if (!String(planId || "").trim()) errors.push("Informe o ID do plano antes de continuar.");
  if (!uniqueTasks.length) errors.push("Cole um JSON de tarefas contendo o campo value.");
  if (hasNextPage(parsedTasks)) errors.push("A resposta contém @odata.nextLink. Cole também as páginas seguintes antes de importar.");
  if (detailsRequired > detailsLoaded) warnings.push(`Faltam detalhes de ${detailsRequired - detailsLoaded} tarefa(s). A importação continuará com descrição e checklist vazios; tente buscar os detalhes novamente antes de importar.`);
  if (unresolvedAssignees.size) errors.push(`${unresolvedAssignees.size} usuário(s) atribuído(s) não têm correspondência no mapeamento.`);
  if (buckets.length && rows.some((row) => row.bucketId && !bucketIds.has(row.bucketId))) warnings.push("Há tarefas apontando para buckets que não estão no JSON colado.");
  if (!buckets.length) warnings.push("Buckets não informados. O status será definido exclusivamente pelo percentComplete.");
  if (!detailsRequired) warnings.push("Nenhuma tarefa sinalizou descrição ou checklist para busca adicional.");

  const statusCounts = rows.reduce((acc, row) => ({ ...acc, [row.status]: (acc[row.status] || 0) + 1 }), {});
  const priorityCounts = rows.reduce((acc, row) => ({ ...acc, [row.priority]: (acc[row.priority] || 0) + 1 }), {});
  return {
    rows,
    errors,
    warnings,
    canImport: errors.length === 0,
    stats: {
      tasks: rows.length,
      buckets: buckets.length,
      detailsRequired,
      detailsLoaded,
      checklistTaskCount,
      assignedTasks: rows.filter((row) => row.assignments.length).length,
      unresolvedAssignees: unresolvedAssignees.size,
      statusCounts,
      priorityCounts,
    },
    unresolvedAssignees: [...unresolvedAssignees.entries()].map(([graphUserId, taskCount]) => ({ graphUserId, taskCount })),
  };
}

export function importStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

export function importPriorityLabel(priority) {
  return PRIORITY_LABELS[priority] || priority;
}

export function graphQueryUrls(planId) {
  const encoded = encodeURIComponent(String(planId || "").trim());
  return {
    tasks: `https://graph.microsoft.com/v1.0/planner/plans/${encoded}/tasks`,
    buckets: `https://graph.microsoft.com/v1.0/planner/plans/${encoded}/buckets`,
    batch: "https://graph.microsoft.com/v1.0/$batch",
    graphExplorer: "https://developer.microsoft.com/en-us/graph/graph-explorer",
  };
}

export function plannerDetailBatches(tasksText = "") {
  const parsed = parseJson(tasksText, "Tarefas");
  if (parsed?.__parseError) return { batches: [], error: parsed.__parseError };
  const tasks = flattenPages(parsed, ["tasks"]);
  const uniqueTasks = [...new Map(tasks.filter((task) => task?.id).map((task) => [String(task.id), task])).values()];
  const detailTasks = uniqueTasks.filter((task) => Boolean(task.hasDescription || Number(task.checklistItemCount || 0) > 0));
  const batches = [];
  for (let index = 0; index < detailTasks.length; index += 20) {
    const chunk = detailTasks.slice(index, index + 20);
    batches.push({
      id: batches.length + 1,
      taskCount: chunk.length,
      taskIds: chunk.map((task) => String(task.id)),
      payload: {
        requests: chunk.map((task) => ({
          id: String(task.id),
          method: "GET",
          url: `/planner/tasks/${encodeURIComponent(String(task.id))}/details`,
        })),
      },
    });
  }
  return { batches, detailTaskCount: detailTasks.length, error: "" };
}
