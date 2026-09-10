import test from "node:test";
import assert from "node:assert/strict";
import { addAttachment, addComment, archivePersonalTag, createPersonalTag, createTask, createTeam, createQuote, deleteAttachment, deleteTask, deleteTeam, ensureQuoteTask, importPlannerTasks, loadPersonalTags, markQuoteSent, replaceTaskPersonalTags, resolveWaitingReturn, seedState, setQuoteOutcome, updatePersonalTag, updateTask, updateTeam, updateQuote } from "../src/mockStore.js";
import { localDateKey } from "../src/management.js";

function withStorage() {
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}

test("semeia datas da agenda relativas ao dia local", () => {
  const initial = seedState();
  const today = localDateKey();
  const taskToday = initial.tasks.find((task) => task.id === "task-1");
  const taskOverdue = initial.tasks.find((task) => task.id === "task-35");
  const taskUpcoming = initial.tasks.find((task) => task.id === "task-22");

  assert.equal(taskToday.dueDate, today);
  assert.notEqual(taskOverdue.dueDate, today);
  assert.notEqual(taskUpcoming.dueDate, today);
});

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

test("persiste o flag de visibilidade restrita no mock durante criação e edição", () => {
  withStorage();
  const initial = seedState();
  const createdState = createTask(initial, {
    title: "Tarefa restrita",
    restrictedVisibility: true,
    actorEmployeeId: "employee-renan",
    actorUserId: "user-renan",
  });
  const created = createdState.tasks.at(-1);
  assert.equal(created.restrictedVisibility, true);

  const reopened = updateTask(createdState, created.id, { restrictedVisibility: false });
  assert.equal(reopened.tasks.find((task) => task.id === created.id).restrictedVisibility, false);
});

test("mantém tags pessoais isoladas por usuário e vinculadas à tarefa", () => {
  withStorage();
  const initial = seedState();
  const created = createPersonalTag(initial, { name: "Cobrar", color: "#b87900", ownerUserId: "user-renan" });
  const otherUser = createPersonalTag(created, { name: "Minha fila", ownerUserId: "user-outro" });
  const renanTags = loadPersonalTags(otherUser, "user-renan");
  assert.deepEqual(renanTags.map((tag) => tag.name), ["Cobrar"]);
  const taskTagged = replaceTaskPersonalTags(otherUser, "task-1", [renanTags[0].id], "user-renan");
  assert.deepEqual(taskTagged.tasks.find((task) => task.id === "task-1").personalTagIds, [renanTags[0].id]);
  const renamed = updatePersonalTag(taskTagged, renanTags[0].id, { name: "Cobrar hoje" });
  assert.equal(renamed.personalTags.find((tag) => tag.id === renanTags[0].id).name, "Cobrar hoje");
  const archived = archivePersonalTag(renamed, renanTags[0].id);
  assert.equal(loadPersonalTags(archived, "user-renan")[0].archived, true);
  assert.deepEqual(archived.tasks.find((task) => task.id === "task-1").personalTagIds, [renanTags[0].id]);
});

test("importa tags do Planner, reutiliza existentes e reativa arquivadas", () => {
  withStorage();
  const initial = seedState();
  const withExisting = createPersonalTag(initial, { name: "VIP", color: "#b87900", ownerUserId: "user-renan" });
  const archived = createPersonalTag(withExisting, { name: "Acompanhar", color: "#2d796f", ownerUserId: "user-renan" });
  const archivedState = archivePersonalTag(archived, archived.personalTags.find((tag) => tag.name === "Acompanhar").id);
  const result = importPlannerTasks(archivedState, [
    { plannerTaskId: "planner-1", title: "Tarefa VIP", tags: ["vip", "Acompanhar"] },
    { plannerTaskId: "planner-2", title: "Outra VIP", tags: ["VIP"] },
  ]);
  const tags = loadPersonalTags(result.nextState, "user-renan");
  const vip = tags.find((tag) => tag.name === "VIP");
  const followUp = tags.find((tag) => tag.name === "Acompanhar");
  assert.equal(tags.length, 2);
  assert.equal(followUp.archived, false);
  assert.deepEqual(result.nextState.tasks.at(-2).personalTagIds, [vip.id, followUp.id]);
  assert.deepEqual(result.nextState.tasks.at(-1).personalTagIds, [vip.id]);
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

test("cria cotação e acompanhamento principal no mesmo estado mock", () => {
  withStorage();
  const next = createQuote(seedState(), { title: "Transfer novo", client: "Cliente novo", deadline: "2026-09-20", priority: "high" });
  const quote = next.quotes[0];
  const task = next.tasks.find((item) => item.quoteId === quote.id && !item.parentTaskId);
  assert.match(quote.code, /^COT-\d{4}$/);
  assert.ok(task);
  assert.equal(quote.plannerTaskId, task.id);
  assert.equal(task.priority, "high");
});

test("atualiza dados comerciais e replica campos operacionais na tarefa", () => {
  withStorage();
  const initial = seedState();
  const quote = initial.quotes[0];
  const next = updateQuote(initial, quote.id, { title: "Título revisado", deadline: "2026-09-30", priority: "high" });
  const task = next.tasks.find((item) => item.quoteId === quote.id && !item.parentTaskId);
  assert.equal(next.quotes.find((item) => item.id === quote.id).title, "Título revisado");
  assert.equal(task.quoteTitle, "Título revisado");
  assert.equal(task.dueDate, "2026-09-30");
  assert.equal(task.priority, "high");
});

test("registra envio e resultados da cotação sem criar reserva", () => {
  withStorage();
  const initial = createQuote(seedState(), { title: "Transfer", client: "Cliente", clientContact: "Contato", channel: "WhatsApp", serviceType: "Transfer", origin: "A", destination: "B", serviceDate: "2026-09-20T10:00", deadline: "2026-09-19" });
  const quote = initial.quotes[0];
  const sent = markQuoteSent(initial, quote.id);
  assert.equal(sent.quotes[0].status, "Respondida ao cliente");
  assert.equal(sent.quotes[0].responseSent, true);
  const lost = setQuoteOutcome(sent, quote.id, "Perdida", "Preço acima do orçamento");
  assert.equal(lost.quotes[0].status, "Perdida");
  assert.equal(lost.tasks.find((task) => task.quoteId === quote.id && !task.parentTaskId).status, "done");
  assert.throws(() => setQuoteOutcome(sent, quote.id, "Perdida"), /motivo/);
  assert.equal(lost.reservations, undefined);
});

test("preserva origem na tarefa criada", () => {
  withStorage();
  const created = createTask(seedState(), { title: "Tratar ocorrência", sourceType: "quality", sourceId: "quality-1", sourceLabel: "Ação de qualidade", sourceCode: "QAL-1" });
  const task = created.tasks.at(-1);
  assert.equal(task.sourceType, "quality");
  assert.equal(task.sourceId, "quality-1");
});

test("salva equipe e acompanha membros atuais nas tarefas da equipe", () => {
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
  assert.deepEqual(savedTask.assigneeIds, ["employee-marina"]);
});

test("apaga equipe sem alterar tarefas existentes", () => {
  withStorage();
  const initial = seedState();
  const teamState = createTeam(initial, { name: "Equipe removível", memberIds: ["employee-marina"] });
  const team = teamState.teams.at(-1);
  const created = createTask(teamState, { title: "Tarefa preservada", assignmentMode: "team", teamId: team.id });
  const deleted = deleteTeam(created, team.id);

  assert.equal(deleted.teams.some((item) => item.id === team.id), false);
  assert.deepEqual(deleted.tasks.find((item) => item.id === created.tasks.at(-1).id).assigneeIds, ["employee-marina"]);
  assert.throws(() => deleteTeam(deleted, team.id), /Equipe não encontrada/);
});

test("registra aguardando e conclusão no histórico mock", () => {
  withStorage();
  const initial = seedState();
  const task = initial.tasks.find((item) => item.status === "todo");
  const waitingContext = { subject: "retorno do parceiro", onType: "team", onId: "Operação", onName: "Operação", expectedDate: "2026-08-28", note: "Cobrar até o fim do dia" };
  const waitingState = updateTask(initial, task.id, { status: "waiting", waitingContext });
  const waiting = waitingState.tasks.find((item) => item.id === task.id);
  const waitingNotifications = waitingState.notifications.filter((item) => item.taskId === task.id && item.type === "waiting");
  const doing = updateTask({ ...initial, tasks: [waiting] }, task.id, { status: "doing" }).tasks.find((item) => item.id === task.id);
  const completed = updateTask({ ...initial, tasks: [doing] }, task.id, { status: "done" }).tasks.find((item) => item.id === task.id);
  assert.ok(waiting.history.some((item) => item.text === "Status alterado para Aguardando."));
  assert.ok(waiting.history.some((item) => item.text.includes("Aguardando retorno do parceiro")));
  assert.ok(waitingNotifications.length >= 1);
  assert.ok(waitingNotifications.every((item) => item.message.includes("retorno do parceiro")));
  assert.ok(completed.history.some((item) => item.text === "Tarefa concluída."));
});

test("notifica uma vez cada membro de múltiplas equipes aguardando", () => {
  withStorage();
  const initial = seedState();
  const first = createTeam(initial, { name: "Equipe A", memberIds: ["employee-marina", "employee-rafael"] });
  const second = createTeam(first, { name: "Equipe B", memberIds: ["employee-rafael", "employee-camila"] });
  const task = second.tasks.find((item) => item.status === "todo");
  const teamA = second.teams.at(-2);
  const teamB = second.teams.at(-1);
  const next = updateTask(second, task.id, { status: "waiting", waitingContext: { subject: "retorno", onType: "team", onIds: [teamA.id, teamB.id], onNames: [teamA.name, teamB.name] } });
  const recipients = next.notifications.filter((item) => item.taskId === task.id && item.type === "waiting").map((item) => item.recipientEmployeeId);

  assert.equal(new Set(recipients).size, recipients.length);
  assert.ok(recipients.includes("employee-rafael"));
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

test("registra retorno, evidência, histórico e notificação em uma operação", () => {
  withStorage();
  const initial = seedState();
  const task = initial.tasks.find((item) => item.status === "waiting" && item.waitingContext.onType === "employee" && item.waitingContext.onId);
  const next = resolveWaitingReturn(initial, task.id, {
    text: "Rafael confirmou a disponibilidade do veículo.",
    files: [{ name: "confirmacao.pdf", type: "application/pdf", size: 2048 }],
    actorEmployeeId: "employee-rafael",
    actorUserId: "user-rafael",
  });
  const resolved = next.tasks.find((item) => item.id === task.id);

  assert.equal(resolved.status, "doing");
  assert.equal(resolved.returns.at(-1).text, "Rafael confirmou a disponibilidade do veículo.");
  assert.equal(resolved.returns.at(-1).attachments.at(-1).name, "confirmacao.pdf");
  assert.equal(resolved.comments.length, 0);
  assert.equal(resolved.returns.at(-1).attachments.at(-1).name, "confirmacao.pdf");
  assert.equal(resolved.history.at(-1).text, "Retorno registrado. Tarefa retomada para Em andamento.");
  assert.equal(resolved.waitingContext.subject, task.waitingContext.subject);
  assert.ok(next.notifications.some((item) => item.taskId === task.id && item.type === "status" && item.message.includes("Rafael confirmou")));
  assert.equal(task.status, "waiting");
});

test("exige relato e permissão para registrar retorno", () => {
  withStorage();
  const initial = seedState();
  const task = initial.tasks.find((item) => item.status === "waiting" && item.waitingContext.onType === "employee" && item.waitingContext.onId);
  assert.throws(() => resolveWaitingReturn(initial, task.id, { actorEmployeeId: "employee-rafael", actorUserId: "user-rafael" }), /Informe o retorno recebido/);
  assert.throws(() => resolveWaitingReturn(initial, task.id, { text: "Retorno", actorEmployeeId: "employee-camila", actorUserId: "user-camila" }), /não pode registrar/);
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
