import test from "node:test";
import assert from "node:assert/strict";
import { filterTasks, isBlocked, isOverdue, sortTasks, taskStats } from "../src/domain.js";

const tasks = [
  { id: "1", title: "Atrasada", quoteTitle: "Cotação A", assigneeName: "Marina", status: "todo", priority: "high", dueDate: "2026-08-01" },
  { id: "2", title: "Hoje", quoteTitle: "Cotação B", assigneeName: "Rafael", status: "doing", priority: "medium", dueDate: "2026-08-03" },
  { id: "3", title: "Concluída", quoteTitle: "Cotação C", assigneeName: "Camila", status: "done", priority: "low", dueDate: "2026-08-01" },
];

test("identifica atraso sem marcar tarefa concluída", () => {
  const today = new Date("2026-08-03T12:00:00");
  assert.equal(isOverdue(tasks[0], today), true);
  assert.equal(isOverdue(tasks[2], today), false);
});

test("filtra por texto, status e prioridade", () => {
  assert.equal(filterTasks(tasks, { query: "Rafael", status: "", priority: "" }).length, 1);
  assert.equal(filterTasks(tasks, { query: "", status: ["doing", "waiting"], priority: ["medium", "high"] }).length, 1);
});

test("filtra texto ignorando acentos e caixa", () => {
  const accented = [{ ...tasks[0], title: "Revisão de cotação" }];
  assert.equal(filterTasks(accented, { query: "REVISAO COTACAO", status: "", priority: "" }).length, 1);
});

test("calcula indicadores operacionais", () => {
  const stats = taskStats(tasks, new Date("2026-08-03T12:00:00"));
  assert.deepEqual(stats, { open: 2, overdue: 1, today: 1, waiting: 0 });
});

test("ordena tarefas abertas antes das concluídas", () => {
  assert.deepEqual(sortTasks(tasks).map((item) => item.id), ["1", "2", "3"]);
});

test("filtra origem e bloqueio operacional", () => {
  const qualityTask = { ...tasks[1], sourceType: "quality", sourceLabel: "Erro operacional", blockedReason: "Aguardando terceiro" };
  assert.equal(isBlocked(qualityTask), true);
  assert.equal(filterTasks([tasks[0], qualityTask], { query: "", status: [], priority: [], source: ["quality"], blocked: true }).length, 1);
});
