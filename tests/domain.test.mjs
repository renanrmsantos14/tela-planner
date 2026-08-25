import test from "node:test";
import assert from "node:assert/strict";
import { addOptimisticAttachment, addOptimisticComment, applyOptimisticTaskPatch, buildAssigneeOptions, buildOptimisticTask, buildTaskCreationInput, filterTasks, getDueBucket, isOverdue, mentionedEmployees, migrateLegacyTeams, normalizeAssigneeNames, normalizeTeam, quoteTaskTitle, resolveTaskAssignment, sortTasks, STATUSES, taskStats, validateWaitingContext, waitingContextSummary } from "../src/domain.js";

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

test("classifica prazos em atraso, hoje, amanhã e próximos no fuso do app", () => {
  const today = new Date("2026-08-03T12:00:00-03:00");
  assert.equal(getDueBucket({ status: "todo", dueDate: "2026-08-02" }, today), "overdue");
  assert.equal(getDueBucket({ status: "todo", dueDate: "2026-08-03" }, today), "today");
  assert.equal(getDueBucket({ status: "todo", dueDate: "2026-08-04" }, today), "tomorrow");
  assert.equal(getDueBucket({ status: "todo", dueDate: "2026-08-05" }, today), "upcoming");
  assert.equal(getDueBucket({ status: "done", dueDate: "2026-08-02" }, today), "none");
  assert.equal(getDueBucket({ status: "todo" }, today), "none");
});

test("filtra por texto, status e prioridade", () => {
  assert.equal(filterTasks(tasks, { query: "Rafael", status: "", priority: "" }).length, 1);
  assert.equal(filterTasks(tasks, { query: "", status: ["doing", "waiting"], priority: ["medium", "high"] }).length, 1);
});

test("filtra por um ou mais responsáveis", () => {
  assert.deepEqual(filterTasks(tasks, { query: "", assignee: ["Marina", "Camila"] }).map((task) => task.id), ["1", "3"]);
  assert.equal(filterTasks(tasks, { query: "", assignee: "Rafael" }).length, 1);
});

test("resolve menções por nome ignorando acentos e caixa", () => {
  const employees = [{ id: "1", name: "Camila Torres" }, { id: "2", name: "João Mendes" }];
  assert.deepEqual(mentionedEmployees("@CAMILA TORRES revisar e @joao mendes validar", employees).map((item) => item.id), ["1", "2"]);
});

test("resolve @all e @todos como menção para toda a equipe", () => {
  const employees = [{ id: "1", name: "Camila Torres" }, { id: "2", name: "João Mendes" }];
  assert.deepEqual(mentionedEmployees("Aviso: @all", employees).map((item) => item.id), ["1", "2"]);
  assert.deepEqual(mentionedEmployees("Atenção (@todos)!", employees).map((item) => item.id), ["1", "2"]);
});

test("resolve menção pelo apelido carregado do funcionário", () => {
  const employees = [{ id: "1", name: "Renan Martins", apelido: "Renan" }];
  assert.deepEqual(mentionedEmployees("@renan revisar", employees).map((item) => item.id), ["1"]);
});

test("normaliza múltiplos responsáveis", () => {
  assert.deepEqual(normalizeAssigneeNames(["Não atribuído", "Marina", "Marina", "Rafael"]), ["Marina", "Rafael"]);
  assert.deepEqual(normalizeAssigneeNames([]), ["Não atribuído"]);
});

test("normaliza equipe e expande seus membros no snapshot da tarefa", () => {
  const team = normalizeTeam({ id: "team-op", name: "Operação", memberIds: ["e1", "e1", "e2"] });
  const assignment = resolveTaskAssignment({ assignmentMode: "team", teamId: team.id }, [team], [{ id: "e1", name: "Marina" }, { id: "e2", name: "Rafael" }]);

  assert.deepEqual(team.memberIds, ["e1", "e2"]);
  assert.deepEqual(assignment, { assignmentMode: "team", teamId: "team-op", teamName: "Operação", assigneeIds: ["e1", "e2"], assigneeNames: ["Marina", "Rafael"] });
});

test("migra equipes legadas sem alterar tarefas fora de equipe", () => {
  const migrated = migrateLegacyTeams([
    { id: "task-op", teamName: "Operação", assigneeIds: ["e1"], assigneeNames: ["Marina"] },
    { id: "task-manual", teamName: "Sem equipe", assigneeIds: ["e2"], assigneeNames: ["Rafael"] },
  ], [{ id: "e1", name: "Marina" }, { id: "e2", name: "Rafael" }], ["Operação"]);

  assert.equal(migrated.teams[0].name, "Operação");
  assert.deepEqual(migrated.teams[0].memberIds, ["e1"]);
  assert.equal(migrated.tasks[0].assignmentMode, "team");
  assert.equal(migrated.tasks[0].teamId, "team-operacao");
  assert.equal(migrated.tasks[1].assignmentMode, "people");
  assert.equal(migrated.tasks[1].teamId, "");
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

test("mantém cada coluna em ordem crescente de prazo", () => {
  const sameColumn = [
    { id: "late", status: "todo", dueDate: "2026-08-20" },
    { id: "early", status: "todo", dueDate: "2026-08-05" },
    { id: "no-date", status: "todo", dueDate: "" },
  ];

  assert.deepEqual(sortTasks(sameColumn).map((item) => item.id), ["early", "late", "no-date"]);
});

test("filtra origem e status aguardando", () => {
  const qualityTask = { ...tasks[1], status: "waiting", sourceType: "quality", sourceLabel: "Erro operacional" };
  assert.equal(filterTasks([tasks[0], qualityTask], { query: "", status: ["waiting"], priority: [], source: ["quality"] }).length, 1);
});

test("ordena Aguardando antes de Em andamento", () => {
  assert.deepEqual(STATUSES.map((item) => item.id), ["todo", "waiting", "doing", "done"]);
});

test("valida contexto mínimo e monta resumo de Aguardando", () => {
  assert.equal(validateWaitingContext("waiting", {}).allowed, false);
  const context = { subject: "confirmação da segunda van", onType: "team", onId: "Operação", onName: "Operação", expectedDate: "2026-08-28", note: "Cobrar parceiro" };
  assert.equal(validateWaitingContext("waiting", context).allowed, true);
  assert.equal(waitingContextSummary(context), "Aguardando confirmação da segunda van · Operação · até 28 ago.");
  assert.equal(validateWaitingContext("doing", {}).allowed, true);
});

test("monta responsáveis únicos em ordem alfabética", () => {
  assert.deepEqual(buildAssigneeOptions([{ name: "Rafael Lima" }, { name: "Camila Torres" }, { name: "Camila Torres" }, { name: "" }]), ["Não atribuído", "Camila Torres", "Rafael Lima"]);
});

test("preserva vínculo manual de cotação sem deep-link", () => {
  const created = buildTaskCreationInput({ title: "Acompanhar cliente", quoteId: "quote-1008", quoteCode: "COT-1008", quoteTitle: "Transfer executivo" });

  assert.equal(created.quoteId, "quote-1008");
  assert.equal(created.sourceType, "quote");
  assert.equal(created.quoteCode, "COT-1008");
});

test("cria tarefa otimista pronta para aparecer antes do Dataverse responder", () => {
  const task = buildOptimisticTask({
    title: "Confirmar motorista",
    description: "Validar escala",
    priority: "high",
    assigneeName: "Betinho",
    teamName: "Operação",
    dueDate: "2026-08-13",
  });

  assert.match(task.id, /^optimistic-/);
  assert.equal(task.title, "Confirmar motorista");
  assert.equal(task.status, "todo");
  assert.equal(task.sourceType, "manual");
  assert.equal(task.syncStatus, "syncing");
  assert.deepEqual(task.comments, []);
  assert.deepEqual(task.attachments, []);
});

test("título automático de cotação nunca exibe undefined", () => {
  assert.equal(quoteTaskTitle({ code: "COT-42" }), "Acompanhar COT-42");
  assert.equal(quoteTaskTitle({ title: "Evento executivo" }), "Acompanhar Evento executivo");
  assert.equal(quoteTaskTitle({}), "Acompanhar cotação");
});

test("aplica alteração otimista sem mutar o estado anterior", () => {
  const state = { tasks: [{ ...tasks[0], comments: [], attachments: [] }] };
  const next = applyOptimisticTaskPatch(state, "1", { status: "doing", priority: "low" });

  assert.equal(state.tasks[0].status, "todo");
  assert.equal(next.tasks[0].status, "doing");
  assert.equal(next.tasks[0].priority, "low");
  assert.equal(next.tasks[0].syncStatus, "syncing");
});

test("inclui comentário e anexo provisórios imediatamente", () => {
  const state = { tasks: [{ ...tasks[0], comments: [], attachments: [] }] };
  const withComment = addOptimisticComment(state, "1", "Retorno solicitado");
  const withAttachment = addOptimisticAttachment(withComment, "1", { name: "briefing.pdf" });

  assert.equal(withAttachment.tasks[0].comments[0].text, "Retorno solicitado");
  assert.equal(withAttachment.tasks[0].comments[0].syncStatus, "syncing");
  assert.equal(withAttachment.tasks[0].attachments[0].name, "briefing.pdf");
  assert.equal(withAttachment.tasks[0].attachments[0].syncStatus, "syncing");
});
