import test from "node:test";
import assert from "node:assert/strict";
import { addAttachment, addComment, archivePersonalTag, createPersonalTag, createTask, createTeam, createQuote, deleteAttachment, deleteTask, deleteTeam, ensureQuoteTask, importPlannerTasks, loadPersonalTags, loadState, markQuoteSent, replaceTaskPersonalTags, resolveWaitingReturn, seedState, setQuoteOutcome, STORAGE_KEY, updatePersonalTag, updateTask, updateTeam, updateQuote } from "../src/mockStore.js";
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

test("mock semeia executor visível em tarefas Em andamento", () => {
  const initial = seedState();
  const task = initial.tasks.find((item) => item.id === "task-40");
  const execution = task.history.find((item) => item.field === "status" && item.nextValue === "doing");

  assert.equal(task.status, "doing");
  assert.equal(execution.author, "Renan Martins");
  assert.equal(execution.authorId, "employee-renan");
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
    { plannerTaskId: "planner-1", title: "Tarefa VIP", checklist: [{ id: "check-1", title: "Conferir", done: true }], tags: ["vip", "Acompanhar"] },
    { plannerTaskId: "planner-2", title: "Outra VIP", tags: ["VIP"] },
  ]);
  const tags = loadPersonalTags(result.nextState, "user-renan");
  const vip = tags.find((tag) => tag.name === "VIP");
  const followUp = tags.find((tag) => tag.name === "Acompanhar");
  assert.equal(tags.length, 2);
  assert.equal(followUp.archived, false);
  assert.deepEqual(result.nextState.tasks.at(-2).checklist, [{ id: "check-1", title: "Conferir", done: true }]);
  assert.deepEqual(result.nextState.tasks.at(-2).personalTagIds, [vip.id, followUp.id]);
  assert.deepEqual(result.nextState.tasks.at(-1).personalTagIds, [vip.id]);
});

test("importação do Planner preserva o primeiro participante como principal", () => {
  withStorage();
  const result = importPlannerTasks(seedState(), [{
    plannerTaskId: "planner-accountability",
    title: "Tarefa compartilhada importada",
    assignments: [
      { employeeId: "employee-rafael" },
      { employeeId: "employee-marina" },
    ],
  }]);
  const task = result.nextState.tasks.at(-1);
  assert.equal(task.primaryAssigneeId, "employee-rafael");
  assert.deepEqual(task.consultantIds, ["employee-marina"]);
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

test("usa solicitante no título automático da cotação e da tarefa", () => {
  withStorage();
  const next = createQuote(seedState(), { client: "Cliente novo", clientContact: "Maria Silva", deadline: "2026-09-20" });
  const quote = next.quotes[0];
  const task = next.tasks.find((item) => item.quoteId === quote.id && !item.parentTaskId);
  assert.equal(quote.title, "Cotação - Maria Silva");
  assert.equal(task.title, "Cotação - Maria Silva");
});

test("atualiza títulos automáticos quando solicitante muda e preserva títulos manuais", () => {
  withStorage();
  const created = createQuote(seedState(), { client: "Cliente", clientContact: "Maria Silva" });
  const quote = created.quotes[0];
  const automatic = updateQuote(created, quote.id, { clientContact: "João Souza" });
  const automaticTask = automatic.tasks.find((item) => item.quoteId === quote.id && !item.parentTaskId);
  assert.equal(automatic.quotes[0].title, "Cotação - João Souza");
  assert.equal(automaticTask.title, "Cotação - João Souza");

  const custom = createQuote(seedState(), { title: "Transfer executivo", client: "Cliente", clientContact: "Maria Silva" });
  const customQuote = custom.quotes[0];
  const customTaskId = custom.tasks.find((item) => item.quoteId === customQuote.id && !item.parentTaskId).id;
  const renamedTaskState = updateTask(custom, customTaskId, { title: "Cobrar retorno do cliente" });
  const edited = updateQuote(renamedTaskState, customQuote.id, { clientContact: "João Souza" });
  const editedTask = edited.tasks.find((item) => item.id === customTaskId);
  assert.equal(edited.quotes.find((item) => item.id === customQuote.id).title, "Transfer executivo");
  assert.equal(editedTask.title, "Cobrar retorno do cliente");
});

test("coloca nova cotação na fila Financeiro sem lembrete individual", () => {
  withStorage();
  const created = createQuote(seedState(), { title: "Transfer", client: "Cliente", deadline: "2026-09-19" });
  const quote = created.quotes[0];
  const task = created.tasks.find((item) => item.quoteId === quote.id && !item.parentTaskId);
  assert.equal(quote.status, "Nova");
  assert.equal(task.teamName, "Financeiro");
  assert.equal(task.assigneeIds.length, 0);
  assert.equal(task.status, "todo");
  assert.equal(created.notifications.some((item) => item.taskId === task.id), false);
});

test("notificações da cotação seguem responsáveis, ação necessária e deduplicação", () => {
  withStorage();
  const created = createQuote(seedState(), {
    title: "Transfer",
    client: "Cliente",
    deadline: "2026-09-19",
    assigneeIds: ["employee-marina"],
    assigneeNames: ["Marina Alves"],
  });
  const quote = created.quotes[0];
  const task = created.tasks.find((item) => item.quoteId === quote.id && !item.parentTaskId);
  const createdAssignment = created.notifications.filter((item) => item.taskId === task.id);
  assert.deepEqual(createdAssignment.map((item) => item.recipientEmployeeId), ["employee-marina"]);

  const edited = updateQuote(created, quote.id, { title: "Título revisado", priority: "high" });
  assert.equal(edited.notifications.length, created.notifications.length);

  const assigned = updateQuote(edited, quote.id, { assigneeIds: ["employee-marina", "employee-rafael"], assigneeNames: ["Marina Alves", "Rafael Lima"] });
  const assignmentNotifications = assigned.notifications.filter((item) => item.taskId === task.id && item.type === "assignees");
  assert.deepEqual(assignmentNotifications.map((item) => item.recipientEmployeeId), ["employee-rafael"]);

  const waiting = updateQuote(assigned, quote.id, {
    status: "Aguardando informação",
    waitingContext: { subject: "Confirmação do cliente", onType: "external", onName: "Cliente", note: "Aguardando dados" },
  });
  const waitingNotifications = waiting.notifications.filter((item) => item.taskId === task.id && item.type === "waiting");
  assert.deepEqual(new Set(waitingNotifications.map((item) => item.recipientEmployeeId)), new Set(["employee-marina", "employee-rafael"]));

  const done = updateQuote(waiting, quote.id, { status: "Cotada", value: "R$ 800,00", commercialTerms: "Pagamento em 30 dias" });
  assert.equal(done.notifications.filter((item) => item.taskId === task.id && item.type === "status").length, 0);
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
  assert.throws(() => markQuoteSent(initial, quote.id), /Finalize/);
  const priced = updateQuote(initial, quote.id, { status: "Cotada", value: "R$ 800,00", commercialTerms: "Pagamento em 30 dias" });
  const sent = markQuoteSent(priced, quote.id);
  assert.equal(sent.quotes[0].status, "Respondida ao cliente");
  assert.equal(sent.quotes[0].responseSent, true);
  const lost = setQuoteOutcome(sent, quote.id, "Perdida", "Preço acima do orçamento");
  assert.equal(lost.quotes[0].status, "Perdida");
  assert.equal(lost.tasks.find((task) => task.quoteId === quote.id && !task.parentTaskId).status, "done");
  assert.throws(() => setQuoteOutcome(sent, quote.id, "Perdida"), /motivo/);
  assert.equal(lost.reservations, undefined);
});

test("sincroniza status comercial da cotação com sua tarefa principal", () => {
  withStorage();
  const created = createQuote(seedState(), { title: "Transfer", client: "Cliente", deadline: "2026-09-19" });
  const quote = created.quotes[0];
  const task = created.tasks.find((item) => item.quoteId === quote.id && !item.parentTaskId);

  assert.throws(() => updateQuote(created, quote.id, { status: "Aguardando informação" }), /aguardado/);
  const waitingContext = { subject: "Confirmação do cliente", onType: "external", onName: "Cliente", note: "Aguardando dados" };
  const waiting = updateQuote(created, quote.id, { status: "Aguardando informação", waitingContext });
  const waitingTask = waiting.tasks.find((item) => item.id === task.id);
  assert.equal(waitingTask.quoteStatus, "Aguardando informação");
  assert.equal(waitingTask.status, "waiting");
  assert.equal(waitingTask.waitingContext.subject, waitingContext.subject);

  const priced = updateQuote(waiting, quote.id, { status: "Cotada", value: "R$ 800,00", commercialTerms: "Pagamento em 30 dias" });
  assert.equal(priced.tasks.find((item) => item.id === task.id).status, "done");
  const sent = markQuoteSent(priced, quote.id);
  const sentTask = sent.tasks.find((item) => item.id === task.id);
  assert.equal(sentTask.quoteStatus, "Respondida ao cliente");
  assert.equal(sentTask.status, "done");
});

test("sincroniza alteração de status da tarefa de cotação de volta para a cotação", () => {
  withStorage();
  const created = createQuote(seedState(), { title: "Transfer", client: "Cliente", deadline: "2026-09-19" });
  const quote = created.quotes[0];
  const task = created.tasks.find((item) => item.quoteId === quote.id && !item.parentTaskId);

  const next = updateTask(created, task.id, { quoteStatus: "Cotada", value: "R$ 800,00", commercialTerms: "Pagamento em 30 dias" });
  assert.equal(next.quotes.find((item) => item.id === quote.id).status, "Cotada");
  assert.equal(next.tasks.find((item) => item.id === task.id).status, "done");
});

test("concluir tarefa vinculada mantém a tarefa concluída e marca a cotação como respondida", () => {
  withStorage();
  const created = createQuote(seedState(), { title: "Transfer", client: "Cliente", deadline: "2026-09-19" });
  const quote = created.quotes[0];
  const task = created.tasks.find((item) => item.quoteId === quote.id && !item.parentTaskId);

  assert.throws(() => updateTask(created, task.id, { status: "done" }), /valor maior que zero/);
  assert.equal(created.tasks.find((item) => item.id === task.id).status, "todo");
  assert.equal(created.quotes.find((item) => item.id === quote.id).status, "Nova");
  assert.throws(() => updateTask(created, task.id, { status: "done", quoteStatus: "Cotada", value: "R$ 0,00", commercialTerms: "À vista" }), /valor maior que zero/);
  assert.throws(() => updateQuote(created, quote.id, { status: "Respondida ao cliente", value: "R$ 800,00", commercialTerms: "À vista" }), /Confirme o envio/);
});

test("confirmação de envio ao concluir tarefa atualiza a cotação vinculada", () => {
  withStorage();
  const created = createQuote(seedState(), { title: "Transfer", client: "Cliente", deadline: "2026-09-19" });
  const quote = created.quotes[0];
  const task = created.tasks.find((item) => item.quoteId === quote.id && !item.parentTaskId);

  assert.throws(() => updateTask(created, task.id, { status: "done", quoteStatus: "Respondida ao cliente", value: "R$ 800,00", commercialTerms: "Pagamento em 30 dias" }), /Confirme o envio/);
  const completed = updateTask(created, task.id, { status: "done", quoteStatus: "Respondida ao cliente", responseSent: true, value: "R$ 800,00", commercialTerms: "Pagamento em 30 dias" });
  assert.equal(completed.tasks.find((item) => item.id === task.id).status, "done");
  assert.equal(completed.quotes.find((item) => item.id === quote.id).status, "Respondida ao cliente");
  assert.equal(completed.quotes.find((item) => item.id === quote.id).responseSent, true);

  const alreadyResponded = updateTask(created, task.id, { status: "done", value: "R$ 800,00", commercialTerms: "Pagamento em 30 dias" });
  const confirmed = markQuoteSent(alreadyResponded, quote.id);
  assert.equal(confirmed.quotes.find((item) => item.id === quote.id).responseSent, true);
});

test("conclusão só com cotação realizada mantém a cotação cotada e não enviada", () => {
  withStorage();
  const created = createQuote(seedState(), { title: "Transfer", client: "Cliente", deadline: "2026-09-19" });
  const quote = created.quotes[0];
  const task = created.tasks.find((item) => item.quoteId === quote.id && !item.parentTaskId);

  const completed = updateTask(created, task.id, { status: "done", quoteStatus: "Cotada", responseSent: false, value: "R$ 800,00", commercialTerms: "Pagamento em 30 dias" });
  assert.equal(completed.tasks.find((item) => item.id === task.id).status, "done");
  assert.equal(completed.tasks.find((item) => item.id === task.id).quoteStatus, "Cotada");
  assert.equal(completed.quotes.find((item) => item.id === quote.id).status, "Cotada");
  assert.equal(completed.quotes.find((item) => item.id === quote.id).responseSent, false);

  const edited = updateQuote(completed, quote.id, { title: "Transfer revisado", status: "Cotada" });
  assert.equal(edited.tasks.find((item) => item.id === task.id).status, "done");
  assert.equal(edited.quotes.find((item) => item.id === quote.id).status, "Cotada");
});

test("falha ao persistir conclusão não modifica tarefa nem cotação originais", () => {
  withStorage();
  const created = createQuote(seedState(), { title: "Transfer", client: "Cliente" });
  const quote = created.quotes[0];
  const task = created.tasks.find((item) => item.quoteId === quote.id && !item.parentTaskId);
  globalThis.localStorage.setItem = () => { throw new Error("Falha de gravação"); };
  assert.throws(() => updateTask(created, task.id, { status: "done", quoteStatus: "Cotada", responseSent: false, value: "R$ 800,00", commercialTerms: "À vista" }), /Falha de gravação/);
  assert.equal(created.tasks.find((item) => item.id === task.id).status, "todo");
  assert.equal(created.quotes.find((item) => item.id === quote.id).status, "Nova");
});

test("reabrir cotação reativa sua tarefa principal e limpa encerramento", () => {
  withStorage();
  const created = createQuote(seedState(), { title: "Transfer", client: "Cliente", deadline: "2026-09-19" });
  const quote = created.quotes[0];
  const closed = setQuoteOutcome(created, quote.id, "Perdida", "Preço acima do orçamento");
  const reopened = updateQuote(closed, quote.id, { status: "Nova", finalizationAt: "", responseSent: false });
  const reopenedTask = reopened.tasks.find((item) => item.quoteId === quote.id && !item.parentTaskId);

  assert.equal(reopened.quotes[0].status, "Nova");
  assert.equal(reopened.quotes[0].finalizationAt, "");
  assert.equal(reopened.quotes[0].lossReason, "");
  assert.equal(reopenedTask.status, "todo");
  assert.equal(reopenedTask.quoteStatus, "Nova");
});

test("conclui todas as tarefas abertas vinculadas ao resultado da cotação", () => {
  withStorage();
  const created = createQuote(seedState(), { title: "Transfer", client: "Cliente", deadline: "2026-09-19" });
  const quote = created.quotes[0];
  const mainTask = created.tasks.find((task) => task.quoteId === quote.id && !task.parentTaskId);
  const withOpenSubtask = createTask(created, { title: "Validar veículo", parentTaskId: mainTask.id, quoteId: quote.id, quoteCode: quote.code, quoteTitle: quote.title });
  const withDoneSubtask = createTask(withOpenSubtask, { title: "Conferir contato", parentTaskId: mainTask.id, quoteId: quote.id, quoteCode: quote.code, quoteTitle: quote.title });
  const doneId = withDoneSubtask.tasks.at(-1).id;
  const withDone = updateTask(withDoneSubtask, doneId, { status: "done" });
  const alreadyDoneTask = withDone.tasks.find((task) => task.id === doneId);

  const lost = setQuoteOutcome(withDone, quote.id, "Perdida", "Preço acima do orçamento");
  const linkedTasks = lost.tasks.filter((task) => task.quoteId === quote.id);

  assert.equal(linkedTasks.length, 3);
  assert.equal(linkedTasks.every((task) => task.status === "done"), true);
  assert.equal(linkedTasks.find((task) => task.id === doneId), alreadyDoneTask);
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
  const teamState = createTeam(initial, { name: "Equipe teste", memberIds: ["employee-marina", "employee-rafael"], primaryMemberId: "employee-rafael" });
  const team = teamState.teams.at(-1);
  const created = createTask(teamState, { title: "Revisar escala", assignmentMode: "team", teamId: team.id });
  const task = created.tasks.at(-1);

  assert.equal(task.assignmentMode, "team");
  assert.equal(task.teamId, team.id);
  assert.deepEqual(task.assigneeIds, ["employee-rafael", "employee-marina"]);
  assert.equal(task.primaryAssigneeId, "employee-rafael");
  assert.deepEqual(task.consultantIds, ["employee-marina"]);

  const editedTeam = updateTeam(created, team.id, { name: team.name, memberIds: ["employee-marina"] });
  const savedTask = editedTeam.tasks.find((item) => item.id === task.id);
  assert.deepEqual(editedTeam.teams.at(-1).memberIds, ["employee-marina"]);
  assert.deepEqual(savedTask.assigneeIds, ["employee-marina"]);
});

test("bloqueia equipe vazia e sincroniza somente tarefas abertas", () => {
  withStorage();
  const initial = seedState();
  assert.throws(() => createTeam(initial, { name: "Equipe vazia", memberIds: [] }), /pelo menos um membro/);
  const teamState = createTeam(initial, { name: "Equipe histórica", memberIds: ["employee-marina", "employee-rafael"], primaryMemberId: "employee-rafael" });
  const openState = createTask(teamState, { title: "Aberta", assignmentMode: "team", teamId: teamState.teams.at(-1).id });
  const withDoneCandidate = createTask(openState, { title: "Histórica", assignmentMode: "team", teamId: teamState.teams.at(-1).id });
  const doneState = updateTask(withDoneCandidate, withDoneCandidate.tasks.at(-1).id, { status: "done" });
  const edited = updateTeam(doneState, teamState.teams.at(-1).id, { name: "Equipe histórica", memberIds: ["employee-marina"], primaryMemberId: "employee-marina" });
  const openTask = edited.tasks.find((task) => task.title === "Aberta");
  assert.deepEqual(openTask.assigneeIds, ["employee-marina"]);
  assert.deepEqual(openTask.consultantIds, []);
  assert.equal(openTask.status, "todo");
  assert.deepEqual(edited.tasks.find((task) => task.title === "Histórica").assigneeIds, ["employee-rafael", "employee-marina"]);
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
  const first = createTeam(initial, { name: "Equipe A", memberIds: ["employee-marina", "employee-rafael"], primaryMemberId: "employee-rafael" });
  const second = createTeam(first, { name: "Equipe B", memberIds: ["employee-rafael", "employee-camila"], primaryMemberId: "employee-camila" });
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

test("lê registros mock antigos como aceite do cliente", () => {
  withStorage();
  const state = seedState();
  state.quotes = [{ id: "quote-old", status: "Convertida em serviço" }];
  state.tasks = [{ id: "task-old", quoteId: "quote-old", quoteStatus: "Convertida em serviço" }];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const loaded = loadState();
  assert.equal(loaded.quotes[0].status, "Aceita pelo cliente");
  assert.equal(loaded.tasks[0].quoteStatus, "Aceita pelo cliente");
});

test("registra no histórico da tarefa mudanças feitas pela gestão da cotação", () => {
  const created = createQuote(seedState(), { title: "Transfer", client: "Cliente", channel: "WhatsApp", clientPhone: "11999999999", serviceType: "Transfer", origin: "A", destination: "B", serviceDate: "2026-09-20T10:00", deadline: "2026-09-19" });
  const quote = created.quotes[0];
  const changed = updateQuote(created, quote.id, { status: "Em análise pelo financeiro", deadline: "2026-09-18", assigneeIds: ["employee-renan"], assigneeNames: ["Renan Martins"] });
  const task = changed.tasks.find((item) => item.quoteId === quote.id && !item.parentTaskId);
  assert.equal(task.quoteStatus, "Em análise pelo financeiro");
  assert.equal(task.assigneeIds[0], "employee-renan");
  assert.ok(task.history.some((item) => item.field === "quoteStatus"));
  assert.ok(task.history.some((item) => item.field === "dueDate"));
  assert.ok(task.history.some((item) => item.field === "assignees"));
});
