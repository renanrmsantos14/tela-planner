import { PRIORITIES, STATUSES } from "./domain.js";

const dateFromToday = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export const ERROR_STATUSES = [
  { id: "open", label: "Aberto", tone: "danger" },
  { id: "treating", label: "Em tratamento", tone: "action" },
  { id: "waiting", label: "Aguardando", tone: "warning" },
  { id: "resolved", label: "Resolvido", tone: "success" },
];

export const ACTION_STATUSES = [
  { id: "todo", label: "A fazer", tone: "neutral" },
  { id: "doing", label: "Em andamento", tone: "action" },
  { id: "waiting", label: "Aguardando", tone: "warning" },
  { id: "done", label: "Concluída", tone: "success" },
];

export function seedModuleState() {
  const errors = [
    { id: "error-204", code: "QAL-204", title: "Atraso na confirmação do fornecedor", severity: "Alta", status: "treating", origin: "Operação", dueDate: dateFromToday(1), responsible: "Rafael Lima", description: "A confirmação do fornecedor não chegou no prazo combinado.", impact: "Risco de atraso no atendimento e necessidade de reescala.", quoteId: "quote-1007" },
    { id: "error-205", code: "QAL-205", title: "Informação de voo não atualizada", severity: "Média", status: "open", origin: "Atendimento", dueDate: dateFromToday(3), responsible: "Camila Torres", description: "A alteração informada pelo cliente não foi refletida no painel.", impact: "Risco de desencontro na recepção do passageiro.", quoteId: "quote-1008" },
    { id: "error-206", code: "QAL-206", title: "Documento operacional incompleto", severity: "Baixa", status: "waiting", origin: "Qualidade", dueDate: dateFromToday(5), responsible: "Marina Alves", description: "O comprovante da operação ainda não foi anexado.", impact: "Pendência de auditoria e encerramento do atendimento.", quoteId: null },
  ];
  const actions = [
    action("action-204-1", "error-204", "Confirmar causa e retorno do fornecedor", "Corretiva", "doing", "high", "Rafael Lima", dateFromToday(1), "Confirmar a causa do atraso e registrar o retorno do parceiro."),
    action("action-204-2", "error-204", "Criar confirmação D-1 obrigatória", "Preventiva", "todo", "medium", "Camila Torres", dateFromToday(4), "Formalizar uma etapa de confirmação antes da operação."),
    action("action-205-1", "error-205", "Revisar atualização do monitoramento", "Corretiva", "waiting", "medium", "Camila Torres", dateFromToday(3), "Validar o caminho de entrada da alteração de voo."),
  ];
  return { errors, actions };
}

function action(id, errorId, title, type, status, priority, assigneeName, dueDate, description) {
  return { id, errorId, title, type, status, priority, assigneeName, dueDate, description, result: "", evidence: [], plannerTaskId: null, history: [{ id: uid("history"), text: "Plano criado no mock.", createdAt: new Date().toISOString(), author: "Sistema" }] };
}

export function ensureModuleState(state) {
  const seeded = seedModuleState();
  return { ...state, errors: state.errors?.length ? state.errors : seeded.errors, actions: state.actions?.length ? state.actions : seeded.actions };
}

export function errorStatusById(id) { return ERROR_STATUSES.find((item) => item.id === id) || ERROR_STATUSES[0]; }
export function actionStatusById(id) { return ACTION_STATUSES.find((item) => item.id === id) || ACTION_STATUSES[0]; }
export function actionForError(actions, errorId) { return actions.filter((item) => item.errorId === errorId); }
export function taskForAction(tasks, actionId) { return tasks.find((item) => item.sourceType === "quality" && item.sourceId === actionId) || null; }

export function updateMockError(state, id, patch) {
  return { ...state, errors: state.errors.map((item) => item.id === id ? { ...item, ...patch } : item) };
}

export function updateMockAction(state, id, patch) {
  const current = state.actions.find((item) => item.id === id);
  if (!current) return state;
  const nextActions = state.actions.map((item) => item.id === id ? { ...item, ...patch, history: patch.status && patch.status !== item.status ? [...item.history, { id: uid("history"), text: `Status alterado para ${actionStatusById(patch.status).label}.`, createdAt: new Date().toISOString(), author: "Você" }] : item.history } : item);
  const nextState = { ...state, actions: nextActions };
  if (patch.status === "done") return updateMockError(nextState, current.errorId, { status: "resolved" });
  if (patch.status && patch.status !== "done") return updateMockError(nextState, current.errorId, { status: "treating" });
  return nextState;
}

export function createMockAction(state, input) {
  const nextAction = action(uid("action"), input.errorId, input.title.trim(), input.type || "Corretiva", "todo", input.priority || "medium", input.assigneeName || "Não atribuído", input.dueDate || dateFromToday(3), input.description || "");
  return { ...state, actions: [...state.actions, nextAction], errors: state.errors.map((item) => item.id === input.errorId ? { ...item, status: "treating" } : item) };
}

export function taskInputFromAction(state, actionItem) {
  const error = state.errors.find((item) => item.id === actionItem.errorId);
  const quote = state.quotes.find((item) => item.id === error?.quoteId);
  const priority = PRIORITIES.some((item) => item.id === actionItem.priority) ? actionItem.priority : "medium";
  return { title: actionItem.title, description: actionItem.description, status: actionItem.status, priority, assigneeName: actionItem.assigneeName, teamName: "Qualidade", dueDate: actionItem.dueDate, sourceType: "quality", sourceId: actionItem.id, sourceCode: error?.code || "QAL", sourceLabel: `${actionItem.type} · Plano de tratamento`, quoteId: error?.quoteId || null, quoteCode: quote?.code || "", quoteTitle: quote?.title || "" };
}

export function moduleStats(state) {
  return { openErrors: state.errors.filter((item) => item.status !== "resolved").length, criticalErrors: state.errors.filter((item) => item.severity === "Alta" && item.status !== "resolved").length, openActions: state.actions.filter((item) => item.status !== "done").length, doneActions: state.actions.filter((item) => item.status === "done").length, statuses: STATUSES };
}
