import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, ArrowUpRight, BellRing, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ClipboardList, ListChecks, Trash2,
  Clock3, FileText, LayoutDashboard, ListFilter, Menu, MessageCircle, Paperclip, PanelLeftClose,
  PanelLeftOpen, Plus, RotateCcw, Search, Settings, ShieldAlert, Sparkles, Target, UserRound, Users, X,
} from "lucide-react";
import { addOptimisticAttachment, addOptimisticComment, applyOptimisticTaskPatch, buildOptimisticTask, filterTasks, formatDate, formatLongDate, isBlocked, isDueToday, isOverdue, mentionedEmployees, normalizeAssigneeNames, normalizeText, PRIORITIES, quoteTaskTitle, sortTasks, sourceById, STATUSES, statusById, TASK_SOURCES, taskStats } from "./domain";
import { createDataStore } from "./dataverse";
import SearchableSelect, { SearchableMultiSelect } from "./SearchableSelect.jsx";
import CentralView from "./CentralView.jsx";
import AssigneeDisplay from "./AssigneeDisplay.jsx";
import { filterWorkItems, isAssignedToEmployee, normalizeWorkItems, workItemStats } from "./workItems.js";
import { APP_VERSION } from "./version.js";

const CENTRAL_NAV_ITEMS = [
  ["dashboard", "Minhas pendências", LayoutDashboard], ["team", "Equipe", Users], ["board", "Tarefas", ClipboardList], ["calendar", "Agenda", CalendarDays], ["settings", "Configurações", Settings],
];

const MOBILE_NAV_ITEMS = [
  ["dashboard", "Início", LayoutDashboard], ["board", "Quadro", ClipboardList], ["list", "Lista", ListFilter], ["calendar", "Agenda", CalendarDays], ["settings", "Mais", Settings],
];

const navItems = [
  ["dashboard", "Visão geral", LayoutDashboard], ["board", "Quadro", ClipboardList], ["list", "Lista operacional", ListFilter], ["calendar", "Agenda", CalendarDays], ["quality", "Qualidade", ShieldAlert], ["settings", "Configurações", Settings],
];
const STATUS_OPTIONS = STATUSES.map((item) => ({ value: item.id, label: item.label }));
const PRIORITY_OPTIONS = PRIORITIES.map((item) => ({ value: item.id, label: item.label }));
const SOURCE_OPTIONS = TASK_SOURCES.map((item) => ({ value: item.id, label: item.label }));
const ASSIGNEE_OPTIONS = ["Não atribuído"];
const TEAM_OPTIONS = ["Comercial", "Operação", "Financeiro"];
const CALENDAR_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const CHECKLIST_VISIBILITY_STORAGE_KEY = "betinhos-tela-planner-checklist-visibility-v1";

function readChecklistVisibility() {
  try { return JSON.parse(localStorage.getItem(CHECKLIST_VISIBILITY_STORAGE_KEY) || "{}"); } catch { return {}; }
}

function currentUserId() {
  return String(window.parent?.Xrm?.Utility?.getGlobalContext?.().userSettings?.userId || window.Xrm?.Utility?.getGlobalContext?.().userSettings?.userId || "").replace(/[{}]/g, "").toLowerCase();
}

function resolveCurrentEmployee(employees, live) {
  if (!live) return (employees || []).find((employee) => employee.isMockCurrentUser) || null;
  const userId = currentUserId();
  return (employees || []).find((employee) => String(employee.userId || "").replace(/[{}]/g, "").toLowerCase() === userId) || null;
}

function Avatar({ name = "Sistema", small = false }) {
  const names = String(name || "Sistema").split(/\s*,\s*/).filter(Boolean);
  const initials = (value) => value.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  if (names.length === 1) return <span className={`avatar ${small ? "avatar-small" : ""}`} title={name}>{initials(names[0])}</span>;
  const visibleNames = names.slice(0, 2);
  return <span className={`avatar avatar-stack ${small ? "avatar-stack-small" : ""}`} title={name} aria-label={`${names.length} responsáveis`}>
    {visibleNames.map((item, index) => <span className="avatar avatar-stack-item" key={`${item}-${index}`}>{initials(item)}</span>)}
    {names.length > visibleNames.length && <span className="avatar avatar-stack-count">+{names.length - visibleNames.length}</span>}
  </span>;
}

function shortAssigneeName(name = "Não atribuído") {
  const value = String(name || "Não atribuído").trim();
  if (!value || /^não atribuído$/i.test(value)) return value || "Não atribuído";
  const names = value.split(/\s*,\s*/).filter(Boolean);
  const first = names[0];
  const parts = first.split(/\s+/);
  const shortName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.` : first;
  return names.length > 1 ? `${shortName} +${names.length - 1}` : shortName;
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

function InputSelect({ value, onChange, options, placeholder = "Selecione", disabled = false, multiple = Array.isArray(value) }) {
  const normalizedOptions = options.map((option) => typeof option === "string" ? { value: option, label: option } : option);
  return multiple
    ? <SearchableMultiSelect value={value} onChange={onChange} disabled={disabled} placeholder={placeholder} options={normalizedOptions} />
    : <SearchableSelect value={value} onChange={onChange} disabled={disabled} placeholder={placeholder} options={normalizedOptions} />;
}

function UnsavedChangesDialog({ onContinue, onDiscard }) {
  return <div className="drawer-confirm-layer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-confirm" role="dialog" aria-modal="true" aria-labelledby="drawer-confirm-title"><h2 id="drawer-confirm-title">Alterações não salvas</h2><p>Você tem alterações que ainda não foram salvas. Deseja descartar?</p><div className="drawer-confirm-actions"><button className="button button-quiet" type="button" onClick={onContinue}>Continuar editando</button><button className="button button-danger" type="button" onClick={onDiscard}>Descartar</button></div></div></div>;
}

function DeleteTaskDialog({ taskTitle, onCancel, onConfirm, subject = "tarefa" }) {
  return <div className="drawer-confirm-layer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-confirm" role="dialog" aria-modal="true" aria-labelledby="delete-task-title"><h2>Excluir {subject}?</h2><p>“{taskTitle}” será removida do Planner. Esta ação não pode ser desfeita.</p><div className="drawer-confirm-actions"><button className="button button-quiet" type="button" onClick={onCancel}>Cancelar</button><button className="button button-danger" type="button" onClick={onConfirm}>Excluir {subject}</button></div></div></div>;
}

function AppShell({ active, onNavigate, children, onCreate, tasks, live, currentEmployee, personalStats, openTaskCount }) {
  const [expanded, setExpanded] = useState(true);
  const stats = personalStats || taskStats(tasks);
  const todayLabel = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date()).replace(".", "");
  const userName = currentEmployee?.name || "Usuário não vinculado";
  const activeLabel = MOBILE_NAV_ITEMS.find(([id]) => id === active)?.[1] || "Central";
  return <div className={`app-shell ${expanded ? "" : "sidebar-collapsed"}`}>
    <aside className="sidebar">
      <button className="sidebar-toggle" type="button" onClick={() => setExpanded((value) => !value)} aria-label={expanded ? "Recolher navegação" : "Expandir navegação"} title={expanded ? "Recolher navegação" : "Expandir navegação"}>
        {expanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>
      <div className="brand-block"><div className="brand-mark"><ClipboardList size={20} /></div><div className="brand-copy"><strong>Central de Trabalho</strong><span>Operação Betinhos</span></div></div>
      <div className="sidebar-day-card" aria-label={`Hoje, ${stats.open} pendências e ${stats.overdue} atrasados`}><div className="sidebar-day-title"><span>Hoje</span><strong>{todayLabel}</strong></div><div className="sidebar-day-stats"><span className="sidebar-day-stat"><strong>{stats.open}</strong><small>Pendências</small></span><span className="sidebar-day-stat sidebar-day-stat-overdue"><strong>{stats.overdue}</strong><small>Atrasados</small></span></div></div>
      <nav className="main-nav">{CENTRAL_NAV_ITEMS.map(([id, label, Icon]) => <button key={id} className={active === id ? "nav-item active" : "nav-item"} onClick={() => onNavigate(id)}><Icon size={18} /><span>{label}</span>{id === "board" && <span className="nav-count">{openTaskCount}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="mock-label"><span className="pulse-dot" />{live ? "Dataverse conectado" : "Modo local · mock"}</div><div className="sidebar-version" aria-label={`Versão do aplicativo ${APP_VERSION}`}>Versão {APP_VERSION}</div><div className="user-card"><Avatar name={userName} /><div className="user-copy"><strong>{userName}</strong><span>{currentEmployee ? "Administrativo" : "Sem vínculo Dataverse"}</span></div><button className="user-settings-button" type="button" onClick={() => onNavigate("settings")} aria-label="Abrir configurações" title="Configurações"><Settings size={15} /></button></div></div>
    </aside>
    <main className="main-area"><header className="mobile-header"><div className="mobile-header-copy"><strong>{activeLabel}</strong><span>Central de Trabalho</span></div><div className="mobile-header-status" title={live ? "Dataverse conectado" : "Modo local"}><span className="pulse-dot" />{live ? "Live" : "Local"}</div><Avatar name={userName} small /></header>{children}</main>
    <nav className="mobile-bottom-nav" aria-label="Navegação principal">{MOBILE_NAV_ITEMS.map(([id, label, Icon]) => <button key={id} className={active === id ? "mobile-nav-item active" : "mobile-nav-item"} type="button" onClick={() => onNavigate(id)} aria-current={active === id ? "page" : undefined}><Icon size={19} strokeWidth={active === id ? 2.4 : 2} /><span>{label}</span>{id === "board" && openTaskCount > 0 && <b>{openTaskCount}</b>}</button>)}</nav>
    <button className="mobile-fab" onClick={onCreate} aria-label="Criar nova tarefa"><Plus size={22} /></button>
  </div>;
}

function PageHeader({ eyebrow, title, description, action, children }) {
  return <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div><div className="header-actions">{children}{action}</div></div>;
}

function MetricCard({ label, value, detail, tone = "neutral", icon: Icon }) {
  return <div className={`metric-card metric-${tone}`}><div className="metric-icon"><Icon size={18} /></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>;
}

function TaskCard({ task: taskItem, subtasks = [], currentEmployee, showChecklistOnCard = false, onOpen, onToggleSubtask, compact = false, onDrop }) {
  const overdue = isOverdue(taskItem);
  const canOpen = !taskItem.id.startsWith("optimistic-");
  const completedSubtasks = subtasks.filter((subtask) => subtask.status === "done").length;
  const visibleSubtasks = subtasks.slice(0, 3);
  const mentionCount = currentEmployee ? (taskItem.comments || []).reduce((count, comment) => count + (mentionedEmployees(comment.text, [currentEmployee]).length ? 1 : 0), 0) : 0;
  return <article className={`task-card ${compact ? "task-card-compact" : ""} ${overdue ? "task-overdue" : ""} ${taskItem.syncStatus === "syncing" ? "task-syncing" : ""}`} draggable={taskItem.syncStatus !== "syncing"} tabIndex={canOpen ? "0" : "-1"} onDragStart={(event) => event.dataTransfer.setData("text/task-id", taskItem.id)} onClick={() => { if (canOpen) onOpen(taskItem.id); }} onKeyDown={(event) => { if (canOpen && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onOpen(taskItem.id); } }}>
    <div className="task-card-top"><PriorityBadge priority={taskItem.priority} />{overdue && <span className="overdue-label">Vencida</span>}{canOpen && <button className="card-open" onClick={(event) => { event.stopPropagation(); onOpen(taskItem.id); }} aria-label="Abrir tarefa"><ArrowUpRight size={15} /></button>}</div>
    <h3>{taskItem.title}</h3>
    {(taskItem.sourceType || taskItem.quoteId) && <div className="task-source-row"><SourceBadge sourceType={taskItem.sourceType || (taskItem.quoteId ? "quote" : "manual")} /><span>{taskItem.sourceCode || taskItem.quoteCode}</span><em>{taskItem.sourceLabel || taskItem.quoteTitle}</em></div>}
    {isBlocked(taskItem) && <div className="blocked-note"><CircleHelp size={13} />Bloqueada: {taskItem.blockedReason}</div>}
    {mentionCount > 0 && <div className="task-mention-alert"><BellRing size={13} /><span>Você foi acionado</span>{mentionCount > 1 && <strong>{mentionCount}</strong>}</div>}
    {showChecklistOnCard && subtasks.length > 0 && <div className="task-checklist" aria-label={`Checklist: ${completedSubtasks} de ${subtasks.length} concluídas`}><div className="task-checklist-heading"><span><ListChecks size={13} />Checklist</span><strong>{completedSubtasks}/{subtasks.length}</strong></div><div className="task-checklist-items">{visibleSubtasks.map((subtask) => { const completed = subtask.status === "done"; return <button className={`task-checklist-item ${completed ? "is-complete" : ""}`} key={subtask.id} type="button" aria-pressed={completed} disabled={subtask.syncStatus === "syncing"} onClick={(event) => { event.stopPropagation(); onToggleSubtask?.(subtask.id, { status: completed ? "todo" : "done" }); }}><span className="task-checklist-box">{completed && <Check size={10} strokeWidth={3} />}</span><span>{subtask.title}</span></button>; })}</div>{subtasks.length > visibleSubtasks.length && <span className="task-checklist-more">+{subtasks.length - visibleSubtasks.length} itens</span>}</div>}
    <div className="task-card-footer"><AssigneeDisplay value={taskItem.assigneeProfiles?.length ? taskItem.assigneeProfiles : taskItem.assigneeNames || taskItem.assigneeName} small />{taskItem.syncStatus === "syncing" ? <span className="sync-chip" role="status">Enviando...</span> : <span className={overdue ? "date-chip overdue" : "date-chip"}><Clock3 size={13} />{formatDate(taskItem.dueDate)}</span>}</div>
    {taskItem.parentTaskId && <div className="subtask-mark"><CheckCircle2 size={13} />Subtarefa</div>}
  </article>;
}

function Board({ tasks, allTasks, currentEmployee, checklistVisibility, onOpen, onToggleSubtask, onMove, onCreate }) {
  return <div className="board-grid">{STATUSES.map((status) => { const items = tasks.filter((taskItem) => taskItem.status === status.id); return <section className="board-column" key={status.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = event.dataTransfer.getData("text/task-id"); if (id && !id.startsWith("optimistic-")) onMove(id, status.id); }}><div className="column-header"><div><span className={`column-marker marker-${status.tone}`} /><h2>{status.label}</h2><span className="column-count">{items.length}</span></div><button className="icon-button" type="button" onClick={onCreate} aria-label={`Criar tarefa em ${status.label}`}><Plus size={16} /></button></div><div className="column-body">{items.map((taskItem) => <TaskCard key={taskItem.id} task={taskItem} subtasks={allTasks.filter((item) => item.parentTaskId === taskItem.id)} currentEmployee={currentEmployee} showChecklistOnCard={checklistVisibility[taskItem.id]} onOpen={onOpen} onToggleSubtask={onToggleSubtask} />)}{!items.length && <div className="drop-placeholder"><Plus size={17} /><span>Arraste tarefas para cá</span></div>}</div></section>; })}</div>;
}

function FilterBar({ filters, setFilters, onCreate, employees = [] }) {
  const [expanded, setExpanded] = useState(false);
  const assigneeOptions = ["Não atribuído", ...employees.map((employee) => employee.name)];
  const activeFilterCount = [filters.query, filters.assignee?.length, filters.priority?.length, filters.source?.length, filters.blocked].filter(Boolean).length;
  return <div className={`filter-bar ${expanded ? "is-expanded" : "is-collapsed"}`}><button className="filter-toggle" type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}><ListFilter size={15} /><span>Filtros</span>{activeFilterCount > 0 && <b>{activeFilterCount}</b>}<ChevronDown size={15} /></button><div className="filter-bar-content"><div className="search-field"><Search size={16} /><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Buscar tarefas, cotações, qualidade ou pessoas" /></div><SearchableMultiSelect value={filters.assignee} onChange={(value) => setFilters((current) => ({ ...current, assignee: value }))} placeholder="Todos os responsáveis" options={assigneeOptions.map((name) => ({ value: name, label: name }))} /><SearchableMultiSelect value={filters.priority} onChange={(value) => setFilters((current) => ({ ...current, priority: value }))} placeholder="Todas as prioridades" options={PRIORITY_OPTIONS} /><SearchableMultiSelect value={filters.source} onChange={(value) => setFilters((current) => ({ ...current, source: value }))} placeholder="Todas as origens" options={SOURCE_OPTIONS} /><button className={`button ${filters.blocked ? "button-secondary" : "button-quiet"}`} onClick={() => setFilters((current) => ({ ...current, blocked: !current.blocked }))}><CircleHelp size={15} />Bloqueadas</button><button className="button button-primary" onClick={onCreate}><Plus size={16} />Nova tarefa</button></div></div>;
}

function Dashboard({ state, onNavigate, onOpen, onCreate, onRefresh }) {
  const stats = useMemo(() => taskStats(state.tasks), [state.tasks]);
  const dueSoon = useMemo(() => sortTasks(state.tasks.filter((taskItem) => taskItem.status !== "done")).slice(0, 4), [state.tasks]);
  const quotesInAnalysis = useMemo(() => state.quotes.filter((quote) => quote.status === "Em análise"), [state.quotes]);
  return <div className="page-content"><PageHeader eyebrow="Visão operacional" title="Bom dia, Renan" description="Aqui está o que precisa da sua atenção hoje." action={<button className="button button-primary" onClick={onCreate}><Plus size={16} />Nova tarefa</button>}><button className="button button-quiet" onClick={onRefresh}><Sparkles size={15} />Atualizar dados</button></PageHeader><div className="metric-grid"><MetricCard label="Tarefas em aberto" value={stats.open} detail="no quadro central" tone="navy" icon={ClipboardList} /><MetricCard label="Vencidas" value={stats.overdue} detail="precisam de atenção" tone="danger" icon={AlertCircle} /><MetricCard label="Para hoje" value={stats.today} detail="com prazo neste dia" tone="action" icon={Clock3} /><MetricCard label="Aguardando" value={stats.waiting} detail="dependem de retorno" tone="warning" icon={CircleHelp} /></div><div className="dashboard-grid"><section className="panel priority-panel"><div className="panel-heading"><div><span className="eyebrow">Prioridades</span><h2>Próximos movimentos</h2></div><button className="text-button" onClick={() => onNavigate("list")}>Ver lista <ArrowUpRight size={14} /></button></div><div className="priority-list">{dueSoon.map((taskItem) => <button className="priority-row" key={taskItem.id} onClick={() => onOpen(taskItem.id)}><div className={`priority-bar ${isOverdue(taskItem) ? "bar-danger" : ""}`} /><div className="priority-main"><strong>{taskItem.title}</strong><span>{taskItem.quoteCode} · {taskItem.assigneeName}</span></div><StatusBadge status={taskItem.status} /><span className={isOverdue(taskItem) ? "priority-date danger-text" : "priority-date"}>{formatDate(taskItem.dueDate)}</span><ChevronRight size={16} /></button>)}</div></section><section className="panel quote-panel"><div className="panel-heading"><div><span className="eyebrow">Integração Dataverse</span><h2>Cotações em análise</h2></div><span className="panel-count">{quotesInAnalysis.length}</span></div><p className="panel-copy">Quando uma cotação entra em análise, o Planner cria a tarefa principal para a equipe.</p><div className="quote-list">{quotesInAnalysis.map((quote) => { const linked = state.tasks.some((taskItem) => taskItem.quoteId === quote.id && !taskItem.parentTaskId); return <div className="quote-row" key={quote.id}><div className="quote-icon"><FileText size={16} /></div><div><strong>{quote.code}</strong><span>{quote.title}</span></div>{linked ? <span className="linked-label"><Check size={14} />Tarefa criada</span> : <button className="small-button" onClick={() => onRefresh(quote)}>Criar tarefa</button>}</div>; })}</div></section></div></div>;
}

function BoardView({ state, currentEmployee, checklistVisibility, onOpen, onToggleSubtask, onMove, onCreate, filters, setFilters }) {
  const filtered = useMemo(() => sortTasks(filterTasks(state.tasks.filter((taskItem) => !taskItem.parentTaskId), filters)), [state.tasks, filters]);
  const tasksByStatus = useMemo(() => Object.fromEntries(STATUSES.map((status) => [status.id, filtered.filter((taskItem) => taskItem.status === status.id)])), [filtered]);
  return <div className="page-content"><PageHeader eyebrow="Quadro central" title="Operação em movimento" description="Arraste os cartões para atualizar o andamento das tarefas." /><FilterBar filters={filters} setFilters={setFilters} onCreate={onCreate} employees={state.employees} /><Board tasks={filtered} allTasks={state.tasks} currentEmployee={currentEmployee} checklistVisibility={checklistVisibility} onOpen={onOpen} onToggleSubtask={onToggleSubtask} onMove={onMove} onCreate={onCreate} /><div className="mobile-board-list">{STATUSES.map((status) => <section className="mobile-status-group" key={status.id}><div className="mobile-status-heading"><span className={`column-marker marker-${status.tone}`} /><h2>{status.label}</h2><span className="column-count">{tasksByStatus[status.id].length}</span></div>{tasksByStatus[status.id].map((taskItem) => <TaskCard key={taskItem.id} task={taskItem} subtasks={state.tasks.filter((item) => item.parentTaskId === taskItem.id)} currentEmployee={currentEmployee} showChecklistOnCard={checklistVisibility[taskItem.id]} onOpen={onOpen} onToggleSubtask={onToggleSubtask} compact />)}</section>)}</div></div>;
}

function ListView({ state, onOpen, onCreate, filters, setFilters }) {
  const filtered = useMemo(() => sortTasks(filterTasks(state.tasks, filters)), [state.tasks, filters]);
  return <div className="page-content"><PageHeader eyebrow="Gestão de tarefas" title="Lista operacional" description="Encontre rapidamente o próximo responsável por cada tarefa." /><FilterBar filters={filters} setFilters={setFilters} onCreate={onCreate} employees={state.employees} /><section className="panel task-table"><div className="table-header"><span>Tarefa</span><span>Vínculo</span><span>Responsável</span><span>Prazo</span><span>Status</span></div>{filtered.map((taskItem) => <button className="table-row" key={taskItem.id} onClick={() => onOpen(taskItem.id)}><div className="table-task"><span className={`table-status status-${taskItem.status}`} /><strong>{taskItem.title}</strong></div><span>{taskItem.quoteCode || "—"}</span><AssigneeDisplay value={taskItem.assigneeProfiles?.length ? taskItem.assigneeProfiles : taskItem.assigneeNames || taskItem.assigneeName} small /><span className={isOverdue(taskItem) ? "danger-text" : ""}>{formatDate(taskItem.dueDate)}</span><div className="table-row-tags"><PriorityBadge priority={taskItem.priority} /><StatusBadge status={taskItem.status} /></div></button>)}</section></div>;
}

function CalendarView({ state, onOpen, onCreate, filters, setFilters }) {
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() + index - 1); return date; });
  const openTasks = useMemo(() => sortTasks(filterTasks(state.tasks.filter((taskItem) => taskItem.status !== "done"), filters)), [state.tasks, filters]);
  return <div className="page-content"><PageHeader eyebrow="Prazos e ritmo" title="Agenda operacional" description="Uma visão simples dos compromissos que movem a operação." /><FilterBar filters={filters} setFilters={setFilters} onCreate={onCreate} employees={state.employees} /><div className="calendar-strip">{days.map((date) => <div className={`calendar-day ${date.toDateString() === new Date().toDateString() ? "today" : ""}`} key={date.toISOString()}><span>{CALENDAR_WEEKDAY_FORMATTER.format(date).replace(".", "")}</span><strong>{date.getDate()}</strong></div>)}</div><section className="panel agenda-panel"><div className="panel-heading"><div><span className="eyebrow">Esta semana</span><h2>O que acontece em seguida</h2></div></div>{openTasks.map((taskItem) => <button className="agenda-row" key={taskItem.id} onClick={() => onOpen(taskItem.id)}><span className="agenda-time">{formatDate(taskItem.dueDate)}</span><div className="agenda-line" /><div className="agenda-info"><strong>{taskItem.title}</strong><span>{taskItem.quoteCode} · {taskItem.assigneeName}</span></div><StatusBadge status={taskItem.status} /><ChevronRight size={16} /></button>)}</section></div>;
}

function QualityView({ state, onCreate, onCreateTask, filters, setFilters }) {
  const quality = state.quality || [];
  const filteredQuality = useMemo(() => quality.filter((item) => {
    const linkedTask = state.tasks.find((taskItem) => taskItem.sourceId === item.id);
    const query = normalizeText(filters.query);
    const matchesQuery = !query || [item.code, item.title, item.type, item.status, linkedTask?.title].some((value) => normalizeText(value).includes(query));
    const taskFilters = { ...filters, query: "" };
    const matchesTaskFilters = linkedTask ? filterTasks([linkedTask], taskFilters).length > 0 : !filters.assignee?.length && !filters.priority?.length && !filters.source?.length && !filters.blocked;
    return matchesQuery && matchesTaskFilters;
  }), [quality, state.tasks, filters]);
  return <div className="page-content"><PageHeader eyebrow="Origem operacional" title="Qualidade" description="Transforme erros e ações operacionais em tarefas do Planner interno." /><FilterBar filters={filters} setFilters={setFilters} onCreate={onCreateTask} employees={state.employees} /><section className="panel task-table"><div className="table-header"><span>Registro</span><span>Tipo</span><span>Prazo</span><span>Status</span><span>Ação</span></div>{filteredQuality.map((item) => { const linked = state.tasks.some((taskItem) => taskItem.sourceId === item.id); return <div className="table-row" key={`${item.type}-${item.id}`}><div className="table-task"><span className="table-status status-waiting" /><strong>{item.code ? `${item.code} · ` : ""}{item.title}</strong></div><span>{item.type === "error" ? "Erro operacional" : "Ação operacional"}</span><span>{formatDate(item.dueDate)}</span><span>{item.status || "Ativo"}</span>{linked ? <span className="linked-label">Tarefa criada</span> : <button className="small-button" onClick={() => onCreate(item)}>Criar tarefa</button>}</div>; })}{!filteredQuality.length && <div className="empty-inline">Nenhum erro ou ação operacional disponível.</div>}</section></div>;
}

function SettingsView({ onReset, live }) {
  return <div className="page-content"><PageHeader eyebrow={live ? "Ambiente Dataverse" : "Execução local"} title="Configurações" description={live ? "Dados operacionais carregados diretamente do ambiente autenticado." : "Dados de demonstração mantidos somente neste navegador."} /><section className="settings-grid"><div className="panel setting-card"><div className="setting-icon"><RotateCcw size={19} /></div><div><h2>{live ? "Recarregar dados" : "Restaurar cenário inicial"}</h2><p>{live ? "Busca novamente cotações, tarefas e registros de qualidade no Dataverse." : "Repõe as cotações e tarefas sintéticas do mock local."}</p><button className="button button-secondary" onClick={onReset}><RotateCcw size={15} />{live ? "Recarregar" : "Restaurar mock"}</button></div></div><div className="panel setting-card"><div className="setting-icon setting-icon-blue"><Target size={19} /></div><div><h2>Fonte de dados</h2><p>{live ? "O Planner usa dados do ambiente autenticado." : "O Planner usa mock data local e não cria registros no Dataverse."}</p><span className="status-note"><span className="pulse-dot" />{live ? "Dataverse conectado" : "Modo local · mock"}</span></div></div><div className="panel setting-card"><div className="setting-icon setting-icon-blue"><span className="version-glyph">v</span></div><div><h2>Versão do aplicativo</h2><p>Identificação da versão publicada neste ambiente.</p><span className="version-value">{APP_VERSION}</span></div></div></section></div>;
}

function TaskDrawerContent({ task: taskItem, state, currentEmployee, showChecklistOnCard, onToggleChecklistOnCard, onClose, onSave, onDelete, onComment, onAttachment, onOpenQuote, onAddSubtask, onRequestDelete, deleteState, showDeletePrompt, onCancelDelete, onConfirmDelete }) {
  const [form, setForm] = useState(taskItem ? { ...taskItem } : null); const [comment, setComment] = useState(""); const [mentionActiveIndex, setMentionActiveIndex] = useState(0); const [newSubtaskTitle, setNewSubtaskTitle] = useState(""); const [isAddingSubtask, setIsAddingSubtask] = useState(false); const [subtaskToDelete, setSubtaskToDelete] = useState(null); const [saveState, setSaveState] = useState("idle"); const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const saveCloseTimerRef = useRef(null);
  useEffect(() => {
    setForm(taskItem ? { ...taskItem, assigneeName: normalizeAssigneeNames(taskItem.assigneeNames || taskItem.assigneeName) } : null); setComment(""); setMentionActiveIndex(0); setNewSubtaskTitle(""); setIsAddingSubtask(false); setSubtaskToDelete(null); setSaveState("idle"); setShowDiscardPrompt(false);
    if (saveCloseTimerRef.current) window.clearTimeout(saveCloseTimerRef.current);
    return () => { if (saveCloseTimerRef.current) window.clearTimeout(saveCloseTimerRef.current); };
  }, [taskItem?.id]);
  useEffect(() => {
    const textarea = document.querySelector(".task-drawer .comment-compose textarea");
    if (!textarea) return undefined;
    textarea.setAttribute("aria-label", "Comentário");
    textarea.setAttribute("aria-autocomplete", "list");
    textarea.setAttribute("aria-expanded", String(mentionSuggestions.length > 0));
    const suggestionList = textarea.parentElement.querySelector(".mention-suggestions");
    if (suggestionList) { suggestionList.id = "comment-mention-list"; textarea.setAttribute("aria-controls", suggestionList.id); } else textarea.removeAttribute("aria-controls");
    const options = textarea.parentElement.querySelectorAll(".mention-suggestion");
    options.forEach((option, index) => {
      option.id = `comment-mention-option-${index}`;
      option.classList.toggle("is-active", index === mentionActiveIndex);
      option.setAttribute("aria-selected", String(index === mentionActiveIndex));
    });
    const onKeyDown = (event) => {
      if (event.defaultPrevented) return;
      if (mentionSuggestions.length > 0 && event.key === "ArrowDown") { event.preventDefault(); setMentionActiveIndex((current) => (current + 1) % mentionSuggestions.length); return; }
      if (mentionSuggestions.length > 0 && event.key === "ArrowUp") { event.preventDefault(); setMentionActiveIndex((current) => (current - 1 + mentionSuggestions.length) % mentionSuggestions.length); return; }
      if (mentionSuggestions.length > 0 && (event.key === "Tab" || event.key === "Enter")) { event.preventDefault(); insertMention(mentionSuggestions[mentionActiveIndex] || mentionSuggestions[0]); return; }
      if (event.ctrlKey && event.key === "Enter") return;
      if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submitComment(); }
    };
    textarea.addEventListener("keydown", onKeyDown);
    return () => textarea.removeEventListener("keydown", onKeyDown);
  }, [comment, mentionActiveIndex, taskItem?.id]);
  if (!taskItem || !form) return null;
  const subtasks = state.tasks.filter((item) => item.parentTaskId === taskItem.id); const history = [...(taskItem.history || [])].reverse();
  const mentionMatch = comment.match(/(?:^|\s)@([^\s@]*)$/);
  const mentionQuery = normalizeText(mentionMatch?.[1] || "");
   const mentionSuggestions = mentionMatch ? (state.employees || []).filter((employee) => normalizeText(employee.name).includes(mentionQuery)).sort((left, right) => Number(normalizeText(left.name).startsWith(mentionQuery)) - Number(normalizeText(right.name).startsWith(mentionQuery))).reverse().slice(0, 6) : [];
   const isOwnComment = (item) => item.author === "Você" || (currentEmployee?.name && normalizeText(item.author) === normalizeText(currentEmployee.name));
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const isDirty = ["title", "status", "priority", "teamName", "dueDate", "description"].some((key) => JSON.stringify(form[key] || "") !== JSON.stringify(taskItem[key] || "")) || JSON.stringify(form.assigneeName || []) !== JSON.stringify(normalizeAssigneeNames(taskItem.assigneeNames || taskItem.assigneeName)) || comment.length > 0;
  const requestClose = () => { if (saveState !== "idle") return; if (isDirty) setShowDiscardPrompt(true); else onClose(); };
  const submitSubtask = () => { const title = newSubtaskTitle.trim(); if (!title) return; onAddSubtask(taskItem.id, title); setNewSubtaskTitle(""); setIsAddingSubtask(false); };
   const insertMention = (employee) => { const match = comment.match(/(^|\s)@([^\s@]*)$/); if (!match) return; setComment(`${comment.slice(0, match.index + match[1].length)}@${employee.name} `); setMentionActiveIndex(0); };
   const submitComment = () => { if (!comment.trim()) return; onComment(taskItem.id, comment); setComment(""); setMentionActiveIndex(0); };
   const handleCommentChange = (event) => { setComment(event.target.value); setMentionActiveIndex(0); };
  const handleSave = () => {
    if (saveState !== "idle") return;
    setSaveState("saving");
    onSave(taskItem.id, { title: form.title, status: form.status, priority: form.priority, assigneeNames: form.assigneeName, teamName: form.teamName, dueDate: form.dueDate, description: form.description });
    setSaveState("success");
    saveCloseTimerRef.current = window.setTimeout(onClose, 620);
  };
  return <div className="drawer-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}><aside className="task-drawer"><header className="drawer-header"><div><span className="eyebrow">Detalhe da tarefa</span><span className="drawer-code">{taskItem.quoteCode || "TAREFA"}</span></div><button className="icon-button" onClick={requestClose} aria-label="Fechar detalhe" disabled={saveState !== "idle"}><X size={19} /></button></header><div className="drawer-body"><div className="drawer-title"><input value={form.title} onChange={(event) => set("title", event.target.value)} aria-label="Título da tarefa" /><PriorityBadge priority={form.priority} /></div>{taskItem.quoteId && <button className="linked-record" onClick={() => onOpenQuote(taskItem.quoteId)}><FileText size={16} /><span><small>Cotação vinculada</small><strong>{taskItem.quoteCode} · {taskItem.quoteTitle}</strong></span><ArrowUpRight size={15} /></button>}<div className="drawer-field-grid"><label>Status<InputSelect value={form.status} onChange={(value) => set("status", value)} options={STATUS_OPTIONS} /></label><label>Prioridade<InputSelect value={form.priority} onChange={(value) => set("priority", value)} options={PRIORITY_OPTIONS} /></label><label>Responsável<InputSelect value={form.assigneeName} onChange={(value) => set("assigneeName", value)} options={ASSIGNEE_OPTIONS} /></label><label>Equipe<InputSelect value={form.teamName} onChange={(value) => set("teamName", value)} options={TEAM_OPTIONS} /></label><label>Prazo<input type="date" value={form.dueDate || ""} onChange={(event) => set("dueDate", event.target.value)} /></label></div><label className="drawer-description">Descrição<textarea value={form.description} onChange={(event) => set("description", event.target.value)} rows="4" /></label><section className="drawer-section"><div className="drawer-section-heading"><div><h3>Subtarefas</h3><label className="checklist-visibility-toggle"><input type="checkbox" checked={showChecklistOnCard} onChange={(event) => onToggleChecklistOnCard(event.target.checked)} /><span>Mostrar no quadro</span></label></div><button className="text-button" type="button" onClick={() => setIsAddingSubtask(true)}><Plus size={14} />Adicionar</button></div>{isAddingSubtask && <div className="subtask-inline-create"><span className="subtask-check" aria-hidden="true" /><input autoFocus value={newSubtaskTitle} onChange={(event) => setNewSubtaskTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitSubtask(); if (event.key === "Escape") { setNewSubtaskTitle(""); setIsAddingSubtask(false); } }} placeholder="Digite o título da subtarefa" aria-label="Título da subtarefa" /><button className="subtask-inline-action" type="button" onClick={submitSubtask} disabled={!newSubtaskTitle.trim()} aria-label="Salvar subtarefa"><Check size={15} /></button></div>}{subtasks.length ? subtasks.map((subtask) => <div className="subtask-row" key={subtask.id}><button className="subtask-toggle" type="button" disabled={subtask.syncStatus === "syncing"} onClick={() => onSave(subtask.id, { status: subtask.status === "done" ? "todo" : "done" })}><span className={`subtask-check ${subtask.status === "done" ? "checked" : ""}`}>{subtask.status === "done" && <Check size={13} />}</span><span>{subtask.title}</span><small>{subtask.syncStatus === "syncing" ? "Sincronizando..." : formatDate(subtask.dueDate)}</small></button><button className="subtask-delete" type="button" disabled={subtask.syncStatus === "syncing"} onClick={(event) => { event.stopPropagation(); setSubtaskToDelete(subtask); }} aria-label="Excluir subtarefa" title="Excluir subtarefa"><Trash2 size={13} /></button></div>) : !isAddingSubtask && <div className="empty-inline">Nenhuma subtarefa adicionada.</div>}</section><section className="drawer-section"><div className="drawer-section-heading"><h3>Comentários</h3><span className="section-count">{taskItem.comments.length}</span></div>{taskItem.comments.map((item) => <div className={`comment-row ${isOwnComment(item) ? "comment-own" : ""} ${item.syncStatus === "syncing" ? "item-syncing" : ""}`} key={item.id}><Avatar name={item.author} small /><div><strong>{item.author}{item.syncStatus === "syncing" ? " · Enviando..." : ""}</strong><p>{item.text}</p></div></div>)}<div className="comment-compose"><div className="comment-mention-field"><textarea value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.ctrlKey && event.key === "Enter") { event.preventDefault(); submitComment(); } if (event.key === "Escape") setComment((value) => value.replace(/(?:^|\s)@[^\s@]*$/, "")); }} placeholder="Adicione um comentário ou use @ para mencionar alguém..." rows="2" />{mentionSuggestions.length > 0 && <div className="mention-suggestions" role="listbox" aria-label="Responsáveis para mencionar">{mentionSuggestions.map((employee) => <button type="button" className="mention-suggestion" key={employee.id || employee.name} onMouseDown={(event) => event.preventDefault()} onClick={() => insertMention(employee)}><Avatar name={employee.name} small /><span>{employee.name}</span></button>)}</div>}</div><button className="button button-secondary" disabled={!comment.trim()} onClick={submitComment}><MessageCircle size={15} />Comentar</button></div></section><section className="drawer-section"><div className="drawer-section-heading"><h3>Anexos</h3><span className="section-count">{taskItem.attachments.length}</span></div>{taskItem.attachments.map((item) => <div className={`attachment-row ${item.syncStatus === "syncing" ? "item-syncing" : ""}`} key={item.id}><Paperclip size={15} /><span>{item.name}</span>{item.syncStatus === "syncing" && <small>Enviando...</small>}</div>)}<label className="upload-mock"><Paperclip size={15} />Adicionar anexo<input type="file" onChange={(event) => { if (event.target.files?.[0]) onAttachment(taskItem.id, event.target.files[0]); }} /></label></section><section className="drawer-section history-section"><div className="drawer-section-heading"><h3>Histórico</h3></div>{history.slice(0, 5).map((item) => <div className="history-row" key={item.id}><span className="history-dot" /><div><strong>{item.text}</strong><small>{item.author} · agora</small></div></div>)}</section></div><footer className="drawer-footer"><button className="button button-danger task-delete-button" type="button" onClick={onRequestDelete} disabled={deleteState !== "idle" || saveState !== "idle"}><Trash2 size={15} />Excluir</button><button className="button button-quiet" onClick={requestClose} disabled={saveState !== "idle"}>Cancelar</button><button className="button button-primary" disabled={saveState !== "idle"} onClick={handleSave}>{saveState === "saving" ? "Salvando..." : <><Check size={16} />Salvar tarefa</>}</button></footer>{saveState === "success" && <div className="drawer-save-feedback" role="status" aria-live="polite"><div className="drawer-save-icon"><Check size={30} strokeWidth={2.5} /></div><strong>Tarefa salva</strong><span>Fechando detalhe…</span></div>}{deleteState === "deleting" && <div className="drawer-delete-feedback" role="status" aria-live="polite"><div className="drawer-delete-icon"><Trash2 size={30} strokeWidth={2.5} /></div><strong>Tarefa excluída</strong><span>Removendo do Planner…</span></div>}{showDiscardPrompt && <UnsavedChangesDialog onContinue={() => setShowDiscardPrompt(false)} onDiscard={onClose} />}{showDeletePrompt && <DeleteTaskDialog taskTitle={taskItem.title} onCancel={onCancelDelete} onConfirm={onConfirmDelete} />}{subtaskToDelete && <DeleteTaskDialog taskTitle={subtaskToDelete.title} subject="subtarefa" onCancel={() => setSubtaskToDelete(null)} onConfirm={() => { setSubtaskToDelete(null); onDelete(subtaskToDelete.id); }} />}</aside></div>;
}

function TaskDrawer({ task, onDelete, ...props }) {
  const [showDeletePrompt, setShowDeletePrompt] = useState(false); const [deleteState, setDeleteState] = useState("idle");
  if (!task) return null;
  const confirmDelete = () => { setShowDeletePrompt(false); setDeleteState("deleting"); window.setTimeout(() => onDelete(task.id), 620); };
  return <TaskDrawerContent task={task} onDelete={onDelete} onRequestDelete={() => setShowDeletePrompt(true)} deleteState={deleteState} showDeletePrompt={showDeletePrompt} onCancelDelete={() => setShowDeletePrompt(false)} onConfirmDelete={confirmDelete} {...props} />;
}

function InlineSubtasksEditor({ items, setItems }) {
  const [draft, setDraft] = useState("");
  const add = () => { const title = draft.trim(); if (!title) return; setItems((current) => [...current, title]); setDraft(""); };
  return <section className="creation-subtasks"><div className="drawer-section-heading"><h3>Subtarefas</h3><span className="section-hint">opcional</span></div>{items.map((title, index) => <div className="creation-subtask-row" key={`${title}-${index}`}><span className="subtask-check" aria-hidden="true" /><span>{title}</span><button className="subtask-delete creation-subtask-delete" type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remover subtarefa ${title}`} title="Remover subtarefa"><Trash2 size={13} /></button></div>)}<div className="creation-subtask-input"><span className="subtask-check" aria-hidden="true" /><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} placeholder="Adicionar subtarefa" aria-label="Título da subtarefa" /><button className="subtask-inline-action" type="button" onClick={add} disabled={!draft.trim()} aria-label="Adicionar subtarefa"><Plus size={14} /></button></div></section>;
}

function NewTaskDrawer({ quotes, employees = [], onClose, onSave }) {
  const [form, setForm] = useState(() => ({ title: "", quoteId: quotes[0]?.id || "", priority: "medium", assigneeName: ["Não atribuído"], teamName: "Comercial", dueDate: "", description: "" })); const [subtasks, setSubtasks] = useState([]); const initialFormRef = useRef(form); const [showDiscardPrompt, setShowDiscardPrompt] = useState(false); const quote = quotes.find((item) => item.id === form.quoteId);
  const isDirty = Object.keys(initialFormRef.current).some((key) => form[key] !== initialFormRef.current[key]);
  const requestClose = () => { if (isDirty) setShowDiscardPrompt(true); else onClose(); };
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return <div className="drawer-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}><aside className="task-drawer new-task-drawer"><header className="drawer-header"><div><span className="eyebrow">Nova tarefa</span><span className="drawer-code">CRIAÇÃO MANUAL</span></div><button className="icon-button" onClick={requestClose}><X size={19} /></button></header><div className="drawer-body"><div className="drawer-title"><input autoFocus value={form.title} onChange={(event) => set("title", event.target.value)} placeholder="O que precisa ser feito?" aria-label="Título da tarefa" /><PriorityBadge priority={form.priority} /></div><div className="linked-record"><FileText size={16} /><label><small>Vincular a uma cotação</small><InputSelect value={form.quoteId} onChange={(value) => set("quoteId", value)} options={quotes.map((item) => ({ value: item.id, label: `${item.code} · ${item.title}`, search: item.client }))} /></label></div><div className="drawer-field-grid"><label>Status<InputSelect value="todo" disabled options={[{ value: "todo", label: "A fazer" }]} /></label><label>Prioridade<InputSelect value={form.priority} onChange={(value) => set("priority", value)} options={PRIORITY_OPTIONS} /></label><label>Responsável<InputSelect value={form.assigneeName} onChange={(value) => set("assigneeName", value)} options={ASSIGNEE_OPTIONS} /></label><label>Equipe<InputSelect value={form.teamName} onChange={(value) => set("teamName", value)} options={TEAM_OPTIONS} /></label><label>Prazo<input type="date" value={form.dueDate} onChange={(event) => set("dueDate", event.target.value)} /></label></div><label className="drawer-description">Descrição<textarea value={form.description} onChange={(event) => set("description", event.target.value)} rows="5" placeholder="Adicione contexto para quem vai executar..." /></label><div className="creation-note"><Sparkles size={16} /><span>Esta tarefa ficará disponível no quadro central e poderá receber subtarefas depois.</span></div></div><footer className="drawer-footer"><button className="button button-quiet" onClick={requestClose}>Cancelar</button><button className="button button-primary" disabled={!form.title.trim()} onClick={() => onSave({ ...form, quoteCode: quote?.code, quoteTitle: quote?.title })}><Plus size={16} />Criar tarefa</button></footer>{showDiscardPrompt && <UnsavedChangesDialog onContinue={() => setShowDiscardPrompt(false)} onDiscard={onClose} />}</aside></div>;
}

function CentralTaskDrawer({ onClose, onSave, employees = [], initialContext = null }) {
  const [form, setForm] = useState(() => ({ title: initialContext?.title || "", priority: initialContext?.priority || "medium", assigneeName: "NÃ£o atribuÃ­do", teamName: "OperaÃ§Ã£o", dueDate: initialContext?.dueDate || "", description: initialContext?.description || "" })); const initialFormRef = useRef(form); const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const isDirty = Object.keys(initialFormRef.current).some((key) => form[key] !== initialFormRef.current[key]);
  const requestClose = () => { if (isDirty) setShowDiscardPrompt(true); else onClose(); };
  useEffect(() => { const params = new URLSearchParams(window.location.search); const data = new URLSearchParams((params.get("data") || "").replace(/^\?/, "")); const source = params.get("source") || data.get("source"); const sourceId = params.get("sourceId") || data.get("sourceId") || ""; const sourceQuote = quotes.find((item) => item.id === sourceId); if (source === "quote" && sourceId) setForm((current) => ({ ...current, quoteId: sourceId, title: current.title || `Acompanhar ${sourceQuote?.code || "cotação"}`, dueDate: current.dueDate || String(sourceQuote?.deadline || "").slice(0, 10) })); }, [quotes]);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return <div className="drawer-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}><aside className="task-drawer new-task-drawer"><header className="drawer-header"><div><span className="eyebrow">Nova tarefa</span><span className="drawer-code">CRIAÇÃO MANUAL</span></div><button className="icon-button" onClick={requestClose}><X size={19} /></button></header><div className="drawer-body"><div className="drawer-title"><input autoFocus value={form.title} onChange={(event) => set("title", event.target.value)} placeholder="O que precisa ser feito?" aria-label="Título da tarefa" /><PriorityBadge priority={form.priority} /></div><div className="drawer-field-grid"><label>Status<InputSelect value="todo" disabled options={[{ value: "todo", label: "A fazer" }]} /></label><label>Prioridade<InputSelect value={form.priority} onChange={(value) => set("priority", value)} options={PRIORITY_OPTIONS} /></label><label>Responsável<InputSelect value={form.assigneeName} onChange={(value) => set("assigneeName", value)} options={["NÃ£o atribuÃ­do", ...employees.map((employee) => employee.name)]} /></label><label>Equipe<InputSelect value={form.teamName} onChange={(value) => set("teamName", value)} options={TEAM_OPTIONS} /></label><label>Prazo<input type="date" value={form.dueDate} onChange={(event) => set("dueDate", event.target.value)} /></label></div><label className="drawer-description">Descrição<textarea value={form.description} onChange={(event) => set("description", event.target.value)} rows="5" placeholder="Adicione contexto para quem vai executar..." /></label></div><footer className="drawer-footer"><button className="button button-quiet" onClick={requestClose}>Cancelar</button><button className="button button-primary" disabled={!form.title.trim()} onClick={() => onSave(form)}><Plus size={16} />Criar tarefa</button></footer>{showDiscardPrompt && <UnsavedChangesDialog onContinue={() => setShowDiscardPrompt(false)} onDiscard={onClose} />}</aside></div>;
}

export default function App() {
  const [active, setActive] = useState("dashboard"); const [state, setState] = useState(null); const [store] = useState(() => createDataStore()); const [selectedId, setSelectedId] = useState(""); const [creating, setCreating] = useState(false); const [filters, setFilters] = useState({ query: "", assignee: [], priority: [], source: [] }); const [checklistVisibility, setChecklistVisibility] = useState(readChecklistVisibility); const [notice, setNotice] = useState(""); const [error, setError] = useState(""); const [failedTaskDraft, setFailedTaskDraft] = useState(null);
  const confirmedStateRef = useRef(null); const pendingMutationsRef = useRef(new Map()); const noticeTimerRef = useRef(null); const launchHandledRef = useRef(false); const failedTaskReopenTimerRef = useRef(null);
  const dismissNotice = useCallback(() => { if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current); noticeTimerRef.current = null; setNotice(""); }, []);
  const showNotice = useCallback((message, duration = 2600) => { setNotice(message); if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current); noticeTimerRef.current = window.setTimeout(() => { noticeTimerRef.current = null; setNotice(""); }, duration); }, []);
  useEffect(() => () => { if (failedTaskReopenTimerRef.current) window.clearTimeout(failedTaskReopenTimerRef.current); }, []);
  const applyPendingMutations = useCallback((confirmed) => [...pendingMutationsRef.current.values()].reduce((current, mutation) => mutation.update(current), confirmed), []);
  useEffect(() => { store.load().then((next) => { confirmedStateRef.current = next; setState(applyPendingMutations(next)); }).catch((failure) => setError(failure.message || "Não foi possível carregar as tarefas.")); }, [store, applyPendingMutations]);
  const runMutation = useCallback((operation, message) => operation.then((next) => { confirmedStateRef.current = next; setState(applyPendingMutations(next)); showNotice(message); }).catch((failure) => showNotice(failure.message || "Não foi possível concluir a operação.", 5200)), [applyPendingMutations, showNotice]);
  useEffect(() => { if (!state || launchHandledRef.current) return; launchHandledRef.current = true; const params = new URLSearchParams(window.location.search); const data = new URLSearchParams((params.get("data") || "").replace(/^\?/, "")); const taskId = params.get("taskId") || data.get("taskId") || ""; const mode = params.get("mode") || data.get("mode") || ""; if (taskId) setSelectedId(taskId); if (mode === "create") setCreating(true); }, [state]);
  const runOptimisticMutation = useCallback((update, operation, pendingMessage, successMessage) => {
    const mutationId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    pendingMutationsRef.current.set(mutationId, { update });
    setState((current) => update(current));
    if (pendingMessage) showNotice(pendingMessage);
    return Promise.resolve().then(operation).then((next) => {
      confirmedStateRef.current = next;
      pendingMutationsRef.current.delete(mutationId);
      setState(applyPendingMutations(next));
      if (successMessage) showNotice(successMessage);
      return true;
    }).catch((failure) => {
      pendingMutationsRef.current.delete(mutationId);
      if (confirmedStateRef.current) setState(applyPendingMutations(confirmedStateRef.current));
      showNotice(`Falha ao sincronizar: ${failure.message || "operação não concluída."}`, 5200);
      return false;
    });
  }, [applyPendingMutations, showNotice]);
  const runOptimisticCreate = useCallback((input, operation, message, parentTaskId = null) => {
    const optimisticTask = buildOptimisticTask(input, parentTaskId);
    return runOptimisticMutation((current) => ({ ...current, tasks: [optimisticTask, ...current.tasks] }), operation, store.live ? "Tarefa adicionada. Enviando ao Dataverse..." : "Tarefa adicionada no mock local.", message);
  }, [runOptimisticMutation, store]);
  const selected = useMemo(() => {
    const taskItem = state?.tasks.find((item) => item.id === selectedId);
    if (!taskItem) return undefined;
    return failedTaskDraft?.id === taskItem.id ? { ...taskItem, ...failedTaskDraft.patch, syncStatus: undefined } : taskItem;
  }, [state, selectedId, failedTaskDraft]);
  const openTask = useCallback((id) => setSelectedId(id), []); const closeTask = useCallback(() => setSelectedId(""), []);
  const setChecklistVisibilityForTask = useCallback((id, visible) => { setChecklistVisibility((current) => { const next = { ...current, [id]: visible }; try { localStorage.setItem(CHECKLIST_VISIBILITY_STORAGE_KEY, JSON.stringify(next)); } catch { /* preferência visual permanece nesta sessão */ } return next; }); }, []);
  const moveTask = useCallback((id, status) => runOptimisticMutation((current) => applyOptimisticTaskPatch(current, id, { status }), () => store.updateTask(state, id, { status }), store.live ? "Status alterado. Sincronizando..." : "Status alterado no mock local.", store.live ? "Status sincronizado." : "Status atualizado localmente."), [state, store, runOptimisticMutation]);
  const saveTask = useCallback((id, patch) => {
    const shouldReopen = id === selectedId;
    return runOptimisticMutation((current) => applyOptimisticTaskPatch(current, id, patch), () => store.updateTask(state, id, patch), "", "").then((success) => {
      if (success) {
        if (shouldReopen) setFailedTaskDraft((current) => current?.id === id ? null : current);
        return true;
      }
      if (!shouldReopen) return false;
      setFailedTaskDraft({ id, patch });
      if (failedTaskReopenTimerRef.current) window.clearTimeout(failedTaskReopenTimerRef.current);
      setSelectedId("");
      failedTaskReopenTimerRef.current = window.setTimeout(() => { failedTaskReopenTimerRef.current = null; setSelectedId(id); }, 120);
      return false;
    });
  }, [state, store, runOptimisticMutation, selectedId]);
  const deleteTask = useCallback((id) => {
    runOptimisticMutation((current) => ({ ...current, tasks: current.tasks.filter((taskItem) => taskItem.id !== id) }), () => store.deleteTask(state, id), "", "").then((success) => { if (success) setSelectedId(""); });
  }, [state, store, runOptimisticMutation]);
  const createNewTask = useCallback((input) => { const { subtasks = [], ...taskInput } = input; const params = new URLSearchParams(window.location.search); const data = new URLSearchParams((params.get("data") || "").replace(/^\?/, "")); const isQuoteFollowUp = (params.get("source") || data.get("source")) === "quote"; const commonTask = isQuoteFollowUp ? { ...taskInput, sourceType: "quote" } : { ...taskInput, quoteId: undefined, sourceType: "manual", sourceId: undefined, sourceCode: undefined, quoteCode: undefined, quoteTitle: undefined }; const operation = () => store.createTask(state, commonTask).then((nextState) => { const parent = nextState.tasks.find((taskItem) => taskItem.title === commonTask.title && !taskItem.parentTaskId); if (!parent || !subtasks.length) return nextState; return subtasks.reduce((promise, title) => promise.then((currentState) => store.createSubtask(currentState, parent.id, { title, description: "", priority: "medium", assigneeName: "Não atribuído", teamName: "Operação", dueDate: "" })), Promise.resolve(nextState)); }); return runOptimisticCreate(commonTask, operation, store.live ? "Tarefa sincronizada." : "Tarefa salva localmente.").then(() => setCreating(false)); }, [state, store, runOptimisticCreate]);
  const createSubtask = useCallback((parentId, title) => { const input = { title, description: "", priority: "medium", assigneeName: "Não atribuído", teamName: "Operação", dueDate: "" }; runOptimisticCreate(input, () => store.createSubtask(state, parentId, input), store.live ? "Subtarefa sincronizada." : "Subtarefa salva localmente.", parentId); }, [state, store, runOptimisticCreate]);
  const createQualityTask = useCallback((item) => { const input = { title: item.title, description: item.description, dueDate: item.dueDate, sourceType: "quality", sourceId: item.id, sourceCode: item.code, sourceLabel: item.type === "error" ? "Erro operacional" : "Ação operacional" }; runOptimisticCreate(input, () => store.createQualityTask(state, item), store.live ? "Tarefa de qualidade sincronizada." : "Tarefa de qualidade salva localmente."); }, [state, store, runOptimisticCreate]);
  const refreshData = useCallback((quote) => { if (!quote) return runMutation(store.save(state), store.live ? "Dados atualizados." : "Dados locais atualizados."); const input = { title: quoteTaskTitle(quote), quoteId: quote.id, quoteCode: quote.code || "", quoteTitle: quote.title || "", dueDate: quote.deadline, priority: "medium", sourceType: "quote", assigneeName: "Não atribuído", teamName: "Comercial" }; return runOptimisticCreate(input, () => store.ensureQuoteTask(state, quote), store.live ? "Tarefa principal sincronizada." : "Tarefa principal salva localmente."); }, [state, store, runMutation, runOptimisticCreate]);
  const reloadData = useCallback(() => { runMutation(store.reset(), "Dados recarregados."); setSelectedId(""); }, [store, runMutation]);
  const addComment = useCallback((id, text) => runOptimisticMutation((current) => addOptimisticComment(current, id, text), () => store.addComment(state, id, text), store.live ? "Comentário adicionado. Sincronizando..." : "Comentário adicionado no mock local.", store.live ? "Comentário sincronizado." : "Comentário salvo localmente."), [state, store, runOptimisticMutation]);
  const addAttachment = useCallback((id, file) => runOptimisticMutation((current) => addOptimisticAttachment(current, id, file), () => store.addAttachment(state, id, file), store.live ? "Anexo em envio..." : "Anexo adicionado no mock local.", store.live ? "Anexo salvo no OneDrive." : "Anexo salvo localmente."), [state, store, runOptimisticMutation]);
  const workItems = useMemo(() => normalizeWorkItems(state || {}), [state?.tasks, state?.quality]);
  if (error) return <div className="app-error"><strong>Não foi possível carregar o Planner.</strong><span>{error}</span><button className="button button-secondary" onClick={() => { setError(""); store.load().then(setState).catch((failure) => setError(failure.message)); }}>Tentar novamente</button></div>;
  if (!state) return <div className="app-loading">Carregando dados operacionais…</div>;
  const viewState = { ...state, workItems };
  const currentEmployee = resolveCurrentEmployee(state.employees, store.live);
  const personalItems = currentEmployee ? workItems.filter((item) => isAssignedToEmployee(item, currentEmployee)) : [];
  const personalStats = workItemStats(filterWorkItems(personalItems));
  const openTaskCount = state.tasks.filter((task) => !task.parentTaskId && !["done", "cancelled"].includes(task.status)).length;
  ASSIGNEE_OPTIONS.splice(1, ASSIGNEE_OPTIONS.length - 1, ...(state.employees || []).map((item) => item.name));
  const renderPage = () => {
    if (active === "dashboard" || active === "team") return <CentralView state={viewState} mode={active === "dashboard" ? "mine" : "team"} currentEmployee={currentEmployee} onOpenTask={openTask} onOpenSource={(item) => store.openSource?.(item)} onCreate={() => setCreating(true)} />;
    if (active === "board") return <BoardView state={state} currentEmployee={currentEmployee} checklistVisibility={checklistVisibility} onOpen={openTask} onToggleSubtask={saveTask} onMove={moveTask} onCreate={() => setCreating(true)} filters={filters} setFilters={setFilters} />;
    if (active === "list") return <ListView state={state} onOpen={openTask} onCreate={() => setCreating(true)} filters={filters} setFilters={setFilters} />;
    if (active === "calendar") return <CalendarView state={state} onOpen={openTask} onCreate={() => setCreating(true)} filters={filters} setFilters={setFilters} />;
    if (active === "quality") return <QualityView state={state} onCreate={createQualityTask} onCreateTask={() => setCreating(true)} filters={filters} setFilters={setFilters} />;
    return <SettingsView onReset={reloadData} live={store.live} />;
  };
  return <AppShell active={active} onNavigate={setActive} onCreate={() => setCreating(true)} tasks={state.tasks} live={store.live} currentEmployee={currentEmployee} personalStats={personalStats} openTaskCount={openTaskCount}>{renderPage()}{notice && <div className={`toast ${notice.startsWith("Falha") ? "toast-error" : ""}`} role="status" aria-live="polite"><CheckCircle2 size={17} /><span>{notice}</span><button className="toast-close" type="button" onClick={dismissNotice} aria-label="Fechar notificação" title="Fechar notificação"><X size={15} /></button></div>}{selected && <TaskDrawer task={selected} state={state} currentEmployee={currentEmployee} showChecklistOnCard={Boolean(checklistVisibility[selected.id])} onToggleChecklistOnCard={(visible) => setChecklistVisibilityForTask(selected.id, visible)} onClose={closeTask} onSave={saveTask} onDelete={deleteTask} onComment={addComment} onAttachment={addAttachment} onOpenQuote={(id) => { setActive("dashboard"); closeTask(); showNotice(`Cotação ${state.quotes.find((quote) => quote.id === id)?.code || ""} vinculada.`); }} onAddSubtask={createSubtask} />}{creating && <NewTaskDrawer quotes={state.quotes} onClose={() => setCreating(false)} onSave={createNewTask} />}</AppShell>;
}
