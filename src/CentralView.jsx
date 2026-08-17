import React, { useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, CheckCircle2, Clock3, RotateCcw, Search, Users } from "lucide-react";
import { formatDate } from "./domain";
import SearchableSelect from "./SearchableSelect.jsx";
import { filterWorkItems, sortWorkItems, workItemStats } from "./workItems";

const SOURCE_LABELS = { task: "Tarefa", quote_followup: "Acompanhamento de cotação", quality_error: "Ocorrência", quality_action: "Ação de qualidade" };
const STATUS_LABELS = { todo: "A fazer", doing: "Em andamento", waiting: "Aguardando", done: "Concluído", cancelled: "Cancelado" };
const SOURCE_OPTIONS = [
  { value: "all", label: "Todas as origens" },
  { value: "task", label: "Tarefas" },
  { value: "quote_followup", label: "Acompanhamentos" },
  { value: "quality_error", label: "Ocorrências" },
  { value: "quality_action", label: "Ações" },
];

function SourceBadge({ source }) {
  return <span className={`source-badge source-${source === "task" ? "neutral" : source === "quote_followup" ? "action" : "warning"}`}>{SOURCE_LABELS[source] || "Origem"}</span>;
}

function hasActiveFilters(filters) {
  return Boolean(filters.query.trim()) || filters.source !== "all" || filters.assignee !== "all" || filters.statusGroup !== "all";
}

export default function CentralView({ state, mode = "mine", currentEmployee, onOpenTask, onOpenSource, onCreate }) {
  const [filters, setFilters] = useState({ query: "", source: "all", assignee: "all", statusGroup: "all" });
  const mineOnly = mode === "mine";
  const allItems = state.workItems || [];
  const scopedItems = mineOnly
    ? currentEmployee
      ? allItems.filter((item) => item.assigneeEmployeeId === currentEmployee.id || item.assigneeName === currentEmployee.name)
      : []
    : allItems;
  const activeItems = useMemo(() => filterWorkItems(scopedItems), [scopedItems]);
  const items = useMemo(() => sortWorkItems(filterWorkItems(scopedItems, filters)), [scopedItems, filters]);
  const stats = useMemo(() => workItemStats(activeItems), [activeItems]);
  const assignees = useMemo(() => [...new Map((state.employees || []).map((employee) => [employee.id || employee.name, employee])).values()], [state.employees]);
  const assigneeOptions = useMemo(() => [{ value: "all", label: "Toda a equipe" }, ...assignees.map((employee) => ({ value: employee.id || employee.name, label: employee.name }))], [assignees]);
  const open = (item) => item.source === "task" || item.source === "quote_followup" ? onOpenTask(item.sourceRecordId) : onOpenSource(item);
  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const clearFilters = () => setFilters({ query: "", source: "all", assignee: "all", statusGroup: "all" });
  const emptyMessage = !currentEmployee && mineOnly
    ? { title: "Usuário sem vínculo", detail: "Seu usuário Dataverse ainda não está associado a um funcionário administrativo." }
    : !activeItems.length
      ? { title: "Nenhuma pendência ativa", detail: "Quando surgir uma nova obrigação, ela aparecerá aqui." }
      : { title: "Nenhum resultado", detail: "Tente remover um filtro ou buscar por outro termo." };

  return <div className="page-content">
    <PageHeader mode={mode} onCreate={onCreate} />
    <div className="metric-grid central-metrics"><Metric label="Pendências abertas" value={stats.open} icon={CheckCircle2} /><Metric label="Atrasadas" value={stats.overdue} icon={Clock3} tone="danger" /><Metric label="Em andamento" value={stats.doing} icon={ArrowUpRight} tone="action" /><Metric label="Aguardando" value={stats.waiting} icon={Users} tone="warning" /></div>
    <section className="panel central-panel">
      <div className="panel-heading"><div><span className="eyebrow">{mineOnly ? "MINHAS PENDÊNCIAS" : "EQUIPE ADMINISTRATIVA"}</span><h2>{mineOnly ? "Próximos movimentos" : "Pendências da equipe"}</h2></div><span className="panel-count">{items.length}</span></div>
      <div className="central-filters" role="search" aria-label="Filtros de pendências">
        <label className="search-field"><span className="sr-only">Buscar pendências</span><Search size={16} aria-hidden="true" /><input value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} placeholder="Buscar por tarefa, origem ou responsável" /></label>
        <label className="central-filter"><span>Origem</span><SearchableSelect value={filters.source} onChange={(value) => updateFilter("source", value)} clearable={false} aria-label="Origem" options={SOURCE_OPTIONS} /></label>
        <label className="central-filter"><span>Responsável</span><SearchableSelect value={filters.assignee} onChange={(value) => updateFilter("assignee", value)} clearable={false} aria-label="Responsável" options={assigneeOptions} /></label>
        {hasActiveFilters(filters) && <button className="button button-quiet central-clear" type="button" onClick={clearFilters}><RotateCcw size={14} />Limpar filtros</button>}
      </div>
      {items.length > 0 && <div className="central-table-head" aria-hidden="true"><span>Item</span><span>Responsável</span><span>Prazo</span><span>Status</span><span>Ações</span></div>}
      <div className="central-list">
        {items.map((item) => <CentralRow key={item.id} item={item} onOpen={open} />)}
        {!items.length && <div className="central-empty"><strong>{emptyMessage.title}</strong><span>{emptyMessage.detail}</span>{hasActiveFilters(filters) && <button className="button button-secondary" type="button" onClick={clearFilters}>Limpar filtros</button>}</div>}
      </div>
    </section>
  </div>;
}

function CentralRow({ item, onOpen }) {
  const statusLabel = item.statusLabel || STATUS_LABELS[item.statusGroup] || item.sourceStatus || "A fazer";
  return <article className="central-row">
    <button className="central-row-open" type="button" onClick={() => onOpen(item)} aria-label={`Abrir ${item.title}`}>
      <div className="central-row-main"><SourceBadge source={item.source} /><strong>{item.title}</strong><span>{item.context}</span></div>
      <div className="central-row-meta"><span><Users size={13} aria-hidden="true" />{item.assigneeName}</span><span className={item.isOverdue ? "danger-text" : ""}><CalendarDays size={13} aria-hidden="true" />{formatDate(item.dueAt)}</span><span className={`central-status central-${item.statusGroup}`}>{statusLabel}</span><ArrowUpRight size={16} aria-hidden="true" /></div>
    </button>
  </article>;
}

function PageHeader({ mode, onCreate }) {
  const mine = mode === "mine";
  return <div className="page-header"><div><span className="eyebrow">OPERAÇÃO ADMINISTRATIVA</span><h1>{mine ? "Minhas pendências" : "Equipe"}</h1><p>{mine ? "Veja o que precisa da sua atenção e qual é o próximo movimento." : "Acompanhe atrasos, responsáveis e obrigações da equipe."}</p></div><button className="button button-primary" onClick={onCreate}>Nova tarefa</button></div>;
}

function Metric({ label, value, icon: Icon, tone = "neutral" }) {
  return <div className={`metric-card metric-${tone}`}><div className="metric-icon"><Icon size={18} /></div><div><span>{label}</span><strong>{value}</strong></div></div>;
}
