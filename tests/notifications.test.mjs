import test from "node:test";
import assert from "node:assert/strict";
import { businessDaysSince, dailyReminderRows, deadlineReminderType, deadlineRole, groupDailyDigest, isTaskWaitingForEmployee, notificationDedupeKey, notificationRecipients, previousBusinessDay, unreadCount, validateDeadlineChange } from "../src/notifications.js";

test("D-1 útil de segunda-feira cai na sexta-feira", () => {
  assert.equal(previousBusinessDay("2026-08-24"), "2026-08-21");
  assert.equal(deadlineReminderType({ dueDate: "2026-08-24", status: "todo" }, "2026-08-21"), "due_soon");
});

test("classifica vencimento, atraso e ignora status terminal", () => {
  assert.equal(deadlineReminderType({ dueDate: "2026-08-24", status: "doing" }, "2026-08-24"), "due_today");
  assert.equal(deadlineReminderType({ dueDate: "2026-08-23", status: "waiting" }, "2026-08-24"), "overdue");
  assert.equal(deadlineReminderType({ dueDate: "2026-08-23", status: "done" }, "2026-08-24"), "");
  assert.equal(deadlineReminderType({ dueDate: "2026-08-23", status: "cancelled" }, "2026-08-24"), "");
});

test("criador altera prazo sem motivo e demais usuários justificam a mudança", () => {
  const task = { dueDate: "2026-08-24", creatorUserId: "user-owner", assigneeIds: ["employee-assignee"] };
  assert.equal(deadlineRole(task, { userId: "user-owner", id: "employee-assignee" }), "creator");
  assert.equal(validateDeadlineChange({ task, employee: { userId: "user-owner" }, nextDueDate: "2026-08-25" }).allowed, true);
  assert.equal(validateDeadlineChange({ task, employee: { id: "employee-assignee" }, nextDueDate: "2026-08-25" }).allowed, false);
  assert.equal(validateDeadlineChange({ task, employee: { id: "employee-assignee" }, nextDueDate: "2026-08-25", reason: "Cliente pediu nova data" }).allowed, true);
  assert.equal(validateDeadlineChange({ task, employee: { id: "employee-other" }, nextDueDate: "2026-08-25" }).allowed, false);
  assert.equal(validateDeadlineChange({ task, employee: { id: "employee-other" }, nextDueDate: "2026-08-25", reason: "Ajuste operacional" }).allowed, true);
});

test("destinatários removem ator, duplicados e atribuições antigas", () => {
  assert.deepEqual(notificationRecipients({ type: "assignment", assigneeIds: ["a", "b"], previousAssigneeIds: ["a"], actorEmployeeId: "x" }), ["b"]);
  assert.deepEqual(notificationRecipients({ type: "status", creatorEmployeeId: "c", assigneeIds: ["a", "b"], previousAssigneeIds: ["a"], nextStatus: "done", actorEmployeeId: "a" }), ["c", "b"]);
  assert.deepEqual(notificationRecipients({ type: "status", creatorEmployeeId: "c", assigneeIds: ["a", "b"], previousAssigneeIds: ["a"], nextStatus: "doing", actorEmployeeId: "a" }), []);
  assert.deepEqual(notificationRecipients({ type: "assignees", assigneeIds: ["a", "b"], previousAssigneeIds: ["a", "c"], actorEmployeeId: "a" }), ["b", "c"]);
  assert.deepEqual(notificationRecipients({ type: "mention", mentionedEmployeeIds: ["a", "a", "b"], actorEmployeeId: "b" }), ["a"]);
  assert.deepEqual(notificationRecipients({ type: "waiting", creatorEmployeeId: "c", assigneeIds: ["a"], mentionedEmployeeIds: ["b"], actorEmployeeId: "a" }), ["c", "b"]);
  assert.deepEqual(notificationRecipients({ type: "waiting_return", creatorEmployeeId: "c", assigneeIds: ["a", "b"], actorEmployeeId: "a" }), ["c", "b"]);
});

test("sinaliza Aguardando apenas para criador ou responsável", () => {
  const task = { status: "waiting", creatorEmployeeId: "creator", assigneeIds: ["assignee"] };
  assert.equal(isTaskWaitingForEmployee(task, { id: "assignee" }), true);
  assert.equal(isTaskWaitingForEmployee(task, { id: "creator" }), true);
  assert.equal(isTaskWaitingForEmployee(task, { id: "viewer" }), false);
  assert.equal(isTaskWaitingForEmployee({ ...task, status: "doing" }, { id: "assignee" }), false);
});

test("chave idempotente e badge de não lidas são determinísticos", () => {
  const input = { recipientId: "EMP-1", taskId: "TASK-1", type: "due_today", referenceDate: "2026-08-24" };
  assert.equal(notificationDedupeKey(input), notificationDedupeKey(input));
  assert.equal(unreadCount([{ readAt: "" }, { readAt: "2026-08-24T10:00:00Z" }, {}]), 2);
});

test("resumo diário expande múltiplos responsáveis uma vez e sinaliza identidade ausente", () => {
  const tasks = [{ id: "t1", dueDate: "2026-08-24", status: "doing", assigneeIds: ["a", "a", "b"] }];
  const employees = [{ id: "a", externalNotificationsAvailable: true }, { id: "b", externalNotificationsAvailable: false }];
  const rows = dailyReminderRows(tasks, employees, "2026-08-24");
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.recipientEmployeeId === "b").externalDeliveryAvailable, false);
  const groups = groupDailyDigest(rows);
  assert.deepEqual(Object.keys(groups).sort(), ["a", "b"]);
  assert.equal(groups.a.due_today.length, 1);
});

test("cobrança diária inclui criador no primeiro dia útil e não dispara D-1", () => {
  assert.equal(businessDaysSince("2026-08-21", "2026-08-24"), 1);
  const tasks = [
    { id: "late", dueDate: "2026-08-21", status: "doing", assigneeIds: ["a"], creatorEmployeeId: "c" },
    { id: "tomorrow", dueDate: "2026-08-25", status: "doing", assigneeIds: ["a"], creatorEmployeeId: "c" },
  ];
  const rows = dailyReminderRows(tasks, [], "2026-08-24");
  assert.deepEqual(rows.filter((row) => row.taskId === "late").map((row) => row.recipientEmployeeId).sort(), ["a", "c"]);
  assert.equal(rows.some((row) => row.taskId === "tomorrow"), false);
});
