import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, ArrowUpRight, CalendarDays, Check, CheckCircle2, ChevronRight, CircleHelp, ClipboardList,
  Clock3, FileText, Filter, LayoutDashboard, ListFilter, Menu, MessageCircle, Paperclip, PanelLeftClose,
  PanelLeftOpen, Plus, RotateCcw, Search, Settings, ShieldAlert, Sparkles, Target, UserRound, Users, X,
} from "lucide-react";
import { filterTasks, formatDate, formatLongDate, isBlocked, isDueToday, isOverdue, PRIORITIES, sortTasks, sourceById, STATUSES, statusById, TASK_SOURCES, taskStats } from "./domain";
import { createDataStore } from "./dataverse";
import SearchableSelect from "./SearchableSelect.jsx";

const navItems = [
  ["dashboard", "Visão geral", LayoutDashboard], ["board", "Quadro", ClipboardList], ["list", "Lista operacional", ListFilter], ["calendar", "Agenda", CalendarDays], ["quality", "Qualidade", ShieldAlert], ["settings", "Configurações", Settings],
];
const STATUS_OPTIONS = STATUSES.map((item) => ({ value: item.id, label: item.label }));
const PRIORITY_OPTIONS = PRIORITIES.map((item) => ({ value: item.id, label: item.label }));
const SOURCE_OPTIONS = TASK_SOURCES.map((item) => ({ value: item.id, label: item.label }));
const ASSIGNEE_OPTIONS = ["Não atribuído", "Marina Alves", "Rafael Lima", "Camila Torres", "João Mendes"];
const TEAM_OPTIONS = ["Comercial", "Operação", "Financeiro"];
const CALENDAR_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });

function Avatar({ name = "Sistema", small = false }) {
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <span className={`avatar ${small ? "avatar-small" : ""}`} title={name}>{initials}</span>;
}

function StatusBadge({ status }) {
  const item = statusById(status);
  return <span className={`badge badge-${item.tone}`}><span className="badge-dot" />{item.label}</span>;
}

function PriorityBadge({ priority }) {
  const item = PRIORITIES.find((entry) => entry.id === priority) || PRIORITIES[1];
  return <span className={`priority priority-${item.tone}`}>{item.label}</span>;
}

function SourceBadge({ sourceType }) {
  const item = sourceById(sourceType);
  return <span className={`source-badge source-${item.tone}`}>{item.label}</span>;
}

function InputSelect({ value, onChange, options, placeholder = "Selecione", disabled = false }) {
  return <SearchableSelect value={value} onChange={onChange} disabled={disabled} placeholder={placeholder} options={options.map((option) => typeof option === "string" ? { value: option, label: option } : option)} />;
}

function AppShell({ active, onNavigate, children, onCreate, tasks }) {
  const [expanded, setExpanded] = useState(true);
  const stats = taskStats(tasks);
  const todayLabel = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date()).replace(".", "");
  return <div className={`app-shell ${expanded ? "" : "sidebar-collapsed"}`}>
    <aside className="sidebar">
      <button className="sidebar-toggle" type="button" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? "Recolher navegação" : "Expandir navegação"} title={expanded ? "Recolher navegação" : "Expandir navegação"}>
        {expanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>
      <div className="brand-block"><div className="brand-mark"><ClipboardList size={20} /></div><div className="brand-copy"><strong>Tela Planner</strong><span>Operação Betinhos</span></div></div>
      <div className="sidebar-day-card" aria-label={`Hoje, ${stats.open} pendências e ${stats.overdue} atrasados`}><div className="sidebar-day-title"><span>Hoje</span><strong>{todayLabel}</strong></div><div className="sidebar-day-stats"><span className="sidebar-day-stat"><strong>{stats.open}</strong><small>Pendências</small></span><span className="sidebar-day-stat sidebar-day-stat-overdue"><strong>{stats.overdue}</strong><small>Atrasados</small></span></div></div>
      <nav className="main-nav">{navItems.map(([id, label, Icon]) => <button key={id} className={active === id ? "nav-item active" : "nav-item"} onClick={() => onNavigate(id)}><Icon size={18} /><span>{label}</span>{id === "board" && <span className="nav-count">12</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="mock-label"><span className="pulse-dot" />Modo demonstração</div><div className="user-card"><Avatar name="Renan Santos" /><div className="user-copy"><strong>Renan Santos</strong><span>Administrador</span></div><button className="user-settings-button" type="button" onClick={() => onNavigate("settings")} aria-label="Abrir configurações" title="Configurações"><Settings size={15} /></button></div></div>
    </aside>
    <main className="main-area"><header className="mobile-header"><button className="icon-button" onClick={() => setExpanded((value) => !value)} aria-label="Abrir navegação" title="Abrir navegação"><Menu size={20} /></button><strong>Tela Planner</strong><Avatar name="Renan Santos" small /></header>{children}</main>
    <button className="mobile-fab" onClick={onCreate}><Plus size={22} /></button>
  </div>;
}

function PageHeader({ eyebrow, title, description, action, children }) {
  return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div><div className="header-actions">{children}{action}</div></div>;
}

function MetricCard({ label, value, detail, tone = "neutral", icon: Icon }) {
  return <div className={`metric-card metric-${tone}`}><div className="metric-icon"><Icon size={18} /></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>;
}

function TaskCard({ task: taskItem, onOpen, compact = false, onDrop }) {
  const overdue = isOverdue(taskItem);
  return <article className={`task-card ${compact ? "task-card-compact" : ""} ${overdue ? "task-overdue" : ""}`} draggable tabIndex="0" onDragStart={(event) => event.dataTransfer.setData("text/task-id", taskItem.id)} onClick={() => onOpen(taskItem.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(taskItem.id); } }}>
    <div className="task-card-top"><PriorityBadge priority={taskItem.priority} />{overdue && <span className="overdue-label">Vencida</span>}<button className="card-open" onClick={(event) => { event.stopPropagation(); onOpen(taskItem.id); }} aria-label="Abrir tarefa"><ArrowUpRight size={15} /></button></div>
    <h3>{taskItem.title}</h3>
    {taskItem.quoteId && <div className="task-link"><FileText size={13} /><span>{taskItem.quoteCode}</span><em>{taskItem.quoteTitle}</em></div>}
    {(taskItem.sourceType || taskItem.quoteId) && <div className="task-source-row"><SourceBadge sourceType={taskItem.sourceType || (taskItem.quoteId ? "quote" : "manual")} /><span>{taskItem.sourceCode || taskItem.quoteCode}</span><em>{taskItem.sourceLabel || taskItem.quoteTitle}</em></div>}
    {isBlocked(taskItem) && <div className="blocked-note"><CircleHelp size={13} />Bloqueada: {taskItem.blockedReason}</div>}
    {!compact && <p className="task-description">{taskItem.description}</p>}
    <div className="task-card-footer"><div className="task-owner"><Avatar name={taskItem.assigneeName} small /><span>{taskItem.assigneeName}</span></div><span className={overdue ? "date-chip overdue" : "date-chip"}><Clock3 size={13} />{formatDate(taskItem.dueDate)}</span></div>
    {taskItem.parentTaskId && <div className="subtask-mark"><CheckCircle2 size={13} />Subtarefa</div>}
  </article>;
}

function Board({ tasks, onOpen, onMove }) {
  return <div className="board-grid">{STATUSES.map((status) => { const items = tasks.filter((taskItem) => taskItem.status === status.id); return <section className="board-column" key={status.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = event.dataTransfer.getData("text/task-id"); if (id) onMove(id, status.id); }}><div className="column-header"><div><span className={`column-marker marker-${status.tone}`} /><h2>{status.label}</h2><span className="column-count">{items.length}</span></div><button className="icon-button"><Plus size={16} /></button></div><div className="column-body">{items.map((taskItem) => <TaskCard key={taskItem.id} task={taskItem} onOpen={onOpen} />)}{!items.length && <div className="drop-placeholder"><Plus size={17} /><span>Arraste tarefas para cá</span></div>}</div></section>; })}</div>;
}

function FilterBar({ filters, setFilters, onCreate }) {
  return <div className="filter-bar"><div className="search-field"><Search size={16} /><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Buscar tarefas, cotações, qualidade ou pessoas" /></div><InputSelect value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} placeholder="Todos os status" options={[{ value: "", label: "Todos os status" }, ...STATUS_OPTIONS]} /><InputSelect value={filters.priority} onChange={(value) => setFilters((current) => ({ ...current, priority: value }))} placeholder="Todas as prioridades" options={[{ value: "", label: "Todas as prioridades" }, ...PRIORITY_OPTIONS]} /><InputSelect value={filters.source} onChange={(value) => setFilters((current) => ({ ...current, source: value }))} placeholder="Todas as origens" options={[{ value: "", label: "Todas as origens" }, ...SOURCE_OPTIONS]} /><button className={`button ${filters.blocked ? "button-secondary" : "button-quiet"}`} onClick={() => setFilters((current) => ({ ...current, blocked: !current.blocked }))}><CircleHelp size={15} />Bloqueadas</button><button className="button button-primary" onClick={onCreate}><Plus size={16} />Nova tarefa</button></div>;
}

function Dashboard({ state, onNavigate, onOpen, onCreate, onRefresh }) {
  const stats = useMemo(() => taskStats(state.tasks), [state.tasks]);
  const dueSoon = useMemo(() => sortTasks(state.tasks.filter((taskItem) => taskItem.status !== "done")).slice(0, 4), [state.tasks]);
  const quotesInAnalysis = useMemo(() => state.quotes.filter((quote) => quote.status === "Em análise"), [state.quotes]);
  return <div className="page-content"><PageHeader eyebrow="Visão operacional" title="Bom dia, Renan" description="Aqui está o que precisa da sua atenção hoje." action={<button className="button button-primary" onClick={onCreate}><Plus size={16} />Nova tarefa</button>}><button className="button button-quiet" onClick={onRefresh}><Sparkles size={15} />Atualizar mock</button></PageHeader><div className="metric-grid"><MetricCard label="Tarefas em aberto" value={stats.open} detail="no quadro central" tone="navy" icon={ClipboardList} /><MetricCard label="Vencidas" value={stats.overdue} detail="precisam de atenção" tone="danger" icon={AlertCircle} /><MetricCard label="Para hoje" value={stats.today} detail="com prazo neste dia" tone="action" icon={Clock3} /><MetricCard label="Aguardando" value={stats.waiting} detail="dependem de retorno" tone="warning" icon={CircleHelp} /></div><div className="dashboard-grid"><section className="panel priority-panel"><div className="panel-heading"><div><span className="eyebrow">Prioridades</span><h2>Próximos movimentos</h2></div><button className="text-button" onClick={() => onNavigate("list")}>Ver lista <ArrowUpRight size={14} /></button></div><div className="priority-list">{dueSoon.map((taskItem) => <button className="priority-row" key={taskItem.id} onClick={() => onOpen(taskItem.id)}><div className={`priority-bar ${isOverdue(taskItem) ? "bar-danger" : ""}`} /><div className="priority-main"><strong>{taskItem.title}</strong><span>{taskItem.quoteCode} · {taskItem.assigneeName}</span></div><StatusBadge status={taskItem.status} /><span className={isOverdue(taskItem) ? "priority-date danger-text" : "priority-date"}>{formatDate(taskItem.dueDate)}</span><ChevronRight size={16} /></button>)}</div></section><section className="panel quote-panel"><div className="panel-heading"><div><span className="eyebrow">Automação simulada</span><h2>Cotações em análise</h2></div><span className="panel-count">{quotesInAnalysis.length}</span></div><p className="panel-copy">Quando uma cotação entra em análise, o Planner cria a tarefa principal para a equipe.</p><div className="quote-list">{quotesInAnalysis.map((quote) => { const linked = state.tasks.some((taskItem) => taskItem.quoteId === quote.id && !taskItem.parentTaskId); return <div className="quote-row" key={quote.id}><div className="quote-icon"><FileText size={16} /></div><div><strong>{quote.code}</strong><span>{quote.title}</span></div>{linked ? <span className="linked-label"><Check size={14} />Tarefa criada</span> : <button className="small-button" onClick={() => onRefresh(quote)}>Simular criação</button>}</div>; })}</div></section></div></div>;
}

function BoardView({ state, onOpen, onMove, onCreate, filters, setFilters }) {
  const filtered = useMemo(() => sortTasks(filterTasks(state.tasks.filter((taskItem) => !taskItem.parentTaskId), filters)), [state.tasks, filters]);
  const tasksByStatus = useMemo(() => Object.fromEntries(STATUSES.map((status) => [status.id, filtered.filter((taskItem) => taskItem.status === status.id)])), [filtered]);
  return <div className="page-content"><PageHeader eyebrow="Quadro central" title="Operação em movimento" description="Arraste os cartões para atualizar o andamento das tarefas." action={<button className="button button-primary" onClick={onCreate}><Plus size={16} />Nova tarefa</button>}><button className="button button-quiet" type="button" disabled title="Os filtros já estão visíveis abaixo"><Filter size={15} />Filtros</button></PageHeader><FilterBar filters={filters} setFilters={setFilters} onCreate={onCreate} /><Board tasks={filtered} onOpen={onOpen} onMove={onMove} /><div className="mobile-board-list">{STATUSES.map((status) => <section className="mobile-status-group" key={status.id}><div className="mobile-status-heading"><span className={`column-marker marker-${status.tone}`} /><h2>{status.label}</h2><span className="column-count">{tasksByStatus[status.id].length}</span></div>{tasksByStatus[status.id].map((taskItem) => <TaskCard key={taskItem.id} task={taskItem} onOpen={onOpen} compact />)}</section>)}</div></div>;
}

function ListView({ state, onOpen, onCreate, filters, setFilters }) {
  const filtered = useMemo(() => sortTasks(filterTasks(state.tasks, filters)), [state.tasks, filters]);
  return <div className="page-content"><PageHeader eyebrow="Gestão de tarefas" title="Lista operacional" description="Encontre rapidamente o próximo responsável por cada tarefa." action={<button className="button button-primary" onClick={onCreate}><Plus size={16} />Nova tarefa</button>} /><FilterBar filters={filters} setFilters={setFilters} onCreate={onCreate} /><section className="panel task-table"><div className="table-header"><span>Tarefa</span><span>Vínculo</span><span>Responsável</span><span>Prazo</span><span>Status</span></div>{filtered.map((taskItem) => <button className="table-row" key={taskItem.id} onClick={() => onOpen(taskItem.id)}><div className="table-task"><span className={`table-status status-${taskItem.status}`} /><strong>{taskItem.title}</strong></div><span>{taskItem.quoteCode || "—"}</span><div className="table-person"><Avatar name={taskItem.assigneeName} small />{taskItem.assigneeName}</div><span className={isOverdue(taskItem) ? "danger-text" : ""}>{formatDate(taskItem.dueDate)}</span><StatusBadge status={taskItem.status} /></button>)}</section></div>;
}

function CalendarView({ state, onOpen, onCreate }) {
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() + index - 1); return date; });
  const openTasks = useMemo(() => sortTasks(state.tasks.filter((taskItem) => taskItem.status !== "done")), [state.tasks]);
  return <div className="page-content"><PageHeader eyebrow="Prazos e ritmo" title="Agenda operacional" description="Uma visão simples dos compromissos que movem a operação." action={<button className="button button-primary" onClick={onCreate}><Plus size={16} />Novo prazo</button>} /><div className="calendar-strip">{days.map((date) => <div className={`calendar-day ${date.toDateString() === new Date().toDateString() ? "today" : ""}`} key={date.toISOString()}><span>{CALENDAR_WEEKDAY_FORMATTER.format(date).replace(".", "")}</span><strong>{date.getDate()}</strong></div>)}</div><section className="panel agenda-panel"><div className="panel-heading"><div><span className="eyebrow">Esta semana</span><h2>O que acontece em seguida</h2></div></div>{openTasks.map((taskItem) => <button className="agenda-row" key={taskItem.id} onClick={() => onOpen(taskItem.id)}><span className="agenda-time">{formatDate(taskItem.dueDate)}</span><div className="agenda-line" /><div className="agenda-info"><strong>{taskItem.title}</strong><span>{taskItem.quoteCode} · {taskItem.assigneeName}</span></div><StatusBadge status={taskItem.status} /><ChevronRight size={16} /></button>)}</section></div>;
}

function QualityView({ state, onCreate }) {
  const quality = state.quality || [];
  return <div className="page-content"><PageHeader eyebrow="Origem operacional" title="Qualidade" description="Transforme erros e ações operacionais em tarefas do Planner interno." /><section className="panel task-table"><div className="table-header"><span>Registro</span><span>Tipo</span><span>Prazo</span><span>Status</span><span>Ação</span></div>{quality.map((item) => { const linked = state.tasks.some((taskItem) => taskItem.sourceId === item.id); return <div className="table-row" key={`${item.type}-${item.id}`}><div className="table-task"><span className="table-status status-waiting" /><strong>{item.code ? `${item.code} · ` : ""}{item.title}</strong></div><span>{item.type === "error" ? "Erro operacional" : "Ação operacional"}</span><span>{formatDate(item.dueDate)}</span><span>{item.status || "Ativo"}</span>{linked ? <span className="linked-label">Tarefa criada</span> : <button className="small-button" onClick={() => onCreate(item)}>Criar tarefa</button>}</div>; })}{!quality.length && <div className="empty-inline">Nenhum erro ou ação operacional disponível.</div>}</section></div>;
}

function SettingsView({ onReset }) {
  return <div className="page-content"><PageHeader eyebrow="Ambiente de demonstração" title="Configurações" description="Controles do protótipo local antes da integração com o Dataverse." /><section className="settings-grid"><div className="panel setting-card"><div className="setting-icon"><RotateCcw size={19} /></div><div><h2>Restaurar cenário inicial</h2><p>Apaga as alterações locais e repõe as cotações, tarefas e subtarefas sintéticas.</p><button className="button button-secondary" onClick={onReset}><RotateCcw size={15} />Restaurar mock</button></div></div><div className="panel setting-card"><div className="setting-icon setting-icon-blue"><Target size={19} /></div><div><h2>Próxima etapa</h2><p>Depois da aprovação visual, o adaptador local será substituído por consultas reais do Dataverse.</p><span className="status-note"><span className="pulse-dot" />Mock ativo · sem conexões externas</span></div></div></section></div>;
}

function TaskDrawer({ task: taskItem, state, onClose, onSave, onComment, onAttachment, onOpenQuote, onAddSubtask }) {
  const [form, setForm] = useState(taskItem ? { ...taskItem } : null); const [comment, setComment] = useState("");
  useEffect(() => { setForm(taskItem ? { ...taskItem } : null); setComment(""); }, [taskItem]);
  if (!taskItem || !form) return null;
  const subtasks = state.tasks.filter((item) => item.parentTaskId === taskItem.id); const history = [...(taskItem.history || [])].reverse();
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return <div className="drawer-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="task-drawer"><header className="drawer-header"><div><span className="eyebrow">Detalhe da tarefa</span><span className="drawer-code">{taskItem.quoteCode || "TAREFA"}</span></div><button className="icon-button" onClick={onClose} aria-label="Fechar detalhe"><X size={19} /></button></header><div className="drawer-body"><div className="drawer-title"><input value={form.title} onChange={(event) => set("title", event.target.value)} aria-label="Título da tarefa" /><PriorityBadge priority={form.priority} /></div>{taskItem.quoteId && <button className="linked-record" onClick={() => onOpenQuote(taskItem.quoteId)}><FileText size={16} /><span><small>Cotação vinculada</small><strong>{taskItem.quoteCode} · {taskItem.quoteTitle}</strong></span><ArrowUpRight size={15} /></button>}<div className="drawer-field-grid"><label>Status<InputSelect value={form.status} onChange={(value) => set("status", value)} options={STATUS_OPTIONS} /></label><label>Prioridade<InputSelect value={form.priority} onChange={(value) => set("priority", value)} options={PRIORITY_OPTIONS} /></label><label>Responsável<InputSelect value={form.assigneeName} onChange={(value) => set("assigneeName", value)} options={ASSIGNEE_OPTIONS} /></label><label>Equipe<InputSelect value={form.teamName} onChange={(value) => set("teamName", value)} options={TEAM_OPTIONS} /></label><label>Prazo<input type="date" value={form.dueDate || ""} onChange={(event) => set("dueDate", event.target.value)} /></label></div><label className="drawer-description">Descrição<textarea value={form.description} onChange={(event) => set("description", event.target.value)} rows="4" /></label><section className="drawer-section"><div className="drawer-section-heading"><h3>Subtarefas</h3><button className="text-button" type="button" onClick={onAddSubtask}><Plus size={14} />Adicionar</button></div>{subtasks.length ? subtasks.map((subtask) => <button className="subtask-row" key={subtask.id} onClick={() => onSave(subtask.id, { status: subtask.status === "done" ? "todo" : "done" })}><span className={`subtask-check ${subtask.status === "done" ? "checked" : ""}`}>{subtask.status === "done" && <Check size={13} />}</span><span>{subtask.title}</span><small>{formatDate(subtask.dueDate)}</small></button>) : <div className="empty-inline">Nenhuma subtarefa adicionada.</div>}</section><section className="drawer-section"><div className="drawer-section-heading"><h3>Comentários</h3><span className="section-count">{taskItem.comments.length}</span></div>{taskItem.comments.map((item) => <div className="comment-row" key={item.id}><Avatar name={item.author} small /><div><strong>{item.author}</strong><p>{item.text}</p></div></div>)}<div className="comment-compose"><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Adicionar um comentário..." rows="2" /><button className="button button-secondary" disabled={!comment.trim()} onClick={() => { onComment(taskItem.id, comment); setComment(""); }}><MessageCircle size={15} />Comentar</button></div></section><section className="drawer-section"><div className="drawer-section-heading"><h3>Anexos</h3><span className="section-count">{taskItem.attachments.length}</span></div>{taskItem.attachments.map((item) => <div className="attachment-row" key={item.id}><Paperclip size={15} /><span>{item.name}</span></div>)}<label className="upload-mock"><Paperclip size={15} />Adicionar anexo<input type="file" onChange={(event) => { if (event.target.files?.[0]) onAttachment(taskItem.id, event.target.files[0]); }} /></label></section><section className="drawer-section history-section"><div className="drawer-section-heading"><h3>Histórico</h3></div>{history.slice(0, 5).map((item) => <div className="history-row" key={item.id}><span className="history-dot" /><div><strong>{item.text}</strong><small>{item.author} · agora</small></div></div>)}</section></div><footer className="drawer-footer"><button className="button button-quiet" onClick={onClose}>Cancelar</button><button className="button button-primary" onClick={() => onSave(taskItem.id, { title: form.title, status: form.status, priority: form.priority, assigneeName: form.assigneeName, teamName: form.teamName, dueDate: form.dueDate, description: form.description })}><Check size={16} />Salvar tarefa</button></footer></aside></div>;
}

function NewTaskDrawer({ quotes, onClose, onSave }) {
  const [form, setForm] = useState({ title: "", quoteId: quotes[0]?.id || "", priority: "medium", assigneeName: "Não atribuído", teamName: "Comercial", dueDate: "", description: "" }); const quote = quotes.find((item) => item.id === form.quoteId);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return <div className="drawer-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="task-drawer new-task-drawer"><header className="drawer-header"><div><span className="eyebrow">Nova tarefa</span><span className="drawer-code">CRIAÇÃO MANUAL</span></div><button className="icon-button" onClick={onClose}><X size={19} /></button></header><div className="drawer-body"><div className="drawer-title"><input autoFocus value={form.title} onChange={(event) => set("title", event.target.value)} placeholder="O que precisa ser feito?" aria-label="Título da tarefa" /><PriorityBadge priority={form.priority} /></div><div className="linked-record"><FileText size={16} /><label><small>Vincular a uma cotação</small><InputSelect value={form.quoteId} onChange={(value) => set("quoteId", value)} options={quotes.map((item) => ({ value: item.id, label: `${item.code} · ${item.title}`, search: item.client }))} /></label></div><div className="drawer-field-grid"><label>Status<InputSelect value="todo" disabled options={[{ value: "todo", label: "A fazer" }]} /></label><label>Prioridade<InputSelect value={form.priority} onChange={(value) => set("priority", value)} options={PRIORITY_OPTIONS} /></label><label>Responsável<InputSelect value={form.assigneeName} onChange={(value) => set("assigneeName", value)} options={ASSIGNEE_OPTIONS} /></label><label>Equipe<InputSelect value={form.teamName} onChange={(value) => set("teamName", value)} options={TEAM_OPTIONS} /></label><label>Prazo<input type="date" value={form.dueDate} onChange={(event) => set("dueDate", event.target.value)} /></label></div><label className="drawer-description">Descrição<textarea value={form.description} onChange={(event) => set("description", event.target.value)} rows="5" placeholder="Adicione contexto para quem vai executar..." /></label><div className="creation-note"><Sparkles size={16} /><span>Esta tarefa ficará disponível no quadro central e poderá receber subtarefas depois.</span></div></div><footer className="drawer-footer"><button className="button button-quiet" onClick={onClose}>Cancelar</button><button className="button button-primary" disabled={!form.title.trim()} onClick={() => onSave({ ...form, quoteCode: quote?.code, quoteTitle: quote?.title })}><Plus size={16} />Criar tarefa</button></footer></aside></div>;
}

export default function App() {
  const [active, setActive] = useState("dashboard"); const [state, setState] = useState(null); const [store] = useState(() => createDataStore()); const [selectedId, setSelectedId] = useState(""); const [creating, setCreating] = useState(false); const [creatingSubtaskFor, setCreatingSubtaskFor] = useState(""); const [filters, setFilters] = useState({ query: "", status: "", priority: "" }); const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  useEffect(() => { store.load().then(setState).catch((failure) => setError(failure.message || "Não foi possível carregar as tarefas.")); }, [store]);
  const runMutation = useCallback((operation, message) => operation.then((next) => { setState(next); setNotice(message); window.setTimeout(() => setNotice(""), 2600); }).catch((failure) => setError(failure.message || "Não foi possível concluir a operação.")), []);
  const selected = useMemo(() => state?.tasks.find((taskItem) => taskItem.id === selectedId), [state, selectedId]);
  const openTask = useCallback((id) => setSelectedId(id), []); const closeTask = useCallback(() => setSelectedId(""), []);
  const moveTask = useCallback((id, status) => runMutation(store.updateTask(state, id, { status }), store.live ? "Status atualizado." : "Status atualizado no mock."), [state, store, runMutation]);
  const saveTask = useCallback((id, patch) => runMutation(store.updateTask(state, id, patch), store.live ? "Tarefa salva." : "Tarefa salva no mock."), [state, store, runMutation]);
  const createNewTask = useCallback((input) => { runMutation(store.createTask(state, input), store.live ? "Tarefa criada." : "Tarefa criada no mock."); setCreating(false); }, [state, store, runMutation]);
  const createNewSubtask = useCallback((input) => { runMutation(store.createSubtask(state, creatingSubtaskFor, input), store.live ? "Subtarefa criada." : "Subtarefa criada no mock."); setCreatingSubtaskFor(""); }, [state, store, runMutation, creatingSubtaskFor]);
  const createQualityTask = useCallback((item) => runMutation(store.createQualityTask(state, item), store.live ? "Tarefa de qualidade criada." : "Tarefa de qualidade criada no mock."), [state, store, runMutation]);
  const refreshMock = useCallback((quote) => runMutation(quote ? store.ensureQuoteTask(state, quote) : store.save(state), quote ? "Tarefa principal criada." : "Dados atualizados."), [state, store, runMutation]);
  const resetMock = useCallback(() => { runMutation(store.reset(), store.live ? "Dados recarregados." : "Cenário inicial restaurado."); setSelectedId(""); }, [store, runMutation]);
  if (error) return <div className="app-error"><strong>Não foi possível carregar o Planner.</strong><span>{error}</span><button className="button button-secondary" onClick={() => { setError(""); store.load().then(setState).catch((failure) => setError(failure.message)); }}>Tentar novamente</button></div>;
  if (!state) return <div className="app-loading">Carregando dados operacionais…</div>;
  const renderPage = () => {
    if (active === "dashboard") return <Dashboard state={state} onNavigate={setActive} onOpen={openTask} onCreate={() => setCreating(true)} onRefresh={refreshMock} />;
    if (active === "board") return <BoardView state={state} onOpen={openTask} onMove={moveTask} onCreate={() => setCreating(true)} filters={filters} setFilters={setFilters} />;
    if (active === "list") return <ListView state={state} onOpen={openTask} onCreate={() => setCreating(true)} filters={filters} setFilters={setFilters} />;
    if (active === "calendar") return <CalendarView state={state} onOpen={openTask} onCreate={() => setCreating(true)} />;
    if (active === "quality") return <QualityView state={state} onCreate={createQualityTask} />;
    return <SettingsView onReset={resetMock} />;
  };
  return <AppShell active={active} onNavigate={setActive} onCreate={() => setCreating(true)} tasks={state.tasks}>{renderPage()}{notice && <div className="toast"><CheckCircle2 size={17} /><span>{notice}</span></div>}{selected && <TaskDrawer task={selected} state={state} onClose={closeTask} onSave={saveTask} onComment={(id, text) => runMutation(store.addComment(state, id, text), "Comentário adicionado.")} onAttachment={(id, file) => runMutation(store.addAttachment(state, id, file), "Anexo adicionado.")} onOpenQuote={(id) => { setActive("dashboard"); closeTask(); setNotice(`Cotação ${state.quotes.find((quote) => quote.id === id)?.code || ""} vinculada.`); }} onAddSubtask={() => setCreatingSubtaskFor(selected.id)} />}{creating && <NewTaskDrawer quotes={state.quotes} onClose={() => setCreating(false)} onSave={createNewTask} />}{creatingSubtaskFor && <NewTaskDrawer quotes={state.quotes} onClose={() => setCreatingSubtaskFor("")} onSave={createNewSubtask} />}</AppShell>;
}
