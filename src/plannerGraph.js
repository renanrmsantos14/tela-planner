const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const BATCH_SIZE = 20;
const MAX_RETRIES = 3;

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function uniqueTasks(tasks) {
  return [...new Map(tasks.filter((task) => task?.id).map((task) => [String(task.id), task])).values()];
}

async function readError(response) {
  let detail = "";
  try {
    const body = await response.json();
    detail = body?.error?.message || body?.error?.code || "";
  } catch {
    detail = "";
  }
  return `${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`;
}

async function graphRequest(url, token, options = {}, attempt = 0) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(options.headers || {}) },
  });
  if ([429, 502, 503, 504].includes(response.status) && attempt < MAX_RETRIES) {
    const retryAfter = Number(response.headers.get("Retry-After") || 0);
    await wait(Math.max(1000, retryAfter * 1000, 2 ** attempt * 1000));
    return graphRequest(url, token, options, attempt + 1);
  }
  if (!response.ok) throw new Error(`Microsoft Graph: ${await readError(response)}`);
  return response.json();
}

async function getAllPages(url, token, onPage) {
  const pages = [];
  let nextUrl = url;
  let page = 0;
  while (nextUrl) {
    const payload = await graphRequest(nextUrl, token);
    pages.push(payload);
    page += 1;
    onPage?.(page, payload);
    nextUrl = payload?.["@odata.nextLink"] || "";
    if (page > 1000) throw new Error("Microsoft Graph retornou paginação demais; operação interrompida.");
  }
  return pages;
}

async function getBatch(requests, token) {
  return graphRequest(`${GRAPH_BASE_URL}/$batch`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
}

async function getTaskDetails(tasks, token, onProgress) {
  const taskList = uniqueTasks(tasks);
  const batches = chunks(taskList, BATCH_SIZE);
  const responses = [];
  let completed = 0;
  for (const batch of batches) {
    const payload = await getBatch(batch.map((task) => ({
      id: String(task.id),
      method: "GET",
      url: `/planner/tasks/${encodeURIComponent(String(task.id))}/details`,
    })), token);
    responses.push(payload);
    completed += batch.length;
    onProgress?.(completed, taskList.length, batches.length);
  }
  return responses;
}

async function getPlannerUsers(tasks, token, onProgress) {
  const userIds = [...new Set(uniqueTasks(tasks).flatMap((task) => Object.keys(task.assignments || {})))];
  if (!userIds.length) return { users: [], map: {}, warning: "" };
  const batches = chunks(userIds, BATCH_SIZE);
  const users = [];
  try {
    for (const batch of batches) {
      const payload = await getBatch(batch.map((id) => ({
        id,
        method: "GET",
        url: `/users/${encodeURIComponent(id)}?$select=id,displayName,mail,userPrincipalName`,
      })), token);
      if ((payload?.responses || []).some((item) => Number(item.status) >= 400)) {
        throw new Error("A permissão para consultar o diretório Microsoft não foi concedida.");
      }
      users.push(...(payload?.responses || []).filter((item) => Number(item.status) >= 200 && Number(item.status) < 300).map((item) => item.body));
      onProgress?.(users.length, userIds.length);
    }
    return { users, map: {}, warning: "" };
  } catch (error) {
    return { users: [], map: {}, warning: "Não foi possível consultar os e-mails dos responsáveis. Conceda User.ReadBasic.All ou faça o mapeamento manual." };
  }
}

async function getPlannerCategoryDescriptions(planId, token) {
  const encodedPlanId = encodeURIComponent(String(planId || "").trim());
  const details = await graphRequest(`${GRAPH_BASE_URL}/planner/plans/${encodedPlanId}/details`, token);
  const descriptions = details?.categoryDescriptions;
  return descriptions && typeof descriptions === "object" ? descriptions : {};
}

export async function fetchPlannerPlans({ token, onProgress } = {}) {
  if (!token) throw new Error("Token Microsoft ausente. Conecte a conta novamente.");

  onProgress?.({ stage: "plans", completed: 0, total: 0, label: "Buscando seus planos…" });
  const pages = await getAllPages(`${GRAPH_BASE_URL}/me/planner/plans`, token);
  const plans = pages
    .flatMap((page) => page?.value || [])
    .filter((plan) => plan?.id)
    .map((plan) => ({ id: String(plan.id), displayName: String(plan.title || plan.displayName || "Plano sem nome").trim() || "Plano sem nome" }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName, "pt-BR"));
  onProgress?.({ stage: "plans", completed: plans.length, total: plans.length, label: `${plans.length} plano(s) encontrado(s).` });
  return plans;
}

export async function fetchPlannerExport({ planId, token, employees = [], onProgress } = {}) {
  const cleanPlanId = String(planId || "").trim();
  if (!cleanPlanId) throw new Error("Informe o ID do plano antes de conectar ao Microsoft Planner.");
  if (!token) throw new Error("Token Microsoft ausente. Conecte a conta novamente.");

  const encodedPlanId = encodeURIComponent(cleanPlanId);
  onProgress?.({ stage: "tasks", completed: 0, total: 0, label: "Buscando tarefas e buckets…" });
  const [taskPages, bucketPages, categoryResult] = await Promise.all([
    getAllPages(`${GRAPH_BASE_URL}/planner/plans/${encodedPlanId}/tasks`, token, (page) => onProgress?.({ stage: "tasks", completed: page, total: 0, label: `Buscando página ${page} de tarefas…` })),
    getAllPages(`${GRAPH_BASE_URL}/planner/plans/${encodedPlanId}/buckets`, token),
    getPlannerCategoryDescriptions(cleanPlanId, token).then((categoryDescriptions) => ({ categoryDescriptions, warning: "" })).catch(() => ({ categoryDescriptions: {}, warning: "Não foi possível consultar os nomes das categorias do plano. As tarefas serão importadas sem essas tags." })),
  ]);
  const tasks = taskPages.flatMap((page) => page?.value || []);
  const buckets = bucketPages.flatMap((page) => page?.value || []);
  onProgress?.({ stage: "tasks", completed: tasks.length, total: tasks.length, label: `${tasks.length} tarefa(s) encontrada(s).` });
  onProgress?.({ stage: "details", completed: 0, total: tasks.length, label: `Buscando detalhes de ${tasks.length} tarefa(s)…` });
  const details = await getTaskDetails(tasks, token, (completed, total, batchCount) => onProgress?.({ stage: "details", completed, total, batchCount, label: `Detalhes: ${completed} de ${total}` }));
  onProgress?.({ stage: "users", completed: 0, total: 0, label: "Relacionando responsáveis…" });
  const userData = await getPlannerUsers(tasks, token, (completed, total) => onProgress?.({ stage: "users", completed, total, label: `Responsáveis: ${completed} de ${total}` }));
  const normalizedEmployees = (employees || []).map((employee) => ({ ...employee, email: String(employee.emailMicrosoft || "").trim().toLowerCase() }));
  const employeeMap = {};
  userData.users.forEach((user) => {
    const email = String(user.mail || user.userPrincipalName || "").trim().toLowerCase();
    const employee = normalizedEmployees.find((item) => item.email && item.email === email);
    if (employee) employeeMap[user.id] = employee.id;
  });
  onProgress?.({ stage: "ready", completed: tasks.length, total: tasks.length, label: "Dados prontos para revisão." });
  return {
    tasksText: JSON.stringify({ value: tasks }),
    bucketsText: JSON.stringify({ value: buckets }),
    detailsText: JSON.stringify(details),
    employeeMapText: JSON.stringify(employeeMap),
    categoryDescriptions: categoryResult.categoryDescriptions,
    plannerUsers: userData.users.map((user) => ({
      id: String(user.id || ""),
      displayName: String(user.displayName || "Usuário Microsoft").trim() || "Usuário Microsoft",
      email: String(user.mail || user.userPrincipalName || "").trim().toLowerCase(),
    })).filter((user) => user.id),
    userWarning: [userData.warning, categoryResult.warning].filter(Boolean).join(" "),
  };
}
