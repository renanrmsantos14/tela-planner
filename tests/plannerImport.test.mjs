import test from "node:test";
import assert from "node:assert/strict";
import { analyzePlannerImport, graphQueryUrls, plannerDetailBatches } from "../src/plannerImport.js";

test("analisa tarefas do Graph, converte choices e exige detalhes e responsáveis", () => {
  const result = analyzePlannerImport({
    planId: "plan-1",
    tasksText: JSON.stringify({ value: [{ id: "task-1", title: "Tarefa", percentComplete: 50, priority: 1, hasDescription: true, checklistItemCount: 1, assignments: { "graph-1": {} } }] }),
    detailsText: JSON.stringify([{ taskId: "task-1", details: { description: "Descrição", checklist: { "check-1": { title: "Conferir", isChecked: true } } } }]),
    employeeMapText: JSON.stringify({ "graph-1": "employee-1" }),
  });
  assert.equal(result.canImport, true);
  assert.equal(result.rows[0].status, "doing");
  assert.equal(result.rows[0].priority, "urgent");
  assert.deepEqual(result.rows[0].checklist, [{ id: "check-1", title: "Conferir", done: true }]);
  assert.equal(result.rows[0].sourceType, "manual");
});

test("bloqueia paginação pendente e responsável sem mapeamento", () => {
  const result = analyzePlannerImport({
    planId: "plan-1",
    tasksText: JSON.stringify({ value: [{ id: "task-1", title: "Tarefa", assignments: { "graph-1": {} } }], "@odata.nextLink": "next" }),
  });
  assert.equal(result.canImport, false);
  assert.match(result.errors.join(" "), /nextLink/);
  assert.match(result.errors.join(" "), /usuário/);
});

test("gera links diretos para as consultas do plano", () => {
  const urls = graphQueryUrls("plan 1");
  assert.match(urls.tasks, /plan%201/);
  assert.match(urls.buckets, /\/buckets$/);
  assert.match(urls.batch, /\/\$batch$/);
});

test("monta lotes de detalhes com no máximo 20 consultas", () => {
  const tasks = Array.from({ length: 21 }, (_, index) => ({ id: `task-${index}`, hasDescription: true }));
  const result = plannerDetailBatches(JSON.stringify({ value: tasks }));
  assert.equal(result.detailTaskCount, 21);
  assert.equal(result.batches.length, 2);
  assert.equal(result.batches[0].payload.requests.length, 20);
  assert.equal(result.batches[1].payload.requests.length, 1);
  assert.equal(result.batches[0].payload.requests[0].id, "task-0");
});

test("lê respostas de detalhes no formato retornado pelo Graph batch", () => {
  const result = analyzePlannerImport({
    planId: "plan-1",
    tasksText: JSON.stringify({ value: [{ id: "task-1", title: "Tarefa", hasDescription: true }] }),
    detailsText: JSON.stringify([{ responses: [{ id: "task-1", status: 200, body: { description: "Descrição" } }] }]),
  });
  assert.equal(result.canImport, true);
  assert.equal(result.rows[0].description, "Descrição");
});

test("lê também um único JSON de resposta batch colado pelo usuário", () => {
  const result = analyzePlannerImport({
    planId: "plan-1",
    tasksText: JSON.stringify({ value: [{ id: "task-1", title: "Tarefa", hasDescription: true }] }),
    detailsText: JSON.stringify({ responses: [{ id: "task-1", status: 200, body: { description: "Descrição" } }] }),
  });
  assert.equal(result.canImport, true);
  assert.equal(result.rows[0].description, "Descrição");
});

test("avisa detalhes ausentes sem bloquear a importação", () => {
  const result = analyzePlannerImport({
    planId: "plan-1",
    tasksText: JSON.stringify({ value: [{ id: "task-1", title: "Tarefa", hasDescription: true, checklistItemCount: 1 }] }),
  });
  assert.equal(result.canImport, true);
  assert.equal(result.rows[0].description, "");
  assert.deepEqual(result.rows[0].checklist, []);
  assert.match(result.warnings.join(" "), /Faltam detalhes de 1 tarefa/);
});

test("converte categorias aplicadas em tags e ignora categorias sem descrição", () => {
  const result = analyzePlannerImport({
    planId: "plan-1",
    categoryDescriptions: { category1: "  VIP  ", category2: "", category3: "vip" },
    tasksText: JSON.stringify({ value: [{ id: "task-1", title: "Tarefa", appliedCategories: { category1: true, category2: true, category3: true } }] }),
  });
  assert.deepEqual(result.rows[0].tags, ["VIP"]);
  assert.equal(result.stats.taggedTaskCount, 1);
});

test("aceita booleanos serializados em tags e checklist", () => {
  const result = analyzePlannerImport({
    planId: "plan-1",
    categoryDescriptions: { category1: "VIP" },
    tasksText: JSON.stringify({ value: [{ id: "task-1", title: "Tarefa", appliedCategories: { category1: "true" }, hasDescription: true }] }),
    detailsText: JSON.stringify([{ taskId: "task-1", details: { checklist: { "check-1": { title: "Conferir", isChecked: "false" } } } }]),
  });
  assert.deepEqual(result.rows[0].tags, ["VIP"]);
  assert.deepEqual(result.rows[0].checklist, [{ id: "check-1", title: "Conferir", done: false }]);
});

test("aceita descrições de categorias coladas no formato do Planner", () => {
  const result = analyzePlannerImport({
    planId: "plan-1",
    categoryDescriptionsText: JSON.stringify({ categoryDescriptions: { category1: "VIP" } }),
    tasksText: JSON.stringify({ value: [{ id: "task-1", title: "Tarefa", appliedCategories: { category1: true } }] }),
  });
  assert.deepEqual(result.rows[0].tags, ["VIP"]);
});
