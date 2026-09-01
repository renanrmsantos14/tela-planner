import { getDueBucket, normalizeAssigneeNames, normalizeTeam } from "./domain.js";

const TERMINAL = new Set(["done", "cancelled"]);
const LOCAL_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function localDateKey(value = new Date()) {
  return LOCAL_DATE_FORMATTER.format(value);
}

function dateDifference(from, to) {
  const start = new Date(`${String(from).slice(0, 10)}T12:00:00Z`);
  const end = new Date(`${String(to).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.floor((end - start) / 86400000));
}

export function daysOverdue(task, today = new Date()) {
  if (!task?.dueDate || TERMINAL.has(task.status)) return 0;
  const todayKey = localDateKey(today);
  return String(task.dueDate).slice(0, 10) < todayKey
    ? dateDifference(task.dueDate, todayKey)
    : 0;
}

function teamById(teams = []) {
  return new Map(teams.map((team) => [String(team.id), normalizeTeam(team)]));
}

function collectionRecipients(task, teams = []) {
  if (task?.assignmentMode === "team") {
    const byId = teamById(teams);
    return [...new Set((task.teamIds || (task.teamId ? [task.teamId] : []))
      .flatMap((id) => byId.get(String(id))?.memberIds || []))];
  }
  return [...new Set((task?.assigneeIds || []).filter(Boolean).map(String))];
}

export function collectionRows(tasks = [], employees = [], teams = [], collectionEvents = [], today = new Date()) {
  const employeeById = new Map(employees.map((employee) => [String(employee.id), employee]));
  const creatorName = (task) => employeeById.get(String(task.creatorEmployeeId || ""))?.name || "Não identificado";
  return tasks
    .filter((task) => !TERMINAL.has(task.status) && daysOverdue(task, today) > 0)
    .map((task) => {
      const recipients = collectionRecipients(task, teams);
      const last = [...collectionEvents]
        .filter((event) => event.taskId === task.id)
        .sort((left, right) => String(right.occurredAt || "").localeCompare(String(left.occurredAt || "")))[0];
      const assigneeNames = task.assignmentMode === "team"
        ? (task.teamNames || (task.teamName ? [task.teamName] : []))
        : (task.assigneeNames || normalizeAssigneeNames(task.assigneeName));
      return {
        ...task,
        overdueDays: daysOverdue(task, today),
        assignmentLabel: task.assignmentMode === "team" ? "Equipe" : "Pessoas",
        assigneeNames,
        assigneeIds: recipients.length ? recipients : task.assigneeIds || [],
        creatorName: creatorName(task),
        lastCollectionAt: last?.occurredAt || "",
        collectionDate: last?.referenceDate || "",
      };
    })
    .sort((left, right) => right.overdueDays - left.overdueDays || String(left.dueDate || "").localeCompare(String(right.dueDate || "")));
}

export function workloadGroups(tasks = [], teams = [], today = new Date()) {
  const byTeam = teamById(teams);
  const groups = new Map();
  const add = (key, label, type, task) => {
    const current = groups.get(key) || { key, label, type, total: 0, overdue: 0, today: 0, open: 0, tasks: [] };
    current.total += 1;
    current.open += 1;
    const bucket = getDueBucket(task, today);
    if (bucket === "overdue") current.overdue += 1;
    if (bucket === "today") current.today += 1;
    current.tasks.push(task);
    groups.set(key, current);
  };
  tasks.filter((task) => !TERMINAL.has(task.status)).forEach((task) => {
    if (task.assignmentMode === "team") {
      const ids = task.teamIds || (task.teamId ? [task.teamId] : []);
      if (ids.length) ids.forEach((id) => add(`team:${id}`, byTeam.get(String(id))?.name || task.teamName || "Equipe sem cadastro", "team", task));
      else add("team:unassigned", "Equipe não definida", "team", task);
      return;
    }
    const ids = task.assigneeIds || [];
    const names = task.assigneeNames || normalizeAssigneeNames(task.assigneeName);
    if (!ids.length && (!names.length || names.includes("Não atribuído"))) {
      add("employee:unassigned", "Sem responsável", "employee", task);
      return;
    }
    ids.forEach((id, index) => add(`employee:${id}`, names[index] || "Responsável sem cadastro", "employee", task));
  });
  const bucketRank = { overdue: 0, today: 1, tomorrow: 2, upcoming: 3, none: 4 };
  const compareTasks = (left, right) => {
    const overdueDelta = daysOverdue(right, today) - daysOverdue(left, today);
    if (overdueDelta) return overdueDelta;
    const bucketDelta = (bucketRank[getDueBucket(left, today)] ?? 4) - (bucketRank[getDueBucket(right, today)] ?? 4);
    if (bucketDelta) return bucketDelta;
    const leftDate = String(left.dueDate || "9999-12-31").slice(0, 10);
    const rightDate = String(right.dueDate || "9999-12-31").slice(0, 10);
    return leftDate.localeCompare(rightDate) || String(left.title || "").localeCompare(String(right.title || ""), "pt-BR");
  };
  return [...groups.values()]
    .map((group) => ({ ...group, tasks: [...group.tasks].sort(compareTasks) }))
    .sort((left, right) => right.overdue - left.overdue || right.total - left.total || left.label.localeCompare(right.label, "pt-BR"));
}

export function workloadTotals(tasks = [], today = new Date()) {
  const openTasks = tasks.filter((task) => !TERMINAL.has(task.status));
  return {
    unique: openTasks.length,
    today: openTasks.filter((task) => getDueBucket(task, today) === "today").length,
    overdue: openTasks.filter((task) => getDueBucket(task, today) === "overdue").length,
  };
}

export function waitingRows(tasks = [], teams = [], today = new Date()) {
  return tasks.filter((task) => {
    if (task.status !== "waiting") return false;
    const expectedDate = task.waitingContext?.expectedDate;
    return !expectedDate || getDueBucket({ status: "waiting", dueDate: expectedDate }, today) === "overdue";
  }).map((task) => ({
    ...task,
    waitingExpectedDate: task.waitingContext?.expectedDate || "",
    waitingOverdueDays: task.waitingContext?.expectedDate ? daysOverdue({ ...task, dueDate: task.waitingContext.expectedDate }, today) : 0,
    waitingTarget: task.waitingContext?.onNames?.join(", ") || task.waitingContext?.onName || "Sem parte informada",
    waitingTargetType: task.waitingContext?.onType || "employee",
    teamNames: task.teamNames || (task.teamName ? [task.teamName] : []),
    teams,
  })).sort((left, right) => right.waitingOverdueDays - left.waitingOverdueDays || String(left.waitingExpectedDate).localeCompare(String(right.waitingExpectedDate)));
}

export function manualCollectionKey(taskId, referenceDate) {
  return `manual-overdue|${taskId}|${referenceDate}`;
}
