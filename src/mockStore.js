import { STATUSES } from "./domain.js";

export const STORAGE_KEY = "betinhos-tela-planner-mock-v1";

const dateFromToday = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export function seedState() {
  const quotes = [
    { id: "quote-1008", code: "COT-1008", title: "Transfer executivo · Aeroporto GRU", client: "Grupo Horizonte", status: "Em análise", deadline: dateFromToday(0), value: "R$ 1.280,00" },
    { id: "quote-1007", code: "COT-1007", title: "Van executiva · Evento corporativo", client: "Norte & Sul Eventos", status: "Aguardando fornecedor", deadline: dateFromToday(2), value: "R$ 4.950,00" },
    { id: "quote-1006", code: "COT-1006", title: "Carro blindado · Diretoria", client: "Alvorada Capital", status: "Em análise", deadline: dateFromToday(1), value: "R$ 2.400,00" },
    { id: "quote-1005", code: "COT-1005", title: "Recepção de convidados · Congonhas", client: "Casa 9 Produções", status: "Respondida", deadline: dateFromToday(-1), value: "R$ 860,00" },
  ];
  const tasks = [
    task("task-1", "Preparar proposta comercial", "quote-1008", "COT-1008", "Transfer executivo · Aeroporto GRU", "doing", "high", "Marina Alves", "Comercial", dateFromToday(0), "Revisar composição de preço e confirmar janela de embarque."),
    task("task-2", "Confirmar disponibilidade de veículo", "quote-1007", "COT-1007", "Van executiva · Evento corporativo", "waiting", "medium", "Rafael Lima", "Operação", dateFromToday(2), "Aguardando confirmação do parceiro para a segunda van."),
    task("task-3", "Validar margem da proposta", "quote-1008", "COT-1008", "Transfer executivo · Aeroporto GRU", "todo", "medium", "Camila Torres", "Financeiro", dateFromToday(1), "Validar margem mínima antes de enviar ao cliente.", "task-1"),
    task("task-4", "Selecionar motorista de apoio", "quote-1006", "COT-1006", "Carro blindado · Diretoria", "todo", "high", "João Mendes", "Operação", dateFromToday(1), "Separar duas opções de motorista habilitado.", "task-5"),
    task("task-5", "Montar cotação do carro blindado", "quote-1006", "COT-1006", "Carro blindado · Diretoria", "doing", "high", "Marina Alves", "Comercial", dateFromToday(1), "Compor o valor final com deslocamento e espera."),
    task("task-6", "Registrar resposta enviada", "quote-1005", "COT-1005", "Recepção de convidados · Congonhas", "done", "low", "Camila Torres", "Comercial", dateFromToday(-1), "Resposta enviada e registrada no histórico."),
  ];
  return { quotes, tasks, lastUpdated: new Date().toISOString() };
}

function task(id, title, quoteId, quoteCode, quoteTitle, status, priority, assigneeName, teamName, dueDate, description, parentTaskId = null) {
  return {
    id, title, parentTaskId, quoteId, quoteCode, quoteTitle, status, priority, assigneeName, teamName, dueDate,
    description, labels: [quoteCode], comments: [], attachments: [],
    history: [{ id: uid("history"), text: "Tarefa criada no cenário de demonstração.", createdAt: new Date().toISOString(), author: "Sistema" }],
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : seedState();
  } catch {
    return seedState();
  }
}

export function saveState(state) {
  const next = { ...state, lastUpdated: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function createTask(state, input) {
  const nextTask = {
    id: uid("task"), parentTaskId: input.parentTaskId || null, quoteId: input.quoteId || null,
    quoteCode: input.quoteCode || "", quoteTitle: input.quoteTitle || "Sem vínculo", title: input.title.trim(),
    status: input.status || STATUSES[0].id, priority: input.priority || "medium", assigneeName: input.assigneeName || "Não atribuído",
    teamName: input.teamName || "Operação", dueDate: input.dueDate || "", description: input.description || "",
    labels: input.quoteCode ? [input.quoteCode] : [], comments: [], attachments: [],
    history: [{ id: uid("history"), text: "Tarefa criada no mock.", createdAt: new Date().toISOString(), author: "Você" }],
  };
  return saveState({ ...state, tasks: [...state.tasks, nextTask] });
}

export function updateTask(state, id, patch) {
  return saveState({ ...state, tasks: state.tasks.map((taskItem) => taskItem.id === id ? {
    ...taskItem, ...patch,
    history: patch.status && patch.status !== taskItem.status
      ? [...taskItem.history, { id: uid("history"), text: `Status alterado para ${STATUSES.find((item) => item.id === patch.status)?.label || patch.status}.`, createdAt: new Date().toISOString(), author: "Você" }]
      : taskItem.history,
  } : taskItem) });
}

export function addComment(state, id, text) {
  const comment = { id: uid("comment"), text: text.trim(), createdAt: new Date().toISOString(), author: "Você" };
  return saveState({ ...state, tasks: state.tasks.map((taskItem) => taskItem.id === id ? { ...taskItem, comments: [...taskItem.comments, comment] } : taskItem) });
}

export function addAttachment(state, id, name) {
  const attachment = { id: uid("file"), name, createdAt: new Date().toISOString() };
  return saveState({ ...state, tasks: state.tasks.map((taskItem) => taskItem.id === id ? { ...taskItem, attachments: [...taskItem.attachments, attachment] } : taskItem) });
}

export function ensureQuoteTask(state, quote) {
  const existing = state.tasks.find((taskItem) => taskItem.quoteId === quote.id && !taskItem.parentTaskId);
  if (existing) return state;
  return createTask(state, { title: `Acompanhar ${quote.code}`, quoteId: quote.id, quoteCode: quote.code, quoteTitle: quote.title, dueDate: quote.deadline, priority: "medium", assigneeName: "Não atribuído", teamName: "Comercial", description: `Acompanhar a cotação ${quote.code} até a resposta ao cliente.` });
}

export function resetState() {
  const next = seedState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
