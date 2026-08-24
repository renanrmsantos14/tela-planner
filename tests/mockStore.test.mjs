import test from "node:test";
import assert from "node:assert/strict";
import { addAttachment, addComment, createTask, deleteAttachment, deleteTask, ensureQuoteTask, seedState, updateTask } from "../src/mockStore.js";

function withStorage() {
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}

test("cria e atualiza tarefa sem alterar a referência original", () => {
  withStorage();
  const initial = seedState();
  const next = createTask(initial, { title: "Nova etapa", quoteId: "quote-test", quoteCode: "COT-TEST", quoteTitle: "Transfer", dueDate: "2026-08-05" });
  assert.equal(next.tasks.length, initial.tasks.length + 1);
  const created = next.tasks.at(-1);
  const updated = updateTask(next, created.id, { status: "done" });
  assert.equal(updated.tasks.at(-1).status, "done");
  assert.equal(initial.tasks.length, 44);
});

test("mantém subtarefa vinculada à tarefa-pai no mock", () => {
  withStorage();
  const initial = seedState();
  const parent = initial.tasks.find((item) => !item.parentTaskId && initial.tasks.filter((task) => task.parentTaskId === item.id).length === 0);
  const next = createTask(initial, { title: "Checklist da tarefa", parentTaskId: parent.id });
  const subtask = next.tasks.at(-1);

  assert.equal(subtask.parentTaskId, parent.id);
  const countByParent = next.tasks.filter((item) => item.parentTaskId === parent.id).length;
  assert.equal(countByParent, initial.tasks.filter((item) => item.parentTaskId === parent.id).length + 1);
});

test("adiciona comentário e anexo mock", () => {
  withStorage();
  const initial = seedState();
  const commented = addComment(initial, "task-1", "Cliente confirmou o horário.");
  const attached = addAttachment(commented, "task-1", "confirmacao.png");
  const task = attached.tasks.find((item) => item.id === "task-1");
  assert.equal(task.comments.length, 3);
  assert.equal(task.attachments.length, 3);
  assert.equal(task.attachments.at(-1).name, "confirmacao.png");
});

test("remove somente o anexo selecionado no mock", () => {
  withStorage();
  const initial = seedState();
  const task = initial.tasks.find((item) => item.id === "task-1");
  const attachmentId = task.attachments[0].id;
  const next = deleteAttachment(initial, task.id, attachmentId);
  const updatedTask = next.tasks.find((item) => item.id === task.id);
  assert.equal(updatedTask.attachments.some((attachment) => attachment.id === attachmentId), false);
  assert.equal(updatedTask.attachments.length, task.attachments.length - 1);
});

test("exclui somente a tarefa selecionada no mock", () => {
  withStorage();
  const initial = seedState();
  const next = deleteTask(initial, "task-1");
  assert.equal(next.tasks.some((taskItem) => taskItem.id === "task-1"), false);
  assert.equal(next.tasks.length, initial.tasks.length - 1);
  assert.equal(initial.tasks.length, 44);
});

test("cria tarefa principal para cotação sem duplicar", () => {
  withStorage();
  const initial = seedState();
  const quote = initial.quotes.find((item) => item.id === "quote-1008");
  const same = ensureQuoteTask(initial, quote);
  assert.equal(same.tasks.length, initial.tasks.length);
});

test("bloqueia segunda tarefa principal ativa para a mesma cotação no mock", () => {
  withStorage();
  const initial = seedState();

  assert.throws(
    () => createTask(initial, { title: "Duplicada", quoteId: "quote-1008", quoteCode: "COT-1008" }),
    /acompanhamento principal ativo/,
  );
});

test("preserva origem e bloqueio na tarefa criada", () => {
  withStorage();
  const created = createTask(seedState(), { title: "Tratar ocorrência", sourceType: "quality", sourceId: "quality-1", sourceLabel: "Ação de qualidade", sourceCode: "QAL-1", blockedReason: "Aguardando evidência" });
  const task = created.tasks.at(-1);
  assert.equal(task.sourceType, "quality");
  assert.equal(task.sourceId, "quality-1");
  assert.equal(task.blockedReason, "Aguardando evidência");
});

test("registra bloqueio, desbloqueio e conclusão no histórico mock", () => {
  withStorage();
  const initial = seedState();
  const task = initial.tasks.find((item) => item.status === "todo");
  const blocked = updateTask(initial, task.id, { status: "waiting", blockedReason: "Aguardando retorno" }).tasks.find((item) => item.id === task.id);
  const unblocked = updateTask(blockedState(blocked), task.id, { status: "doing", blockedReason: "" }).tasks.find((item) => item.id === task.id);
  const completed = updateTask(blockedState(unblocked), task.id, { status: "done", blockedReason: "" }).tasks.find((item) => item.id === task.id);
  assert.ok(blocked.history.some((item) => item.text.includes("Bloqueio registrado")));
  assert.ok(unblocked.history.some((item) => item.text === "Bloqueio removido."));
  assert.ok(completed.history.some((item) => item.text === "Tarefa concluída."));
});

test("não salva aguardando sem motivo no mock", () => {
  withStorage();
  const initial = seedState();
  const task = initial.tasks.find((item) => item.status === "todo");
  assert.throws(() => updateTask(initial, task.id, { status: "waiting" }), /motivo do bloqueio/);
});

function blockedState(task) {
  return { tasks: [task], quotes: [], employees: [], quality: [] };
}

test("semeia cenário operacional amplo e variado", () => {
  const state = seedState();
  assert.equal(state.quotes.length, 17);
  assert.equal(state.tasks.length, 44);
  assert.equal(state.employees.length, 7);
  assert.equal(state.quality.length, 8);
  assert.ok(state.tasks.some((item) => item.status === "waiting" && item.blockedReason));
  assert.ok(state.tasks.some((item) => item.sourceType === "quality"));
  assert.ok(state.tasks.some((item) => item.parentTaskId));
  assert.ok(state.tasks.some((item) => item.checklist.length >= 3));
  assert.ok(state.tasks.some((item) => item.assigneeNames.includes("Renan Martins")));
  assert.ok(new Set(state.tasks.map((item) => item.teamName)).size >= 4);
  assert.ok(state.tasks.some((item) => item.comments.length > 0 && item.attachments.length > 0 && item.history.length > 1));
});
