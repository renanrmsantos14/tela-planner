import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  lazy,
  Suspense,
  memo,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  AtSign,
  BellRing,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ListChecks,
  Trash2,
  Clock3,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Flag,
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  Menu,
  MessageCircle,
  Paperclip,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Sparkles,
  Target,
  UserRound,
  Users,
  X,
  UploadCloud,
} from "lucide-react";
import {
  addOptimisticAttachment,
  addOptimisticComment,
  applyOptimisticTaskPatch,
  buildAssigneeOptions,
  buildEmployeeAssigneeOptions,
  buildOptimisticTask,
  buildTaskCreationInput,
  filterTasks,
  formatDate,
  formatLongDate,
  isDueToday,
  isOverdue,
  mentionedEmployees,
  normalizeAssigneeNames,
  normalizeText,
  PRIORITIES,
  quoteTaskTitle,
  sortTasks,
  sourceById,
  STATUSES,
  statusById,
  TASK_SOURCES,
  taskStats,
} from "./domain";
import { createDataStore } from "./dataverse";
import SearchableSelect, {
  SearchableMultiSelect,
} from "./SearchableSelect.jsx";
import CentralView from "./CentralView.jsx";
import AssigneeDisplay from "./AssigneeDisplay.jsx";
import { MentionableField, useMentionController } from "./MentionableField.jsx";
import LoadingFallback from "./LoadingFallback.jsx";
import {
  filterWorkItems,
  isAssignedToEmployee,
  normalizeWorkItems,
  workItemStats,
} from "./workItems.js";
import { APP_VERSION } from "./version.js";
import {
  deadlineRole,
  unreadCount,
  validateDeadlineChange,
} from "./notifications.js";

const CENTRAL_NAV_ITEMS = [
  ["dashboard", "Início", LayoutDashboard],
  ["board", "Tarefas", ClipboardList],
  ["quality", "Qualidade", ShieldAlert],
  ["settings", "Configurações", Settings],
];

const MOBILE_NAV_ITEMS = [
  ["dashboard", "Hoje", LayoutDashboard],
  ["board", "Tarefas", ClipboardList],
  ["more", "Mais", Menu],
];

const TASK_VIEW_ITEMS = [
  ["board", "Quadro", LayoutDashboard],
  ["list", "Lista", ListFilter],
  ["calendar", "Agenda", CalendarDays],
];

const STATUS_OPTIONS = STATUSES.map((item) => ({
  value: item.id,
  label: item.label,
}));
const TASK_FILTER_STATUS_OPTIONS = [
  ...STATUS_OPTIONS,
  { value: "cancelled", label: "Cancelada" },
];
const PRIORITY_OPTIONS = PRIORITIES.map((item) => ({
  value: item.id,
  label: item.label,
}));
const SOURCE_OPTIONS = TASK_SOURCES.map((item) => ({
  value: item.id,
  label: item.label,
}));
const TEAM_OPTIONS = ["Comercial", "Operação", "Financeiro", "Qualidade"];
const CALENDAR_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
});
const TODAY_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});
const CHECKLIST_VISIBILITY_STORAGE_KEY =
  "betinhos-tela-planner-checklist-visibility-v1";
let plannerQuoteSearch = null;

function createDefaultFilters() {
  return {
    query: "",
    assignee: [],
    status: [],
    priority: [],
    source: [],
    team: "",
  };
}

function readChecklistVisibility() {
  try {
    return JSON.parse(
      localStorage.getItem(CHECKLIST_VISIBILITY_STORAGE_KEY) || "{}",
    );
  } catch {
    return {};
  }
}

function currentUserId() {
  return String(
    window.parent?.Xrm?.Utility?.getGlobalContext?.().userSettings?.userId ||
      window.Xrm?.Utility?.getGlobalContext?.().userSettings?.userId ||
      "",
  )
    .replace(/[{}]/g, "")
    .toLowerCase();
}

function launchQuoteId() {
  const params = new URLSearchParams(window.location.search);
  const data = new URLSearchParams(
    (params.get("data") || "").replace(/^\?/, ""),
  );
  return (
    params.get("quoteId") ||
    data.get("quoteId") ||
    params.get("recordId") ||
    data.get("recordId") ||
    ""
  );
}

function resolveCurrentEmployee(employees, live) {
  if (!live)
    return (
      (employees || []).find((employee) => employee.isMockCurrentUser) || null
    );
  const userId = currentUserId();
  return (
    (employees || []).find(
      (employee) =>
        String(employee.userId || "")
          .replace(/[{}]/g, "")
          .toLowerCase() === userId,
    ) || null
  );
}

function useMediaQuery(query) {
  const getMatches = () =>
    typeof window !== "undefined" && window.matchMedia?.(query).matches;
  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, [query]);

  return matches;
}

function Avatar({ name = "Sistema", small = false }) {
  const names = String(name || "Sistema")
    .split(/\s*,\s*/)
    .filter(Boolean);
  const initials = (value) =>
    value
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  if (names.length === 1)
    return (
      <span className={`avatar ${small ? "avatar-small" : ""}`} title={name}>
        {initials(names[0])}
      </span>
    );
  const visibleNames = names.slice(0, 2);
  return (
    <span
      className={`avatar avatar-stack ${small ? "avatar-stack-small" : ""}`}
      title={name}
      aria-label={`${names.length} responsáveis`}
    >
      {visibleNames.map((item, index) => (
        <span className="avatar avatar-stack-item" key={`${item}-${index}`}>
          {initials(item)}
        </span>
      ))}
      {names.length > visibleNames.length && (
        <span className="avatar avatar-stack-count">
          +{names.length - visibleNames.length}
        </span>
      )}
    </span>
  );
}

function shortAssigneeName(name = "Não atribuído") {
  const value = String(name || "Não atribuído").trim();
  if (!value || /^não atribuído$/i.test(value)) return value || "Não atribuído";
  const names = value.split(/\s*,\s*/).filter(Boolean);
  const first = names[0];
  const parts = first.split(/\s+/);
  const shortName =
    parts.length > 1
      ? `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`
      : first;
  return names.length > 1 ? `${shortName} +${names.length - 1}` : shortName;
}

function StatusBadge({ status }) {
  const item = statusById(status);
  return (
    <span className={`badge badge-${item.tone}`}>
      <span className="badge-dot" />
      {item.label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const item =
    PRIORITIES.find((entry) => entry.id === priority) || PRIORITIES[1];
  return <span className={`priority priority-${item.tone}`}>{item.label}</span>;
}

function SourceBadge({ sourceType }) {
  const item = sourceById(sourceType);
  return (
    <span className={`source-badge source-${item.tone}`}>{item.label}</span>
  );
}

function InputSelect({
  value,
  onChange,
  options,
  placeholder = "Selecione",
  disabled = false,
  multiple = Array.isArray(value),
}) {
  const normalizedOptions = useMemo(
    () =>
      options.map((option) =>
        typeof option === "string" ? { value: option, label: option } : option,
      ),
    [options],
  );
  const remoteSearch = options.find(
    (option) => typeof option?._remoteSearch === "function",
  )?._remoteSearch;
  return multiple ? (
    <SearchableMultiSelect
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      options={normalizedOptions}
    />
  ) : (
    <SearchableSelect
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      options={normalizedOptions}
      onQueryChange={remoteSearch}
    />
  );
}

function PriorityPicker({ value, onChange }) {
  const selectedItem =
    PRIORITIES.find((item) => item.id === value) || PRIORITIES[0];
  return (
    <div
      className="priority-picker"
      role="group"
      aria-label={`Prioridade atual: ${selectedItem.label}`}
    >
      <div className="priority-picker-options">
        {PRIORITIES.map((item) => {
          const isSelected = value === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`priority-option priority-option-${item.tone}${isSelected ? " is-selected" : ""}`}
              aria-label={item.label}
              aria-pressed={isSelected}
              title={item.label}
              onClick={() => onChange(item.id)}
            >
              <Flag size={18} strokeWidth={2.2} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <span className={`priority-picker-current priority-current-${selectedItem.tone}`}>
        {selectedItem.label}
      </span>
    </div>
  );
}

function StatusPicker({ value, onChange }) {
  const selectedItem =
    STATUSES.find((item) => item.id === value) || STATUSES[0];
  const selectedTone = selectedItem.tone;
  return (
    <div
      className="status-picker"
      role="group"
      aria-label={`Status atual: ${selectedItem.label}`}
    >
      <div className="status-picker-options">
        {STATUSES.map((item) => {
          const Icon = {
            todo: ClipboardList,
            doing: LoaderCircle,
            waiting: Clock3,
            done: CheckCircle2,
          }[item.id] || ClipboardList;
          const isSelected = value === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`status-option status-option-${item.tone}${isSelected ? " is-selected" : ""}`}
              aria-label={item.label}
              aria-pressed={isSelected}
              title={item.label}
              onClick={() => onChange(item.id)}
            >
              <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <span className={`status-picker-current status-current-${selectedTone}`}>
        {selectedItem.label}
      </span>
    </div>
  );
}

function UnsavedChangesDialog({ onContinue, onDiscard }) {
  return (
    <div
      className="drawer-confirm-layer"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div
        className="drawer-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-confirm-title"
      >
        <h2 id="drawer-confirm-title">Alterações não salvas</h2>
        <p>Você tem alterações que ainda não foram salvas. Deseja descartar?</p>
        <div className="drawer-confirm-actions">
          <button
            className="button button-quiet"
            type="button"
            onClick={onContinue}
          >
            Continuar editando
          </button>
          <button
            className="button button-danger"
            type="button"
            onClick={onDiscard}
          >
            Descartar
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteTaskDialog({
  taskTitle,
  onCancel,
  onConfirm,
  subject = "tarefa",
}) {
  return (
    <div
      className="drawer-confirm-layer"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div
        className="drawer-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-task-title"
      >
        <h2>Excluir {subject}?</h2>
        <p>
          “{taskTitle}” será removida do Planner. Esta ação não pode ser
          desfeita.
        </p>
        <div className="drawer-confirm-actions">
          <button
            className="button button-quiet"
            type="button"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className="button button-danger"
            type="button"
            onClick={onConfirm}
          >
            Excluir {subject}
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationsPanel({
  notifications,
  tasks,
  onClose,
  onOpenTask,
  onMarkRead,
  onMarkAllRead,
}) {
  return (
    <div
      className="notification-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="notification-panel" aria-label="Notificações">
        <header>
          <div>
            <span className="eyebrow">CENTRAL DE AVISOS</span>
            <h2>Notificações</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Fechar notificações"
          >
            <X size={18} />
          </button>
        </header>
        <div className="notification-panel-actions">
          <span>{unreadCount(notifications)} não lidas</span>
          <button
            className="text-button"
            type="button"
            onClick={onMarkAllRead}
            disabled={!unreadCount(notifications)}
          >
            Marcar todas como lidas
          </button>
        </div>
        <div className="notification-list">
          {notifications.length ? (
            notifications.map((item) => {
              const task = tasks.find((entry) => entry.id === item.taskId);
              return (
                <article
                  className={`notification-item ${item.readAt ? "is-read" : "is-unread"}`}
                  key={item.id}
                >
                  <span className="notification-dot" />
                  <button type="button" onClick={() => onOpenTask(item)}>
                    <strong>{item.title}</strong>
                    <p>
                      {item.message || task?.title || "Atualização da tarefa"}
                    </p>
                    <small>
                      {new Date(item.occurredAt || Date.now()).toLocaleString(
                        "pt-BR",
                      )}
                    </small>
                  </button>
                  {!item.readAt && (
                    <button
                      className="notification-read"
                      type="button"
                      onClick={() => onMarkRead(item.id)}
                    >
                      Marcar como lida
                    </button>
                  )}
                </article>
              );
            })
          ) : (
            <div className="notification-empty">
              <BellRing size={24} />
              <strong>Nenhuma notificação</strong>
              <span>
                Novas atribuições, menções e cobranças aparecerão aqui.
              </span>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function AppShell({
  active,
  onNavigate,
  children,
  onCreate,
  tasks,
  live,
  currentEmployee,
  personalStats,
  openTaskCount,
  mentionEmployees = [],
  notifications = [],
  onOpenNotification,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onRefresh,
  refreshing = false,
}) {
  const [expanded, setExpanded] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  useMentionController(
    mentionEmployees.length
      ? mentionEmployees
      : globalThis.__plannerEmployees || [],
  );
  const stats = personalStats || taskStats(tasks);
  const todayLabel = TODAY_LABEL_FORMATTER.format(new Date()).replace(".", "");
  const userName = currentEmployee?.name || "Usuário não vinculado";
  const desktopNavActive =
    active === "team"
      ? "dashboard"
      : ["board", "list", "calendar"].includes(active)
        ? "board"
        : active;
  const mobileNavActive = ["quality", "settings"].includes(active)
    ? "more"
    : desktopNavActive;
  const activeLabel =
    MOBILE_NAV_ITEMS.find(([id]) => id === mobileNavActive)?.[1] || "Central";
  return (
    <div className={`app-shell ${expanded ? "" : "sidebar-collapsed"}`}>
      <aside className="sidebar">
        <button
          className="sidebar-toggle"
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-label={expanded ? "Recolher navegação" : "Expandir navegação"}
          title={expanded ? "Recolher navegação" : "Expandir navegação"}
        >
          {expanded ? (
            <PanelLeftClose size={18} />
          ) : (
            <PanelLeftOpen size={18} />
          )}
        </button>
        <div className="brand-block">
          <div className="brand-mark">
            <ClipboardList size={20} />
          </div>
          <div className="brand-copy">
            <strong>Central de Trabalho</strong>
            <span>Operação Betinhos</span>
          </div>
        </div>
        <div
          className="sidebar-day-card"
          aria-label={`Hoje, ${stats.open} pendências e ${stats.overdue} atrasados`}
        >
          <div className="sidebar-day-title">
            <span>Hoje</span>
            <strong>{todayLabel}</strong>
          </div>
          <div className="sidebar-day-stats">
            <span className="sidebar-day-stat">
              <strong>{stats.open}</strong>
              <small>Pendências</small>
            </span>
            <span className="sidebar-day-stat sidebar-day-stat-overdue">
              <strong>{stats.overdue}</strong>
              <small>Atrasados</small>
            </span>
          </div>
        </div>
        <nav className="main-nav">
          {CENTRAL_NAV_ITEMS.map(([id, label, Icon]) => (
            <button
              key={id}
              className={
                desktopNavActive === id ? "nav-item active" : "nav-item"
              }
              onClick={() => onNavigate(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "board" && (
                <span className="nav-count">{openTaskCount}</span>
              )}
              {id === "dashboard" && personalStats?.alertCount > 0 && (
                <span className="nav-count nav-count-alert">
                  {personalStats.alertCount}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mock-label">
            <span className="pulse-dot" />
            {live ? "Dataverse conectado" : "Modo local · mock"}
          </div>
          <div
            className="sidebar-version"
            aria-label={`Versão do aplicativo ${APP_VERSION}`}
          >
            Versão {APP_VERSION}
          </div>
          <div className="user-card">
            <Avatar name={userName} />
            <div className="user-copy">
              <strong>{userName}</strong>
              <span>
                {currentEmployee ? "Administrativo" : "Sem vínculo Dataverse"}
              </span>
            </div>
            <button
              className="user-settings-button"
              type="button"
              onClick={() => onNavigate("settings")}
              aria-label="Abrir configurações"
              title="Configurações"
            >
              <Settings size={15} />
            </button>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <div className="app-topbar" aria-label="Ações do aplicativo">
          <button
            className="notification-trigger"
            type="button"
            onClick={() => setNotificationsOpen(true)}
            aria-label={`Abrir notificações${unreadCount(notifications) ? `, ${unreadCount(notifications)} não lidas` : ""}`}
            title="Notificações"
          >
            <BellRing size={17} />
            {unreadCount(notifications) > 0 && <b>{unreadCount(notifications)}</b>}
          </button>
          <button
            className={`refresh-trigger${refreshing ? " is-refreshing" : ""}`}
            type="button"
            onClick={() => onRefresh?.({ silent: false })}
            disabled={refreshing}
            aria-label={refreshing ? "Atualizando dados" : "Atualizar dados"}
            title={refreshing ? "Atualizando dados" : "Atualizar dados"}
          >
            <RotateCcw size={16} />
          </button>
        </div>
        <header className="mobile-header">
          <div className="mobile-header-copy">
            <strong>{activeLabel}</strong>
            <span>Central de Trabalho</span>
          </div>
          <div
            className="mobile-header-status"
            title={live ? "Dataverse conectado" : "Modo local"}
          >
            <span className="pulse-dot" />
            {live ? "Live" : "Local"}
          </div>
          <button
            className="notification-trigger mobile-notification-trigger"
            type="button"
            onClick={() => setNotificationsOpen(true)}
            aria-label={`Abrir notificações${unreadCount(notifications) ? `, ${unreadCount(notifications)} não lidas` : ""}`}
          >
            <BellRing size={18} />
            {unreadCount(notifications) > 0 && (
              <b>{unreadCount(notifications)}</b>
            )}
          </button>
          <button
            className={`refresh-trigger mobile-refresh-trigger${refreshing ? " is-refreshing" : ""}`}
            type="button"
            onClick={() => onRefresh?.({ silent: false })}
            disabled={refreshing}
            aria-label={refreshing ? "Atualizando dados" : "Atualizar dados"}
            title={refreshing ? "Atualizando dados" : "Atualizar dados"}
          >
            <RotateCcw size={16} />
          </button>
          <Avatar name={userName} small />
        </header>
        {children}
      </main>
      <nav className="mobile-bottom-nav" aria-label="Navegação principal">
        {MOBILE_NAV_ITEMS.map(([id, label, Icon]) => (
          <button
            key={id}
            className={
              mobileNavActive === id
                ? "mobile-nav-item active"
                : "mobile-nav-item"
            }
            type="button"
            onClick={() => onNavigate(id)}
            aria-current={mobileNavActive === id ? "page" : undefined}
          >
            <Icon size={19} strokeWidth={mobileNavActive === id ? 2.4 : 2} />
            <span>{label}</span>
            {id === "board" && openTaskCount > 0 && <b>{openTaskCount}</b>}
            {id === "dashboard" && personalStats?.alertCount > 0 && (
              <b>{personalStats.alertCount}</b>
            )}
          </button>
        ))}
      </nav>
      <button
        className="mobile-fab"
        onClick={onCreate}
        aria-label="Criar nova tarefa"
      >
        <Plus size={22} />
      </button>
      {notificationsOpen && (
        <NotificationsPanel
          notifications={notifications}
          tasks={tasks}
          onClose={() => setNotificationsOpen(false)}
          onOpenTask={(item) => {
            onOpenNotification?.(item);
            setNotificationsOpen(false);
          }}
          onMarkRead={onMarkNotificationRead}
          onMarkAllRead={onMarkAllNotificationsRead}
        />
      )}
    </div>
  );
}

function PageHeader({ eyebrow, title, description, action, children }) {
  return (
    <div className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="header-actions">
        {children}
        {action}
      </div>
    </div>
  );
}

function TaskViewSelector({ active, onSelect }) {
  return (
    <div
      className="task-view-selector"
      aria-label="Modo de visualização das tarefas"
    >
      {TASK_VIEW_ITEMS.map(([id, label, Icon]) => (
        <button
          key={id}
          className={
            active === id ? "task-view-button active" : "task-view-button"
          }
          type="button"
          onClick={() => onSelect(id)}
          aria-label={label}
          aria-pressed={active === id}
          title={label}
        >
          <Icon size={17} strokeWidth={active === id ? 2.3 : 2} />
        </button>
      ))}
    </div>
  );
}

function TaskScopeSelector({ active, onSelect, disabled = false }) {
  return (
    <div className="task-scope-selector" aria-label="Escopo das tarefas">
      <button
        className={
          active === "all" ? "task-scope-button active" : "task-scope-button"
        }
        type="button"
        onClick={() => onSelect("all")}
        aria-pressed={active === "all"}
      >
        <Users size={14} />
        Todas
      </button>
      <button
        className={
          active === "mine" ? "task-scope-button active" : "task-scope-button"
        }
        type="button"
        onClick={() => onSelect("mine")}
        aria-pressed={active === "mine"}
        disabled={disabled}
        title={
          disabled ? "Usuário atual não identificado" : "Filtrar minhas tarefas"
        }
      >
        <UserRound size={14} />
        Minhas
      </button>
    </div>
  );
}

function tasksForView(tasks) {
  return tasks;
}

const LIST_SORT_COLUMNS = [
  ["title", "Tarefa"],
  ["quoteCode", "Vínculo"],
  ["assigneeName", "Responsável"],
  ["dueDate", "Prazo"],
  ["status", "Status"],
];

function compareListTasks(left, right, key) {
  if (key === "dueDate") {
    const leftDate = left.dueDate || "9999-12-31";
    const rightDate = right.dueDate || "9999-12-31";
    return leftDate.localeCompare(rightDate);
  }
  if (key === "status")
    return (
      STATUSES.findIndex((item) => item.id === left.status) -
      STATUSES.findIndex((item) => item.id === right.status)
    );
  const value = (task) =>
    key === "assigneeName"
      ? normalizeAssigneeNames(task.assigneeNames || task.assigneeName).join(
          ", ",
        )
      : task[key];
  return normalizeText(value(left)).localeCompare(normalizeText(value(right)));
}

function sortListTasks(tasks, sort) {
  const direction = sort.direction === "desc" ? -1 : 1;
  return [...tasks].sort(
    (left, right) =>
      compareListTasks(left, right, sort.key) * direction ||
      String(left.id).localeCompare(String(right.id)),
  );
}

function DataLoadingView({ loading, error }) {
  const stage = loading?.core
    ? "Carregando tarefas e responsáveis"
    : loading?.quotes || loading?.quality
      ? "Preparando dados complementares"
      : "Finalizando conexão";
  return (
    <div className="data-loading-view" role="status" aria-live="polite">
      <div className="loading-orbit" aria-hidden="true">
        <span />
      </div>
      <div className="loading-copy">
        <strong>{stage}</strong>
        <span>
          {error ||
            "A operação continua disponível enquanto os dados são preparados."}
        </span>
      </div>
      <div className="loading-skeleton-grid" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

const TaskCard = memo(function TaskCard({
  task: taskItem,
  subtasks = [],
  currentEmployee,
  hasUnreadMention = false,
  showChecklistOnCard = false,
  onOpen,
  onToggleSubtask,
  onComplete,
  showQuickComplete = false,
  compact = false,
  enableDrag = true,
  isDragging = false,
  dropFeedback = "",
  onDragStart,
  onDragEnd,
}) {
  const overdue = isOverdue(taskItem);
  const canOpen = !taskItem.id.startsWith("optimistic-");
  const completedSubtasks = subtasks.filter(
    (subtask) => subtask.status === "done",
  ).length;
  const visibleSubtasks = subtasks.slice(0, 3);
  return (
    <article
      className={`task-card ${compact ? "task-card-compact" : ""} ${overdue ? "task-overdue" : ""} ${taskItem.syncStatus === "syncing" ? "task-syncing" : ""} ${isDragging ? "task-card-dragging" : ""}`}
      draggable={enableDrag && taskItem.syncStatus !== "syncing"}
      tabIndex={canOpen ? "0" : "-1"}
      data-task-id={taskItem.id}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/task-id", taskItem.id);
        onDragStart?.(taskItem.id, event);
      }}
      onDragEnd={onDragEnd}
      onClick={() => {
        if (canOpen) onOpen(taskItem.id);
      }}
      onKeyDown={(event) => {
        if (canOpen && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen(taskItem.id);
        }
      }}
    >
      <div className="task-card-top">
        <PriorityBadge priority={taskItem.priority} />
        {overdue && <span className="overdue-label">Vencida</span>}
        {canOpen && (
          <button
            className="card-open"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(taskItem.id);
            }}
            aria-label="Abrir tarefa"
          >
            <ArrowUpRight size={15} />
          </button>
        )}
      </div>
      <h3>{taskItem.title}</h3>
      {(taskItem.sourceType || taskItem.quoteId) && (
        <div className="task-source-row">
          <SourceBadge
            sourceType={
              taskItem.sourceType || (taskItem.quoteId ? "quote" : "manual")
            }
          />
          <span>{taskItem.sourceCode || taskItem.quoteCode}</span>
          <em>{taskItem.sourceLabel || taskItem.quoteTitle}</em>
        </div>
      )}
      {hasUnreadMention && (
        <div className="task-mention-alert">
          <BellRing size={13} />
          <span>Você foi mencionado</span>
        </div>
      )}
      {showChecklistOnCard && subtasks.length > 0 && (
        <div
          className="task-checklist"
          aria-label={`Checklist: ${completedSubtasks} de ${subtasks.length} concluídas`}
        >
          <div className="task-checklist-heading">
            <span>
              <ListChecks size={13} />
              Checklist
            </span>
            <strong>
              {completedSubtasks}/{subtasks.length}
            </strong>
          </div>
          <div className="task-checklist-items">
            {visibleSubtasks.map((subtask) => {
              const completed = subtask.status === "done";
              return (
                <button
                  className={`task-checklist-item ${completed ? "is-complete" : ""}`}
                  key={subtask.id}
                  type="button"
                  aria-pressed={completed}
                  disabled={subtask.syncStatus === "syncing"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleSubtask?.(subtask.id, {
                      status: completed ? "todo" : "done",
                    });
                  }}
                >
                  <span className="task-checklist-box">
                    {completed && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span>{subtask.title}</span>
                </button>
              );
            })}
          </div>
          {subtasks.length > visibleSubtasks.length && (
            <span className="task-checklist-more">
              +{subtasks.length - visibleSubtasks.length} itens
            </span>
          )}
        </div>
      )}
      <div className="task-card-footer">
        <AssigneeDisplay
          value={
            taskItem.assigneeProfiles?.length
              ? taskItem.assigneeProfiles
              : taskItem.assigneeNames || taskItem.assigneeName
          }
          small
        />
        {taskItem.syncStatus === "syncing" ? (
          <span className="sync-chip" role="status">
            Enviando...
          </span>
        ) : (
          <span className={overdue ? "date-chip overdue" : "date-chip"}>
            <Clock3 size={13} />
            {formatDate(taskItem.dueDate)}
          </span>
        )}
        {showQuickComplete &&
          !["done", "cancelled"].includes(taskItem.status) && (
            <button
              className="task-quick-action"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onComplete?.(taskItem.id);
              }}
            >
              Concluir
            </button>
          )}
      </div>
      {taskItem.parentTaskId && (
        <div className="subtask-mark">
          <CheckCircle2 size={13} />
          Subtarefa
        </div>
      )}
      {dropFeedback === "loading" && (
        <div
          className="task-drop-feedback task-drop-feedback-loading"
          role="status"
          aria-label="Salvando mudança de coluna"
        >
          <LoaderCircle size={22} aria-hidden="true" />
        </div>
      )}
      {dropFeedback === "success" && (
        <div
          className="task-drop-feedback task-drop-feedback-success"
          role="status"
          aria-label="Mudança de coluna concluída"
        >
          <Check size={22} strokeWidth={2.6} aria-hidden="true" />
        </div>
      )}
    </article>
  );
});

function getDropIndex(column, pointerY, draggedId) {
  const cards = [...column.querySelectorAll(".task-card[data-task-id]")].filter(
    (card) => card.dataset.taskId !== draggedId,
  );
  for (let index = 0; index < cards.length; index += 1) {
    const rect = cards[index].getBoundingClientRect();
    if (pointerY < rect.top + rect.height / 2) return index;
  }
  return cards.length;
}

const DRAG_TRANSFER_DURATION = 230;
const DRAG_SETTLE_DURATION = 36;
const DRAG_REORDER_DURATION = 180;
const DRAG_TOTAL_DURATION =
  DRAG_TRANSFER_DURATION + DRAG_SETTLE_DURATION + DRAG_REORDER_DURATION;
const DRAG_TRANSFER_EASING = "cubic-bezier(.22, .61, .36, 1)";
const DRAG_REORDER_EASING = "cubic-bezier(.77, 0, .175, 1)";

function translateBetween(previous, next) {
  return `translate(${previous.left - next.left}px, ${previous.top - next.top}px)`;
}

const Board = memo(function Board({
  tasks,
  subtasksByParent,
  currentEmployee,
  checklistVisibility,
  unreadMentionTaskIds,
  onOpen,
  onToggleSubtask,
  onMove,
  onCreate,
}) {
  const [dragState, setDragState] = useState(null);
  const [dropExit, setDropExit] = useState(null);
  const [dropFeedback, setDropFeedback] = useState(null);
  const boardRef = useRef(null);
  const cardRectsRef = useRef(new Map());
  const animateLayoutRef = useRef(false);
  const layoutAnimationsRef = useRef(new Map());
  const pendingTransferRef = useRef(null);
  const feedbackTimerRef = useRef(null);
  const feedbackClearTimerRef = useRef(null);
  const clearFeedbackTimers = useCallback(() => {
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    if (feedbackClearTimerRef.current)
      window.clearTimeout(feedbackClearTimerRef.current);
    feedbackTimerRef.current = null;
    feedbackClearTimerRef.current = null;
  }, []);
  useEffect(() => () => clearFeedbackTimers(), [clearFeedbackTimers]);
  useLayoutEffect(() => {
    const cards = [
      ...(boardRef.current?.querySelectorAll(".task-card[data-task-id]") || []),
    ];
    layoutAnimationsRef.current.forEach((animation) => animation.cancel());
    layoutAnimationsRef.current.clear();
    const nextRects = new Map(
      cards.map((card) => [card.dataset.taskId, card.getBoundingClientRect()]),
    );
    const motionDuration = globalThis.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches
      ? 1
      : undefined;
    const pendingTransfer = pendingTransferRef.current;
    if (pendingTransfer && !pendingTransfer.ready) {
      const movedCard = cards.find(
        (card) => card.dataset.taskId === pendingTransfer.id,
      );
      const movedNext = movedCard && nextRects.get(pendingTransfer.id);
      const movedStatusId =
        movedCard?.closest(".board-column")?.dataset.statusId;
      if (
        movedCard &&
        movedNext &&
        pendingTransfer.slotRect &&
        movedStatusId === pendingTransfer.statusId &&
        typeof movedCard.animate === "function"
      ) {
        const slotTransform = `translate(${pendingTransfer.slotRect.left - movedNext.left}px, ${pendingTransfer.slotRect.top - movedNext.top}px)`;
        layoutAnimationsRef.current.set(
          pendingTransfer.id,
          movedCard.animate([{ transform: slotTransform }], {
            duration: motionDuration ?? 1,
            fill: "both",
            composite: "replace",
          }),
        );
      }
      return;
    }
    if (pendingTransfer) {
      const movedCard = cards.find(
        (card) => card.dataset.taskId === pendingTransfer.id,
      );
      const movedNext = movedCard && nextRects.get(pendingTransfer.id);
      const movedStatusId =
        movedCard?.closest(".board-column")?.dataset.statusId;
      if (
        movedCard &&
        movedNext &&
        pendingTransfer.slotRect &&
        movedStatusId === pendingTransfer.statusId
      ) {
        const transferOffset = DRAG_TRANSFER_DURATION / DRAG_TOTAL_DURATION;
        const reorderOffset =
          (DRAG_TRANSFER_DURATION + DRAG_SETTLE_DURATION) / DRAG_TOTAL_DURATION;
        cards.forEach((card) => {
          const previous = cardRectsRef.current.get(card.dataset.taskId);
          const next = nextRects.get(card.dataset.taskId);
          if (!previous || !next || typeof card.animate !== "function") return;
          const isMovedCard = card.dataset.taskId === pendingTransfer.id;
          const isTargetCard =
            card.closest(".board-column")?.dataset.statusId ===
            pendingTransfer.statusId;
          const fromTransform = translateBetween(previous, next);
          let keyframes;
          let duration = DRAG_REORDER_DURATION;
          if (isMovedCard) {
            const slotTransform = `translate(${pendingTransfer.slotRect.left - movedNext.left}px, ${pendingTransfer.slotRect.top - movedNext.top}px)`;
            const entryTransform = `${slotTransform} translateY(-6px) scale(.97)`;
            keyframes = [
              {
                transform: entryTransform,
                opacity: 0,
                offset: 0,
                easing: DRAG_TRANSFER_EASING,
              },
              { transform: slotTransform, opacity: 1, offset: transferOffset },
              {
                transform: slotTransform,
                offset: reorderOffset,
                easing: DRAG_REORDER_EASING,
              },
              { transform: "translate(0, 0)", offset: 1 },
            ];
            duration = DRAG_TOTAL_DURATION;
          } else if (isTargetCard) {
            keyframes = [
              { transform: fromTransform, offset: 0 },
              { transform: fromTransform, offset: transferOffset },
              {
                transform: fromTransform,
                offset: reorderOffset,
                easing: DRAG_REORDER_EASING,
              },
              { transform: "translate(0, 0)", offset: 1 },
            ];
            duration = DRAG_TOTAL_DURATION;
          } else if (
            Math.abs(previous.top - next.top) >= 1 ||
            Math.abs(previous.left - next.left) >= 1
          ) {
            keyframes = [
              { transform: fromTransform },
              { transform: "translate(0, 0)" },
            ];
          }
          if (!keyframes) return;
          layoutAnimationsRef.current.set(
            card.dataset.taskId,
            card.animate(keyframes, {
              duration: motionDuration ?? duration,
              easing: "linear",
              fill: "both",
              composite: "replace",
            }),
          );
        });
        pendingTransferRef.current = null;
        animateLayoutRef.current = false;
      } else if (
        !movedCard ||
        !movedNext ||
        movedStatusId === pendingTransfer.statusId
      ) {
        pendingTransferRef.current = null;
      } else {
        return;
      }
    } else if (animateLayoutRef.current) {
      cards.forEach((card) => {
        const previous = cardRectsRef.current.get(card.dataset.taskId);
        const next = nextRects.get(card.dataset.taskId);
        if (
          !previous ||
          !next ||
          typeof card.animate !== "function" ||
          (Math.abs(previous.top - next.top) < 1 &&
            Math.abs(previous.left - next.left) < 1)
        )
          return;
        const animation = card.animate(
          [
            {
              transform: `translate(${previous.left - next.left}px, ${previous.top - next.top}px)`,
            },
            { transform: "translate(0, 0)" },
          ],
          {
            duration: motionDuration ?? DRAG_REORDER_DURATION,
            easing: DRAG_REORDER_EASING,
            fill: "both",
            composite: "replace",
          },
        );
        layoutAnimationsRef.current.set(card.dataset.taskId, animation);
      });
      animateLayoutRef.current = false;
    }
    cardRectsRef.current = nextRects;
  }, [
    dragState?.statusId,
    dragState?.insertAt,
    dropExit,
    dropFeedback?.phase,
    tasks,
  ]);
  useEffect(() => {
    if (!dropExit) return undefined;
    const timer = window.setTimeout(
      () => {
        animateLayoutRef.current = true;
        setDropExit(null);
      },
      dropExit.isMove ? DRAG_TOTAL_DURATION : 160,
    );
    return () => window.clearTimeout(timer);
  }, [dropExit]);
  const handleDragStart = useCallback(
    (taskId, event) => {
      const task = tasks.find((item) => item.id === taskId);
      clearFeedbackTimers();
      setDropFeedback(null);
      setDropExit(null);
      setDragState({
        id: taskId,
        sourceStatusId: task?.status || "",
        statusId: task?.status || "",
        insertAt: 0,
        height: event.currentTarget.getBoundingClientRect().height,
      });
    },
    [clearFeedbackTimers, tasks],
  );
  const handleDragOver = useCallback(
    (statusId, event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const column = event.currentTarget;
      const draggedId =
        dragState?.id || event.dataTransfer.getData("text/task-id");
      const insertAt = getDropIndex(column, event.clientY, draggedId);
      setDragState((current) => {
        if (
          current &&
          current.statusId === statusId &&
          current.insertAt === insertAt
        )
          return current;
        animateLayoutRef.current = true;
        return { ...(current || {}), statusId, insertAt };
      });
    },
    [dragState?.id],
  );
  const getExitMetrics = useCallback(() => {
    const slot = boardRef.current?.querySelector(".card-drop-placeholder");
    const body = slot?.closest(".column-body");
    if (!slot || !body) return null;
    const slotRect = slot.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    return {
      top: slotRect.top,
      left: slotRect.left,
      localTop: slotRect.top - bodyRect.top,
      localLeft: slotRect.left - bodyRect.left,
      width: slotRect.width,
    };
  }, []);
  const handleDrop = useCallback(
    (statusId, event) => {
      event.preventDefault();
      const id = dragState?.id || event.dataTransfer.getData("text/task-id");
      const task = tasks.find((item) => item.id === id);
      const sourceStatusId = dragState?.sourceStatusId || task?.status;
      const shouldAttemptMove =
        id && !id.startsWith("optimistic-") && sourceStatusId !== statusId;
      const canMove = shouldAttemptMove;
      const slotRect = getExitMetrics();
      if (canMove && dragState) {
        pendingTransferRef.current = { id, statusId, slotRect, ready: false };
        setDropFeedback({ id, statusId, phase: "loading" });
        setDropExit(null);
      } else if (dragState) {
        setDropExit({ ...dragState, isMove: false, slotRect });
      }
      setDragState(null);
      if (shouldAttemptMove) {
        Promise.resolve(onMove(id, statusId)).then((success) => {
          const finish = () => {
            feedbackTimerRef.current = null;
            if (!success) {
              pendingTransferRef.current = null;
              animateLayoutRef.current = true;
              setDropFeedback((current) =>
                current?.id === id ? null : current,
              );
              return;
            }
            setDropFeedback((current) =>
              current?.id === id ? { ...current, phase: "success" } : current,
            );
            feedbackClearTimerRef.current = window.setTimeout(() => {
              feedbackClearTimerRef.current = null;
              if (pendingTransferRef.current?.id === id)
                pendingTransferRef.current = {
                  ...pendingTransferRef.current,
                  ready: true,
                };
              setDropFeedback((current) =>
                current?.id === id ? null : current,
              );
            }, 520);
          };
          feedbackTimerRef.current = window.setTimeout(finish, 0);
        });
      }
    },
    [clearFeedbackTimers, dragState, getExitMetrics, onMove, tasks],
  );
  const clearDrag = useCallback(() => {
    if (dragState)
      setDropExit({ ...dragState, isMove: false, slotRect: getExitMetrics() });
    setDragState((current) => {
      if (!current) return current;
      animateLayoutRef.current = true;
      return null;
    });
  }, [dragState, getExitMetrics]);
  return (
    <div className="board-grid" ref={boardRef}>
      {STATUSES.map((status) => {
        const items = tasks.filter((taskItem) => taskItem.status === status.id);
        const visibleDropState = dragState || dropExit;
        const isExiting = !dragState && Boolean(dropExit);
        const hasExitMetrics = isExiting && visibleDropState.slotRect;
        const showDropSlot = Boolean(
          visibleDropState &&
            (!visibleDropState.isMove || dragState) &&
            visibleDropState.sourceStatusId !== status.id &&
            visibleDropState.statusId === status.id,
        );
        const dropSlot = showDropSlot ? (
          <div
            className={`drop-placeholder card-drop-placeholder ${hasExitMetrics ? "is-exiting" : ""}`}
            style={{
              "--drop-slot-height": `${Math.max(76, visibleDropState.height || 96)}px`,
              ...(hasExitMetrics
                ? {
                    "--drop-slot-top": `${visibleDropState.slotRect.localTop}px`,
                    "--drop-slot-left": `${visibleDropState.slotRect.localLeft}px`,
                    "--drop-slot-width": `${visibleDropState.slotRect.width}px`,
                  }
                : {}),
            }}
            aria-label={`Espaço para soltar em ${status.label}`}
          >
            <Plus size={17} aria-hidden="true" />
            <span>Solte aqui</span>
          </div>
        ) : null;
        return (
          <section
            className={`board-column ${showDropSlot ? "is-drop-target" : ""}`}
            data-status-id={status.id}
            key={status.id}
            onDragOver={(event) => handleDragOver(status.id, event)}
            onDrop={(event) => handleDrop(status.id, event)}
            onDragEnd={clearDrag}
          >
            <div className="column-header">
              <div>
                <span className={`column-marker marker-${status.tone}`} />
                <h2>{status.label}</h2>
                <span className="column-count">{items.length}</span>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={onCreate}
                aria-label={`Criar tarefa em ${status.label}`}
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="column-body">
              {items.map((taskItem, index) => (
                <React.Fragment key={taskItem.id}>
                  {showDropSlot &&
                    visibleDropState.insertAt === index &&
                    dropSlot}
                  <TaskCard
                    task={taskItem}
                    subtasks={subtasksByParent.get(taskItem.id) || []}
                    currentEmployee={currentEmployee}
                    hasUnreadMention={unreadMentionTaskIds.has(taskItem.id)}
                    showChecklistOnCard={checklistVisibility[taskItem.id]}
                    onOpen={onOpen}
                    onToggleSubtask={onToggleSubtask}
                    isDragging={dragState?.id === taskItem.id}
                    dropFeedback={
                      dropFeedback?.id === taskItem.id ? dropFeedback.phase : ""
                    }
                    onDragStart={handleDragStart}
                    onDragEnd={clearDrag}
                  />
                </React.Fragment>
              ))}
              {showDropSlot &&
                visibleDropState.insertAt >= items.length &&
                dropSlot}
              {!items.length && !showDropSlot && (
                <div className="drop-placeholder">
                  <Plus size={17} />
                  <span>Arraste tarefas para cá</span>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
});

const FilterBar = memo(function FilterBar({
  filters,
  setFilters,
  onCreate,
  employees = [],
}) {
  const [expanded, setExpanded] = useState(false);
  const assigneeOptions = useMemo(
    () => buildAssigneeOptions(employees),
    [employees],
  );
  const teamOptions = useMemo(
    () => TEAM_OPTIONS.map((team) => ({ value: team, label: team })),
    [],
  );
  const activeFilterCount = [
    filters.query,
    filters.assignee?.length,
    filters.status?.length,
    filters.priority?.length,
    filters.source?.length,
    filters.team,
  ].filter(Boolean).length;
  return (
    <div className={`filter-bar ${expanded ? "is-expanded" : "is-collapsed"}`}>
      <button
        className="filter-toggle"
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <ListFilter size={15} />
        <span>Filtros</span>
        {activeFilterCount > 0 && <b>{activeFilterCount}</b>}
        <ChevronDown size={15} />
      </button>
      <div className="search-field filter-search">
        <Search size={16} />
        <input
          value={filters.query}
          onChange={(event) =>
            setFilters((current) => ({ ...current, query: event.target.value }))
          }
          placeholder="Buscar tarefas, cotações, qualidade ou pessoas"
        />
      </div>
      <div className="filter-bar-content">
        <SearchableMultiSelect
          value={filters.assignee}
          onChange={(value) =>
            setFilters((current) => ({ ...current, assignee: value }))
          }
          placeholder="Todos os responsáveis"
          options={assigneeOptions.map((name) => ({
            value: name,
            label: name,
          }))}
        />
        <SearchableMultiSelect
          value={filters.status}
          onChange={(value) =>
            setFilters((current) => ({ ...current, status: value }))
          }
          placeholder="Todos os status"
          options={TASK_FILTER_STATUS_OPTIONS}
        />
        <SearchableMultiSelect
          value={filters.priority}
          onChange={(value) =>
            setFilters((current) => ({ ...current, priority: value }))
          }
          placeholder="Todas as prioridades"
          options={PRIORITY_OPTIONS}
        />
        <SearchableMultiSelect
          value={filters.source}
          onChange={(value) =>
            setFilters((current) => ({ ...current, source: value }))
          }
          placeholder="Todas as origens"
          options={SOURCE_OPTIONS}
        />
        <SearchableSelect
          value={filters.team || ""}
          onChange={(value) =>
            setFilters((current) => ({ ...current, team: value }))
          }
          placeholder="Todas as equipes"
          options={teamOptions}
        />
        <button
          className="button button-quiet"
          type="button"
          onClick={() => setFilters(createDefaultFilters())}
        >
          <RotateCcw size={15} />
          Limpar filtros
        </button>
        <button
          className="button button-primary"
          type="button"
          onClick={onCreate}
        >
          <Plus size={16} />
          Nova tarefa
        </button>
      </div>
    </div>
  );
});

function MobileBoardList({
  tasksByStatus,
  subtasksByParent,
  currentEmployee,
  checklistVisibility,
  unreadMentionTaskIds,
  onOpen,
  onToggleSubtask,
  onComplete,
}) {
  return (
    <div className="mobile-board-list">
      {STATUSES.map((status) => (
        <section className="mobile-status-group" key={status.id}>
          <div className="mobile-status-heading">
            <span className={`column-marker marker-${status.tone}`} />
            <h2>{status.label}</h2>
            <span className="column-count">
              {tasksByStatus[status.id].length}
            </span>
          </div>
          {tasksByStatus[status.id].map((taskItem) => (
            <TaskCard
              key={taskItem.id}
              task={taskItem}
              subtasks={subtasksByParent.get(taskItem.id) || []}
              currentEmployee={currentEmployee}
              hasUnreadMention={unreadMentionTaskIds.has(taskItem.id)}
              showChecklistOnCard={checklistVisibility[taskItem.id]}
              onOpen={onOpen}
              onToggleSubtask={onToggleSubtask}
              onComplete={onComplete}
              showQuickComplete
              enableDrag={false}
              compact
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function BoardView({
  state,
  currentEmployee,
  checklistVisibility,
  onOpen,
  onToggleSubtask,
  onMove,
  onComplete,
  onCreate,
  filters,
  setFilters,
  onNavigate,
  taskScope,
  onScopeChange,
}) {
  const unreadMentionTaskIds = useMemo(
    () => new Set((state.notifications || []).filter((item) => item.type === "mention" && !item.readAt && item.taskId).map((item) => item.taskId)),
    [state.notifications],
  );
  const filtered = useMemo(
    () =>
      sortTasks(
        filterTasks(
          tasksForView(state.tasks, filters).filter(
            (taskItem) => !taskItem.parentTaskId,
          ),
          filters,
        ),
      ),
    [state.tasks, filters],
  );
  const tasksByStatus = useMemo(
    () =>
      Object.fromEntries(
        STATUSES.map((status) => [
          status.id,
          filtered.filter((taskItem) => taskItem.status === status.id),
        ]),
      ),
    [filtered],
  );
  const isMobile = useMediaQuery("(max-width: 820px)");
  const subtasksByParent = useMemo(
    () =>
      state.tasks.reduce((index, taskItem) => {
        if (!taskItem.parentTaskId) return index;
        const siblings = index.get(taskItem.parentTaskId) || [];
        siblings.push(taskItem);
        index.set(taskItem.parentTaskId, siblings);
        return index;
      }, new Map()),
    [state.tasks],
  );
  return (
    <div className="page-content board-page-content">
      <PageHeader
        eyebrow="Tarefas"
        title="Operação em movimento"
        description={
          isMobile
            ? "Escolha a próxima ação e atualize o andamento da tarefa."
            : "Arraste os cartões para atualizar o andamento das tarefas."
        }
      >
        <TaskScopeSelector
          active={taskScope}
          onSelect={onScopeChange}
          disabled={!currentEmployee?.name}
        />
        <TaskViewSelector active="board" onSelect={onNavigate} />
      </PageHeader>
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        onCreate={onCreate}
        employees={state.employees}
      />
      {isMobile ? (
        <MobileBoardList
          tasksByStatus={tasksByStatus}
          subtasksByParent={subtasksByParent}
          currentEmployee={currentEmployee}
          checklistVisibility={checklistVisibility}
          unreadMentionTaskIds={unreadMentionTaskIds}
          onOpen={onOpen}
          onToggleSubtask={onToggleSubtask}
          onComplete={onComplete}
        />
      ) : (
        <Board
          tasks={filtered}
          subtasksByParent={subtasksByParent}
          currentEmployee={currentEmployee}
          checklistVisibility={checklistVisibility}
          unreadMentionTaskIds={unreadMentionTaskIds}
          onOpen={onOpen}
          onToggleSubtask={onToggleSubtask}
          onMove={onMove}
          onCreate={onCreate}
        />
      )}
    </div>
  );
}

function ListView({
  state,
  onOpen,
  onCreate,
  filters,
  setFilters,
  onNavigate,
  currentEmployee,
  taskScope,
  onScopeChange,
}) {
  const [sort, setSort] = useState({ key: "", direction: "asc" });
  const filtered = useMemo(() => {
    const tasks = filterTasks(tasksForView(state.tasks, filters), filters);
    return sort.key ? sortListTasks(tasks, sort) : sortTasks(tasks);
  }, [state.tasks, filters, sort]);
  const selectSort = (key) =>
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="Tarefas"
        title="Lista operacional"
        description="Encontre rapidamente o próximo responsável por cada tarefa."
      >
        <TaskScopeSelector
          active={taskScope}
          onSelect={onScopeChange}
          disabled={!currentEmployee?.name}
        />
        <TaskViewSelector active="list" onSelect={onNavigate} />
      </PageHeader>
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        onCreate={onCreate}
        employees={state.employees}
      />
      <section className="panel task-table">
        <div className="table-header" role="row">
          {LIST_SORT_COLUMNS.map(([key, label]) => (
            <div
              key={key}
              role="columnheader"
              aria-sort={sort.key === key ? `${sort.direction}ending` : "none"}
            >
              <button
                className={
                  sort.key === key
                    ? "table-sort-button active"
                    : "table-sort-button"
                }
                type="button"
                onClick={() => selectSort(key)}
              >
                <span>{label}</span>
                {sort.key === key && (
                  <ChevronDown
                    className={
                      sort.direction === "asc"
                        ? "sort-icon ascending"
                        : "sort-icon"
                    }
                    size={14}
                    aria-hidden="true"
                  />
                )}
              </button>
            </div>
          ))}
        </div>
        {filtered.map((taskItem) => (
          <button
            className="table-row"
            key={taskItem.id}
            onClick={() => onOpen(taskItem.id)}
          >
            <div className="table-task">
              <span className={`table-status status-${taskItem.status}`} />
              <strong>{taskItem.title}</strong>
            </div>
            <span>{taskItem.quoteCode || "—"}</span>
            <AssigneeDisplay
              value={
                taskItem.assigneeProfiles?.length
                  ? taskItem.assigneeProfiles
                  : taskItem.assigneeNames || taskItem.assigneeName
              }
              small
            />
            <span className={isOverdue(taskItem) ? "danger-text" : ""}>
              {formatDate(taskItem.dueDate)}
            </span>
            <div className="table-row-tags">
              <PriorityBadge priority={taskItem.priority} />
              <StatusBadge status={taskItem.status} />
            </div>
          </button>
        ))}
      </section>
    </div>
  );
}

function CalendarView({
  state,
  onOpen,
  onCreate,
  filters,
  setFilters,
  onNavigate,
  currentEmployee,
  taskScope,
  onScopeChange,
}) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index - 1);
    return date;
  });
  const openTasks = useMemo(
    () => sortTasks(filterTasks(tasksForView(state.tasks, filters), filters)),
    [state.tasks, filters],
  );
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="Tarefas"
        title="Agenda operacional"
        description="Uma visão simples dos compromissos que movem a operação."
      >
        <TaskScopeSelector
          active={taskScope}
          onSelect={onScopeChange}
          disabled={!currentEmployee?.name}
        />
        <TaskViewSelector active="calendar" onSelect={onNavigate} />
      </PageHeader>
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        onCreate={onCreate}
        employees={state.employees}
      />
      <div className="calendar-strip">
        {days.map((date) => (
          <div
            className={`calendar-day ${date.toDateString() === new Date().toDateString() ? "today" : ""}`}
            key={date.toISOString()}
          >
            <span>
              {CALENDAR_WEEKDAY_FORMATTER.format(date).replace(".", "")}
            </span>
            <strong>{date.getDate()}</strong>
          </div>
        ))}
      </div>
      <section className="panel agenda-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Esta semana</span>
            <h2>O que acontece em seguida</h2>
          </div>
        </div>
        {openTasks.map((taskItem) => (
          <button
            className="agenda-row"
            key={taskItem.id}
            onClick={() => onOpen(taskItem.id)}
          >
            <span className="agenda-time">{formatDate(taskItem.dueDate)}</span>
            <div className="agenda-line" />
            <div className="agenda-info">
              <strong>{taskItem.title}</strong>
              <span>
                {taskItem.quoteCode} · {taskItem.assigneeName}
              </span>
            </div>
            <StatusBadge status={taskItem.status} />
            <ChevronRight size={16} />
          </button>
        ))}
      </section>
    </div>
  );
}

function QualityView({ state, onCreate, onCreateTask, filters, setFilters }) {
  const quality = state.quality || [];
  const filteredQuality = useMemo(
    () =>
      quality.filter((item) => {
        const linkedTask = state.tasks.find(
          (taskItem) => taskItem.sourceId === item.id,
        );
        const query = normalizeText(filters.query);
        const matchesQuery =
          !query ||
          [
            item.code,
            item.title,
            item.type,
            item.status,
            linkedTask?.title,
          ].some((value) => normalizeText(value).includes(query));
        const taskFilters = { ...filters, query: "" };
        const matchesTaskFilters = linkedTask
          ? filterTasks([linkedTask], taskFilters).length > 0
          : !filters.assignee?.length &&
            !filters.priority?.length &&
            !filters.source?.length &&
            !filters.team;
        return matchesQuery && matchesTaskFilters;
      }),
    [quality, state.tasks, filters],
  );
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="Origem operacional"
        title="Qualidade"
        description="Transforme erros e ações operacionais em tarefas do Planner interno."
      />
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        onCreate={onCreateTask}
        employees={state.employees}
      />
      <section className="panel task-table">
        <div className="table-header">
          <span>Registro</span>
          <span>Tipo</span>
          <span>Prazo</span>
          <span>Status</span>
          <span>Ação</span>
        </div>
        {filteredQuality.map((item) => {
          const linked = state.tasks.some(
            (taskItem) => taskItem.sourceId === item.id,
          );
          return (
            <div className="table-row" key={`${item.type}-${item.id}`}>
              <div className="table-task">
                <span className="table-status status-waiting" />
                <strong>
                  {item.code ? `${item.code} · ` : ""}
                  {item.title}
                </strong>
              </div>
              <span>
                {item.type === "error"
                  ? "Erro operacional"
                  : "Ação operacional"}
              </span>
              <span>{formatDate(item.dueDate)}</span>
              <span>{item.status || "Ativo"}</span>
              {linked ? (
                <span className="linked-label">Tarefa criada</span>
              ) : (
                <button className="small-button" onClick={() => onCreate(item)}>
                  Criar tarefa
                </button>
              )}
            </div>
          );
        })}
        {!filteredQuality.length && (
          <div className="empty-inline">
            Nenhum erro ou ação operacional disponível.
          </div>
        )}
      </section>
    </div>
  );
}

function SettingsView({ onReset, live }) {
  return (
    <div className="page-content">
      <PageHeader
        eyebrow={live ? "Ambiente Dataverse" : "Execução local"}
        title="Configurações"
        description={
          live
            ? "Dados operacionais carregados diretamente do ambiente autenticado."
            : "Dados de demonstração mantidos somente neste navegador."
        }
      />
      <section className="settings-grid">
        <div className="panel setting-card">
          <div className="setting-icon">
            <RotateCcw size={19} />
          </div>
          <div>
            <h2>{live ? "Recarregar dados" : "Restaurar cenário inicial"}</h2>
            <p>
              {live
                ? "Busca novamente cotações, tarefas e registros de qualidade no Dataverse."
                : "Repõe as cotações e tarefas sintéticas do mock local."}
            </p>
            <button className="button button-secondary" onClick={onReset}>
              <RotateCcw size={15} />
              {live ? "Recarregar" : "Restaurar mock"}
            </button>
          </div>
        </div>
        <div className="panel setting-card">
          <div className="setting-icon setting-icon-blue">
            <Target size={19} />
          </div>
          <div>
            <h2>Fonte de dados</h2>
            <p>
              {live
                ? "O Planner usa dados do ambiente autenticado."
                : "O Planner usa mock data local e não cria registros no Dataverse."}
            </p>
            <span className="status-note">
              <span className="pulse-dot" />
              {live ? "Dataverse conectado" : "Modo local · mock"}
            </span>
          </div>
        </div>
        <div className="panel setting-card">
          <div className="setting-icon setting-icon-blue">
            <span className="version-glyph">v</span>
          </div>
          <div>
            <h2>Versão do aplicativo</h2>
            <p>Identificação da versão publicada neste ambiente.</p>
            <span className="version-value">{APP_VERSION}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

const attachmentPreviewCache = new Map();

function isImageAttachment(attachment) {
  return (
    String(attachment?.mimeType || "")
      .toLowerCase()
      .startsWith("image/") ||
    /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(String(attachment?.name || ""))
  );
}

function isPdfAttachment(attachment) {
  return (
    String(attachment?.mimeType || "").toLowerCase() === "application/pdf" ||
    /\.pdf$/i.test(String(attachment?.name || ""))
  );
}

function attachmentCacheKey(attachment) {
  return (
    attachment?.sharePointId ||
    attachment?.fileLocator ||
    attachment?.path ||
    attachment?.name
  );
}

function toAttachmentFiles(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value.length === "number" && !value.name)
    return Array.from(value).filter(Boolean);
  return [value];
}

function fileToDataUrl(file) {
  if (!file) return Promise.resolve("");
  if (typeof FileReader === "undefined") return Promise.resolve("");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () =>
      reject(
        reader.error || new Error("Não foi possível preparar o arquivo local."),
      );
    reader.readAsDataURL(file);
  });
}

function createDraftAttachment(file, prefix = "draft") {
  const previewUrl = globalThis.URL?.createObjectURL
    ? globalThis.URL.createObjectURL(file)
    : "";
  return {
    id: `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`,
    name: file.name,
    mimeType: file.type,
    size: file.size,
    previewUrl,
    file,
    syncStatus: "pending",
  };
}

function releaseDraftAttachment(attachment) {
  if (
    attachment?.previewUrl?.startsWith("blob:") &&
    globalThis.URL?.revokeObjectURL
  )
    globalThis.URL.revokeObjectURL(attachment.previewUrl);
}

function mergeAttachmentDetailsIntoState(state, taskId, details) {
  if (!details?.taskId) return details;
  return {
    ...state,
    tasks: state.tasks.map((item) =>
      item.id === taskId
        ? {
            ...item,
            ...details,
            detailsLoaded: true,
            detailsLoading: false,
            detailsError: "",
          }
        : item,
    ),
  };
}

function formatAttachmentSize(size) {
  const bytes = Number(size || 0);
  if (!bytes) return "Tamanho não informado";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function attachmentTypeLabel(attachment) {
  const mimeType = String(attachment?.mimeType || "").toLowerCase();
  const name = String(attachment?.name || "").toLowerCase();
  if (
    mimeType.startsWith("image/") ||
    /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/.test(name)
  )
    return "Imagem";
  if (mimeType === "application/pdf" || name.endsWith(".pdf")) return "PDF";
  if (/spreadsheet|excel/.test(mimeType) || /\.(csv|xls|xlsx)$/.test(name))
    return "Planilha";
  if (/presentation|powerpoint/.test(mimeType) || /\.(ppt|pptx)$/.test(name))
    return "Apresentação";
  if (/zip|compressed/.test(mimeType) || /\.(7z|rar|zip)$/.test(name))
    return "Arquivo compactado";
  return "Arquivo";
}

function AttachmentTypeIcon({ attachment }) {
  const type = attachmentTypeLabel(attachment);
  const Icon =
    type === "Imagem"
      ? FileImage
      : type === "Planilha"
        ? FileSpreadsheet
        : type === "Arquivo compactado"
          ? FileArchive
          : type === "PDF"
            ? FileText
            : File;
  return (
    <span
      className={`attachment-file-icon attachment-file-icon-${type.toLowerCase().replace(/\s/g, "-")}`}
      aria-hidden="true"
    >
      <Icon size={17} />
    </span>
  );
}

function AttachmentPreview({ attachment, loadAttachmentContent, onOpen }) {
  const cacheKey = attachmentCacheKey(attachment);
  const canPreview =
    isImageAttachment(attachment) || isPdfAttachment(attachment);
  const slotRef = useRef(null);
  const [visible, setVisible] = useState(Boolean(attachment?.previewUrl));
  const [state, setState] = useState(() => ({
    dataUrl:
      attachment?.previewUrl || attachmentPreviewCache.get(cacheKey) || "",
    loading: false,
    error: "",
  }));
  useEffect(
    () => () => {
      if (
        attachment?.previewUrl?.startsWith("blob:") &&
        globalThis.URL?.revokeObjectURL
      )
        globalThis.setTimeout(
          () => globalThis.URL.revokeObjectURL(attachment.previewUrl),
          60000,
        );
    },
    [attachment?.previewUrl],
  );
  useEffect(() => {
    if (
      attachment?.previewUrl ||
      typeof window === "undefined" ||
      typeof window.IntersectionObserver !== "function"
    ) {
      setVisible(true);
      return undefined;
    }
    const node = slotRef.current;
    if (!node) return undefined;
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "160px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [attachment?.previewUrl, cacheKey]);
  useEffect(() => {
    if (
      !visible ||
      attachment?.previewUrl ||
      !canPreview ||
      !loadAttachmentContent ||
      !cacheKey ||
      (!attachment?.sharePointId &&
        !attachment?.fileLocator &&
        !attachment?.path) ||
      attachmentPreviewCache.has(cacheKey)
    )
      return undefined;
    let active = true;
    setState({ dataUrl: "", loading: true, error: "" });
    loadAttachmentContent(attachment)
      .then((result) => {
        if (!active) return;
        attachmentPreviewCache.set(cacheKey, result.dataUrl);
        setState({ dataUrl: result.dataUrl, loading: false, error: "" });
      })
      .catch((error) => {
        if (active)
          setState({
            dataUrl: "",
            loading: false,
            error: error.message || "Prévia indisponível.",
          });
      });
    return () => {
      active = false;
    };
  }, [attachment, cacheKey, canPreview, loadAttachmentContent, visible]);
  if (!canPreview) return null;
  const openPreview = () =>
    onOpen?.({ ...attachment, previewUrl: state.dataUrl });
  return (
    <div className="attachment-preview-slot" ref={slotRef}>
      {state.dataUrl ? (
        isPdfAttachment(attachment) ? (
          <div
            className="attachment-preview attachment-preview-pdf"
            role="button"
            tabIndex="0"
            onClick={openPreview}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openPreview();
              }
            }}
            aria-label={`Abrir prévia de ${attachment.name || "PDF anexado"}`}
          >
            <iframe
              src={state.dataUrl}
              title={attachment.name || "Prévia do PDF"}
            />
          </div>
        ) : (
          <button
            className="attachment-preview"
            type="button"
            onClick={openPreview}
            aria-label={`Abrir prévia de ${attachment.name || "imagem anexada"}`}
          >
            <img
              src={state.dataUrl}
              alt={attachment.name || "Imagem anexada"}
              loading="lazy"
              decoding="async"
            />
          </button>
        )
      ) : state.loading ? (
        <div className="attachment-preview-placeholder">
          <LoaderCircle size={15} className="spin" />
          <span>Preparando prévia…</span>
        </div>
      ) : state.error ? (
        <div className="attachment-preview-placeholder attachment-preview-error">
          <AttachmentTypeIcon attachment={attachment} />
          <span>Prévia indisponível</span>
        </div>
      ) : (
        <div className="attachment-preview-placeholder">
          <AttachmentTypeIcon attachment={attachment} />
          <span>
            {isPdfAttachment(attachment) ? "PDF anexado" : "Imagem anexada"}
          </span>
        </div>
      )}
    </div>
  );
}

function AttachmentSection({
  taskId,
  attachments = [],
  loadAttachmentContent,
  onAttachment,
  onDeleteAttachment,
  helperText,
}) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [openingId, setOpeningId] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [openError, setOpenError] = useState("");
  const addFiles = (value) => {
    const files = toAttachmentFiles(value);
    if (files.length) onAttachment(taskId, files);
  };
  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  };
  const previewUrl =
    previewAttachment?.previewUrl ||
    attachmentPreviewCache.get(attachmentCacheKey(previewAttachment));
  const openAttachment = async (attachment) => {
    if (typeof window === "undefined") return;
    setOpenError("");
    const popup = window.open("", "_blank");
    if (!popup) {
      setOpenError(
        "O navegador bloqueou a nova aba. Permita pop-ups para abrir anexos.",
      );
      return;
    }
    popup.opener = null;
    popup.document.title = attachment.name || "Anexo";
    setOpeningId(attachment.id);
    try {
      let source =
        attachment.previewUrl ||
        attachmentPreviewCache.get(attachmentCacheKey(attachment));
      if (!source && loadAttachmentContent) {
        const result = await loadAttachmentContent(attachment);
        source = result?.dataUrl || result?.previewUrl || "";
        if (source)
          attachmentPreviewCache.set(attachmentCacheKey(attachment), source);
      }
      if (!source)
        throw new Error("Não foi possível carregar o conteúdo deste anexo.");
      const response = await fetch(source);
      if (!response.ok)
        throw new Error("O conteúdo do anexo não respondeu corretamente.");
      const blobUrl = URL.createObjectURL(await response.blob());
      popup.location.href = blobUrl;
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (error) {
      popup.close();
      setOpenError(error.message || "Não foi possível abrir o anexo.");
    } finally {
      setOpeningId("");
    }
  };
  const confirmDelete = (attachment) => {
    setPendingDeleteId("");
    setDeletingId(attachment.id);
    Promise.resolve(onDeleteAttachment?.(taskId, attachment)).finally(() =>
      setDeletingId(""),
    );
  };
  return (
    <section className="drawer-section attachment-section">
      <div className="drawer-section-heading">
        <div className="attachment-heading-copy">
          <h3>Anexos</h3>
          <span className="section-count">{attachments.length}</span>
        </div>
        <span className="section-hint">Até 5 MB por arquivo</span>
      </div>
      {helperText && <p className="attachment-helper">{helperText}</p>}
      <label
        className={`attachment-dropzone ${isDragging ? "is-dragging" : ""}`}
        htmlFor={inputId}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setIsDragging(false);
        }}
        onDrop={handleDrop}
      >
        <span className="attachment-upload-icon">
          <UploadCloud size={19} />
        </span>
        <span className="attachment-dropzone-copy">
          <strong>
            {isDragging
              ? "Solte os arquivos aqui"
              : "Adicione evidências à tarefa"}
          </strong>
          <small>Clique para escolher ou arraste arquivos para cá</small>
        </span>
        <span className="attachment-dropzone-action">Escolher arquivos</span>
        <input
          id={inputId}
          type="file"
          multiple
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {openError && (
        <div
          className="attachment-feedback attachment-feedback-error"
          role="alert"
        >
          {openError}
        </div>
      )}
      {attachments.length ? (
        <div className="attachment-list">
          {attachments.map((item) => (
            <article
              className={`attachment-item ${item.syncStatus === "syncing" ? "item-syncing" : ""}`}
              key={item.id}
            >
              <AttachmentPreview
                attachment={item}
                loadAttachmentContent={loadAttachmentContent}
                onOpen={setPreviewAttachment}
              />
              <div className="attachment-card">
                <button
                  className="attachment-open-button"
                  type="button"
                  onClick={() => openAttachment(item)}
                  disabled={openingId === item.id || deletingId === item.id}
                  aria-label={`Abrir ${item.name || "anexo"} em nova aba`}
                >
                  <AttachmentTypeIcon attachment={item} />
                  <span className="attachment-file-main">
                    <strong title={item.name}>
                      {item.name || "Arquivo sem nome"}
                    </strong>
                    <span>
                      {attachmentTypeLabel(item)} ·{" "}
                      {formatAttachmentSize(item.size)} · Abrir em nova aba
                    </span>
                  </span>
                </button>
                <div className="attachment-card-actions">
                  <span
                    className={`attachment-status ${item.syncStatus === "syncing" ? "is-syncing" : ""} ${item.syncStatus === "pending" ? "is-pending" : ""}`}
                  >
                    {item.syncStatus === "syncing" ? (
                      <>
                        <LoaderCircle size={13} className="spin" />
                        Enviando
                      </>
                    ) : item.syncStatus === "pending" ? (
                      <>
                        <Clock3 size={13} />
                        Aguardando salvar
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={13} />
                        Salvo
                      </>
                    )}
                  </span>
                  {onDeleteAttachment &&
                    (pendingDeleteId === item.id ? (
                      <div
                        className="attachment-remove-confirm"
                        role="group"
                        aria-label={`Confirmar remoção de ${item.name || "anexo"}`}
                      >
                        <button
                          className="button button-danger"
                          type="button"
                          onClick={() => confirmDelete(item)}
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id ? "Removendo…" : "Remover"}
                        </button>
                        <button
                          className="button button-quiet"
                          type="button"
                          onClick={() => setPendingDeleteId("")}
                          disabled={deletingId === item.id}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        className="attachment-delete-button"
                        type="button"
                        onClick={() => setPendingDeleteId(item.id)}
                        disabled={
                          item.syncStatus === "syncing" ||
                          deletingId === item.id
                        }
                        aria-label={`Remover ${item.name || "anexo"}`}
                        title="Remover anexo"
                      >
                        <Trash2 size={15} />
                      </button>
                    ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="attachment-empty">
          <Paperclip size={16} />
          <span>
            <strong>Nenhum anexo ainda</strong>
            <small>
              Inclua briefing, evidência ou qualquer arquivo útil para a
              execução.
            </small>
          </span>
        </div>
      )}
      {previewAttachment &&
      previewUrl &&
      typeof document !== "undefined" &&
      document.body
        ? createPortal(
            <div
              className="attachment-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label={`Prévia de ${previewAttachment.name || "arquivo anexado"}`}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget)
                  setPreviewAttachment(null);
              }}
            >
              <button
                className="icon-button attachment-lightbox-close"
                type="button"
                onClick={() => setPreviewAttachment(null)}
                aria-label="Fechar prévia"
              >
                <X size={19} />
              </button>
              {isPdfAttachment(previewAttachment) ? (
                <iframe
                  src={previewUrl}
                  title={previewAttachment.name || "Prévia do PDF"}
                />
              ) : (
                <img
                  src={previewUrl}
                  alt={previewAttachment.name || "Imagem anexada"}
                />
              )}
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}

function MoreView({ onNavigate }) {
  return (
    <div className="page-content more-page-content">
      <PageHeader
        eyebrow="Atalhos"
        title="Mais"
        description="Acesse origens e configurações sem tirar o foco das tarefas."
      />
      <section className="more-actions">
        <button
          className="panel more-action"
          type="button"
          onClick={() => onNavigate("quality")}
        >
          <span className="more-action-icon more-action-icon-warning">
            <ShieldAlert size={19} />
          </span>
          <span>
            <strong>Qualidade</strong>
            <small>Transforme erros e ações em tarefas</small>
          </span>
          <ChevronRight size={17} />
        </button>
        <button
          className="panel more-action"
          type="button"
          onClick={() => onNavigate("settings")}
        >
          <span className="more-action-icon">
            <Settings size={19} />
          </span>
          <span>
            <strong>Configurações</strong>
            <small>Dados, recarregamento e versão</small>
          </span>
          <ChevronRight size={17} />
        </button>
      </section>
    </div>
  );
}

function formatCommentTimestamp(value) {
  if (!value) return "Agora";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function TaskDrawerContent({
  task: taskItem,
  state,
  currentEmployee,
  loadAttachmentContent,
  showChecklistOnCard,
  onToggleChecklistOnCard,
  onClose,
  onSave,
  onDelete,
  onComment,
  onAttachment,
  onDeleteAttachment,
  onOpenQuote,
  onAddSubtask,
  onRequestDelete,
  deleteState,
  showDeletePrompt,
  onCancelDelete,
  onConfirmDelete,
}) {
  const [form, setForm] = useState(taskItem ? { ...taskItem } : null);
  const [comment, setComment] = useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [subtaskToDelete, setSubtaskToDelete] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [saveProgress, setSaveProgress] = useState({
    label: "Salvando tarefa…",
    detail: "Validando alterações",
    current: 0,
    total: 1,
  });
  const [validationError, setValidationError] = useState("");
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const [draftAttachments, setDraftAttachments] = useState([]);
  const [pendingAttachmentRemovals, setPendingAttachmentRemovals] = useState(
    [],
  );
  const draftAttachmentsRef = useRef([]);
  draftAttachmentsRef.current = draftAttachments;
  const assigneeOptions = useMemo(
    () => buildEmployeeAssigneeOptions(state.employees),
    [state.employees],
  );
  const saveCloseTimerRef = useRef(null);
  useEffect(() => {
    setForm(
      taskItem
        ? {
            ...taskItem,
            assigneeName: normalizeAssigneeNames(
              taskItem.assigneeNames || taskItem.assigneeName,
            ).filter((name) => name !== "Não atribuído"),
          }
        : null,
    );
    setComment("");
    setMentionActiveIndex(0);
    setNewSubtaskTitle("");
    setIsAddingSubtask(false);
    setSubtaskToDelete(null);
    setSaveState("idle");
    setSaveProgress({
      label: "Salvando tarefa…",
      detail: "Validando alterações",
      current: 0,
      total: 1,
    });
    setValidationError("");
    setShowDiscardPrompt(false);
    setDraftAttachments([]);
    setPendingAttachmentRemovals([]);
    if (saveCloseTimerRef.current)
      window.clearTimeout(saveCloseTimerRef.current);
    return () => {
      if (saveCloseTimerRef.current)
        window.clearTimeout(saveCloseTimerRef.current);
    };
  }, [taskItem?.id]);
  useEffect(
    () => () => draftAttachmentsRef.current.forEach(releaseDraftAttachment),
    [],
  );
  useEffect(() => {
    const container = document.querySelector(
      ".task-drawer .drawer-section:nth-of-type(2)",
    );
    if (container) container.scrollTop = container.scrollHeight;
  }, [taskItem?.id, taskItem?.comments?.length]);
  if (!taskItem || !form) return null;
  const setMentionActiveIndex = () => undefined;
  const subtasks = state.tasks.filter(
    (item) => item.parentTaskId === taskItem.id,
  );
  const history = [...(taskItem.history || [])].reverse();
  const mentionMatch = comment.match(/(?:^|[^\p{L}\p{N}_])@([^\s@]*)$/u);
  const mentionQuery = normalizeText(mentionMatch?.[1] || "");
  const mentionSuggestions = [];
  const isOwnComment = (item) =>
    item.author === "Você" ||
    (currentEmployee?.userId &&
      String(item.authorId || "")
        .replace(/[{}]/g, "")
        .toLowerCase() ===
        String(currentEmployee.userId).replace(/[{}]/g, "").toLowerCase()) ||
    (currentEmployee?.name &&
      normalizeText(item.author) === normalizeText(currentEmployee.name));
  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const visibleAttachments = [
    ...(taskItem.attachments || []).filter(
      (item) => !pendingAttachmentRemovals.includes(item.id),
    ),
    ...draftAttachments,
  ];
  const isDirty =
    ["title", "status", "priority", "teamName", "dueDate", "description"].some(
      (key) =>
        JSON.stringify(form[key] || "") !== JSON.stringify(taskItem[key] || ""),
    ) ||
    JSON.stringify(form.assigneeName || []) !==
      JSON.stringify(
        normalizeAssigneeNames(
          taskItem.assigneeNames || taskItem.assigneeName,
        ).filter((name) => name !== "Não atribuído"),
      ) ||
    comment.length > 0 ||
    draftAttachments.length > 0 ||
    pendingAttachmentRemovals.length > 0;
  const currentDeadlineRole = deadlineRole(taskItem, currentEmployee);
  const dueDateChanged =
    String(form.dueDate || "") !== String(taskItem.dueDate || "");
  const deadlineValidation = validateDeadlineChange({
    task: taskItem,
    employee: currentEmployee,
    nextDueDate: form.dueDate,
    reason: form.deadlineChangeReason,
  });
  const selectedEmployees = state.employees.filter((employee) =>
    normalizeAssigneeNames(form.assigneeName).includes(employee.name),
  );
  const missingExternalRecipients = selectedEmployees.filter(
    (employee) => !employee.externalNotificationsAvailable,
  );
  const requestClose = () => {
    if (saveState !== "idle") return;
    if (isDirty) setShowDiscardPrompt(true);
    else onClose();
  };
  const submitSubtask = () => {
    const title = newSubtaskTitle.trim();
    if (!title) return;
    onAddSubtask(taskItem.id, title);
    setNewSubtaskTitle("");
    setIsAddingSubtask(false);
  };
  const submitComment = () => {
    if (!comment.trim()) return;
    onComment(taskItem.id, comment);
    setComment("");
  };
  const insertMention = () => undefined;
  const handleDraftAttachment = (id, filesOrFile) =>
    setDraftAttachments((current) => [
      ...current,
      ...toAttachmentFiles(filesOrFile).map((file) =>
        createDraftAttachment(file, "edit"),
      ),
    ]);
  const handleDraftAttachmentDelete = (id, attachment) => {
    if (attachment?.syncStatus === "pending") {
      releaseDraftAttachment(attachment);
      setDraftAttachments((current) =>
        current.filter((item) => item.id !== attachment.id),
      );
      return;
    }
    setPendingAttachmentRemovals((current) =>
      current.includes(attachment.id) ? current : [...current, attachment.id],
    );
  };
  const handleSave = () => {
    if (saveState !== "idle") return;
    setValidationError("");
    if (dueDateChanged && !deadlineValidation.allowed) {
      setValidationError(deadlineValidation.error);
      return;
    }
    const removals = pendingAttachmentRemovals
      .map((attachmentId) =>
        (taskItem.attachments || []).find((item) => item.id === attachmentId),
      )
      .filter(Boolean);
    const total = 1 + removals.length + draftAttachments.length;
    setSaveProgress({
      label: "Salvando tarefa…",
      detail: "Aplicando alterações",
      current: 0,
      total,
    });
    setSaveState("saving");
    Promise.resolve(
      onSave(taskItem.id, {
        title: form.title,
        status: form.status,
        priority: form.priority,
        assigneeNames: normalizeAssigneeNames(form.assigneeName),
        teamName: form.teamName,
        dueDate: form.dueDate,
        deadlineChangeReason: dueDateChanged
          ? String(form.deadlineChangeReason || "").trim()
          : "",
        actorEmployeeId: currentEmployee?.id || "",
        actorUserId: currentEmployee?.userId || "",
        description: form.description,
      }),
    )
      .then((success) => {
        if (!success) throw new Error("Não foi possível salvar a tarefa.");
        setSaveProgress({
          label:
            removals.length || draftAttachments.length
              ? "Atualizando anexos…"
              : "Finalizando…",
          detail: "Tarefa salva",
          current: 1,
          total,
        });
        return removals.reduce(
          (queue, attachment, index) =>
            queue.then((ok) => {
              if (!ok) return false;
              setSaveProgress({
                label: "Removendo anexo…",
                detail: attachment.name || `Anexo ${index + 1}`,
                current: 1 + index,
                total,
              });
              return Promise.resolve(
                onDeleteAttachment(taskItem.id, attachment),
              ).then((result) => {
                setSaveProgress({
                  label: "Atualizando anexos…",
                  detail: `${index + 1} de ${total - 1} concluído`,
                  current: 2 + index,
                  total,
                });
                return result;
              });
            }),
          Promise.resolve(true),
        );
      })
      .then((success) => {
        if (!success)
          throw new Error("Não foi possível remover um dos anexos.");
        return draftAttachments.reduce(
          (queue, attachment, index) =>
            queue.then((ok) => {
              if (!ok) return false;
              const completed = 1 + removals.length + index;
              setSaveProgress({
                label: `Enviando anexo ${index + 1} de ${draftAttachments.length}…`,
                detail: attachment.name || "Arquivo selecionado",
                current: completed,
                total,
              });
              return Promise.resolve(
                onAttachment(taskItem.id, attachment.file),
              ).then((result) => {
                setSaveProgress({
                  label: "Atualizando anexos…",
                  detail: `${completed + 1} de ${total} concluído`,
                  current: completed + 1,
                  total,
                });
                return result;
              });
            }),
          Promise.resolve(true),
        );
      })
      .then((success) => {
        if (!success) throw new Error("Não foi possível enviar um dos anexos.");
        setSaveState("success");
        saveCloseTimerRef.current = window.setTimeout(onClose, 620);
      })
      .catch((error) => {
        setSaveState("idle");
        setValidationError(
          error.message || "Não foi possível salvar as alterações.",
        );
      });
  };
  return (
    <div
      className="drawer-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <aside className="task-drawer">
        {saveState === "saving" && (
          <div
            className="drawer-save-feedback drawer-progress-feedback"
            role="status"
            aria-live="polite"
          >
            <div className="drawer-progress-icon">
              <LoaderCircle size={27} className="spin" />
            </div>
            <strong>{saveProgress.label}</strong>
            <span>{saveProgress.detail}</span>
            <div
              className="drawer-progress-bar"
              aria-label={`${saveProgress.current} de ${saveProgress.total} etapas concluídas`}
            >
              <i
                style={{
                  width: `${Math.min(100, Math.round((saveProgress.current / Math.max(1, saveProgress.total)) * 100))}%`,
                }}
              />
            </div>
          </div>
        )}
        <header className="drawer-header">
          <div>
            <span className="eyebrow">Detalhe da tarefa</span>
            <span className="drawer-code">
              {taskItem.quoteCode || "TAREFA"}
            </span>
          </div>
          <button
            className="icon-button"
            onClick={requestClose}
            aria-label="Fechar detalhe"
            disabled={saveState !== "idle"}
          >
            <X size={19} />
          </button>
        </header>
        <div className="drawer-body">
          <div className="drawer-title">
            <label className="drawer-title-field" htmlFor={`task-title-${taskItem.id}`}>
              <span className="drawer-title-label">Título da tarefa</span>
              <input
                id={`task-title-${taskItem.id}`}
                value={form.title}
                onChange={(event) => set("title", event.target.value)}
                placeholder="Escreva o título da tarefa"
                aria-label="Título da tarefa"
              />
            </label>
          </div>
          {taskItem.quoteId && (
            <button
              className="linked-record"
              onClick={() => onOpenQuote(taskItem.quoteId)}
            >
              <FileText size={16} />
              <span>
                <small>Cotação vinculada</small>
                <strong>
                  {taskItem.quoteCode} · {taskItem.quoteTitle}
                </strong>
              </span>
              <ArrowUpRight size={15} />
            </button>
          )}
          <div className="drawer-field-grid">
            <div className="status-field">
              <span className="status-field-label">Status</span>
              <StatusPicker
                value={form.status}
                onChange={(value) => set("status", value)}
              />
            </div>
            <div className="priority-field">
              <span className="priority-field-label">Prioridade</span>
              <PriorityPicker
                value={form.priority}
                onChange={(value) => set("priority", value)}
              />
            </div>
            <label>
              Responsável
              <InputSelect
                value={form.assigneeName}
                onChange={(value) => set("assigneeName", value)}
                options={assigneeOptions}
                placeholder="Não atribuído"
              />
            </label>
            <label>
              Equipe
              <InputSelect
                value={form.teamName}
                onChange={(value) => set("teamName", value)}
                options={TEAM_OPTIONS}
              />
            </label>
            <label>
              Prazo
              <input
                type="date"
                value={form.dueDate || ""}
                onChange={(event) => set("dueDate", event.target.value)}
                disabled={currentDeadlineRole === "viewer"}
                title={currentDeadlineRole === "viewer" ? "Somente o criador ou um responsável pode alterar o prazo" : ""}
              />
            </label>
          </div>
          {dueDateChanged && currentDeadlineRole === "assignee" && (
            <label className="deadline-reason">
              Motivo da alteração do prazo
              <textarea value={form.deadlineChangeReason || ""} onChange={(event) => set("deadlineChangeReason", event.target.value)} rows="2" placeholder="Explique por que o prazo precisa mudar" />
            </label>
          )}
          {missingExternalRecipients.length > 0 && (
            <div className="external-notification-warning" role="status">
              <BellRing size={15} />
              <span>{missingExternalRecipients.map((employee) => employee.name).join(", ")} não receberá Teams/e-mail até ter usuário Microsoft vinculado.</span>
            </div>
          )}
          {validationError && (
            <div className="field-error" role="alert">
              {validationError}
            </div>
          )}
          <label className="drawer-description">
            Descrição
            <textarea
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
              rows="4"
            />
          </label>
          <section className="drawer-section">
            <div className="drawer-section-heading">
              <h3>Subtarefas</h3>
              <div className="drawer-heading-actions">
                <label className="checklist-visibility-toggle">
                  <input
                    type="checkbox"
                    checked={showChecklistOnCard}
                    onChange={(event) =>
                      onToggleChecklistOnCard(event.target.checked)
                    }
                  />
                  <span>No quadro</span>
                </label>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setIsAddingSubtask(true)}
                >
                  <Plus size={14} />
                  Adicionar
                </button>
              </div>
            </div>
            {isAddingSubtask && (
              <div className="subtask-inline-create">
                <span className="subtask-check" aria-hidden="true" />
                <input
                  autoFocus
                  value={newSubtaskTitle}
                  onChange={(event) => setNewSubtaskTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitSubtask();
                    if (event.key === "Escape") {
                      setNewSubtaskTitle("");
                      setIsAddingSubtask(false);
                    }
                  }}
                  placeholder="Digite o título da subtarefa"
                  aria-label="Título da subtarefa"
                />
                <button
                  className="subtask-inline-action"
                  type="button"
                  onClick={submitSubtask}
                  disabled={!newSubtaskTitle.trim()}
                  aria-label="Salvar subtarefa"
                >
                  <Check size={15} />
                </button>
              </div>
            )}
            {subtasks.length
              ? subtasks.map((subtask) => (
                  <div className="subtask-row" key={subtask.id}>
                    <button
                      className="subtask-toggle"
                      type="button"
                      disabled={subtask.syncStatus === "syncing"}
                      onClick={() =>
                        onSave(subtask.id, {
                          status: subtask.status === "done" ? "todo" : "done",
                        })
                      }
                    >
                      <span
                        className={`subtask-check ${subtask.status === "done" ? "checked" : ""}`}
                      >
                        {subtask.status === "done" && <Check size={13} />}
                      </span>
                      <span>{subtask.title}</span>
                      <small>
                        {subtask.syncStatus === "syncing"
                          ? "Sincronizando..."
                          : formatDate(subtask.dueDate)}
                      </small>
                    </button>
                    <button
                      className="subtask-delete"
                      type="button"
                      disabled={subtask.syncStatus === "syncing"}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSubtaskToDelete(subtask);
                      }}
                      aria-label="Excluir subtarefa"
                      title="Excluir subtarefa"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              : !isAddingSubtask && (
                  <div className="empty-inline">
                    Nenhuma subtarefa adicionada.
                  </div>
                )}
          </section>
          <section className="drawer-section">
            <div className="drawer-section-heading">
              <div className="comment-section-title">
                <h3>Conversa da tarefa</h3>
                <span className="section-count">{taskItem.comments.length}</span>
              </div>
              <span className="comment-section-helper">Atualizações e contexto</span>
            </div>
            {taskItem.comments.length ? taskItem.comments.map((item) => (
              <article
                className={`comment-row ${isOwnComment(item) ? "comment-own" : ""} ${item.syncStatus === "syncing" ? "item-syncing" : ""}`}
                key={item.id}
              >
                <Avatar name={item.author} small />
                <div className="comment-bubble">
                  <header>
                    <strong>{item.author}</strong>
                    <time dateTime={item.createdAt}>{formatCommentTimestamp(item.createdAt)}</time>
                  </header>
                  <p>{item.text}</p>
                  {item.syncStatus === "syncing" && <small className="comment-sync-status">Enviando…</small>}
                </div>
              </article>
            )) : (
              <div className="comment-empty-state">
                <MessageCircle size={18} aria-hidden="true" />
                <strong>Comece a conversa</strong>
                <span>Registre uma atualização para manter a equipe alinhada.</span>
              </div>
            )}
            <div className="comment-compose">
              <div className="comment-compose-label">
                <strong>Nova atualização</strong>
                <span>Use <b>@</b> para mencionar alguém</span>
              </div>
              <div className="comment-mention-field">
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.ctrlKey && event.key === "Enter") {
                      event.preventDefault();
                      submitComment();
                    }
                    if (event.key === "Escape")
                      setComment((value) =>
                        value.replace(/(?:^|\s)@[^\s@]*$/, ""),
                      );
                  }}
                  aria-label="Nova atualização da tarefa"
                  placeholder="O que a equipe precisa saber?"
                  maxLength={1000}
                  rows="2"
                />
                {mentionSuggestions.length > 0 && (
                  <div
                    className="mention-suggestions"
                    role="listbox"
                    aria-label="Responsáveis para mencionar"
                  >
                    {mentionSuggestions.map((employee) => (
                      <button
                        type="button"
                        className="mention-suggestion"
                        key={employee.id || employee.name}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => insertMention(employee)}
                      >
                        <Avatar name={employee.apelido || employee.name} small />
                        <span>{employee.apelido || employee.name}</span>
                        {employee.apelido && employee.name !== employee.apelido && <small>{employee.name}</small>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="comment-compose-footer">
                <span className="comment-compose-hint"><AtSign size={13} aria-hidden="true" /> Mencione responsáveis para avisá-los</span>
                <span className="comment-character-count">{comment.length}/1000</span>
                <button className="button button-secondary comment-submit" disabled={!comment.trim()} onClick={submitComment}>
                  <Send size={14} aria-hidden="true" />
                  Enviar atualização
                </button>
              </div>
            </div>
          </section>
          <AttachmentSection
            taskId={taskItem.id}
            attachments={visibleAttachments}
            loadAttachmentContent={loadAttachmentContent}
            onAttachment={handleDraftAttachment}
            onDeleteAttachment={handleDraftAttachmentDelete}
            helperText="As alterações nos anexos só são enviadas ao clicar em Salvar tarefa."
          />
          <section className="drawer-section history-section">
            <div className="drawer-section-heading">
              <h3>Histórico</h3>
            </div>
            {history.slice(0, 5).map((item) => (
              <div className="history-row" key={item.id}>
                <span className="history-dot" />
                <div>
                  <strong>{item.text}</strong>
                  <small>{item.author} · {formatCommentTimestamp(item.createdAt)}</small>
                </div>
              </div>
            ))}
          </section>
        </div>
        <footer className="drawer-footer">
          <button
            className="button button-danger task-delete-button"
            type="button"
            onClick={onRequestDelete}
            disabled={deleteState !== "idle" || saveState !== "idle"}
          >
            <Trash2 size={15} />
            Excluir
          </button>
          <button
            className="button button-quiet"
            onClick={requestClose}
            disabled={saveState !== "idle"}
          >
            Cancelar
          </button>
          <button
            className="button button-primary"
            disabled={saveState !== "idle"}
            onClick={handleSave}
          >
            {saveState === "saving" ? (
              <>
                <LoaderCircle size={16} className="spin" />
                {saveProgress.label}
              </>
            ) : (
              <>
                <Check size={16} />
                Salvar tarefa
              </>
            )}
          </button>
        </footer>
        {saveState === "success" && (
          <div
            className="drawer-save-feedback"
            role="status"
            aria-live="polite"
          >
            <div className="drawer-save-icon">
              <Check size={30} strokeWidth={2.5} />
            </div>
            <strong>Tarefa salva</strong>
            <span>Fechando detalhe…</span>
          </div>
        )}
        {deleteState === "deleting" && (
          <div
            className="drawer-delete-feedback"
            role="status"
            aria-live="polite"
          >
            <div className="drawer-delete-icon">
              <Trash2 size={30} strokeWidth={2.5} />
            </div>
            <strong>Tarefa excluída</strong>
            <span>Removendo do Planner…</span>
          </div>
        )}
        {showDiscardPrompt && (
          <UnsavedChangesDialog
            onContinue={() => setShowDiscardPrompt(false)}
            onDiscard={onClose}
          />
        )}
        {showDeletePrompt && (
          <DeleteTaskDialog
            taskTitle={taskItem.title}
            onCancel={onCancelDelete}
            onConfirm={onConfirmDelete}
          />
        )}
        {subtaskToDelete && (
          <DeleteTaskDialog
            taskTitle={subtaskToDelete.title}
            subject="subtarefa"
            onCancel={() => setSubtaskToDelete(null)}
            onConfirm={() => {
              setSubtaskToDelete(null);
              onDelete(subtaskToDelete.id);
            }}
          />
        )}
      </aside>
    </div>
  );
}

function TaskDrawer({ task, onDelete, ...props }) {
  const [showDeletePrompt, setShowDeletePrompt] = useState(false);
  const [deleteState, setDeleteState] = useState("idle");
  if (!task) return null;
  const confirmDelete = () => {
    setShowDeletePrompt(false);
    setDeleteState("deleting");
    window.setTimeout(() => {
      Promise.resolve(onDelete(task.id)).finally(() => setDeleteState("idle"));
    }, 620);
  };
  return (
    <TaskDrawerContent
      task={task}
      onDelete={onDelete}
      onRequestDelete={() => setShowDeletePrompt(true)}
      deleteState={deleteState}
      showDeletePrompt={showDeletePrompt}
      onCancelDelete={() => setShowDeletePrompt(false)}
      onConfirmDelete={confirmDelete}
      loadAttachmentContent={
        props.loadAttachmentContent || globalThis.__plannerAttachmentLoader
      }
      {...props}
    />
  );
}

function NewTaskDrawer({ employees = [], onClose, onSave }) {
  const [form, setForm] = useState({
    title: "",
    priority: "medium",
    assigneeName: [],
    teamName: "Comercial",
    dueDate: "",
    description: "",
  });
  const [draftAttachments, setDraftAttachments] = useState([]);
  const initialFormRef = useRef(form);
  const draftAttachmentsRef = useRef([]);
  draftAttachmentsRef.current = draftAttachments;
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [saveProgress, setSaveProgress] = useState({
    label: "Criando tarefa…",
    detail: "Preparando dados",
    current: 0,
    total: 1,
  });
  const saveCloseTimerRef = useRef(null);
  const assigneeOptions = useMemo(
    () => buildEmployeeAssigneeOptions(employees),
    [employees],
  );
  useEffect(
    () => () => {
      if (saveCloseTimerRef.current)
        window.clearTimeout(saveCloseTimerRef.current);
      draftAttachmentsRef.current.forEach(releaseDraftAttachment);
    },
    [],
  );
  const isDirty =
    Object.keys(initialFormRef.current).some(
      (key) =>
        JSON.stringify(form[key]) !==
        JSON.stringify(initialFormRef.current[key]),
    ) || draftAttachments.length > 0;
  const requestClose = () => {
    if (saveState !== "idle") return;
    if (isDirty) setShowDiscardPrompt(true);
    else onClose();
  };
  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const handleDraftAttachment = (id, filesOrFile) =>
    setDraftAttachments((current) => [
      ...current,
      ...toAttachmentFiles(filesOrFile).map((file) =>
        createDraftAttachment(file, "new"),
      ),
    ]);
  const handleDraftAttachmentDelete = (id, attachment) => {
    releaseDraftAttachment(attachment);
    setDraftAttachments((current) =>
      current.filter((item) => item.id !== attachment.id),
    );
  };
  const handleCreate = () => {
    if (saveState !== "idle" || !form.title.trim()) return;
    setSaveProgress({
      label: "Criando tarefa…",
      detail: draftAttachments.length
        ? "Salvando dados antes dos anexos"
        : "Preparando tarefa",
      current: 0,
      total: 1 + draftAttachments.length,
    });
    setSaveState("saving");
    Promise.resolve()
      .then(() =>
        onSave({
          ...form,
          attachments: draftAttachments,
          onProgress: setSaveProgress,
        }),
      )
      .then((success) => {
        if (!success) {
          setSaveState("idle");
          return;
        }
        setSaveState("success");
        saveCloseTimerRef.current = window.setTimeout(onClose, 680);
      })
      .catch(() => setSaveState("idle"));
  };
  return (
    <div
      className="drawer-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <aside className="task-drawer new-task-drawer">
        {saveState === "saving" && (
          <div
            className="drawer-save-feedback drawer-progress-feedback"
            role="status"
            aria-live="polite"
          >
            <div className="drawer-progress-icon">
              <LoaderCircle size={27} className="spin" />
            </div>
            <strong>{saveProgress.label}</strong>
            <span>{saveProgress.detail}</span>
            <div
              className="drawer-progress-bar"
              aria-label={`${saveProgress.current} de ${saveProgress.total} etapas concluídas`}
            >
              <i
                style={{
                  width: `${Math.min(100, Math.round((saveProgress.current / Math.max(1, saveProgress.total)) * 100))}%`,
                }}
              />
            </div>
          </div>
        )}
        <header className="drawer-header">
          <div>
            <span className="eyebrow">Nova tarefa</span>
            <span className="drawer-code">CRIAÇÃO MANUAL</span>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={requestClose}
            aria-label="Fechar criação"
            disabled={saveState !== "idle"}
          >
            <X size={19} />
          </button>
        </header>
        <div className="drawer-body">
          <div className="drawer-title">
            <label className="drawer-title-field" htmlFor="new-task-title">
              <span className="drawer-title-label">Título da tarefa</span>
              <input
                id="new-task-title"
                autoFocus
                value={form.title}
                onChange={(event) => set("title", event.target.value)}
                placeholder="Ex.: Confirmar motorista"
                aria-label="Título da tarefa"
              />
            </label>
          </div>
          <div className="drawer-field-grid new-task-quick-fields">
            <div className="priority-field">
              <span className="priority-field-label">Prioridade</span>
              <PriorityPicker
                value={form.priority}
                onChange={(value) => set("priority", value)}
              />
            </div>
            <label>
              Responsável
              <InputSelect
                value={form.assigneeName}
                onChange={(value) => set("assigneeName", value)}
                options={assigneeOptions}
                placeholder="Não atribuído"
              />
            </label>
            <label>
              Prazo
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => set("dueDate", event.target.value)}
              />
            </label>
            <label>
              Equipe
              <InputSelect
                value={form.teamName}
                onChange={(value) => set("teamName", value)}
                options={TEAM_OPTIONS}
              />
            </label>
          </div>
          <label className="drawer-description">
            Descrição
            <textarea
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
              rows="5"
              placeholder="Adicione contexto para quem vai executar..."
            />
          </label>
          <AttachmentSection
            taskId="new-task"
            attachments={draftAttachments}
            onAttachment={handleDraftAttachment}
            onDeleteAttachment={handleDraftAttachmentDelete}
            helperText="Os arquivos só serão enviados quando você clicar em Criar tarefa."
          />
          <div className="creation-note">
            <Sparkles size={16} />
            <span>
              Preencha os dados e confirme em Criar tarefa para salvar tudo de
              uma vez.
            </span>
          </div>
        </div>
        <footer className="drawer-footer">
          <button
            className="button button-quiet"
            type="button"
            onClick={requestClose}
            disabled={saveState !== "idle"}
          >
            Cancelar
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={!form.title.trim() || saveState !== "idle"}
            onClick={handleCreate}
          >
            {saveState === "saving" ? (
              <>
                <LoaderCircle size={16} className="spin" />
                {saveProgress.label}
              </>
            ) : (
              <>
                <Plus size={16} />
                Criar tarefa
              </>
            )}
          </button>
        </footer>
        {saveState === "success" && (
          <div
            className="drawer-save-feedback"
            role="status"
            aria-live="polite"
          >
            <div className="drawer-save-icon">
              <Check size={30} strokeWidth={2.5} />
            </div>
            <strong>Tarefa criada</strong>
            <span>Fechando…</span>
          </div>
        )}
        {showDiscardPrompt && (
          <UnsavedChangesDialog
            onContinue={() => setShowDiscardPrompt(false)}
            onDiscard={onClose}
          />
        )}
      </aside>
    </div>
  );
}

// Lazy-loaded wrappers for non-critical views (Quality & Settings)
// These are code-split to reduce the critical bundle size
const LazyQualityView = lazy(() => Promise.resolve({ default: QualityView }));
const LazySettingsView = lazy(() => Promise.resolve({ default: SettingsView }));

export default function App() {
  const [active, setActive] = useState("board");
  const [store] = useState(() => createDataStore());
  const [state, setState] = useState(() => ({
    tasks: [],
    quotes: [],
    employees: [],
    quality: [],
    notifications: [],
    live: store.live,
    loading: { core: true, quotes: true, quality: true, photos: true },
    loadErrors: {},
  }));
  const currentEmployee = resolveCurrentEmployee(state.employees, store.live);
  const [selectedId, setSelectedId] = useState("");
  const [creating, setCreating] = useState(false);
  const [filters, setFilters] = useState(createDefaultFilters);
  const [taskScope, setTaskScope] = useState("mine");
  const [checklistVisibility, setChecklistVisibility] = useState(
    readChecklistVisibility,
  );
  const [notice, setNotice] = useState("");
  const [noticeAction, setNoticeAction] = useState(null);
  const [error, setError] = useState("");
  const [failedTaskDraft, setFailedTaskDraft] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const confirmedStateRef = useRef(null);
  const pendingMutationsRef = useRef(new Map());
  const refreshInFlightRef = useRef(false);
  const noticeTimerRef = useRef(null);
  const launchHandledRef = useRef(false);
  const failedTaskReopenTimerRef = useRef(null);
  const dismissNotice = useCallback(() => {
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = null;
    setNotice("");
    setNoticeAction(null);
  }, []);
  const showNotice = useCallback((message, duration = 2600, action = null) => {
    setNotice(message);
    setNoticeAction(action);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => {
      noticeTimerRef.current = null;
      setNotice("");
      setNoticeAction(null);
    }, duration);
  }, []);
  globalThis.__plannerEmployees = state.employees;
  const defaultEmployee = resolveCurrentEmployee(state.employees, store.live);
  useEffect(() => {
    if (taskScope !== "mine" || !defaultEmployee?.name) return;
    setFilters((current) =>
      current.assignee?.length
        ? current
        : { ...current, assignee: [defaultEmployee.name] },
    );
  }, [taskScope, defaultEmployee?.name]);
  useEffect(() => {
    if (!defaultEmployee?.name) return;
    const isMine =
      filters.assignee?.length === 1 &&
      filters.assignee[0] === defaultEmployee.name;
    setTaskScope((current) =>
      current === (isMine ? "mine" : "all") ? current : isMine ? "mine" : "all",
    );
  }, [filters.assignee, defaultEmployee?.name]);
  useEffect(
    () => () => {
      if (failedTaskReopenTimerRef.current)
        window.clearTimeout(failedTaskReopenTimerRef.current);
    },
    [],
  );
  const applyPendingMutations = useCallback(
    (confirmed) =>
      [...pendingMutationsRef.current.values()].reduce(
        (current, mutation) => mutation.update(current),
        confirmed,
      ),
    [],
  );
  const mergeConfirmed = useCallback(
    (patch) => {
      const current = confirmedStateRef.current || {};
      const next = {
        ...current,
        ...patch,
        loading: { ...(current.loading || {}), ...(patch.loading || {}) },
      };
      confirmedStateRef.current = next;
      setState(applyPendingMutations(next));
    },
    [applyPendingMutations],
  );
  const refreshInBackground = useCallback(async ({ silent = true } = {}) => {
    if (refreshInFlightRef.current || state.loading?.core) return;
    refreshInFlightRef.current = true;
    setRefreshing(true);
    if (!silent) showNotice("Atualizando dados…", 5200);
    try {
      const core = await store.loadCore();
      mergeConfirmed(core);
      const [supplemental, photos] = await Promise.allSettled([
        store.loadSupplemental(core),
        store.loadPhotos(core),
      ]);
      if (supplemental.status === "fulfilled") mergeConfirmed(supplemental.value);
      if (photos.status === "fulfilled") mergeConfirmed(photos.value);
      setState((current) => ({
        ...current,
        loadErrors: {
          ...current.loadErrors,
          ...(supplemental.status === "rejected"
            ? { supplemental: supplemental.reason?.message || "Dados complementares indisponíveis." }
            : { supplemental: undefined }),
          ...(photos.status === "rejected"
            ? { photos: photos.reason?.message || "Fotos indisponíveis." }
            : { photos: undefined }),
        },
      }));
      if (!silent) showNotice("Dados atualizados agora.", 2200);
    } catch {
      if (!silent) showNotice("Não foi possível atualizar. Dados atuais mantidos.", 4200);
    } finally {
      refreshInFlightRef.current = false;
      setRefreshing(false);
    }
  }, [mergeConfirmed, showNotice, state.loading?.core, store]);

  useEffect(() => {
    if (state.loading?.core) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") refreshInBackground({ silent: true });
    }, 60000);
    return () => window.clearInterval(timer);
  }, [refreshInBackground, state.loading?.core]);
  const searchQuotes = useCallback(
    (query) =>
      store.searchQuotes
        ? store
            .searchQuotes(query)
            .then((found) =>
              setState((current) => ({
                ...current,
                quotes: [
                  ...new Map(
                    [...current.quotes, ...found].map((quote) => [
                      quote.id,
                      quote,
                    ]),
                  ).values(),
                ],
              })),
            )
            .catch(() => undefined)
        : Promise.resolve([]),
    [store],
  );
  plannerQuoteSearch = searchQuotes;
  useEffect(() => {
    let activeRequest = true;
    store
      .loadCore()
      .then((core) => {
        if (!activeRequest) return;
        mergeConfirmed(core);
        store
          .loadSupplemental(core)
          .then((supplemental) => {
            if (activeRequest) mergeConfirmed(supplemental);
          })
          .catch((failure) => {
            if (activeRequest)
              setState((current) => ({
                ...current,
                loadErrors: {
                  ...current.loadErrors,
                  supplemental:
                    failure.message || "Dados complementares indisponíveis.",
                },
                loading: { ...current.loading, quotes: false, quality: false },
              }));
          });
        store
          .loadPhotos(core)
          .then((photos) => {
            if (activeRequest) mergeConfirmed(photos);
          })
          .catch((failure) => {
            if (activeRequest)
              setState((current) => ({
                ...current,
                loadErrors: {
                  ...current.loadErrors,
                  photos: failure.message || "Fotos indisponíveis.",
                },
                loading: { ...current.loading, photos: false },
              }));
          });
      })
      .catch((failure) => {
        if (activeRequest)
          setError(failure.message || "Não foi possível carregar as tarefas.");
      });
    return () => {
      activeRequest = false;
    };
  }, [store, mergeConfirmed]);
  useEffect(() => {
    const task = state.tasks.find((item) => item.id === selectedId);
    if (
      !selectedId ||
      !task ||
      task.detailsLoaded ||
      task.detailsLoading ||
      !store.loadTaskDetails
    )
      return;
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((item) =>
        item.id === selectedId ? { ...item, detailsLoading: true } : item,
      ),
    }));
    store
      .loadTaskDetails(selectedId)
      .then((details) =>
        setState((current) => ({
          ...current,
          tasks: current.tasks.map((item) =>
            item.id === selectedId
              ? {
                  ...item,
                  ...details,
                  detailsLoaded: true,
                  detailsLoading: false,
                }
              : item,
          ),
        })),
      )
      .catch((failure) => {
        setState((current) => ({
          ...current,
          tasks: current.tasks.map((item) =>
            item.id === selectedId
              ? {
                  ...item,
                  detailsLoading: false,
                  detailsError:
                    failure.message || "Não foi possível carregar o histórico.",
                }
              : item,
          ),
        }));
      });
  }, [selectedId, state.tasks, store]);
  const runMutation = useCallback(
    (operation, message) =>
      operation
        .then((next) => {
          confirmedStateRef.current = next;
          setState(applyPendingMutations(next));
          showNotice(message);
        })
        .catch((failure) =>
          showNotice(
            failure.message || "Não foi possível concluir a operação.",
            5200,
          ),
        ),
    [applyPendingMutations, showNotice],
  );
  useEffect(() => {
    if (!state || launchHandledRef.current) return;
    launchHandledRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const data = new URLSearchParams(
      (params.get("data") || "").replace(/^\?/, ""),
    );
    const taskId = params.get("taskId") || data.get("taskId") || "";
    const mode = params.get("mode") || data.get("mode") || "";
    if (taskId) setSelectedId(taskId);
    if (mode === "create") setCreating(true);
  }, [state]);
  const runOptimisticMutation = useCallback(
    (update, operation, pendingMessage, successMessage) => {
      const mutationId =
        globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      pendingMutationsRef.current.set(mutationId, { update });
      setState((current) => update(current));
      if (pendingMessage) showNotice(pendingMessage);
      return Promise.resolve()
        .then(operation)
        .then((next) => {
          confirmedStateRef.current = next;
          pendingMutationsRef.current.delete(mutationId);
          setState(applyPendingMutations(next));
          if (successMessage) showNotice(successMessage);
          return true;
        })
        .catch((failure) => {
          pendingMutationsRef.current.delete(mutationId);
          if (confirmedStateRef.current)
            setState(applyPendingMutations(confirmedStateRef.current));
          showNotice(
            `Falha ao sincronizar: ${failure.message || "operação não concluída."}`,
            5200,
          );
          return false;
        });
    },
    [applyPendingMutations, showNotice],
  );
  const runOptimisticCreate = useCallback(
    (input, operation, message, parentTaskId = null) => {
      const optimisticTask = buildOptimisticTask(input, parentTaskId);
      return runOptimisticMutation(
        (current) => ({
          ...current,
          tasks: [optimisticTask, ...current.tasks],
        }),
        operation,
        store.live
          ? "Tarefa adicionada. Enviando ao Dataverse..."
          : "Tarefa adicionada no mock local.",
        message,
      );
    },
    [runOptimisticMutation, store],
  );
  const selected = useMemo(() => {
    const taskItem = state?.tasks.find((item) => item.id === selectedId);
    if (!taskItem) return undefined;
    return failedTaskDraft?.id === taskItem.id
      ? { ...taskItem, ...failedTaskDraft.patch, syncStatus: undefined }
      : taskItem;
  }, [state, selectedId, failedTaskDraft]);
  const openTask = useCallback((id) => setSelectedId(id), []);
  const closeTask = useCallback(() => setSelectedId(""), []);
  const setChecklistVisibilityForTask = useCallback((id, visible) => {
    setChecklistVisibility((current) => {
      const next = { ...current, [id]: visible };
      try {
        localStorage.setItem(
          CHECKLIST_VISIBILITY_STORAGE_KEY,
          JSON.stringify(next),
        );
      } catch {
        /* preferência visual permanece nesta sessão */
      }
      return next;
    });
  }, []);
  const moveTask = useCallback(
    (id, status) => {
      const task = state.tasks.find((item) => item.id === id);
      if (!task) return Promise.resolve(false);
      const patch = { status };
      return runOptimisticMutation(
        (current) => applyOptimisticTaskPatch(current, id, patch),
        () => store.updateTask(state, id, patch),
        store.live
          ? "Status alterado. Sincronizando..."
          : "Status alterado no mock local.",
        store.live ? "Status sincronizado." : "Status atualizado localmente.",
      );
    },
    [state, store, runOptimisticMutation, showNotice],
  );
  const saveTask = useCallback(
    (id, patch) => {
      const existingTask = state.tasks.find((taskItem) => taskItem.id === id);
      const mentionText = [
        patch.title !== existingTask?.title ? patch.title : "",
        patch.description !== existingTask?.description ? patch.description : "",
      ].filter((value) => typeof value === "string").join(" ");
      const nextPatch = {
        ...patch,
        actorEmployeeId: currentEmployee?.id || "",
        actorUserId: currentEmployee?.userId || "",
        mentionedEmployeeIds: mentionText ? mentionedEmployees(mentionText, state.employees).map((employee) => employee.id) : [],
      };
      const shouldReopen = id === selectedId;
      return runOptimisticMutation(
        (current) => applyOptimisticTaskPatch(current, id, nextPatch),
        () => store.updateTask(state, id, nextPatch),
        "",
        "",
      ).then((success) => {
        if (success) {
          if (shouldReopen)
            setFailedTaskDraft((current) =>
              current?.id === id ? null : current,
            );
          return true;
        }
        if (!shouldReopen) return false;
        setFailedTaskDraft({ id, patch: nextPatch });
        if (failedTaskReopenTimerRef.current)
          window.clearTimeout(failedTaskReopenTimerRef.current);
        setSelectedId("");
        failedTaskReopenTimerRef.current = window.setTimeout(() => {
          failedTaskReopenTimerRef.current = null;
          setSelectedId(id);
        }, 120);
        return false;
      });
    },
    [currentEmployee, state, store, runOptimisticMutation, selectedId, showNotice],
  );
  const completeTask = useCallback(
    (id) => {
      const task = state.tasks.find((item) => item.id === id);
      if (!task || ["done", "cancelled"].includes(task.status))
        return Promise.resolve(false);
      const previousPatch = { status: task.status };
      const completePatch = { status: "done" };
      return runOptimisticMutation(
        (current) => applyOptimisticTaskPatch(current, id, completePatch),
        () => store.updateTask(state, id, completePatch),
        "",
        "",
      ).then((success) => {
        if (!success) return false;
        showNotice("Tarefa concluída.", 5600, {
          label: "Desfazer",
          onClick: () =>
            runOptimisticMutation(
              (current) => applyOptimisticTaskPatch(current, id, previousPatch),
              () =>
                store.updateTask(
                  confirmedStateRef.current || state,
                  id,
                  previousPatch,
                ),
              "",
              "Tarefa reaberta.",
            ),
        });
        return true;
      });
    },
    [state, store, runOptimisticMutation, showNotice],
  );
  const deleteTask = useCallback(
    (id) => {
      const shouldCloseDrawer = selectedId === id;
      return runOptimisticMutation(
        (current) => ({
          ...current,
          tasks: current.tasks.filter((taskItem) => taskItem.id !== id),
        }),
        () => store.deleteTask(state, id),
        "",
        "",
      ).then((success) => {
        if (success && shouldCloseDrawer) setSelectedId("");
        return success;
      });
    },
    [state, store, runOptimisticMutation, selectedId],
  );
  const createNewTask = useCallback(
    (input) => {
      const {
        subtasks = [],
        attachments = [],
        onProgress,
        ...taskInput
      } = input;
      const commonTask = {
        ...buildTaskCreationInput(taskInput),
        actorEmployeeId: currentEmployee?.id || "",
        actorUserId: currentEmployee?.userId || "",
      };
      const operation = () => {
        onProgress?.({
          label: "Criando tarefa…",
          detail: "Salvando dados da tarefa",
          current: 0,
          total: 1 + attachments.length,
        });
        return store.createTask(state, commonTask).then((nextState) => {
          const parent = nextState.tasks.find(
            (taskItem) =>
              taskItem.title === commonTask.title && !taskItem.parentTaskId,
          );
          if (!parent) return nextState;
          onProgress?.({
            label: attachments.length
              ? "Tarefa criada. Preparando anexos…"
              : "Finalizando tarefa…",
            detail: "Tarefa salva",
            current: 1,
            total: 1 + attachments.length,
          });
          const withSubtasks = subtasks.reduce(
            (promise, title) =>
              promise.then((currentState) =>
                store.createSubtask(currentState, parent.id, {
                  title,
                  description: "",
                  priority: "medium",
                  assigneeName: "Não atribuído",
                  teamName: "Operação",
                  dueDate: "",
                }),
              ),
            Promise.resolve(nextState),
          );
          return attachments.reduce(
            (promise, attachment, index) =>
              promise.then((currentState) => {
                onProgress?.({
                  label: `Enviando anexo ${index + 1} de ${attachments.length}…`,
                  detail: attachment.name || "Arquivo selecionado",
                  current: index + 1,
                  total: 1 + attachments.length,
                });
                return store
                  .addAttachment(
                    currentState,
                    parent.id,
                    attachment.file,
                    attachment.previewUrl,
                  )
                  .then((result) => {
                    onProgress?.({
                      label: "Atualizando anexos…",
                      detail: `${index + 1} de ${attachments.length} concluído`,
                      current: index + 2,
                      total: 1 + attachments.length,
                    });
                    return mergeAttachmentDetailsIntoState(
                      currentState,
                      parent.id,
                      result,
                    );
                  });
              }),
            withSubtasks,
          );
        });
      };
      return runOptimisticCreate(
        commonTask,
        operation,
        store.live ? "Tarefa sincronizada." : "Tarefa salva localmente.",
      );
    },
    [state, store, runOptimisticCreate, currentEmployee],
  );
  const createSubtask = useCallback(
    (parentId, title) => {
      const input = {
        title,
        description: "",
        priority: "medium",
        assigneeName: "Não atribuído",
        teamName: "Operação",
        dueDate: "",
      };
      runOptimisticCreate(
        input,
        () => store.createSubtask(state, parentId, input),
        store.live ? "Subtarefa sincronizada." : "Subtarefa salva localmente.",
        parentId,
      );
    },
    [state, store, runOptimisticCreate],
  );
  const createQualityTask = useCallback(
    (item) => {
      const input = {
        title: item.title,
        description: item.description,
        dueDate: item.dueDate,
        sourceType: "quality",
        sourceId: item.id,
        sourceCode: item.code,
        sourceLabel:
          item.type === "error" ? "Erro operacional" : "Ação operacional",
      };
      runOptimisticCreate(
        input,
        () => store.createQualityTask(state, item),
        store.live
          ? "Tarefa de qualidade sincronizada."
          : "Tarefa de qualidade salva localmente.",
      );
    },
    [state, store, runOptimisticCreate],
  );
  const refreshData = useCallback(
    (quote) => {
      if (!quote)
        return runMutation(
          store.save(state),
          store.live ? "Dados atualizados." : "Dados locais atualizados.",
        );
      const input = {
        title: quoteTaskTitle(quote),
        quoteId: quote.id,
        quoteCode: quote.code || "",
        quoteTitle: quote.title || "",
        dueDate: quote.deadline,
        priority: "medium",
        sourceType: "quote",
        assigneeName: "Não atribuído",
        teamName: "Comercial",
      };
      return runOptimisticCreate(
        input,
        () => store.ensureQuoteTask(state, quote),
        store.live
          ? "Tarefa principal sincronizada."
          : "Tarefa principal salva localmente.",
      );
    },
    [state, store, runMutation, runOptimisticCreate],
  );
  const reloadData = useCallback(() => {
    runMutation(store.reset(), "Dados recarregados.");
    setSelectedId("");
  }, [store, runMutation]);
  const addComment = useCallback(
    (id, text) => {
      const actor = resolveCurrentEmployee(state.employees, store.live);
      const mentionedEmployeeIds = mentionedEmployees(text, state.employees).map((employee) => employee.id);
      const context = { actorEmployeeId: actor?.id || "", actorUserId: actor?.userId || "", mentionedEmployeeIds };
      return (
      runOptimisticMutation(
        (current) => addOptimisticComment(current, id, text),
        () => store.addComment(state, id, text, context),
        store.live
          ? "Comentário adicionado. Sincronizando..."
          : "Comentário adicionado no mock local.",
        store.live
          ? "Comentário sincronizado."
          : "Comentário salvo localmente.",
      ));
    },
    [state, store, runOptimisticMutation],
  );
  const addAttachment = useCallback(
    (id, filesOrFile) => {
      const files = toAttachmentFiles(filesOrFile);
      if (!files.length) return Promise.resolve(false);
      return files.reduce(
        (queue, file, index) =>
          queue.then(() => {
            const baseState = confirmedStateRef.current || state;
            const previewPromise = store.live
              ? Promise.resolve(
                  globalThis.URL?.createObjectURL
                    ? globalThis.URL.createObjectURL(file)
                    : "",
                )
              : fileToDataUrl(file);
            return previewPromise.then((previewUrl) =>
              runOptimisticMutation(
                (current) =>
                  addOptimisticAttachment(current, id, file, previewUrl),
                () =>
                  Promise.resolve(
                    store.addAttachment(baseState, id, file, previewUrl),
                  ).then((result) =>
                    mergeAttachmentDetailsIntoState(baseState, id, result),
                  ),
                files.length > 1
                  ? `Anexo ${index + 1} de ${files.length} na fila...`
                  : store.live
                    ? "Anexo em envio..."
                    : "Anexo adicionado no mock local.",
                files.length > 1
                  ? `Anexo ${index + 1} de ${files.length} salvo.`
                  : store.live
                    ? "Anexo salvo no SharePoint."
                    : "Anexo salvo localmente.",
              ),
            );
          }),
        Promise.resolve(true),
      );
    },
    [state, store, runOptimisticMutation],
  );
  const removeAttachment = useCallback(
    (taskId, attachment) =>
      runOptimisticMutation(
        (current) => ({
          ...current,
          tasks: current.tasks.map((taskItem) =>
            taskItem.id === taskId
              ? {
                  ...taskItem,
                  attachments: (taskItem.attachments || []).filter(
                    (item) => item.id !== attachment.id,
                  ),
                }
              : taskItem,
          ),
        }),
        () =>
          Promise.resolve(
            store.deleteAttachment(
              confirmedStateRef.current || state,
              taskId,
              attachment,
            ),
          ),
        store.live
          ? "Anexo removido. Sincronizando SharePoint..."
          : "Anexo removido no mock local.",
        store.live
          ? "Anexo removido do SharePoint."
          : "Anexo removido localmente.",
      ),
    [state, store, runOptimisticMutation],
  );
  const workItems = useMemo(
    () => normalizeWorkItems(state || {}),
    [state?.tasks, state?.quality],
  );
  useEffect(() => {
    if (!currentEmployee?.id || !store.loadNotifications) return undefined;
    let activeRequest = true;
    const refresh = () => store.loadNotifications(currentEmployee.id).then((notifications) => { if (activeRequest) setState((current) => ({ ...current, notifications })); });
    refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => { activeRequest = false; window.clearInterval(timer); };
  }, [currentEmployee?.id, store]);
  const markNotificationRead = useCallback((notificationId) => {
    if (!store.markNotificationRead) return;
    store.markNotificationRead(state, notificationId).then(setState).catch((failure) => showNotice(`Falha ao atualizar notificação: ${failure.message}`));
  }, [state, store, showNotice]);
  const markTaskNotificationsRead = useCallback((taskId) => {
    if (!taskId || !store.markNotificationRead) return;
    const unread = (state.notifications || []).filter((item) => item.taskId === taskId && !item.readAt);
    if (!unread.length) return;
    Promise.all(unread.map((item) => store.markNotificationRead(state, item.id)))
      .then(() => setState((current) => ({
        ...current,
        notifications: (current.notifications || []).map((item) => unread.some((entry) => entry.id === item.id) ? { ...item, readAt: item.readAt || new Date().toISOString() } : item),
      })))
      .catch((failure) => showNotice(`Falha ao atualizar notificações: ${failure.message}`));
  }, [state, store, showNotice]);
  useEffect(() => {
    if (selectedId) markTaskNotificationsRead(selectedId);
  }, [selectedId, markTaskNotificationsRead]);
  const markAllNotificationsRead = useCallback(() => {
    if (!currentEmployee?.id || !store.markAllNotificationsRead) return;
    store.markAllNotificationsRead(state, currentEmployee.id).then(setState).catch((failure) => showNotice(`Falha ao atualizar notificações: ${failure.message}`));
  }, [currentEmployee?.id, state, store, showNotice]);
  const openNotification = useCallback((item) => { if (!item.readAt) markNotificationRead(item.id); if (item.taskId) setSelectedId(item.taskId); }, [markNotificationRead]);
  const onTaskScopeChange = useCallback(
    (scope) => {
      setTaskScope(scope);
      setFilters((current) => ({
        ...current,
        assignee:
          scope === "mine" && currentEmployee?.name
            ? [currentEmployee.name]
            : [],
      }));
    },
    [currentEmployee?.name],
  );
  const onCentralModeChange = useCallback(
    (mode) => {
      setActive(mode === "mine" ? "dashboard" : "team");
      onTaskScopeChange(mode === "mine" ? "mine" : "all");
    },
    [onTaskScopeChange],
  );
  const navigate = useCallback(
    (target) => {
      if (target === "dashboard") return onCentralModeChange("mine");
      if (target === "team") return onCentralModeChange("team");
      setActive(target);
    },
    [onCentralModeChange],
  );
  if (error)
    return (
      <div className="app-error">
        <strong>Não foi possível carregar o Planner.</strong>
        <span>{error}</span>
        <button
          className="button button-secondary"
          onClick={() => {
            setError("");
            store
              .load()
              .then(setState)
              .catch((failure) => setError(failure.message));
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  if (state.loading?.core)
    return (
      <AppShell
        active={active}
        onNavigate={navigate}
        onCreate={() => setCreating(true)}
        tasks={state.tasks}
        live={store.live}
        currentEmployee={null}
        personalStats={taskStats([])}
        openTaskCount={0}
        onRefresh={refreshInBackground}
        refreshing={refreshing}
      >
        <DataLoadingView
          loading={state.loading}
          error={state.loadErrors?.core}
        />
      </AppShell>
    );
  const viewState = { ...state, workItems };
  const personalItems = currentEmployee
    ? workItems.filter((item) => isAssignedToEmployee(item, currentEmployee))
    : [];
  const personalStats = workItemStats(filterWorkItems(personalItems));
  const openTaskCount = state.tasks.filter(
    (task) =>
      !task.parentTaskId && !["done", "cancelled"].includes(task.status),
  ).length;
  const renderPage = () => {
    if (active === "dashboard" || active === "team")
      return (
        <CentralView
          state={viewState}
          mode={active === "dashboard" ? "mine" : "team"}
          currentEmployee={currentEmployee}
          filters={filters}
          filterBar={
            <FilterBar
              filters={filters}
              setFilters={setFilters}
              onCreate={() => setCreating(true)}
              employees={state.employees}
            />
          }
          onClearFilters={() => setFilters(createDefaultFilters())}
          onChangeMode={onCentralModeChange}
          onOpenTask={openTask}
          onOpenSource={(item) => store.openSource?.(item)}
          onCompleteTask={completeTask}
          onCreate={() => setCreating(true)}
        />
      );
    if (active === "board")
      return (
        <BoardView
          state={state}
          currentEmployee={currentEmployee}
          checklistVisibility={checklistVisibility}
          onOpen={openTask}
          onToggleSubtask={saveTask}
          onMove={moveTask}
          onComplete={completeTask}
          onCreate={() => setCreating(true)}
          filters={filters}
          setFilters={setFilters}
          onNavigate={navigate}
          taskScope={taskScope}
          onScopeChange={onTaskScopeChange}
        />
      );
    if (active === "list")
      return (
        <ListView
          state={state}
          currentEmployee={currentEmployee}
          onOpen={openTask}
          onCreate={() => setCreating(true)}
          filters={filters}
          setFilters={setFilters}
          onNavigate={navigate}
          taskScope={taskScope}
          onScopeChange={onTaskScopeChange}
        />
      );
    if (active === "calendar")
      return (
        <CalendarView
          state={state}
          currentEmployee={currentEmployee}
          onOpen={openTask}
          onCreate={() => setCreating(true)}
          filters={filters}
          setFilters={setFilters}
          onNavigate={navigate}
          taskScope={taskScope}
          onScopeChange={onTaskScopeChange}
        />
      );
    if (active === "more") return <MoreView onNavigate={navigate} />;
    if (active === "quality")
      return state.loading?.quality ? (
        <LoadingFallback />
      ) : (
        <Suspense fallback={<LoadingFallback />}>
          <LazyQualityView
            state={state}
            onCreate={createQualityTask}
            onCreateTask={() => setCreating(true)}
            filters={filters}
            setFilters={setFilters}
          />
        </Suspense>
      );
    return (
      <Suspense fallback={<LoadingFallback />}>
        <LazySettingsView onReset={reloadData} live={store.live} />
      </Suspense>
    );
  };
  return (
    <AppShell
      active={active}
      onNavigate={navigate}
      onCreate={() => setCreating(true)}
      tasks={state.tasks}
      live={store.live}
      currentEmployee={currentEmployee}
      personalStats={personalStats}
      openTaskCount={openTaskCount}
      notifications={(state.notifications || []).filter((item) => item.recipientEmployeeId === currentEmployee?.id)}
      onOpenNotification={openNotification}
      onMarkNotificationRead={markNotificationRead}
      onMarkAllNotificationsRead={markAllNotificationsRead}
      onRefresh={refreshInBackground}
      refreshing={refreshing}
    >
      {renderPage()}
      {(state.loading?.quotes || state.loading?.quality) && (
        <div className="data-sync-chip" role="status" aria-live="polite">
          Preparando dados complementares…
        </div>
      )}
      {notice && (
        <div
          className={`toast ${notice.startsWith("Falha") || notice.startsWith("Não foi") ? "toast-error" : ""} ${refreshing ? "toast-refreshing" : ""}`}
          role="status"
          aria-live="polite"
        >
          {refreshing ? <LoaderCircle className="spin" size={17} /> : <CheckCircle2 size={17} />}
          <span>{notice}</span>
          {noticeAction && (
            <button
              className="toast-action"
              type="button"
              onClick={() => {
                const action = noticeAction;
                dismissNotice();
                action.onClick();
              }}
            >
              {noticeAction.label}
            </button>
          )}
          <button
            className="toast-close"
            type="button"
            onClick={dismissNotice}
            aria-label="Fechar notificação"
            title="Fechar notificação"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {selected && (
        <TaskDrawer
          task={selected}
          state={state}
          currentEmployee={currentEmployee}
          showChecklistOnCard={Boolean(checklistVisibility[selected.id])}
          onToggleChecklistOnCard={(visible) =>
            setChecklistVisibilityForTask(selected.id, visible)
          }
          onClose={closeTask}
          onSave={saveTask}
          onDelete={deleteTask}
          onComment={addComment}
          onAttachment={addAttachment}
          onDeleteAttachment={removeAttachment}
          onOpenQuote={(id) => {
            onCentralModeChange("mine");
            closeTask();
            showNotice(
              `Cotação ${state.quotes.find((quote) => quote.id === id)?.code || ""} vinculada.`,
            );
          }}
          onAddSubtask={createSubtask}
        />
      )}
      {creating && (
        <NewTaskDrawer
          employees={state.employees}
          onClose={() => setCreating(false)}
          onSave={createNewTask}
        />
      )}
    </AppShell>
  );
}
