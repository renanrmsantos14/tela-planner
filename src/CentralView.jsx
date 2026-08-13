import React, { useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, CheckCircle2, Clock3, Search, Users } from "lucide-react";
import { formatDate } from "./domain";
import { filterWorkItems, sortWorkItems, workItemStats } from "./workItems";

const SOURCE_LABELS = { task: "Tarefa", quote_followup: "Acompanhamento de cotação", quality_error: "Ocorrência", quality_action: "Ação de qualidade" };

function SourceBadge({ source }) { return <span className={`source-badge source-${source === "task" ? "neutral" : source === "quote_followup" ? "action" : "warning"}`}>{SOURCE_LABELS[source] || source}</span>; }

export default function CentralView({ state, onOpenTask, onOpenSource, onCreate, onTransition, mineOnly = false }) {
  const [filters, setFilters] = useState({ query: "", source: "all", assignee: "all", statusGroup: "all" });
  const currentUserId = String(window.parent?.Xrm?.Utility?.getGlobalContext?.().userSettings?.userId || window.Xrm?.Utility?.getGlobalContext?.().userSettings?.userId || "").replace(/[{}]/g, "").toLowerCase();
  const currentEmployee = (state.employees || []).find((employee) => String(employee.userId || "").replace(/[{}]/g, "").toLowerCase() === currentUserId);
  const scopedItems = mineOnly && currentEmployee ? (state.workItems || []).filter((item) => item.assigneeEmployeeId === currentEmployee.id || item.assigneeName === currentEmployee.name) : (state.workItems || []);
  const items = useMemo(() => sortWorkItems(filterWorkItems(scopedItems, filters)), [scopedItems, filters]);
  const stats = useMemo(() => workItemStats(state.workItems || []), [state.workItems]);
  const assignees = useMemo(() => [...new Map((state.employees || []).map((employee) => [employee.id || employee.name, employee])).values()], [state.employees]);
  const open = (item) => item.source === "task" || item.source === "quote_followup" ? onOpenTask(item.sourceRecordId) : onOpenSource(item);
  return <div className="page-content">
    <PageHeader title="Central de Trabalho" description="Minhas pendências e os prazos que movem a operação administrativa." onCreate={onCreate} />
    <div className="metric-grid"><Metric label="Pendências abertas" value={stats.open} icon={CheckCircle2} /><Metric label="Atrasadas" value={stats.overdue} icon={Clock3} tone="danger" /><Metric label="Em andamento" value={stats.doing} icon={ArrowUpRight} tone="action" /><Metric label="Aguardando" value={stats.waiting} icon={Users} tone="warning" /></div>
    <section className="panel central-panel"><div className="panel-heading"><div><span className="eyebrow">MINHAS PENDÊNCIAS</span><h2>Próximos movimentos</h2></div><span className="panel-count">{items.length}</span></div>
      <div className="central-filters"><label className="search-field"><Search size={16} /><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Buscar por tarefa, origem ou responsável" /></label><select value={filters.source} onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))}><option value="all">Todas as origens</option><option value="task">Tarefas</option><option value="quote_followup">Acompanhamentos</option><option value="quality_error">Ocorrências</option><option value="quality_action">Ações</option></select><select value={filters.assignee} onChange={(event) => setFilters((current) => ({ ...current, assignee: event.target.value }))}><option value="all">Toda a equipe</option>{assignees.map((employee) => <option value={employee.id || employee.name} key={employee.id || employee.name}>{employee.name}</option>)}</select></div>
      <div className="central-list">{items.map((item) => <button className="central-row" key={item.id} onClick={() => open(item)}><div className="central-row-main"><SourceBadge source={item.source} /><strong>{item.title}</strong><span>{item.context}</span></div><div className="central-row-meta"><span><Users size={13} />{item.assigneeName}</span><span className={item.isOverdue ? "danger-text" : ""}><CalendarDays size={13} />{formatDate(item.dueAt)}</span><span className={`central-status central-${item.statusGroup}`}>{item.sourceStatus || item.statusGroup}</span>{item.source === "task" || item.source === "quote_followup" ? <span className="central-quick-actions">{item.statusGroup !== "doing" && <span role="button" tabIndex="0" onClick={(event) => { event.stopPropagation(); onTransition?.(item.sourceRecordId, "doing"); }}>Iniciar</span>}{item.statusGroup !== "waiting" && <span role="button" tabIndex="0" onClick={(event) => { event.stopPropagation(); onTransition?.(item.sourceRecordId, "waiting"); }}>Aguardar</span>}</span> : null}<ArrowUpRight size={16} /></div></button>)}{!items.length && <div className="empty-inline">Nenhuma pendência encontrada com estes filtros.</div>}</div>
    </section>
  </div>;
}

function PageHeader({ title, description, onCreate }) { return <div className="page-header"><div><span className="eyebrow">OPERAÇÃO ADMINISTRATIVA</span><h1>{title}</h1><p>{description}</p></div><button className="button button-primary" onClick={onCreate}>Nova tarefa</button></div>; }
function Metric({ label, value, icon: Icon, tone = "neutral" }) { return <div className={`metric-card metric-${tone}`}><div className="metric-icon"><Icon size={18} /></div><div><span>{label}</span><strong>{value}</strong><small>na Central</small></div></div>; }
