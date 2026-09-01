import test from "node:test";
import assert from "node:assert/strict";
import { collectionRows, daysOverdue, localDateKey, waitingRows, workloadGroups, workloadTotals } from "../src/management.js";
import { normalizeWaitingContext, validateWaitingContext } from "../src/domain.js";
import { collectTask, createTask, seedState } from "../src/mockStore.js";

test("calcula atraso e centraliza cobrança por pessoa ou equipe", () => {
  const tasks = [
    { id: "people", title: "Pessoa atrasada", status: "doing", dueDate: "2026-08-29", assignmentMode: "people", assigneeIds: ["e1"], assigneeNames: ["Marina"], creatorEmployeeId: "e2" },
    { id: "team", title: "Equipe atrasada", status: "todo", dueDate: "2026-08-30", assignmentMode: "team", teamIds: ["t1"], teamNames: ["Operação"], teamId: "t1", teamName: "Operação", assigneeIds: ["e1", "e2"] },
    { id: "done", title: "Concluída", status: "done", dueDate: "2026-08-20", assignmentMode: "people", assigneeIds: ["e1"] },
  ];
  const rows = collectionRows(tasks, [{ id: "e2", name: "Rafael" }], [{ id: "t1", name: "Operação", memberIds: ["e1", "e2"] }], [], new Date("2026-09-01T12:00:00-03:00"));
  assert.deepEqual(rows.map((row) => row.id), ["people", "team"]);
  assert.equal(rows[0].overdueDays, 3);
  assert.deepEqual(rows[0].assigneeIds, ["e1"]);
  assert.deepEqual(rows[1].assigneeIds, ["e1", "e2"]);
  assert.equal(daysOverdue(tasks[1], new Date("2026-09-01T12:00:00-03:00")), 2);
  assert.equal(localDateKey(new Date("2026-09-01T02:00:00Z")), "2026-08-31");
});

test("carga separa pessoas e equipes e não inclui tarefas terminadas", () => {
  const groups = workloadGroups([
    { id: "p", status: "todo", dueDate: "2026-09-01", assignmentMode: "people", assigneeIds: ["e1", "e2"], assigneeNames: ["Marina", "Rafael"] },
    { id: "t", status: "doing", dueDate: "2026-08-31", assignmentMode: "team", teamIds: ["t1"], teamName: "Operação" },
    { id: "d", status: "done", dueDate: "2026-08-30", assignmentMode: "people", assigneeIds: ["e1"] },
  ], [{ id: "t1", name: "Operação", memberIds: ["e1"] }], new Date("2026-09-01T12:00:00-03:00"));
  assert.equal(groups.find((group) => group.key === "employee:e1").today, 1);
  assert.equal(groups.find((group) => group.key === "team:t1").overdue, 1);
  assert.equal(groups.some((group) => group.tasks.some((task) => task.id === "d")), false);
  assert.deepEqual(workloadTotals([
    { id: "p", status: "todo", dueDate: "2026-09-01" },
    { id: "t", status: "doing", dueDate: "2026-08-31" },
    { id: "d", status: "done", dueDate: "2026-08-30" },
  ], new Date("2026-09-01T12:00:00-03:00")), { unique: 2, today: 1, overdue: 1 });
});

test("ordena tarefas da carga do maior atraso para o menor e depois por prazo", () => {
  const groups = workloadGroups([
    { id: "today", title: "Hoje", status: "todo", dueDate: "2026-09-01", assignmentMode: "people", assigneeIds: ["e1"] },
    { id: "late1", title: "Atrasada 1", status: "todo", dueDate: "2026-08-28", assignmentMode: "people", assigneeIds: ["e1"] },
    { id: "late3", title: "Atrasada 3", status: "todo", dueDate: "2026-08-26", assignmentMode: "people", assigneeIds: ["e1"] },
    { id: "upcoming", title: "Próxima", status: "todo", dueDate: "2026-09-03", assignmentMode: "people", assigneeIds: ["e1"] },
  ], [], new Date("2026-09-01T12:00:00-03:00"));
  assert.deepEqual(groups[0].tasks.map((task) => task.id), ["late3", "late1", "today", "upcoming"]);
});

test("retornos vencidos e sem previsão entram na fila", () => {
  const rows = waitingRows([
    { id: "late", status: "waiting", waitingContext: { onType: "external", onNames: ["Fornecedor"], expectedDate: "2026-08-30" } },
    { id: "no-date", status: "waiting", waitingContext: { onType: "employee", onIds: ["e1"], onNames: ["Marina"] } },
    { id: "future", status: "waiting", waitingContext: { onType: "employee", onIds: ["e1"], onNames: ["Marina"], expectedDate: "2026-09-03" } },
  ], [], new Date("2026-09-01T12:00:00-03:00"));
  assert.deepEqual(rows.map((row) => row.id), ["late", "no-date"]);
});

test("cobrança manual é idempotente por tarefa e dia", () => {
  globalThis.localStorage = { getItem: () => null, setItem: () => {} };
  const initial = seedState();
  const task = initial.tasks.find((item) => item.status !== "done" && item.dueDate);
  const first = collectTask(initial, task.id, { referenceDate: "2026-09-01", actorEmployeeId: "employee-renan" });
  assert.equal(first.collectionEvents.length, 1);
  assert.throws(() => collectTask(first, task.id, { referenceDate: "2026-09-01", actorEmployeeId: "employee-renan" }), /cobrada hoje/);
});

test("Aguardando aceita dependência externa sem exigir id Dataverse", () => {
  const context = normalizeWaitingContext({ subject: "aprovação", onType: "external", onName: "Cliente XPTO" });
  assert.equal(context.onType, "external");
  assert.deepEqual(context.onIds, []);
  assert.equal(validateWaitingContext("waiting", context).allowed, true);
});
