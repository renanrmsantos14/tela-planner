import test from "node:test";
import assert from "node:assert/strict";
import { addAttachment, addComment, createTask, createTeam, deleteAttachment, deleteTask, ensureQuoteTask, seedState, updateTask, updateTeam } from "../src/mockStore.js";

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

test("preserva origem na tarefa criada", () => {
  withStorage();
  const created = createTask(seedState(), { title: "Tratar ocorrência", sourceType: "quality", sourceId: "quality-1", sourceLabel: "Ação de qualidade", sourceCode: "QAL-1" });
  const task = created.tasks.at(-1);
  assert.equal(task.sourceType, "quality");
  assert.equal(task.sourceId, "quality-1");
});

test("salva equipe e snapshot de responsáveis sem reescrever tarefas antigas", () => {
  withStorage();
  const initial = seedState();
  const teamState = createTeam(initial, { name: "Equipe teste", memberIds: ["employee-marina", "employee-rafael"] });
  const team = teamState.teams.at(-1);
  const created = createTask(teamState, { title: "Revisar escala", assignmentMode: "team", teamId: team.id });
  const task = created.tasks.at(-1);

  assert.equal(task.assignmentMode, "team");
  assert.equal(task.teamId, team.id);
  assert.deepEqual(task.assigneeIds, team.memberIds);

  const editedTeam = updateTeam(created, team.id, { name: team.name, memberIds: ["employee-marina"] });
  const savedTask = editedTeam.tasks.find((item) => item.id === task.id);
  assert.deepEqual(editedTeam.teams.at(-1).memberIds, ["employee-marina"]);
  assert.deepEqual(savedTask.assigneeIds, ["employee-marina", "employee-rafael"]);
});

test("registra aguardando e conclusão no histórico mock", () => {
  withStorage();
  const initial = seedState();
  const task = initial.tasks.find((item) => item.status === "todo");
  const waitingContext = { subject: "retorno do parceiro", onType: "team", onId: "Operação", onName: "Operação", expectedDate: "2026-08-28", note: "Cobrar até o fim do dia" };
  const waiting = updateTask(initial, task.id, { status: "waiting", waitingContext }).tasks.find((item) => item.id === task.id);
  const doing = updateTask({ ...initial, tasks: [waiting] }, task.id, { status: "doing" }).tasks.find((item) => item.id === task.id);
  const completed = updateTask({ ...initial, tasks: [doing] }, task.id, { status: "done" }).tasks.find((item) => item.id === task.id);
  assert.ok(waiting.history.some((item) => item.text === "Status alterado para Aguardando."));
  assert.ok(waiting.history.some((item) => item.text.includes("Aguardando retorno do parceiro")));
  assert.ok(completed.history.some((item) => item.text === "Tarefa concluída."));
});

test("exige contexto ao entrar em Aguardando no mock", () => {
  withStorage();
  const initial = seedState();
  const task = initial.tasks.find((item) => item.status === "todo");
  assert.throws(() => updateTask(initial, task.id, { status: "waiting" }), /Informe o que está sendo aguardado/);
});

test("preserva contexto ao sair de Aguardando", () => {
  withStorage();
  const initial = seedState();
  const task = initial.tasks.find((item) => item.status === "todo");
  const waitingContext = { subject: "aprovação da proposta", onType: "employee", onId: "employee-marina", onName: "Marina Alves" };
  const waiting = updateTask(initial, task.id, { status: "waiting", waitingContext });
  const doing = updateTask(waiting, task.id, { status: "doing" }).tasks.find((item) => item.id === task.id);
  assert.equal(doing.waitingContext.subject, "aprovação da proposta");
  assert.equal(doing.status, "doing");
});

test("semeia cenário operacional amplo e variado", () => {
  const state = seedState();
  assert.equal(state.quotes.length, 17);
  assert.equal(state.tasks.length, 44);
  assert.equal(state.employees.length, 7);
  assert.equal(state.quality.length, 8);
  assert.ok(state.tasks.some((item) => item.status === "waiting"));
  assert.ok(state.tasks.some((item) => item.sourceType === "quality"));
  assert.ok(state.tasks.some((item) => item.parentTaskId));
  assert.ok(state.tasks.some((item) => item.checklist.length >= 3));
  assert.ok(state.tasks.some((item) => item.assigneeNames.includes("Renan Martins")));
  assert.ok(new Set(state.tasks.map((item) => item.teamName)).size >= 4);
  assert.ok(state.tasks.some((item) => item.comments.length > 0 && item.attachments.length > 0 && item.history.length > 1));
});
