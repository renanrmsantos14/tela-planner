const STATUS_LABELS = { todo: "A fazer", waiting: "Aguardando", doing: "Em andamento", done: "Concluído" };

function parseObject(value) {
  if (value && typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return null; }
}

function dateLabel(value) {
  if (!value) return "Sem prazo";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("pt-BR");
}

function names(value, employees) {
  const list = Array.isArray(value) ? value : parseObject(value);
  if (!Array.isArray(list)) return String(value || "Sem responsável");
  return list.map((entry) => employees.find((employee) => employee.id === entry || employee.userId === entry)?.name || entry).join(", ") || "Sem responsável";
}

export function taskHistoryDetails(item, employees = []) {
  const field = item.field || "";
  const previous = item.previousValue;
  const next = item.nextValue;
  if (field === "status" || field === "quoteStatus") return {
    title: field === "status" ? "Status alterado" : "Etapa da cotação alterada",
    before: previous ? STATUS_LABELS[previous] || previous : "Não informado",
    after: next ? STATUS_LABELS[next] || next : "Não informado",
  };
  if (field === "dueDate" || field === "notification:deadline") {
    const context = parseObject(next);
    return { title: "Prazo alterado", before: dateLabel(previous), after: dateLabel(context?.nextDueDate ?? next), detail: context?.reason ? `Motivo: ${context.reason}` : "" };
  }
  if (field === "assignees" || field === "notification:assignees") {
    const context = parseObject(next);
    const previousIds = parseObject(previous);
    if (context && !Array.isArray(context)) {
      const added = names(context.addedAssigneeIds || [], employees);
      const removed = names(context.removedAssigneeIds || [], employees);
      return { title: "Responsáveis alterados", detail: [added !== "Sem responsável" ? `Adicionados: ${added}` : "", removed !== "Sem responsável" ? `Removidos: ${removed}` : ""].filter(Boolean).join(" · ") || "Atribuição atualizada." };
    }
    return { title: "Responsáveis alterados", before: names(previousIds || previous, employees), after: names(next, employees) };
  }
  if (field === "waitingContext") return { title: "Contexto de aguardando", detail: item.text || "Contexto atualizado." };
  return { title: item.text || "Alteração registrada" };
}

export function visibleTaskHistory(history) {
  return (history || []).filter((item) => !String(item.field || "").startsWith("notification:") || ["notification:deadline", "notification:assignees"].includes(item.field))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}
