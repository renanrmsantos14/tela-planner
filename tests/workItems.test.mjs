import test from "node:test";
import assert from "node:assert/strict";
import { filterWorkItems, normalizeWorkItems, sortWorkItems, workItemStats } from "../src/workItems.js";

test("normaliza tarefas, ocorrências e ações como itens agregados", () => {
  const items = normalizeWorkItems({ tasks: [{ id: "t1", title: "Cotação", status: "todo", priority: "high", dueDate: "2026-01-01", sourceType: "quote", quoteId: "q1" }], quality: [{ id: "e1", type: "error", title: "Avaria", status: "Em tratamento", dueDate: "2026-01-02" }] });
  assert.deepEqual(items.map((item) => item.source), ["quote_followup", "quality_error"]);
  assert.equal(items[1].statusGroup, "doing");
});

test("ordena vencidos antes de prazo e prioridade", () => {
  const items = [{ id: "a", title: "Depois", dueAt: "2099-01-01", priorityRank: 0, statusGroup: "todo", isOverdue: false }, { id: "b", title: "Vencido", dueAt: "2020-01-01", priorityRank: 3, statusGroup: "todo", isOverdue: true }];
  assert.equal(sortWorkItems(items)[0].id, "b");
});

test("filtra origem e calcula pendências", () => {
  const items = [{ id: "a", source: "task", title: "A", context: "", assigneeName: "Renan", statusGroup: "todo", isOverdue: true }, { id: "b", source: "quality_action", title: "B", context: "", assigneeName: "Outro", statusGroup: "waiting", isOverdue: false }];
  assert.equal(filterWorkItems(items, { source: "task" }).length, 1);
  assert.deepEqual(workItemStats(items), { open: 1, overdue: 1, doing: 0, waiting: 1 });
});
