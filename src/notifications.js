const TERMINAL_STATUSES = new Set(["done", "cancelled"]);

const dateKey = (value) => String(value || "").slice(0, 10);

export function previousBusinessDay(value) {
  const key = dateKey(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "";
  const date = new Date(`${key}T12:00:00Z`);
  do { date.setUTCDate(date.getUTCDate() - 1); } while ([0, 6].includes(date.getUTCDay()));
  return date.toISOString().slice(0, 10);
}

export function businessDaysSince(startValue, endValue) {
  const startKey = dateKey(startValue);
  const endKey = dateKey(endValue);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startKey) || !/^\d{4}-\d{2}-\d{2}$/.test(endKey) || startKey >= endKey) return 0;
  const cursor = new Date(`${startKey}T12:00:00Z`);
  const end = new Date(`${endKey}T12:00:00Z`);
  let count = 0;
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (![0, 6].includes(cursor.getUTCDay())) count += 1;
  }
  return count;
}

export function deadlineReminderType(task, todayKey) {
  const dueDate = dateKey(task?.dueDate);
  const today = dateKey(todayKey);
  if (!dueDate || !today || TERMINAL_STATUSES.has(task?.status)) return "";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "due_today";
  if (previousBusinessDay(dueDate) === today) return "due_soon";
  return "";
}

const cleanId = (value) => String(value || "").replace(/[{}]/g, "").toLowerCase();

export function deadlineRole(task, employee) {
  const userId = cleanId(employee?.userId);
  if (userId && userId === cleanId(task?.creatorUserId)) return "creator";
  const employeeId = cleanId(employee?.id);
  if (employeeId && (task?.assigneeIds || []).some((id) => cleanId(id) === employeeId)) return "assignee";
  return "viewer";
}

export function isTaskWaitingForEmployee(task, employee) {
  const employeeId = cleanId(employee?.id);
  const userId = cleanId(employee?.userId);
  if (task?.status !== "waiting" || !employeeId) return false;
  return cleanId(task.creatorEmployeeId) === employeeId ||
    (userId && cleanId(task.creatorUserId) === userId) ||
    (task.assigneeIds || []).some((id) => cleanId(id) === employeeId);
}

export function validateDeadlineChange({ task, employee, nextDueDate, reason }) {
  if (dateKey(nextDueDate) === dateKey(task?.dueDate)) return { allowed: true, role: deadlineRole(task, employee), requiresReason: false };
  const role = deadlineRole(task, employee);
  if (role === "creator") return { allowed: true, role, requiresReason: false };
  if (role === "assignee") {
    const hasReason = Boolean(String(reason || "").trim());
    return { allowed: hasReason, role, requiresReason: true, error: hasReason ? "" : "Informe o motivo da alteração do prazo." };
  }
  const hasReason = Boolean(String(reason || "").trim());
  return { allowed: hasReason, role, requiresReason: true, error: hasReason ? "" : "Informe o motivo da alteração do prazo." };
}

export function notificationRecipients({ creatorEmployeeId, assigneeIds = [], mentionedEmployeeIds = [], previousAssigneeIds = [], nextStatus = "", type, actorEmployeeId }) {
  const actor = cleanId(actorEmployeeId);
  let values = [];
  if (type === "assignment") values = assigneeIds.filter((id) => !previousAssigneeIds.some((oldId) => cleanId(oldId) === cleanId(id)));
  else if (type === "mention") values = mentionedEmployeeIds;
  else if (type === "waiting") values = [creatorEmployeeId, ...assigneeIds, ...mentionedEmployeeIds];
  else if (type === "waiting_return") values = [creatorEmployeeId, ...assigneeIds];
  else if (type === "status") values = ["done", "waiting"].includes(nextStatus) ? [creatorEmployeeId, ...assigneeIds] : [];
  else if (type === "assignees") {
    const current = new Set(assigneeIds.map(cleanId));
    const previous = new Set(previousAssigneeIds.map(cleanId));
    values = [
      ...assigneeIds.filter((id) => !previous.has(cleanId(id))),
      ...previousAssigneeIds.filter((id) => !current.has(cleanId(id))),
    ];
  }
  else values = [creatorEmployeeId, ...assigneeIds, ...previousAssigneeIds];
  return [...new Map(values.filter(Boolean).map((id) => [cleanId(id), id])).entries()]
    .filter(([key]) => key !== actor)
    .map(([, id]) => id);
}

export function notificationDedupeKey({ recipientId, taskId, type, referenceDate = "", eventId = "" }) {
  return [recipientId, taskId, type, referenceDate, eventId].map(cleanId).join("|");
}

export function unreadCount(notifications = []) {
  return notifications.filter((item) => !item.readAt).length;
}

export function dailyReminderRows(tasks = [], employees = [], todayKey) {
  const employeeById = new Map(employees.map((employee) => [cleanId(employee.id), employee]));
  return tasks.flatMap((task) => {
    const type = deadlineReminderType(task, todayKey);
    if (!type || type === "due_soon") return [];
    const uniqueAssigneeIds = [...new Set((task.assigneeIds || []).map(cleanId).filter(Boolean))];
    const recipientIds = type === "overdue" && task.creatorEmployeeId && businessDaysSince(task.dueDate, todayKey) >= 1
      ? [...new Set([...uniqueAssigneeIds, cleanId(task.creatorEmployeeId)].filter(Boolean))]
      : uniqueAssigneeIds;
    return recipientIds.map((employeeId) => {
      const employee = employeeById.get(employeeId);
      return {
        taskId: task.id,
        recipientEmployeeId: employee?.id || employeeId,
        type,
        referenceDate: dateKey(todayKey),
        externalDeliveryAvailable: Boolean(employee?.externalNotificationsAvailable),
        dedupeKey: notificationDedupeKey({ recipientId: employeeId, taskId: task.id, type, referenceDate: todayKey }),
      };
    });
  });
}

export function groupDailyDigest(rows = []) {
  return rows.reduce((groups, row) => {
    const key = cleanId(row.recipientEmployeeId);
    if (!groups[key]) groups[key] = { due_soon: [], due_today: [], overdue: [] };
    if (groups[key][row.type]) groups[key][row.type].push(row);
    return groups;
  }, {});
}
