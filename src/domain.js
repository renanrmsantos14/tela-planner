export const STATUSES = [
  { id: "todo", label: "A fazer", tone: "neutral" },
  { id: "doing", label: "Em andamento", tone: "action" },
  { id: "waiting", label: "Aguardando", tone: "warning" },
  { id: "done", label: "Concluído", tone: "success" },
];

export const PRIORITIES = [
  { id: "high", label: "Alta", tone: "danger" },
  { id: "medium", label: "Média", tone: "warning" },
  { id: "low", label: "Baixa", tone: "neutral" },
];

export const QUOTE_STATUSES = ["Nova", "Em análise", "Aguardando fornecedor", "Respondida"];

export const statusById = (id) => STATUSES.find((item) => item.id === id) || STATUSES[0];
export const priorityById = (id) => PRIORITIES.find((item) => item.id === id) || PRIORITIES[1];

export function isOverdue(task, today = new Date()) {
  if (!task.dueDate || task.status === "done") return false;
  return new Date(`${task.dueDate}T23:59:59`) < today;
}

export function isDueToday(task, today = new Date()) {
  if (!task.dueDate || task.status === "done") return false;
  const date = new Date(`${task.dueDate}T12:00:00`);
  return date.toDateString() === today.toDateString();
}

export function formatDate(value) {
  if (!value) return "Sem prazo";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" })
    .format(new Date(`${value}T12:00:00`))
    .replace(" de ", " ");
}

export function formatLongDate(value) {
  if (!value) return "Sem prazo definido";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}

export function filterTasks(tasks, filters) {
  const query = filters.query.trim().toLowerCase();
  return tasks.filter((task) => {
    const matchesQuery = !query || [task.title, task.quoteTitle, task.assigneeName, task.teamName]
      .some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus = !filters.status || task.status === filters.status;
    const matchesPriority = !filters.priority || task.priority === filters.priority;
    return matchesQuery && matchesStatus && matchesPriority;
  });
}

export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (a.status !== "done" && b.status === "done") return -1;
    return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
  });
}

export function taskStats(tasks, today = new Date()) {
  return {
    open: tasks.filter((task) => task.status !== "done").length,
    overdue: tasks.filter((task) => isOverdue(task, today)).length,
    today: tasks.filter((task) => isDueToday(task, today)).length,
    waiting: tasks.filter((task) => task.status === "waiting").length,
  };
}
