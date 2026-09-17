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
import PriorityPicker from "./PriorityPicker.jsx";
import { DateInput } from "./DateInput.jsx";
import {
  ArrowUpRight,
  ArrowDownUp,
  BellRing,
  Columns3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
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
  Eye,
  EyeOff,
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  Menu,
  MessageCircle,
  Paperclip,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Sparkles,
  Target,
  Tag,
  UserRound,
  Users,
  X,
  UploadCloud,
} from "lucide-react";
import {
  addOptimisticAttachment,
  addOptimisticComment,
  addOptimisticReturn,
  applyOptimisticTaskPatch,
  buildAssigneeOptions,
  buildOptimisticTask,
  buildTaskCreationInput,
  DEFAULT_PERSONAL_TAG_COLOR,
  deriveExecutionActor,
  canRegisterWaitingReturn,
  EMPTY_WAITING_CONTEXT,
  filterTasks,
  findCreatedMainTask,
  formatDate,
  formatLongDate,
  getDueBucketForEmployee,
  hasTaskResponsible,
  isTaskVisibleToEmployee,
  isDueToday,
  mentionedEmployees,
  normalizeWaitingContext,
  normalizePersonalTagIds,
  normalizeAssigneeNames,
  normalizeText,
  PRIORITIES,
  PERSONAL_TAG_COLORS,
  quoteTaskTitle,
  resolveTaskAssignment,
  sortTasks,
  sortBoardTasks,
  STATUSES,
  statusById,
  taskDisplayDueDate,
  taskStats,
  teamResponsibilitySummary,
  validateTeamComposition,
  validateWaitingContext,
  waitingContextSummary,
} from "./domain";
import { isQuoteTask, quoteStatusForTaskStatus, taskStatusForQuoteStatus } from "./quoteTaskFlow";
import { validateQuoteCommercial } from "./quoteDomain";
import { FormMoneyInput, FormTextArea } from "./quotes/QuoteFields";
import { taskHistoryDetails, visibleTaskHistory } from "./taskHistory";
import { playCompletionSound, prepareCompletionSound } from "./completionSound";
import { createDataStore } from "./dataverse";
import ServiceTypeManager from "./ServiceTypeManager.jsx";
import { plannerNavigationWindow, plannerUrlForState, readPlannerUrlState } from "./plannerUrl";
import SearchableSelect, {
  SearchableMultiSelect,
} from "./SearchableSelect.jsx";
import AssignmentFields, { InputSelect } from "./AssignmentFields.jsx";
import CentralView from "./CentralView.jsx";
import ManagementView from "./ManagementView.jsx";
import QuotesView from "./QuotesView.jsx";
import ContactsView from "./ContactsView.jsx";
import PageHeader from "./PageHeader.jsx";
import AssigneeDisplay from "./AssigneeDisplay.jsx";
import { TEAM_ICON_OPTIONS, TeamIcon } from "./teamIcons.jsx";
import { MentionableField, useMentionController } from "./MentionableField.jsx";
import LoadingFallback from "./LoadingFallback.jsx";
import { readQuoteViewPreference } from "./quotes/quoteViewPreference.js";
import KanbanBoard from "./KanbanBoard.jsx";
import PlannerImportView from "./PlannerImportView.jsx";
import AdminCleanupPanel from "./AdminCleanupPanel.jsx";
import NotificationTestPanel from "./NotificationTestPanel.jsx";
import {
  filterWorkItems,
  isAssignedToEmployee,
  normalizeWorkItems,
  workItemStats,
} from "./workItems.js";
import { APP_VERSION } from "./version.js";
import {
  deadlineRole,
  isTaskWaitingForEmployee,
  unreadCount,
  validateDeadlineChange,
} from "./notifications.js";
import { canViewManagement, localDateKey } from "./management.js";
import {
  buildLinkedTaskInput,
  createContactPayload,
  createContactEvent,
  normalizeContact,
} from "./contactDomain.js";
import { installPlannerBridge } from "./whatsappBridge.js";
import { buildBackgroundRefreshPatch } from "./refreshState.js";

const QUOTE_WORKSPACE_V2_ENABLED = import.meta.env.VITE_QUOTES_WORKSPACE_V2 !== "false";
const QUOTE_HYBRID_V3_ENABLED = import.meta.env.VITE_QUOTES_HYBRID_V3 !== "false";

const CENTRAL_NAV_ITEMS = [
  ["dashboard", "Início", LayoutDashboard],
  ["board", "Tarefas", ClipboardList],
  ["management", "Gestão", Target],
  ["contacts", "Contatos", Users],
  ["quotes", "Cotações", FileText],
  ["settings", "Configurações", Settings],
];

const MOBILE_NAV_ITEMS = [
  ["dashboard", "Hoje", LayoutDashboard],
  ["board", "Tarefas", ClipboardList],
  ["quotes", "Cotações", FileText],
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
const STATUS_ICONS = {
  todo: ClipboardList,
  doing: Play,
  waiting: Clock3,
  done: CheckCircle2,
};
const PRIORITY_OPTIONS = PRIORITIES.map((item) => ({
  value: item.id,
  label: item.label,
}));
const TEAM_OPTIONS = ["Comercial", "Financeiro", "Operação", "Qualidade"];
const BOARD_GROUP_OPTIONS = [
  { value: "status", label: "Status" },
  { value: "team", label: "Equipe" },
  { value: "assignee", label: "Responsável" },
  { value: "priority", label: "Prioridade" },
  { value: "personalTag", label: "Tag" },
];
const BOARD_GROUP_STORAGE_KEY = "betinhos-tela-planner-board-group-v1";

function readBoardGroupPreference() {
  try {
    const saved = localStorage.getItem(BOARD_GROUP_STORAGE_KEY);
    return BOARD_GROUP_OPTIONS.some((option) => option.value === saved) ? saved : "status";
  } catch {
    return "status";
  }
}

function boardGroupValues(task, groupBy) {
  if (groupBy === "status") return [task.status];
  if (groupBy === "team") return task.teamNames?.length ? task.teamNames : [task.teamName || "Sem equipe"];
  if (groupBy === "assignee") return task.assigneeNames?.length ? task.assigneeNames : [task.assigneeName || "Não atribuído"];
  if (groupBy === "priority") return [task.priority || "medium"];
  const tagIds = normalizePersonalTagIds(task.personalTagIds);
  return tagIds.length ? tagIds : ["__none__"];
}

function boardColumns(groupBy, tasks, teams = [], personalTags = [], employees = []) {
  if (groupBy === "status") return STATUSES.map((status) => ({ ...status, groupValue: status.id }));
  if (groupBy === "priority") return PRIORITIES.map((priority) => ({ ...priority, groupValue: priority.id }));
  if (groupBy === "team") {
    const names = [...new Set([
      ...teams.map((team) => team.name),
      ...tasks.flatMap((task) => boardGroupValues(task, groupBy)),
    ].filter(Boolean))];
    return names.map((name) => ({ id: `team:${name}`, label: name, groupValue: name }));
  }
  if (groupBy === "assignee") {
    const names = [...new Set([
      ...employees.map((employee) => employee.name),
      ...tasks.flatMap((task) => boardGroupValues(task, groupBy)),
    ].filter(Boolean))];
    return names.map((name) => ({ id: `assignee:${name}`, label: name, groupValue: name }));
  }
  const tags = personalTags.filter((tag) => !tag.archived);
  return [
    ...tags.map((tag) => ({ id: `tag:${tag.id}`, label: tag.name, groupValue: tag.id, color: tag.color })),
    { id: "tag:__none__", label: "Sem tag", groupValue: "__none__" },
  ];
}
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
    team: [],
    personalTag: [],
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

function launchQuoteId(search = window.location.search) {
  const params = new URLSearchParams(search);
  const data = new URLSearchParams(
    (params.get("data") || "").replace(/^\?/, ""),
  );
  const source = params.get("source") || data.get("source") || "";
  if (source !== "quote") return "";
  return params.get("sourceId") || data.get("sourceId") || "";
}

function resolveCurrentEmployee(employees, live, currentUserEmail = "") {
  if (!live)
    return (
      (employees || []).find((employee) => employee.isMockCurrentUser) || null
    );
  const normalizedEmail = String(currentUserEmail || "").trim().toLowerCase();
  if (!normalizedEmail) return null;
  return (
    (employees || []).find(
      (employee) =>
        String(employee.emailMicrosoft || "").trim().toLowerCase() ===
        normalizedEmail,
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

function StatusIcon({ status, ...props }) {
  const Icon = STATUS_ICONS[status] || ClipboardList;
  return <Icon {...props} />;
}

function PriorityBadge({ priority }) {
  const item =
    PRIORITIES.find((entry) => entry.id === priority) || PRIORITIES[1];
  return <span className={`priority priority-${item.tone}`}>{item.label}</span>;
}

function RestrictedVisibilityMark({ className = "" }) {
  return (
    <span
      className={`task-visibility-mark ${className}`.trim()}
      role="img"
      title="Visível somente para responsáveis e criador"
      aria-label="Tarefa oculta: visível somente para responsáveis e criador"
    >
      <EyeOff size={13} strokeWidth={2.2} aria-hidden="true" />
    </span>
  );
}

function WaitingContextFields({ value, onChange, employees = [], teams = [], error = "" }) {
  const context = normalizeWaitingContext(value);
  const employeeOptions = employees
    .filter((employee) => employee?.id && employee?.name)
    .map((employee) => ({ value: employee.id, label: employee.name }));
  const targetOptions = context.onType === "team"
    ? (teams.length ? teams.map((team) => ({ value: team.id, label: team.name })) : TEAM_OPTIONS.map((team) => ({ value: team, label: team })))
    : employeeOptions;
  const update = (patch) => onChange({ ...context, ...patch });
  const selectTarget = (ids) => {
    const selectedIds = Array.isArray(ids) ? ids : ids ? [ids] : [];
    const selectedNames = selectedIds
      .map((id) => targetOptions.find((item) => String(item.value) === String(id))?.label)
      .filter(Boolean);
    update({ onIds: selectedIds, onNames: selectedNames, onId: selectedIds[0] || "", onName: selectedNames.join(", ") });
  };
  return (
    <section className="waiting-context" aria-labelledby="waiting-context-title">
      <div className="waiting-context-heading">
        <div>
          <span className="status-field-label">Contexto do retorno</span>
          <strong id="waiting-context-title">O que está sendo aguardado?</strong>
        </div>
        <span>O prazo do retorno é opcional; sem ele, entra na fila de acompanhamento</span>
      </div>
      <label>
        O que está sendo aguardado?
        <input
          value={context.subject}
          onChange={(event) => update({ subject: event.target.value })}
          placeholder="Ex.: confirmação da segunda van"
        />
      </label>
      <div className="waiting-context-grid">
        <div className="waiting-context-recipient-field">
          <div className="waiting-context-recipient-header">
            <span>{context.onType === "external" ? "Contato externo" : context.onType === "team" ? "Equipe responsável" : "Responsáveis"}</span>
            <div className="assignment-mode waiting-context-type-picker" role="group" aria-label="Tipo de destinatário">
            <button
              type="button"
              className={context.onType === "employee" ? "is-selected" : ""}
              aria-label="Funcionário"
              aria-pressed={context.onType === "employee"}
              title="Funcionário"
              onClick={() => update({ onType: "employee", onIds: [], onNames: [], onId: "", onName: "" })}
            >
              <UserRound size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={context.onType === "team" ? "is-selected" : ""}
              aria-label="Equipe"
              aria-pressed={context.onType === "team"}
              title="Equipe"
              onClick={() => update({ onType: "team", onIds: [], onNames: [], onId: "", onName: "" })}
            >
              <Users size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={context.onType === "external" ? "is-selected" : ""}
              aria-label="Externo"
              aria-pressed={context.onType === "external"}
              title="Cliente ou fornecedor"
              onClick={() => update({ onType: "external", onIds: [], onNames: [], onId: "", onName: "" })}
            >
              <ArrowUpRight size={15} aria-hidden="true" />
            </button>
            </div>
          </div>
          <label className="waiting-context-recipient-control">
            <span className="sr-only">{context.onType === "external" ? "Quem está sendo aguardado?" : "De quem?"}</span>
            {context.onType === "external" ? (
              <input
                value={context.onName}
                onChange={(event) => update({ onIds: [], onNames: event.target.value.split(",").map((item) => item.trim()).filter(Boolean), onId: "", onName: event.target.value })}
                placeholder="Ex.: cliente ou fornecedor"
              />
            ) : (
              <InputSelect
                value={context.onIds}
                onChange={selectTarget}
                options={targetOptions}
                placeholder={context.onType === "team" ? "Selecione uma ou mais equipes" : "Selecione uma ou mais pessoas"}
                multiple
              />
            )}
          </label>
        </div>
        <label className="waiting-context-deadline-field">
          Retorno previsto
          <DateInput
            type="date"
            value={context.expectedDate}
            onChange={(event) => update({ expectedDate: event.target.value })}
          />
        </label>
      </div>
      <label>
        Observação
        <textarea
          value={context.note}
          onChange={(event) => update({ note: event.target.value })}
          rows="2"
          placeholder="Adicione o último contexto da cobrança"
        />
      </label>
      {error && <div className="field-error" role="alert">{error}</div>}
    </section>
  );
}

function StatusPicker({ value, onChange }) {
  const selectedItem = STATUSES.find((item) => item.id === value) || STATUSES[0];
  return (
    <div className="status-picker" role="group" aria-label={`Status atual: ${selectedItem.label}`}>
      <div className="status-picker-options">
        {STATUSES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`status-option status-option-${item.tone}${value === item.id ? " is-selected" : ""}`}
            aria-label={item.label}
            aria-pressed={value === item.id}
            title={item.label}
            onClick={() => onChange(item.id)}
          >
            <StatusIcon status={item.id} size={18} strokeWidth={2.2} fill="none" stroke="currentColor" aria-hidden="true" />
          </button>
        ))}
      </div>
      <span className={`status-picker-current status-current-${selectedItem.tone}`}>{selectedItem.label}</span>
    </div>
  );
}

function QuoteCompletionDialog({ quote, onCancel, onConfirm }) {
  const [result, setResult] = useState(quote?.responseSent ? "sent" : "ready");
  const [value, setValue] = useState(quote?.value || "");
  const [commercialTerms, setCommercialTerms] = useState(quote?.commercialTerms || "");
  const [sentConfirmed, setSentConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const validation = validateQuoteCommercial({ value, commercialTerms });
  const confirm = async (event) => {
    event.preventDefault();
    if (!validation.valid || (result === "sent" && !sentConfirmed) || busy) return;
    setBusy(true);
    setError("");
    try {
      const saved = await onConfirm({ status: "done", quoteStatus: result === "sent" ? "Respondida ao cliente" : "Cotada", responseSent: result === "sent", value, commercialTerms });
      if (saved === false) setError("Não foi possível concluir. Confira os dados e tente novamente.");
    } catch (failure) { setError(failure.message || "Não foi possível concluir a tarefa."); }
    finally { setBusy(false); }
  };
  return (
    <div className="drawer-confirm-layer" onMouseDown={(event) => event.stopPropagation()}>
      <form className="drawer-confirm quote-completion-dialog" role="dialog" aria-modal="true" aria-labelledby="quote-completion-title" onSubmit={confirm}>
        <h2 id="quote-completion-title">Concluir tarefa da cotação</h2>
        <p>Informe o resultado comercial antes de concluir a tarefa.</p>
        <div className="quote-completion-checks">
          <label><input type="radio" name="quote-completion-result" checked={result === "ready"} onChange={() => setResult("ready")} />Cotação pronta, ainda não enviada</label>
          <label><input type="radio" name="quote-completion-result" checked={result === "sent"} onChange={() => setResult("sent")} />Proposta já enviada ao cliente</label>
        </div>
        <label className="quote-completion-field" htmlFor="quote-completion-value">Valor total (BRL)<FormMoneyInput id="quote-completion-value" value={value} onChange={(event) => setValue(event.target.value)} error={value && validation.errors.value} required /></label>
        <label className="quote-completion-field" htmlFor="quote-completion-terms">Condições comerciais<FormTextArea id="quote-completion-terms" rows={3} value={commercialTerms} onChange={(event) => setCommercialTerms(event.target.value)} error={commercialTerms && validation.errors.commercialTerms} required /></label>
        {result === "sent" && <label className="quote-completion-sent"><input type="checkbox" checked={sentConfirmed} onChange={(event) => setSentConfirmed(event.target.checked)} />Confirmo que a proposta já foi enviada ao cliente.</label>}
        {error && <p className="quote-completion-error" role="alert">{error}</p>}
        <div className="drawer-confirm-actions">
          <button className="button button-quiet" type="button" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button className="button button-primary" type="submit" disabled={busy || !validation.valid || (result === "sent" && !sentConfirmed)}>{busy ? "Salvando…" : "Confirmar conclusão"}</button>
        </div>
      </form>
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

function UnassignedTaskDialog({
  taskTitle = "",
  isCreation = false,
  missingResponsible = true,
  missingDueDate = false,
  onCancel,
  onConfirm,
}) {
  const missingFields = [
    missingResponsible ? "responsável" : "",
    missingDueDate ? "prazo" : "",
  ].filter(Boolean);
  const missingLabel = missingFields.length === 2
    ? "responsável e prazo"
    : missingFields[0] || "campos obrigatórios";
  return (
    <div
      className="drawer-confirm-layer"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div
        className="drawer-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unassigned-task-title"
      >
        <h2 id="unassigned-task-title">Faltam dados para salvar</h2>
        <p>
          {isCreation
            ? "Preencha os campos abaixo ou confirme para criar assim mesmo."
            : `“${taskTitle}” pode ser salva sem os campos abaixo.`}
        </p>
        <ul className="drawer-confirm-missing" aria-label={`Campos pendentes: ${missingLabel}`}>
          {missingResponsible && (
            <li>
              <UserRound size={16} aria-hidden="true" />
              <span><strong>Responsável</strong><small>Escolha uma pessoa ou equipe</small></span>
            </li>
          )}
          {missingDueDate && (
            <li>
              <CalendarDays size={16} aria-hidden="true" />
              <span><strong>Prazo</strong><small>Defina uma data de entrega</small></span>
            </li>
          )}
        </ul>
        <div className="drawer-confirm-actions">
          <button className="button button-primary" type="button" onClick={onCancel}>
            {isCreation ? "Voltar e preencher" : "Preencher agora"}
          </button>
          <button className="button button-quiet" type="button" onClick={onConfirm}>
            {isCreation ? "Criar mesmo assim" : "Salvar mesmo assim"}
          </button>
        </div>
      </div>
    </div>
  );
}

const ACTIONABLE_NOTIFICATION_TYPES = new Set([
  "assignment",
  "deadline",
  "due_today",
  "mention",
  "overdue",
  "waiting",
  "contact_assignment",
  "contact_transfer",
]);

function formatNotificationTime(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "Agora";
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (elapsedMinutes < 1) return "agora";
  if (elapsedMinutes < 60) return `há ${elapsedMinutes} min`;
  if (elapsedMinutes < 1440) return `há ${Math.round(elapsedMinutes / 60)} h`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function notificationPresentation(item, task, contact) {
  const taskTitle = task?.title || item.message || "Atualização da tarefa";
  const contactTitle = contact?.subject || item.message || "Atualização do caso";
  const context = task ? task.teamName || "Sem equipe" : contact ? `${contactChannelLabelForNotification(contact.channel)} • ${contact.ownerName || "Sem responsável"}` : "Central de avisos";
  const type = item.type || "update";
  const distinctMessage = item.message && String(item.message).trim() !== String(taskTitle).trim() ? item.message : "";

  if (item.contactId) {
    return {
      context,
      icon: Users,
      label: "Novo caso para você",
      message: item.message || "Um caso de atendimento foi atribuído a você.",
      title: item.title || contactTitle,
      tone: "success",
    };
  }

  if (["deadline", "due_today", "overdue"].includes(type)) {
    return {
      context,
      icon: type === "overdue" ? ShieldAlert : CalendarDays,
      label: type === "overdue" ? "Prazo da tarefa atrasado" : "Prazo da tarefa",
      message: distinctMessage || (type === "overdue" ? "O prazo desta tarefa está atrasado." : "O prazo desta tarefa vence hoje."),
      title: taskTitle,
      tone: type === "overdue" ? "danger" : "warning",
    };
  }

  if (type === "assignment") {
    return {
      context,
      icon: ClipboardList,
      label: "Nova tarefa para você",
      message: distinctMessage || "Você recebeu uma nova tarefa para acompanhar.",
      title: taskTitle,
      tone: "success",
    };
  }

  if (type === "mention") {
    return {
      context,
      icon: MessageCircle,
      label: "Você foi mencionado",
      message: distinctMessage || "Há uma mensagem aguardando sua resposta.",
      title: taskTitle,
      tone: "info",
    };
  }

  if (type === "waiting" || (type === "status" && task?.status === "waiting")) {
    return {
      context,
      icon: BellRing,
      label: "Aguardando seu retorno",
      message: distinctMessage || waitingContextSummary(task?.waitingContext) || "Esta tarefa aguarda um retorno para avançar.",
      title: taskTitle,
      tone: "warning",
    };
  }

  if (type === "status") {
    const statusLabel = task ? statusById(task.status)?.label : "";
    return {
      context,
      icon: CheckCircle2,
      label: "Tarefa atualizada",
      message: distinctMessage || (statusLabel ? `Agora: ${statusLabel}` : "O andamento desta tarefa foi alterado."),
      title: taskTitle,
      tone: "info",
    };
  }

  if (type === "assignees") {
    return {
      context,
      icon: Users,
      label: "Responsáveis atualizados",
      message: distinctMessage || "A equipe responsável foi atualizada.",
      title: taskTitle,
      tone: "info",
    };
  }
  if (type === "overdue_manual") {
    return {
      context,
      icon: ShieldAlert,
      label: "Cobrança de tarefa",
      message: distinctMessage || "O responsável recebeu uma cobrança.",
      title: taskTitle,
      tone: "warning",
    };
  }


  return {
    context,
    icon: BellRing,
    label: "Nova atualização",
    message: distinctMessage || "Há uma nova atualização no Planner.",
    title: item.title || taskTitle,
    tone: "neutral",
  };
}

function contactChannelLabelForNotification(channel) {
  return channel === "email" ? "E-mail" : channel === "phone" ? "Telefone" : "WhatsApp";
}

function isActionableNotification(item, tasks) {
  if (ACTIONABLE_NOTIFICATION_TYPES.has(item.type)) return true;
  return item.type === "status" && tasks.some((task) => task.id === item.taskId && task.status === "waiting");
}

function notificationsVisibleToEmployee(notifications = [], tasks = [], employee, teams = []) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  return notifications.filter((item) => {
    if (!item.taskId) return true;
    const task = taskById.get(item.taskId);
    return !task || isTaskVisibleToEmployee(task, employee, teams);
  });
}

function NotificationsPanel({
  notifications,
  tasks,
  contacts = [],
  currentEmployee,
  teams = [],
  error = "",
  onClose,
  onOpenTask,
  onOpenContact,
  onMarkRead,
  onMarkAllRead,
}) {
  const [notificationFilter, setNotificationFilter] = useState("all");
  const scopedNotifications = notificationsVisibleToEmployee(notifications, tasks, currentEmployee, teams);
  const unread = unreadCount(scopedNotifications);
  const actionableNotifications = scopedNotifications.filter((item) => isActionableNotification(item, tasks));
  const informationalNotifications = scopedNotifications.filter((item) => !isActionableNotification(item, tasks));
  const filterOptions = [
    { id: "all", label: "Todas", icon: BellRing, items: scopedNotifications },
    { id: "actionable", label: "Pendentes", icon: ListChecks, items: actionableNotifications },
    { id: "informational", label: "Informativas", icon: FileText, items: informationalNotifications },
  ];
  const visibleNotifications = [...(notificationFilter === "actionable" ? actionableNotifications : notificationFilter === "informational" ? informationalNotifications : scopedNotifications)].sort((left, right) => {
    return new Date(right.occurredAt || 0).getTime() - new Date(left.occurredAt || 0).getTime();
  });

  return (
    <div
      className="notification-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="notification-panel" aria-label="Caixa de entrada de notificações">
        <header>
          <div className="notification-panel-heading">
            <span className="notification-panel-heading-icon" aria-hidden="true">
              <BellRing size={21} strokeWidth={2.1} />
            </span>
            <div>
              <h2>Caixa de entrada</h2>
              <p>{unread ? "Atualizações recentes" : "Tudo em dia"}</p>
            </div>
          </div>
          <button
            className="icon-button notification-close"
            type="button"
            onClick={onClose}
            aria-label="Fechar notificações"
          >
            <X size={18} />
          </button>
        </header>
        {unread > 0 && (
          <div className="notification-panel-actions">
            <span className="notification-action-summary" aria-live="polite" aria-atomic="true">
              {`${unread} não lida${unread === 1 ? "" : "s"}`}
            </span>
            <button
              className="notification-mark-all"
              type="button"
              onClick={onMarkAllRead}
              aria-label="Marcar todas como lidas"
            >
              <Check size={14} strokeWidth={2.2} aria-hidden="true" />
              <span>Marcar todas</span>
            </button>
          </div>
        )}
        <div className="notification-filters" role="tablist" aria-label="Filtrar notificações">
          {filterOptions.map((filter) => {
            const Icon = filter.icon;
            const isActive = notificationFilter === filter.id;
            return (
              <button
                aria-selected={isActive}
                className={`notification-filter ${isActive ? "is-active" : ""}`}
                key={filter.id}
                onClick={() => setNotificationFilter(filter.id)}
                role="tab"
                type="button"
              >
                <Icon aria-hidden="true" size={20} strokeWidth={2} />
                <span>{filter.label}</span>
                <b>{filter.items.length}</b>
              </button>
            );
          })}
        </div>
        {error && <div className="notification-degraded" role="alert"><strong>Notificações indisponíveis</strong><span>{error}</span></div>}
        <div className="notification-list">
          {visibleNotifications.length ? (
            visibleNotifications.map((item) => {
              const task = tasks.find((entry) => entry.id === item.taskId);
              const contact = contacts.find((entry) => entry.id === item.contactId);
              const presentation = notificationPresentation(item, task, contact);
              const Icon = presentation.icon;
              return (
                <article
                  className={`notification-item is-${presentation.tone} ${item.readAt ? "is-read" : "is-unread"}`}
                  key={item.id}
                >
                  <span className="notification-icon" aria-hidden="true">
                    <Icon size={20} strokeWidth={2.1} />
                  </span>
                  <div className="notification-item-content">
                    <button className="notification-item-main" type="button" onClick={() => item.contactId ? onOpenContact?.(item) : onOpenTask(item)}>
                      <span className="notification-kicker">{presentation.label}</span>
                      {presentation.message && <span className="notification-message">{presentation.message}</span>}
                      <strong>{presentation.title}</strong>
                      <span className="notification-meta">
                        <span>{presentation.context}</span>
                        <time dateTime={item.occurredAt || undefined}>{formatNotificationTime(item.occurredAt)}</time>
                      </span>
                      <ChevronRight className="notification-item-chevron" aria-hidden="true" size={18} strokeWidth={2.1} />
                    </button>
                    {!item.readAt && (
                      <button
                        className="notification-view"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onMarkRead?.(item.id);
                        }}
                        aria-label={`Marcar como lida sem abrir: ${presentation.title}`}
                        title="Marcar como lida sem abrir"
                      >
                        <Eye aria-hidden="true" size={17} strokeWidth={2.1} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="notification-empty" role="status">
              <CheckCircle2 size={28} strokeWidth={1.8} />
              <strong>{notificationFilter === "all" ? "Nenhuma notificação" : "Nada por aqui"}</strong>
              <span>
                {notificationFilter === "actionable" ? "Você não tem pendências que exigem ação." : notificationFilter === "informational" ? "Novas atualizações informativas aparecerão aqui." : "Novas atribuições, menções e prazos aparecerão aqui."}
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
  contacts = [],
  live,
  currentEmployee,
  teams = [],
  personalStats,
  openTaskCount,
  mentionEmployees = [],
  notifications = [],
  notificationError = "",
  onOpenNotification,
  onOpenContact,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onRefresh,
  refreshing = false,
  canViewManagement = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  useMentionController(
    mentionEmployees.length
      ? mentionEmployees
      : globalThis.__plannerEmployees || [],
  );
  const visibleTasks = tasks.filter((task) => isTaskVisibleToEmployee(task, currentEmployee, teams));
  const stats = personalStats || taskStats(visibleTasks);
  const visibleNotifications = notificationsVisibleToEmployee(notifications, tasks, currentEmployee, teams);
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
    MOBILE_NAV_ITEMS.find(([id]) => id === mobileNavActive)?.[1] || (active === "contacts" ? "Contatos" : "Central");
  const canCreateTask = ["dashboard", "team", "board", "list", "calendar"].includes(active);
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
          {CENTRAL_NAV_ITEMS.filter(([id]) => id !== "management" || canViewManagement).map(([id, label, Icon]) => (
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
      {canCreateTask && (
        <button
          className="mobile-fab"
          type="button"
          onClick={onCreate}
          aria-label="Criar nova tarefa"
          title="Nova tarefa"
        >
          <Plus size={22} strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}
      {notificationsOpen && (
        <NotificationsPanel
          notifications={visibleNotifications}
          tasks={visibleTasks}
          contacts={contacts}
          currentEmployee={currentEmployee}
          teams={teams}
          error={notificationError}
          onClose={() => setNotificationsOpen(false)}
          onOpenTask={(item) => {
            onOpenNotification?.(item);
            setNotificationsOpen(false);
          }}
          onOpenContact={(item) => {
            onOpenContact?.(item);
            setNotificationsOpen(false);
          }}
          onMarkRead={onMarkNotificationRead}
          onMarkAllRead={onMarkAllNotificationsRead}
        />
      )}
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

const BOARD_SORT_OPTIONS = [
  ["dueDate", "Prazo", "Mais próximo primeiro", "Mais distante primeiro"],
  ["priority", "Prioridade", "Mais alta primeiro", "Mais baixa primeiro"],
  ["updatedAt", "Atualização", "Mais recente primeiro", "Mais antiga primeiro"],
  ["createdAt", "Criação", "Mais recente primeiro", "Mais antiga primeiro"],
  ["title", "Título", "A–Z", "Z–A"],
];
const BOARD_SORT_DEFAULT = { key: "dueDate", direction: "asc" };
const BOARD_SORT_STORAGE_KEY = "betinhos-tela-planner-board-sort-v1";

function readBoardSortPreference() {
  try {
    const saved = JSON.parse(localStorage.getItem(BOARD_SORT_STORAGE_KEY) || "null");
    if (BOARD_SORT_OPTIONS.some(([key]) => key === saved?.key) && ["asc", "desc"].includes(saved?.direction)) return saved;
  } catch {}
  return BOARD_SORT_DEFAULT;
}

function BoardSortSelector({ sort, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const activeOption = BOARD_SORT_OPTIONS.find(([key]) => key === sort.key) || BOARD_SORT_OPTIONS[0];
  const activeDirection = sort.direction === "desc" ? activeOption[3] : activeOption[2];

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const select = (key) => {
    onChange({ key, direction: key === sort.key ? sort.direction : "asc" });
    setOpen(false);
  };

  const invert = () => onChange({ ...sort, direction: sort.direction === "asc" ? "desc" : "asc" });

  return (
    <div className="board-sort-selector" ref={rootRef}>
      <button className="board-sort-trigger" type="button" aria-haspopup="menu" aria-expanded={open} aria-controls="board-sort-menu" onClick={() => setOpen((current) => !current)} title={`Ordenar por ${activeOption[1]}: ${activeDirection}`}>
        <ArrowDownUp size={15} aria-hidden="true" />
        <span>Ordenar: {activeOption[1]}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && <div className="board-sort-menu" id="board-sort-menu" role="menu" aria-label="Ordenar cards">
        <div className="board-sort-menu-heading">
          <div><strong>Ordenar cards</strong><span>Escolha o critério da fila</span></div>
          <span className="board-sort-current">{activeOption[1]}</span>
        </div>
        {BOARD_SORT_OPTIONS.map(([key, label, ascLabel, descLabel]) => {
          const selected = key === sort.key;
          const directionLabel = selected && sort.direction === "desc" ? descLabel : ascLabel;
          return <button key={key} className={`board-sort-option${selected ? " active" : ""}`} type="button" role="menuitemradio" aria-checked={selected} onClick={() => select(key)}>
            <span>{label}</span><small>{directionLabel}</small>{selected && <Check size={14} aria-hidden="true" />}
          </button>;
        })}
        <div className="board-sort-menu-footer">
          <button className="board-sort-invert" type="button" onClick={invert} aria-label={`Inverter ordem: ${activeDirection}`}>
            <ArrowDownUp size={14} aria-hidden="true" />
            <span>Inverter ordem</span>
            <small>{activeDirection}</small>
          </button>
        </div>
      </div>}
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

function compareListTasks(left, right, key, employee, teams) {
  if (key === "dueDate") {
    const leftDate = taskDisplayDueDate(left, employee, teams) || "9999-12-31";
    const rightDate = taskDisplayDueDate(right, employee, teams) || "9999-12-31";
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

function sortListTasks(tasks, sort, employee, teams) {
  const direction = sort.direction === "desc" ? -1 : 1;
  return [...tasks].sort(
    (left, right) =>
      compareListTasks(left, right, sort.key, employee, teams) * direction ||
      String(left.id).localeCompare(String(right.id)),
  );
}

function DataLoadingView({ loading, error, view }) {
  const stage = loading?.core
    ? "Carregando tarefas e responsáveis"
    : loading?.quotes || loading?.quality
      ? "Preparando dados complementares"
      : "Finalizando conexão";
  return <LoadingFallback label={error || stage} view={view} quoteView={readQuoteViewPreference()} />;
}

const TaskCard = memo(function TaskCard({
  task: taskItem,
  employees = [],
  subtasks = [],
  currentEmployee,
  teams = [],
  personalTags = [],
  hasUnreadMention = false,
  showChecklistOnCard = false,
  onOpen,
  onToggleSubtask,
  onComplete,
  onRegisterWaitingReturn,
  showQuickComplete = false,
  compact = false,
  enableDrag = true,
  isDragging = false,
  onDragStart,
  onDragEnd,
}) {
  const displayDueDate = taskDisplayDueDate(taskItem, currentEmployee, teams);
  const overdue = getDueBucketForEmployee(taskItem, currentEmployee, teams) === "overdue";
  const waitingActionRequired = isTaskWaitingForEmployee(taskItem, currentEmployee);
  const canRegisterReturn = canRegisterWaitingReturn(taskItem, currentEmployee, teams);
  const executionActor = deriveExecutionActor(taskItem, employees);
  const executionFirstName = executionActor?.name === "Executor não identificado"
    ? "Não identificado"
    : executionActor?.name.trim().split(/\s+/)[0];
  const canOpen = !taskItem.id.startsWith("optimistic-");
  const importedChecklist = Array.isArray(taskItem.checklist)
    ? taskItem.checklist.filter((item) => item?.title).map((item) => ({
        id: `planner-checklist-${item.id}`,
        title: item.title,
        done: Boolean(item.done),
        imported: true,
      }))
    : [];
  const checklistItems = subtasks.length ? subtasks : importedChecklist;
  const completedSubtasks = checklistItems.filter(
    (item) => item.status === "done" || item.done,
  ).length;
  const visibleSubtasks = checklistItems.slice(0, 3);
  const assignedTeam = taskItem.assignmentMode === "team"
    ? teams.find((team) => (taskItem.teamIds || [taskItem.teamId]).some((id) => String(id) === String(team.id)))
    : null;
  const taskPersonalTagIds = new Set(normalizePersonalTagIds(taskItem.personalTagIds));
  const visiblePersonalTags = personalTags.filter(
    (tag) => !tag.archived && taskPersonalTagIds.has(tag.id),
  );
  return (
    <article
      className={`task-card ${compact ? "task-card-compact" : ""} ${overdue ? "task-overdue" : ""} ${taskItem.syncStatus === "syncing" ? "task-syncing" : ""} ${isDragging ? "task-card-dragging" : ""}`}
      draggable={enableDrag && taskItem.syncStatus !== "syncing"}
      tabIndex={canOpen ? "0" : "-1"}
      data-task-id={taskItem.id}
      data-kanban-id={taskItem.id}
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
        {isQuoteTask(taskItem) && <span className="task-quote-status">{taskItem.quoteStatus || quoteStatusForTaskStatus(taskItem.status)}</span>}
        {overdue && <span className="overdue-label">Vencida</span>}
        {waitingActionRequired && (
          <span className="task-waiting-action" title="Aguardando sua atuação" aria-label="Aguardando sua atuação">
            <BellRing size={13} aria-hidden="true" />
            <span>Pendente</span>
          </span>
        )}
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
      <div className="task-card-title-row">
        <h3>{taskItem.title}</h3>
        {taskItem.restrictedVisibility && <RestrictedVisibilityMark />}
      </div>
      {visiblePersonalTags.length > 0 && (
        <div className="task-card-tags" aria-label="Tags da tarefa">
          {visiblePersonalTags.map((tag) => (
            <span
              className="task-card-tag"
              key={tag.id}
              style={{ "--personal-tag-color": tag.color }}
              title={tag.name}
            >
              <span className="personal-tag-dot" aria-hidden="true" />
              {tag.name}
            </span>
          ))}
        </div>
      )}
      {hasUnreadMention && (
        <div className="task-mention-alert">
          <BellRing size={13} />
          <span>Você foi mencionado</span>
        </div>
      )}
      {taskItem.status === "waiting" && waitingContextSummary(taskItem.waitingContext) && (
        <div className="task-waiting-summary" title={waitingContextSummary(taskItem.waitingContext)}>
          <Clock3 size={13} />
          <span>{waitingContextSummary(taskItem.waitingContext)}</span>
        </div>
      )}
      {executionActor && (
        <div
          className="task-execution-chip"
          role="group"
          aria-label={`Em andamento por ${executionFirstName}, ${formatRelativeTimestamp(executionActor.occurredAt)}`}
        >
          <div className="task-execution-when">
            <span>{formatExecutionDay(executionActor.occurredAt)}</span>
            <time dateTime={executionActor.occurredAt} title={formatCommentTimestamp(executionActor.occurredAt)}>
              {formatRelativeTimestamp(executionActor.occurredAt).replace(/^há\s*/, "").replace(/\s+/g, "")}
            </time>
          </div>
          <div className="task-execution-description">
            <strong>Em andamento</strong>
            <span>{executionFirstName}</span>
          </div>
        </div>
      )}
      {(showChecklistOnCard || importedChecklist.length > 0) && checklistItems.length > 0 && (
        <div
          className="task-checklist"
          aria-label={`Checklist: ${completedSubtasks} de ${checklistItems.length} concluídas`}
        >
          <div className="task-checklist-heading">
            <span>
              <ListChecks size={13} />
              Checklist
            </span>
            <strong>
              {completedSubtasks}/{checklistItems.length}
            </strong>
          </div>
          <div className="task-checklist-items">
            {visibleSubtasks.map((subtask) => {
              const completed = subtask.status === "done" || subtask.done;
              const content = (
                <>
                  <span className="task-checklist-box">
                    {completed && <Check size={10} strokeWidth={3} />}
                  </span>
                  <span>{subtask.title}</span>
                </>
              );
              return subtask.imported ? (
                <div className={`task-checklist-item ${completed ? "is-complete" : ""}`} key={subtask.id}>
                  {content}
                </div>
              ) : (
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
                  {content}
                </button>
              );
            })}
          </div>
          {checklistItems.length > visibleSubtasks.length && (
            <span className="task-checklist-more">
              +{checklistItems.length - visibleSubtasks.length} itens
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
          team={assignedTeam}
          teamName={taskItem.assignmentMode === "team" ? taskItem.teamName : ""}
          primaryName={taskItem.primaryAssigneeName}
          consultantNames={taskItem.consultantNames || []}
        />
        {taskItem.syncStatus === "syncing" ? (
          <span className="sync-chip" role="status">
            Enviando...
          </span>
        ) : (
          <span className={overdue ? "date-chip overdue" : "date-chip"}>
            <Clock3 size={13} />
            {formatDate(displayDueDate)}
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
        {canRegisterReturn && (
          <button
            className="task-quick-action task-return-action"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRegisterWaitingReturn?.(taskItem.id);
            }}
          >
            Registrar retorno
          </button>
        )}
      </div>
      {taskItem.parentTaskId && (
        <div className="subtask-mark">
          <CheckCircle2 size={13} />
          Subtarefa
        </div>
      )}
    </article>
  );
});

function getDropIndex(tasksByColumn, columnId, draggedTask, employee, teams) {
  if (!draggedTask) return 0;
  const destination = tasksByColumn[columnId] || [];
  return sortTasks(
    [...destination, { ...draggedTask }],
    employee,
    teams,
  ).findIndex((taskItem) => taskItem.id === draggedTask.id);
}

const Board = memo(function Board({
  tasks,
  employees = [],
  columns,
  tasksByColumn,
  groupBy,
  subtasksByParent,
  currentEmployee,
  checklistVisibility,
  teams = [],
  personalTags = [],
  unreadMentionTaskIds,
  onOpen,
  onToggleSubtask,
  onRegisterWaitingReturn,
  onMove,
  onCreate,
}) {
  const getSourceColumnId = useCallback(
    (taskItem) => groupBy === "status"
      ? taskItem?.status || ""
      : `${groupBy}:${boardGroupValues(taskItem, groupBy)[0] || "__none__"}`,
    [groupBy],
  );
  const getTaskDropIndex = useCallback(
    (grouped, columnId, draggedTask) => getDropIndex(
      grouped,
      columnId,
      draggedTask,
      currentEmployee,
      teams,
    ),
    [currentEmployee, teams],
  );
  const moveTask = useCallback(
    (taskId, column) => onMove(taskId, column?.groupValue, groupBy),
    [groupBy, onMove],
  );
  return (
    <KanbanBoard
      items={tasks}
      columns={columns}
      itemsByColumn={tasksByColumn}
      getSourceColumnId={getSourceColumnId}
      getDropIndex={getTaskDropIndex}
      canMove={(taskItem) => !taskItem.id.startsWith("optimistic-")}
      canCreate={() => groupBy === "status"}
      onMove={moveTask}
      onCreate={(column) => onCreate(column.id)}
      itemLabel="tarefa"
      itemLabelPlural="tarefas"
      transferType="text/task-id"
      renderColumnIcon={groupBy === "status"
        ? (column) => <StatusIcon
            status={column.id}
            className={`status-column-icon status-column-icon-${column.tone}`}
            size={17}
            strokeWidth={2.2}
            aria-hidden="true"
          />
        : undefined}
      renderCard={(taskItem, dragProps) => (
        <TaskCard
          task={taskItem}
          employees={employees}
          subtasks={subtasksByParent.get(taskItem.id) || []}
          currentEmployee={currentEmployee}
          teams={teams}
          personalTags={personalTags}
          hasUnreadMention={unreadMentionTaskIds.has(taskItem.id)}
          showChecklistOnCard={checklistVisibility[taskItem.id]}
          onOpen={onOpen}
          onToggleSubtask={onToggleSubtask}
          onRegisterWaitingReturn={onRegisterWaitingReturn}
          isDragging={dragProps.isDragging}
          onDragStart={(_, event) => dragProps.onDragStart(event)}
          onDragEnd={dragProps.onDragEnd}
          enableDrag={dragProps.draggable}
        />
      )}
    />
  );
});


function PersonalTagPicker({ tags = [], tasks = [], value = [], onChange, onCreate, showAllTags = false }) {
  const [visibleCount, setVisibleCount] = useState(tags.length);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("select");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(DEFAULT_PERSONAL_TAG_COLOR);
  const pickerRef = useRef(null);
  const inlineRef = useRef(null);
  const moreRef = useRef(null);
  const addRef = useRef(null);
  const tagRefs = useRef(new Map());
  const selectedIds = Array.isArray(value) ? value : [];
  const selected = new Set(selectedIds);
  const activeTags = tags.filter((tag) => !tag.archived);
  const recentTagOrder = new Map();
  [...tasks].sort((left, right) => String(left.updatedAt || left.createdAt || "").localeCompare(String(right.updatedAt || right.createdAt || ""))).forEach((task) => {
    normalizePersonalTagIds(task.personalTagIds).forEach((tagId) => recentTagOrder.set(tagId, task.updatedAt || task.createdAt || ""));
  });
  const recentTags = [...activeTags].sort((left, right) => {
    const rightUsed = recentTagOrder.get(right.id);
    const leftUsed = recentTagOrder.get(left.id);
    if (rightUsed || leftUsed) return String(rightUsed || "").localeCompare(String(leftUsed || ""));
    return left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" });
  });
  const orderedTags = recentTags;
  const selectedCount = activeTags.filter((tag) => selected.has(tag.id)).length;
  const tagSignature = orderedTags.map((tag) => `${tag.id}:${tag.name}`).join("|");
  const [selectedOverflow, setSelectedOverflow] = useState(false);
  const visibleCountRef = useRef(visibleCount);
  const selectedOverflowRef = useRef(selectedOverflow);
  const updateVisibleCount = (next) => {
    if (visibleCountRef.current === next) return;
    visibleCountRef.current = next;
    setVisibleCount(next);
  };
  const updateSelectedOverflow = (next) => {
    if (selectedOverflowRef.current === next) return;
    selectedOverflowRef.current = next;
    setSelectedOverflow(next);
  };

  useLayoutEffect(() => {
    const picker = pickerRef.current;
    const inline = inlineRef.current;
    if (!picker || !inline || !activeTags.length) return undefined;
          if (showAllTags) {
            updateSelectedOverflow(false);
            updateVisibleCount(activeTags.length);
            return undefined;
          }

    const measure = () => {
      const pickerWidth = picker.getBoundingClientRect().width;
      if (!pickerWidth) return;
      const gap = Number.parseFloat(getComputedStyle(inline).columnGap || "7") || 7;
      const widths = orderedTags.map((tag) => tagRefs.current.get(tag.id)?.getBoundingClientRect().width || 0);
      const selectedWidths = widths.slice(0, selectedCount);
      const selectedWidth = selectedWidths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, selectedWidths.length - 1);
      const totalWidth = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, widths.length - 1);
      const addWidth = onCreate ? (addRef.current?.getBoundingClientRect().width || 34) : 0;
      const addGap = addWidth ? gap : 0;
      const availableWithoutMore = pickerWidth - addWidth - addGap;
      if (selectedOverflowRef.current && selectedWidth <= availableWithoutMore + 1) {
        updateSelectedOverflow(false);
        return;
      }
      if (selectedWidth > availableWithoutMore + 1) {
        updateSelectedOverflow(true);
        updateVisibleCount(selectedCount);
        return;
      }
      if (totalWidth <= availableWithoutMore + 1) {
        updateSelectedOverflow(false);
        updateVisibleCount(activeTags.length);
        return;
      }

      const moreWidth = moreRef.current?.getBoundingClientRect().width || 34;
      const availableWidth = Math.max(0, pickerWidth - addWidth - moreWidth - gap - addGap);
      if (selectedWidth > availableWidth + 1) {
        updateSelectedOverflow(true);
        updateVisibleCount(selectedCount);
        return;
      }
      updateSelectedOverflow(false);
      let usedWidth = 0;
      let count = selectedCount;
      selectedWidths.forEach((width, index) => {
        usedWidth += (index ? gap : 0) + width;
      });
      widths.slice(selectedCount).forEach((width) => {
        const nextWidth = usedWidth + (count ? gap : 0) + width;
        if (nextWidth <= availableWidth + 1) {
          usedWidth = nextWidth;
          count += 1;
        }
      });
      updateVisibleCount(count);
    };

    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(picker);
    return () => observer?.disconnect();
  }, [tagSignature, activeTags.length, onCreate, selectedCount, showAllTags]);

  const shownTags = orderedTags.slice(0, visibleCount);
  const displayTags = showAllTags ? orderedTags : orderedTags.filter((tag) => selected.has(tag.id));
  const hasMore = !showAllTags;
  const visibleUnselectedCount = Math.max(0, visibleCount - selectedCount);
  const showAddButton = showAllTags && onCreate;
  const toggleTag = (tagId) => onChange(selected.has(tagId) ? selectedIds.filter((id) => id !== tagId) : [...selectedIds, tagId]);

  const openCreateModal = () => {
    setModalMode("create");
    setIsModalOpen(true);
  };
  const createTag = (event) => {
    event.preventDefault();
    const name = newTagName.trim();
    if (!name || !onCreate) return;
    Promise.resolve(onCreate({ name, color: newTagColor })).then((success) => {
      if (success === false) return;
      setNewTagName("");
      setNewTagColor(DEFAULT_PERSONAL_TAG_COLOR);
      setModalMode("select");
    });
  };

  return (
    <>
      <div className={`personal-tag-picker ${showAllTags ? "show-all-tags" : "show-selected-only"} ${selectedOverflow ? "has-selected-overflow" : ""}`} ref={pickerRef} role="group" aria-label="Tags pessoais da tarefa">
        <div className="personal-tag-picker-inline" ref={inlineRef}>
          {displayTags.length ? displayTags.map((tag, index) => {
            const checked = selected.has(tag.id);
            return (
              <button
                className={`personal-tag-chip ${index < displayTags.length ? "" : "is-measured-hidden"} ${checked ? "is-selected" : ""}`}
                key={tag.id}
                ref={(node) => {
                  if (node) tagRefs.current.set(tag.id, node);
                  else tagRefs.current.delete(tag.id);
                }}
                type="button"
                onClick={() => toggleTag(tag.id)}
                aria-pressed={checked}
                style={{ "--personal-tag-color": tag.color }}
              >
                <span className="personal-tag-dot" aria-hidden="true" />
                {tag.name}
              </button>
            );
          }) : <span className="personal-tag-empty">{showAllTags ? "Crie sua primeira tag no gerenciador." : "Sem Tag selecionada"}</span>}
          {showAddButton && (
            <button className="personal-tag-add" ref={addRef} type="button" onClick={openCreateModal} aria-label="Adicionar tag" title="Adicionar tag">
              <Plus size={14} />
            </button>
          )}
          {hasMore && (
            <button
              className={`personal-tag-more ${[...selected].some((id) => !shownTags.some((tag) => tag.id === id)) ? "has-selected" : ""}`}
              ref={moreRef}
              type="button"
              onClick={() => { setModalMode("select"); setIsModalOpen(true); }}
              aria-label={`Escolher tags; ${activeTags.length - selectedCount} não selecionadas`}
              title="Escolher mais tags"
            >
              ...
            </button>
          )}
        </div>
      </div>
      {isModalOpen && typeof document !== "undefined" && document.body
        ? createPortal(
            <div
              className="personal-tags-modal-layer"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setIsModalOpen(false);
              }}
            >
              <section className="personal-tags-modal" role="dialog" aria-modal="true" aria-labelledby="personal-tags-modal-title">
                <header className="personal-tags-modal-header">
                  <div>
                    <span className="eyebrow">Personalização</span>
                    <h3 id="personal-tags-modal-title">{modalMode === "create" ? "Adicionar tag" : "Escolher tags"}</h3>
                  </div>
                  <button className="icon-button" type="button" onClick={() => setIsModalOpen(false)} aria-label="Fechar seleção de tags"><X size={17} /></button>
                </header>
                {modalMode === "create" ? (
                  <form className="personal-tags-modal-create" onSubmit={createTag}>
                    <label>
                      Nome da tag
                      <input autoFocus value={newTagName} onChange={(event) => setNewTagName(event.target.value.slice(0, 32))} maxLength={32} placeholder="Ex.: VIP" />
                    </label>
                    <div className="personal-tag-color-options" role="group" aria-label="Cor da nova tag">
                      {PERSONAL_TAG_COLORS.map((item) => (
                        <button key={item} className={`personal-tag-color ${newTagColor === item ? "is-selected" : ""}`} type="button" style={{ "--personal-tag-color": item }} onClick={() => setNewTagColor(item)} aria-label={`Usar cor ${item}`} aria-pressed={newTagColor === item} />
                      ))}
                    </div>
                    <footer className="personal-tags-modal-footer">
                      <button className="button button-quiet button-small" type="button" onClick={() => setModalMode("select")}>Voltar</button>
                      <button className="button button-primary button-small" type="submit" disabled={!newTagName.trim()}><Plus size={14} /> Criar tag</button>
                    </footer>
                  </form>
                ) : (
                  <>
                    <div className="personal-tags-modal-list" role="group" aria-label="Todas as tags pessoais">
                      {[...activeTags].sort((left, right) => left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" })).map((tag) => {
                        const checked = selected.has(tag.id);
                        return (
                          <button
                            className={`personal-tag-chip ${checked ? "is-selected" : ""}`}
                            key={tag.id}
                            type="button"
                            onClick={() => toggleTag(tag.id)}
                            aria-pressed={checked}
                            style={{ "--personal-tag-color": tag.color }}
                          >
                            <span className="personal-tag-dot" aria-hidden="true" />
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                    <footer className="personal-tags-modal-footer">
                      <span>{selectedIds.length} selecionada{selectedIds.length === 1 ? "" : "s"}</span>
                      <div className="personal-tags-modal-footer-actions">
                        {onCreate && <button className="button button-secondary button-small" type="button" onClick={openCreateModal}><Plus size={14} /> Adicionar tag</button>}
                        <button className="button button-primary button-small" type="button" onClick={() => setIsModalOpen(false)}>Concluir</button>
                      </div>
                    </footer>
                  </>
                )}
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

function PersonalTagManager({ tags = [], onCreate, onUpdate, onArchive }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(DEFAULT_PERSONAL_TAG_COLOR);
  const [tagToDelete, setTagToDelete] = useState(null);
  const activeTags = tags.filter((tag) => !tag.archived).sort((left, right) => left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }));
  const submit = (event) => {
    event.preventDefault();
    if (!name.trim()) return;
    Promise.resolve(onCreate({ name, color })).then(() => {
      setName("");
      setColor(DEFAULT_PERSONAL_TAG_COLOR);
    });
  };
  return (
    <div className="personal-tag-manager" aria-label="Gerenciar tags pessoais">
      <form className="personal-tag-create" onSubmit={submit}>
        <input value={name} onChange={(event) => setName(event.target.value.slice(0, 32))} maxLength={32} placeholder="Nova tag" aria-label="Nome da nova tag" />
        <div className="personal-tag-color-options" role="group" aria-label="Cor da nova tag">
          {PERSONAL_TAG_COLORS.map((item) => (
            <button key={item} className={`personal-tag-color ${color === item ? "is-selected" : ""}`} type="button" style={{ "--personal-tag-color": item }} onClick={() => setColor(item)} aria-label={`Usar cor ${item}`} aria-pressed={color === item} />
          ))}
        </div>
        <button className="button button-secondary button-small" type="submit" disabled={!name.trim()}><Plus size={14} /> Criar</button>
      </form>
      {activeTags.length ? (
        <div className="personal-tag-manager-list">
          {activeTags.map((tag) => (
            <div className="personal-tag-manager-row" key={tag.id}>
              <span className="personal-tag-dot personal-tag-manager-dot" style={{ "--personal-tag-color": tag.color }} aria-hidden="true" />
              <input className="personal-tag-badge" style={{ "--personal-tag-color": tag.color }} defaultValue={tag.name} maxLength={32} aria-label={`Nome da tag ${tag.name}`} onBlur={(event) => {
                if (event.target.value.trim() && event.target.value.trim() !== tag.name) onUpdate(tag.id, { name: event.target.value });
              }} />
              <div className="personal-tag-manager-actions">
                {tagToDelete?.id === tag.id ? (
                  <div className="subtask-remove-confirm" role="group" aria-label={`Confirmar exclusão de ${tag.name}`}>
                    <button className="button button-danger" type="button" onClick={() => { setTagToDelete(null); onArchive(tag.id); }}>Excluir</button>
                    <button className="button button-quiet" type="button" onClick={() => setTagToDelete(null)}>Cancelar</button>
                  </div>
                ) : (
                  <button className="subtask-delete" type="button" onClick={() => setTagToDelete(tag)} aria-label={`Excluir ${tag.name}`} title="Excluir tag">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : <div className="personal-tag-empty">Nenhuma tag pessoal criada.</div>}
    </div>
  );
}

const FilterBar = memo(function FilterBar({
  filters,
  setFilters,
  onCreate,
  employees = [],
  teams = [],
  personalTags = [],
}) {
  const [expanded, setExpanded] = useState(false);
  const assigneeOptions = useMemo(
    () => buildAssigneeOptions(employees),
    [employees],
  );
  const teamOptions = useMemo(
    () => teams.map((team) => ({ value: team.name, label: team.name })),
    [teams],
  );
  const activeFilterCount = [
    filters.query?.trim(),
    filters.assignee?.length,
    filters.status?.length,
    filters.priority?.length,
    Array.isArray(filters.team) ? filters.team.length : filters.team,
    filters.personalTag?.length,
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
        {filters.query && (
          <button
            className="search-field-clear"
            type="button"
            aria-label="Limpar busca"
            title="Limpar busca"
            onClick={() => setFilters((current) => ({ ...current, query: "" }))}
          >
            <X size={14} />
          </button>
        )}
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
          value={Array.isArray(filters.team) ? filters.team : filters.team ? [filters.team] : []}
          onChange={(value) =>
            setFilters((current) => ({ ...current, team: value }))
          }
          placeholder="Todas as equipes"
          options={teamOptions}
        />
        <SearchableMultiSelect
          className="personal-tag-filter-select"
          value={filters.personalTag || []}
          onChange={(value) => setFilters((current) => ({ ...current, personalTag: value }))}
          placeholder="Minhas tags"
          options={personalTags.filter((tag) => !tag.archived).map((tag) => ({ value: tag.id, label: tag.name, color: tag.color }))}
        />
        {activeFilterCount > 0 && (
          <button
            className="button button-quiet"
            type="button"
            onClick={() => setFilters(createDefaultFilters())}
          >
            <RotateCcw size={15} />
            Limpar filtros
          </button>
        )}
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
  columns,
  employees = [],
  tasksByColumn,
  subtasksByParent,
  currentEmployee,
  checklistVisibility,
  teams = [],
  personalTags = [],
  unreadMentionTaskIds,
  onOpen,
  onToggleSubtask,
  onComplete,
  onRegisterWaitingReturn,
}) {
  return (
    <div className="mobile-board-list">
      {columns.map((column) => (
        <section className="mobile-status-group" key={column.id}>
          <div className="mobile-status-heading">
            <StatusIcon
              status={column.id}
              className={`status-column-icon status-column-icon-${column.tone || "neutral"}`}
              size={17}
              strokeWidth={2.2}
              aria-hidden="true"
            />
            <h2>{column.label}</h2>
            <span className="column-count">
              {tasksByColumn[column.id].length}
            </span>
          </div>
          {(tasksByColumn[column.id] || []).map((taskItem) => (
            <TaskCard
              key={taskItem.id}
              task={taskItem}
              employees={employees}
              subtasks={subtasksByParent.get(taskItem.id) || []}
              currentEmployee={currentEmployee}
              teams={teams}
              personalTags={personalTags}
              hasUnreadMention={unreadMentionTaskIds.has(taskItem.id)}
              showChecklistOnCard={checklistVisibility[taskItem.id]}
              onOpen={onOpen}
              onToggleSubtask={onToggleSubtask}
              onComplete={onComplete}
              onRegisterWaitingReturn={onRegisterWaitingReturn}
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

function MobileTaskListView({ tasks, currentEmployee, teams = [], onOpen }) {
  const [tab, setTab] = useState("today");
  const tabs = [["today", "Hoje"], ["next", "Próximas"], ["done", "Concluídas"]];
  const visibleTasks = tasks.filter((taskItem) => {
    if (tab === "done") return taskItem.status === "done";
    if (["done", "cancelled"].includes(taskItem.status)) return false;
    const bucket = getDueBucketForEmployee(taskItem, currentEmployee, teams);
    return tab === "today"
      ? ["overdue", "today", "none"].includes(bucket)
      : !["overdue", "today", "none"].includes(bucket);
  });
  return (
    <section className="mobile-task-list" aria-label="Lista de tarefas mobile">
      <div className="mobile-task-tabs" role="tablist" aria-label="Período das tarefas">
        {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      <p className="mobile-task-summary">{visibleTasks.length} {tab === "done" ? "concluída(s)" : "tarefa(s)"}</p>
      <div className="mobile-task-rows">
        {visibleTasks.length ? visibleTasks.map((taskItem) => {
          const status = statusById(taskItem.status);
          const dueDate = taskDisplayDueDate(taskItem, currentEmployee, teams);
          const overdue = getDueBucketForEmployee(taskItem, currentEmployee, teams) === "overdue";
          const assignee = taskItem.primaryAssigneeName || taskItem.assigneeName || "Sem responsável";
          return <button className={`mobile-task-row${overdue ? " is-overdue" : ""}`} key={taskItem.id} type="button" onClick={() => onOpen(taskItem.id)}>
            <span className={`mobile-task-status-dot status-${taskItem.status}`} aria-hidden="true" />
            <span className="mobile-task-row-main"><strong>{taskItem.title}</strong><span><Avatar name={assignee} small />{assignee}</span></span>
            <span className="mobile-task-row-meta"><time>{dueDate ? formatDate(dueDate) : "Sem prazo"}</time><small>{status?.label || "Sem status"}</small></span>
            <ChevronRight size={17} aria-hidden="true" />
          </button>;
        }) : <div className="mobile-task-empty">Nenhuma tarefa nesta aba.</div>}
      </div>
    </section>
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
  onRegisterWaitingReturn,
  onCreate,
  filters,
  setFilters,
  onNavigate,
  taskScope,
  onScopeChange,
  personalTags,
  onCreatePersonalTag,
  onUpdatePersonalTag,
  onArchivePersonalTag,
  onReorderPersonalTags,
}) {
  const [groupBy, setGroupBy] = useState(readBoardGroupPreference);
  useEffect(() => {
    try {
      localStorage.setItem(BOARD_GROUP_STORAGE_KEY, groupBy);
    } catch {}
  }, [groupBy]);
  const [sort, setSort] = useState(readBoardSortPreference);
  useEffect(() => {
    try {
      localStorage.setItem(BOARD_SORT_STORAGE_KEY, JSON.stringify(sort));
    } catch {}
  }, [sort]);
  const unreadMentionTaskIds = useMemo(
    () => new Set((state.notifications || []).filter((item) => item.type === "mention" && !item.readAt && item.taskId).map((item) => item.taskId)),
    [state.notifications],
  );
  const filtered = useMemo(
    () =>
      sortBoardTasks(
        filterTasks(state.tasks.filter((taskItem) => !taskItem.parentTaskId), filters, currentEmployee, state.teams),
        sort,
        currentEmployee,
        state.teams,
      ),
    [state.tasks, state.teams, filters, currentEmployee?.id, sort],
  );
  const columns = useMemo(
    () => boardColumns(groupBy, filtered, state.teams, personalTags, state.employees),
    [filtered, groupBy, personalTags, state.employees, state.teams],
  );
  const tasksByColumn = useMemo(
    () => {
      const grouped = Object.fromEntries(columns.map((column) => [column.id, []]));
      filtered.forEach((taskItem) => {
        boardGroupValues(taskItem, groupBy).forEach((value) => {
          const column = columns.find((item) => item.groupValue === value);
          if (column) grouped[column.id].push(taskItem);
        });
      });
      return grouped;
    },
    [columns, filtered, groupBy],
  );
  const isMobile = useMediaQuery(
    "(max-width: 820px), (max-width: 900px) and (max-height: 600px)",
  );
  const subtasksByParent = useMemo(
    () =>
      state.tasks.reduce((index, taskItem) => {
        if (!taskItem.parentTaskId) return index;
        const parent = state.tasks.find((candidate) => candidate.id === taskItem.parentTaskId);
        if (isQuoteTask(parent || {})) return index;
        const siblings = index.get(taskItem.parentTaskId) || [];
        siblings.push(taskItem);
        index.set(taskItem.parentTaskId, siblings);
        return index;
      }, new Map()),
    [state.tasks],
  );
  return (
    <div className="page-content board-page-content">
      {!isMobile && <PageHeader
        eyebrow="Tarefas"
        title="Operação em movimento"
        description={
          isMobile
            ? "Escolha a próxima ação e atualize o andamento da tarefa."
            : "Arraste os cartões para atualizar o agrupamento selecionado."
        }
      >
        <BoardSortSelector sort={sort} onChange={setSort} />
        <SearchableSelect value={groupBy} onChange={setGroupBy} options={BOARD_GROUP_OPTIONS} placeholder="Escolher agrupamento" displayPrefix="Agrupar: " icon={<Columns3 size={15} aria-hidden="true" />} aria-label="Agrupar colunas por" className="board-group-select" />
        <TaskScopeSelector
          active={taskScope}
          onSelect={onScopeChange}
          disabled={!currentEmployee?.name}
        />
        <TaskViewSelector active="board" onSelect={onNavigate} />
      </PageHeader>}
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        onCreate={onCreate}
        employees={state.employees}
        teams={state.teams}
        personalTags={personalTags}
        onCreatePersonalTag={onCreatePersonalTag}
        onUpdatePersonalTag={onUpdatePersonalTag}
        onArchivePersonalTag={onArchivePersonalTag}
        onReorderPersonalTags={onReorderPersonalTags}
      />
      {isMobile ? (
        <MobileTaskListView
          tasks={filtered}
          currentEmployee={currentEmployee}
          teams={state.teams}
          onOpen={onOpen}
        />
      ) : (
        <Board
          tasks={filtered}
          employees={state.employees}
          columns={columns}
          tasksByColumn={tasksByColumn}
          groupBy={groupBy}
          subtasksByParent={subtasksByParent}
          currentEmployee={currentEmployee}
          checklistVisibility={checklistVisibility}
          teams={state.teams}
          personalTags={personalTags}
          unreadMentionTaskIds={unreadMentionTaskIds}
          onOpen={onOpen}
          onToggleSubtask={onToggleSubtask}
          onRegisterWaitingReturn={onRegisterWaitingReturn}
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
  personalTags,
  onCreatePersonalTag,
  onUpdatePersonalTag,
  onArchivePersonalTag,
  onReorderPersonalTags,
}) {
  const [sort, setSort] = useState({ key: "", direction: "asc" });
  const filtered = useMemo(() => {
    const tasks = filterTasks(tasksForView(state.tasks, filters), filters, currentEmployee, state.teams);
    return sort.key ? sortListTasks(tasks, sort, currentEmployee, state.teams) : sortTasks(tasks, currentEmployee, state.teams);
  }, [state.tasks, state.teams, filters, sort, currentEmployee]);
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
        teams={state.teams}
        personalTags={personalTags}
        onCreatePersonalTag={onCreatePersonalTag}
        onUpdatePersonalTag={onUpdatePersonalTag}
        onArchivePersonalTag={onArchivePersonalTag}
        onReorderPersonalTags={onReorderPersonalTags}
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
              {isTaskWaitingForEmployee(taskItem, currentEmployee) && (
                <span className="table-waiting-action" title="Aguardando sua atuação" aria-label="Aguardando sua atuação">
                  <BellRing size={14} aria-hidden="true" />
                </span>
              )}
              <div className="table-task-copy">
                <div className="task-title-inline">
                  <strong>{taskItem.title}</strong>
                  {taskItem.restrictedVisibility && <RestrictedVisibilityMark />}
                </div>
                {taskItem.status === "waiting" && waitingContextSummary(taskItem.waitingContext) && (
                  <small>{waitingContextSummary(taskItem.waitingContext)}</small>
                )}
              </div>
            </div>
            <span>{taskItem.quoteCode || "—"}</span>
            <AssigneeDisplay
              value={
                taskItem.assigneeProfiles?.length
                  ? taskItem.assigneeProfiles
                  : taskItem.assigneeNames || taskItem.assigneeName
              }
              small
              primaryName={taskItem.primaryAssigneeName}
              consultantNames={taskItem.consultantNames || []}
            />
            <span className={getDueBucketForEmployee(taskItem, currentEmployee, state.teams) === "overdue" ? "danger-text" : ""}>
              {formatDate(taskDisplayDueDate(taskItem, currentEmployee, state.teams))}
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

function calendarDateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function calendarDateFromKey(value) {
  return new Date(`${value}T12:00:00`);
}

function shiftCalendarDate(value, amount) {
  const date = calendarDateFromKey(value);
  date.setDate(date.getDate() + amount);
  return calendarDateKey(date);
}

function calendarDaysBetween(startKey, endKey) {
  const start = calendarDateFromKey(startKey);
  const end = calendarDateFromKey(endKey);
  return Math.max(0, Math.round((end - start) / 86400000));
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
  personalTags,
  onCreatePersonalTag,
  onUpdatePersonalTag,
  onArchivePersonalTag,
  onReorderPersonalTags,
}) {
  const today = new Date();
  const todayKey = calendarDateKey(today);
  const [windowStartDate, setWindowStartDate] = useState(todayKey);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => calendarDateFromKey(shiftCalendarDate(windowStartDate, index))),
    [windowStartDate],
  );
  const statusFilters = Array.isArray(filters.status)
    ? filters.status
    : filters.status
      ? [filters.status]
      : [];
  const openTasks = useMemo(() => {
    const filteredTasks = filterTasks(
      tasksForView(state.tasks, filters),
      filters,
      currentEmployee,
      state.teams,
    );
    const visibleTasks = statusFilters.includes("done")
      ? filteredTasks
      : filteredTasks.filter((taskItem) => taskItem.status !== "done");
    return sortTasks(visibleTasks, currentEmployee, state.teams);
  }, [state.tasks, state.teams, filters, currentEmployee, statusFilters]);
  const isCurrentWindow = windowStartDate === todayKey;
  const overdueTasks = useMemo(
    () => isCurrentWindow
      ? openTasks.filter((taskItem) => getDueBucketForEmployee(taskItem, currentEmployee, state.teams) === "overdue")
      : [],
    [isCurrentWindow, openTasks, currentEmployee, state.teams],
  );
  const overdueTaskIds = useMemo(
    () => new Set(overdueTasks.map((taskItem) => taskItem.id)),
    [overdueTasks],
  );
  const taskCountByDate = useMemo(
    () => days.reduce((counts, date) => {
      const dateKey = calendarDateKey(date);
      counts[dateKey] = openTasks.filter(
        (taskItem) => taskDisplayDueDate(taskItem, currentEmployee, state.teams) === dateKey,
      ).length;
      return counts;
    }, {}),
    [days, openTasks, currentEmployee, state.teams],
  );
  const visibleTasks = openTasks.filter(
    (taskItem) => taskDisplayDueDate(taskItem, currentEmployee, state.teams) === selectedDate
      && !overdueTaskIds.has(taskItem.id),
  );
  const selectedDateLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(calendarDateFromKey(selectedDate));
  const windowLabel = `${CALENDAR_WEEKDAY_FORMATTER.format(days[0]).replace(".", "")} ${days[0].getDate()} – ${CALENDAR_WEEKDAY_FORMATTER.format(days[6]).replace(".", "")} ${days[6].getDate()}`;
  const shiftWindow = (amount) => {
    setWindowStartDate((currentStart) => shiftCalendarDate(currentStart, amount));
    setSelectedDate((currentSelected) => shiftCalendarDate(currentSelected, amount));
  };
  const goToToday = () => {
    setWindowStartDate(todayKey);
    setSelectedDate(todayKey);
  };
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
        onCreate={() => onCreate("todo", { dueDate: selectedDate })}
        employees={state.employees}
        teams={state.teams}
        personalTags={personalTags}
        onCreatePersonalTag={onCreatePersonalTag}
        onUpdatePersonalTag={onUpdatePersonalTag}
        onArchivePersonalTag={onArchivePersonalTag}
        onReorderPersonalTags={onReorderPersonalTags}
      />
      <div className="calendar-navigation" aria-label="Navegação da agenda">
        <button
          className="icon-button"
          type="button"
          aria-label="Sete dias anteriores"
          title="Sete dias anteriores"
          onClick={() => shiftWindow(-7)}
        >
          <ChevronLeft size={17} aria-hidden="true" />
        </button>
        <strong>{windowLabel}</strong>
        <button
          className="button button-quiet button-small"
          type="button"
          onClick={goToToday}
          disabled={isCurrentWindow && selectedDate === todayKey}
        >
          Hoje
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label="Sete dias seguintes"
          title="Sete dias seguintes"
          onClick={() => shiftWindow(7)}
        >
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="calendar-strip">
        {days.map((date) => (
          <button
            className={`calendar-day ${calendarDateKey(date) === todayKey ? "today" : ""} ${calendarDateKey(date) === selectedDate ? "selected" : ""}`}
            key={date.toISOString()}
            type="button"
            aria-label={`${CALENDAR_WEEKDAY_FORMATTER.format(date).replace(".", "")}, ${date.getDate()} de ${date.toLocaleDateString("pt-BR", { month: "long" })}. ${taskCountByDate[calendarDateKey(date)] || 0} tarefas`}
            aria-pressed={calendarDateKey(date) === selectedDate}
            onClick={() => setSelectedDate(calendarDateKey(date))}
          >
            <span>
              {CALENDAR_WEEKDAY_FORMATTER.format(date).replace(".", "")}
            </span>
            <strong>{date.getDate()}</strong>
            <small>{taskCountByDate[calendarDateKey(date)] || 0} {taskCountByDate[calendarDateKey(date)] === 1 ? "tarefa" : "tarefas"}</small>
          </button>
        ))}
      </div>
      {isCurrentWindow && (
        <section className="panel overdue-panel" aria-labelledby="calendar-overdue-title">
          <div className="panel-heading">
            <div>
              <span className="eyebrow danger-text">Atenção operacional</span>
              <h2 id="calendar-overdue-title">Tarefas atrasadas</h2>
            </div>
            <span className="panel-count panel-count-danger" aria-label={`${overdueTasks.length} tarefas atrasadas`}>{overdueTasks.length}</span>
          </div>
          {overdueTasks.length ? (
            <div className="overdue-list">
              {overdueTasks.map((taskItem) => {
                const dueDate = taskDisplayDueDate(taskItem, currentEmployee, state.teams);
                const overdueDays = calendarDaysBetween(dueDate, todayKey);
                return (
                  <button className="overdue-row" key={taskItem.id} type="button" onClick={() => onOpen(taskItem.id)}>
                    <span className="overdue-row-marker" aria-hidden="true" />
                    <span className="overdue-row-copy">
                      <strong>{taskItem.title}</strong>
                      <small>{overdueDays} {overdueDays === 1 ? "dia" : "dias"} em atraso · {taskItem.assigneeName || "Sem responsável"}</small>
                    </span>
                    <span className="overdue-row-date">{formatDate(dueDate)}</span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="calendar-empty calendar-empty-compact" role="status">
              <CheckCircle2 size={18} aria-hidden="true" />
              <strong>Nenhuma tarefa atrasada</strong>
              <span>A operação está em dia.</span>
            </div>
          )}
        </section>
      )}
      <section className="panel agenda-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Próximos 7 dias</span>
            <h2>{selectedDateLabel}</h2>
          </div>
          <span className="panel-count" aria-label={`${visibleTasks.length} tarefas no dia selecionado`}>{visibleTasks.length}</span>
        </div>
        {visibleTasks.length ? visibleTasks.map((taskItem) => (
          <button
            className="agenda-row"
            key={taskItem.id}
            onClick={() => onOpen(taskItem.id)}
          >
            <span className="agenda-time">{formatDate(taskDisplayDueDate(taskItem, currentEmployee, state.teams))}</span>
            <div className="agenda-line" />
            <div className="agenda-info">
              <div className="task-title-inline">
                <strong>{taskItem.title}</strong>
                {taskItem.restrictedVisibility && <RestrictedVisibilityMark />}
              </div>
              <span>
                {taskItem.quoteCode} · {taskItem.assigneeName}
              </span>
            </div>
            <StatusBadge status={taskItem.status} />
            <ChevronRight size={16} />
          </button>
        )) : (
          <div className="calendar-empty" role="status">
            <CalendarDays size={20} aria-hidden="true" />
            <strong>Nenhuma tarefa para este dia</strong>
            <span>Escolha outra data ou crie uma nova tarefa.</span>
            <button className="button button-secondary button-small" type="button" onClick={() => onCreate("todo", { dueDate: selectedDate })}>
              <Plus size={14} aria-hidden="true" />Criar tarefa
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function QualityView({ state, currentEmployee, onCreate, onCreateTask, filters, setFilters }) {
  const quality = state.quality || [];
  const query = normalizeText(filters.query);
  const taskFilters = useMemo(() => ({ ...filters, query: "" }), [filters]);
  const taskBySourceId = useMemo(
    () => new Map(state.tasks.map((taskItem) => [taskItem.sourceId, taskItem])),
    [state.tasks],
  );
  const filteredQuality = useMemo(
    () =>
      quality.filter((item) => {
        const linkedTask = taskBySourceId.get(item.id);
        const matchesQuery =
          !query ||
          [
            item.code,
            item.title,
            item.type,
            item.status,
            linkedTask?.title,
          ].some((value) => normalizeText(value).includes(query));
        const matchesTaskFilters = linkedTask
          ? filterTasks([linkedTask], taskFilters, currentEmployee, state.teams).length > 0
          : !filters.assignee?.length &&
            !filters.priority?.length &&
            !filters.source?.length &&
            !filters.team?.length;
        return matchesQuery && matchesTaskFilters;
      }),
    [quality, taskBySourceId, query, taskFilters, filters, currentEmployee, state.teams],
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
        teams={state.teams}
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
          const linked = taskBySourceId.has(item.id);
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

function TeamManager({ teams = [], tasks = [], employees = [], onSave, onDelete }) {
  const emptyDraft = { id: "", name: "", iconName: "users", memberIds: [], primaryMemberId: "" };
  const [draft, setDraft] = useState(emptyDraft);
  const [teamDrawerOpen, setTeamDrawerOpen] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [validationError, setValidationError] = useState("");
  const employeeOptions = employees.map((employee) => ({ value: employee.id, label: employee.name }));
  const employeeNameById = new Map(employees.map((employee) => [String(employee.id), employee.name]));
  const responsibilitiesByTeam = useMemo(
    () => new Map(teams.map((team) => [String(team.id), teamResponsibilitySummary(team, tasks, employees)])),
    [teams, tasks, employees],
  );
  const memberSummary = (team) => {
    const names = (team.memberIds || []).map((id) => employeeNameById.get(String(id))).filter(Boolean);
    if (!names.length) return "Nenhum membro selecionado";
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
  };
  const startEdit = (team) => {
    setDraft({ id: team.id, name: team.name, iconName: team.iconName || "users", memberIds: [...(team.memberIds || [])], primaryMemberId: team.primaryMemberId || "" });
    setExpandedTeamId(team.id);
    setTeamDrawerOpen(true);
    setValidationError("");
  };
  const submit = () => {
    const name = draft.name.trim();
    if (!name) {
      setValidationError("Informe um nome para a equipe.");
      return;
    }
    const composition = validateTeamComposition(draft.memberIds, draft.primaryMemberId);
    if (!composition.valid) {
      setValidationError(composition.error);
      return;
    }
    setSaving(true);
    Promise.resolve(onSave({ ...draft, name, primaryMemberId: composition.primaryMemberId }))
      .then((success) => {
        if (success) {
          setDraft(emptyDraft);
          setValidationError("");
          setTeamDrawerOpen(false);
        }
      })
      .catch((failure) => setValidationError(failure.message || "Não foi possível salvar a equipe."))
      .finally(() => setSaving(false));
  };
  const remove = () => {
    if (!draft.id || !window.confirm(`Apagar a equipe "${draft.name}"? As tarefas existentes serão preservadas.`)) return;
    setDeleting(true);
    Promise.resolve(onDelete(draft.id))
      .then((success) => {
        if (success) {
          setDraft(emptyDraft);
          setValidationError("");
        }
      })
      .catch((failure) => setValidationError(failure.message || "Não foi possível apagar a equipe."))
      .finally(() => setDeleting(false));
  };
  return (
    <section className="panel teams-settings-panel" aria-labelledby="teams-settings-title">
      <div className="panel-heading teams-panel-heading">
        <div>
          <h2 id="teams-settings-title">Equipes do Planner</h2>
        </div>
        <div className="team-panel-actions">
          <div className="team-total" aria-label={`${teams.length} ${teams.length === 1 ? "equipe cadastrada" : "equipes cadastradas"}`}><strong>{teams.length}</strong><span>{teams.length === 1 ? "equipe" : "equipes"}</span></div>
          <button className="button button-primary team-new-button" type="button" onClick={() => { setDraft(emptyDraft); setValidationError(""); setTeamDrawerOpen(true); }}><Users size={15} />Nova equipe</button>
        </div>
      </div>
      <div className="team-manager-body">
        <div className="team-list-column">
          <div className="team-list">
          {teams.length ? teams.map((team, index) => {
            const isExpanded = expandedTeamId === team.id;
            const summary = responsibilitiesByTeam.get(String(team.id)) || { totalTaskCount: 0, members: [] };
            const detailsId = `team-details-${index}`;
            return (
              <article className={`team-list-item${isExpanded ? " is-expanded" : ""}`} key={team.id}>
                <button className="team-list-row" type="button" onClick={() => setExpandedTeamId((current) => current === team.id ? "" : team.id)} aria-expanded={isExpanded} aria-controls={detailsId}>
                  <span className="team-list-icon" aria-hidden="true"><TeamIcon name={team.iconName} size={17} /></span>
                  <span className="team-list-copy">
                    <strong>{team.name}</strong>
                    <span className="team-list-meta">
                      <span>{(team.memberIds || []).length} {(team.memberIds || []).length === 1 ? "membro" : "membros"}</span>
                      <span aria-hidden="true">·</span>
                      <span>Principal: {employeeNameById.get(String(team.primaryMemberId)) || memberSummary(team)}</span>
                    </span>
                  </span>
                  <span className="team-list-action"><span>{summary.totalTaskCount} {summary.totalTaskCount === 1 ? "tarefa aberta" : "tarefas abertas"}</span><ChevronDown size={15} aria-hidden="true" /></span>
                </button>
                <div className="team-expansion" id={detailsId} aria-hidden={!isExpanded}>
                  <div className="team-expansion-content">
                    <div className="team-expansion-heading"><span>Membros da equipe</span><span>{summary.totalTaskCount} {summary.totalTaskCount === 1 ? "tarefa aberta" : "tarefas abertas"}</span></div>
                    {summary.members.length ? <div className="team-member-list">{summary.members.map((member) => (
                      <div className="team-member-row" key={member.id}>
                        <span className="team-member-avatar" aria-hidden="true">{(member.apelido || member.name).split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
                        <span className="team-member-copy"><strong>{member.name}</strong><span>{String(member.id) === String(team.primaryMemberId) ? "Responsável principal" : "Consultor"}</span></span>
                      </div>
                    ))}</div> : <p className="team-members-empty">Inclua membros para identificar quem compõe esta equipe.</p>}
                    <div className="team-expansion-footer"><span>{summary.totalTaskCount === 1 ? "1 tarefa aberta sob responsabilidade da equipe" : `${summary.totalTaskCount} tarefas abertas sob responsabilidade da equipe`}</span><button className="text-button" type="button" onClick={() => startEdit(team)}>Editar equipe <ChevronRight size={14} aria-hidden="true" /></button></div>
                  </div>
                </div>
              </article>
            );
          }) : <div className="team-list-empty"><Users size={18} /><strong>Nenhuma equipe cadastrada</strong><span>Crie a primeira para acelerar a atribuição de tarefas.</span></div>}
          </div>
        </div>
        {teamDrawerOpen && <div className="drawer-layer team-drawer-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setTeamDrawerOpen(false); }}>
          <aside className="task-drawer team-editor-drawer" role="dialog" aria-modal="true" aria-labelledby="team-editor-title">
            <header className="drawer-header"><div><span className="eyebrow">Atribuição rápida</span><h2 id="team-editor-title">{draft.id ? "Editar equipe" : "Nova equipe"}</h2></div><button className="icon-button" type="button" aria-label="Fechar formulário" onClick={() => setTeamDrawerOpen(false)}><X size={19} /></button></header>
            <div className="drawer-body">
        <div className="team-form">
          <div className="team-form-fields">
            <label className="team-form-field">
              <span className="team-form-label"><span>Nome da equipe</span><span className="team-form-required">Obrigatório</span></span>
              <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Operação" />
            </label>
            <div className="team-form-field">
              <span className="team-form-label"><span>Quem faz parte?</span><span className="team-form-selection">{draft.memberIds.length} {draft.memberIds.length === 1 ? "membro" : "membros"}</span></span>
              <SearchableMultiSelect value={draft.memberIds} onChange={(memberIds) => setDraft((current) => ({ ...current, memberIds, primaryMemberId: memberIds.length === 1 ? memberIds[0] : memberIds.includes(current.primaryMemberId) ? current.primaryMemberId : "" }))} options={employeeOptions} placeholder="Buscar e adicionar membros" />
              <span className="team-form-hint">A mesma pessoa pode estar em mais de uma equipe.</span>
            </div>
            <div className="team-form-field">
              <span className="team-form-label"><span>Responsável principal</span><span className="team-form-selection">{draft.memberIds.length > 1 ? "Obrigatório" : "Automático com 1 membro"}</span></span>
              <InputSelect
                value={draft.primaryMemberId}
                onChange={(primaryMemberId) => setDraft((current) => ({ ...current, primaryMemberId }))}
                options={employeeOptions.filter((option) => draft.memberIds.includes(option.value))}
                placeholder={draft.memberIds.length ? "Escolha quem responde pela equipe" : "Adicione membros primeiro"}
                disabled={!draft.memberIds.length || draft.memberIds.length === 1}
              />
              <span className="team-form-hint">Os demais membros serão consultores derivados nas tarefas abertas.</span>
            </div>
            <div className="team-form-field">
              <span className="team-form-label"><span>Ícone da equipe</span><span className="team-form-selection">Exibido nos cards</span></span>
              <div className="team-icon-options" role="radiogroup" aria-label="Ícone da equipe">
                {TEAM_ICON_OPTIONS.map(({ id, label }) => <button key={id} className={`team-icon-option${draft.iconName === id ? " is-selected" : ""}`} type="button" role="radio" aria-checked={draft.iconName === id} aria-label={label} title={label} onClick={() => setDraft((current) => ({ ...current, iconName: id }))}><TeamIcon name={id} size={17} /><span>{label}</span></button>)}
              </div>
            </div>
          </div>
          {validationError && <div className="form-error" role="alert">{validationError}</div>}
          <div className="team-form-footer">
            {draft.id ? <div className="team-form-secondary-actions">
              <button className="text-button" type="button" onClick={() => setDraft(emptyDraft)} disabled={saving || deleting}>Cancelar edição</button>
              <button className="text-button team-delete-button" type="button" onClick={remove} disabled={saving || deleting}>
                {deleting ? <LoaderCircle size={13} className="spin" /> : <Trash2 size={13} />}
                Apagar equipe
              </button>
            </div> : <span className="team-form-footer-hint">Você poderá editar membros depois.</span>}
            <button className="button button-primary team-form-submit" type="button" onClick={submit} disabled={saving || deleting || !draft.name.trim()}>
              {saving ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}
              {saving ? "Salvando…" : draft.id ? "Salvar alterações" : "Criar equipe"}
            </button>
          </div>
        </div>
            </div>
          </aside>
        </div>}
      </div>
    </section>
  );
}

function SettingsView({ onReset, onAdminCleanup, onSendNotificationTest, live, teams = [], tasks = [], contacts = [], notifications = [], employees = [], personalTags = [], onSaveTeam, onDeleteTeam, onImportPlannerTasks, onCreatePersonalTag, onUpdatePersonalTag, onArchivePersonalTag, onReorderPersonalTags }) {
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
        <PlannerImportView live={live} employees={employees} onImport={onImportPlannerTasks} />
      </section>
      <NotificationTestPanel live={live} tasks={tasks} onSend={onSendNotificationTest} />
      <AdminCleanupPanel live={live} counts={{ tasks: tasks.length, completedTasks: tasks.filter((task) => task.status === "done").length, personalTags: personalTags.length, notifications: notifications.length, teams: teams.length, contacts: contacts.length, taskActivity: tasks.reduce((total, task) => total + (task.comments?.length || 0) + (task.returns?.length || 0) + (task.history?.length || 0), 0), taskAttachments: tasks.reduce((total, task) => total + (task.attachments?.length || 0), 0), assignedTasks: tasks.filter((task) => task.assigneeIds?.length || task.teamIds?.length || task.teamId).length, datedTasks: tasks.filter((task) => task.dueDate).length, plannerRecords: tasks.length + personalTags.length + notifications.length + teams.length + contacts.length }} employees={employees} teams={teams} tasks={tasks} contacts={contacts} onCleanup={onAdminCleanup} />
      <div className="settings-secondary-grid">
        <section className="panel personal-tags-settings-panel" aria-labelledby="personal-tags-settings-title">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Personalização</span>
              <h2 id="personal-tags-settings-title">Minhas tags</h2>
              <p className="panel-copy">Crie e organize etiquetas privadas para encontrar suas tarefas mais rápido.</p>
            </div>
            <Tag size={19} aria-hidden="true" />
          </div>
          <PersonalTagManager tags={personalTags} onCreate={onCreatePersonalTag} onUpdate={onUpdatePersonalTag} onArchive={onArchivePersonalTag} />
        </section>
        <TeamManager teams={teams} tasks={tasks} employees={employees} onSave={onSaveTeam} onDelete={onDeleteTeam} />
      </div>
      <ServiceTypeManager live={live} />
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

function filesFromClipboard(event) {
  const clipboard = event.clipboardData;
  const files = Array.from(clipboard?.files || []).filter(Boolean);
  if (files.length) return files;
  return Array.from(clipboard?.items || [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile?.())
    .filter(Boolean);
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
        attachment?.syncStatus !== "pending" &&
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
  itemLabel = "à tarefa",
  showPreview = true,
  allowOpen = true,
  compact = false,
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
      const downloadLink = popup.document.createElement("a");
      downloadLink.href = blobUrl;
      downloadLink.download = attachment.name || "Anexo";
      downloadLink.textContent = "Download iniciado.";
      popup.document.body.append(downloadLink);
      downloadLink.click();
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
    <section className={`drawer-section attachment-section${compact ? " is-compact" : ""}`}>
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
              : `Adicione arquivos ${itemLabel}`}
          </strong>
          <small>{compact ? "Clique ou arraste arquivos" : "Cole com Ctrl+V, clique para escolher ou arraste arquivos para cá"}</small>
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
              {showPreview && <AttachmentPreview
                attachment={item}
                loadAttachmentContent={loadAttachmentContent}
                onOpen={setPreviewAttachment}
              />}
              <div className="attachment-card">
                {allowOpen ? <button
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
                </button> : <div className="attachment-file-summary">
                  <AttachmentTypeIcon attachment={item} />
                  <span className="attachment-file-main">
                    <strong title={item.name}>{item.name || "Arquivo sem nome"}</strong>
                    <span>{attachmentTypeLabel(item)} · {formatAttachmentSize(item.size)}</span>
                  </span>
                </div>}
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
      {showPreview && previewAttachment &&
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

function ReturnEvidenceList({ taskId, attachments = [], loadAttachmentContent, onDeleteAttachment }) {
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  if (!attachments.length) return null;
  const openEvidence = async (attachment) => {
    setPreviewError("");
    if (!isImageAttachment(attachment) && !isPdfAttachment(attachment)) {
      setPreviewError("A prévia está disponível apenas para imagens e PDFs.");
      return;
    }
    try {
      const cacheKey = attachmentCacheKey(attachment);
      let previewUrl = attachment.previewUrl || attachmentPreviewCache.get(cacheKey);
      if (!previewUrl && loadAttachmentContent) {
        const result = await loadAttachmentContent(attachment);
        previewUrl = result?.dataUrl || result?.previewUrl || "";
        if (previewUrl) attachmentPreviewCache.set(cacheKey, previewUrl);
      }
      if (!previewUrl) throw new Error("Não foi possível carregar a evidência.");
      setPreviewAttachment({ ...attachment, previewUrl });
    } catch (error) {
      setPreviewError(error.message || "Não foi possível abrir a evidência.");
    }
  };
  const confirmDelete = (attachment) => {
    setPendingDeleteId("");
    setDeletingId(attachment.id);
    Promise.resolve(onDeleteAttachment?.(taskId, attachment)).finally(() => setDeletingId(""));
  };
  return (
    <div className="return-evidence" aria-label="Evidências do retorno">
      <span className="return-evidence-label"><Paperclip size={13} aria-hidden="true" /> Evidências</span>
      <div className="return-evidence-list">
        {attachments.map((attachment) => (
          <div className="return-evidence-item" key={attachment.id}>
            <button className="attachment-open-button" type="button" onClick={() => openEvidence(attachment)} aria-label={`Abrir prévia de ${attachment.name || "evidência"}`}>
              <AttachmentTypeIcon attachment={attachment} />
              <span className="attachment-file-main">
                <strong title={attachment.name}>{attachment.name || "Arquivo"}</strong>
                <span>{attachmentTypeLabel(attachment)} · {formatAttachmentSize(attachment.size)} · Abrir prévia</span>
              </span>
            </button>
            <div className="attachment-card-actions">
              <span className="attachment-status"><CheckCircle2 size={13} /> Salvo</span>
              {onDeleteAttachment && (pendingDeleteId === attachment.id ? (
                <div className="attachment-remove-confirm" role="group" aria-label={`Confirmar remoção de ${attachment.name || "evidência"}`}>
                  <button className="button button-danger" type="button" onClick={() => confirmDelete(attachment)} disabled={deletingId === attachment.id}>{deletingId === attachment.id ? "Removendo…" : "Remover"}</button>
                  <button className="button button-quiet" type="button" onClick={() => setPendingDeleteId("")} disabled={deletingId === attachment.id}>Cancelar</button>
                </div>
              ) : (
                <button className="attachment-delete-button" type="button" onClick={() => setPendingDeleteId(attachment.id)} disabled={deletingId === attachment.id} aria-label={`Remover ${attachment.name || "evidência"}`} title={`Remover ${attachment.name || "evidência"}`}><Trash2 size={14} /></button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {previewError && <div className="attachment-feedback attachment-feedback-error" role="alert">{previewError}</div>}
      {previewAttachment && typeof document !== "undefined" && document.body
        ? createPortal(
            <div className="attachment-lightbox" role="dialog" aria-modal="true" aria-label={`Prévia de ${previewAttachment.name || "evidência"}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewAttachment(null); }}>
              <button className="icon-button attachment-lightbox-close" type="button" onClick={() => setPreviewAttachment(null)} aria-label="Fechar prévia"><X size={19} /></button>
              {isPdfAttachment(previewAttachment) ? <iframe src={previewAttachment.previewUrl} title={previewAttachment.name || "Prévia do PDF"} /> : <img src={previewAttachment.previewUrl} alt={previewAttachment.name || "Imagem anexada"} />}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function MoreView({ onNavigate, canViewManagement = false }) {
  return (
    <div className="page-content more-page-content">
      <PageHeader
        eyebrow="Atalhos"
        title="Mais"
        description="Acesse origens e configurações sem tirar o foco das tarefas."
      />
      <section className="more-actions">
        {canViewManagement && <button
          className="panel more-action"
          type="button"
          onClick={() => onNavigate("management")}
        >
          <span className="more-action-icon more-action-icon-action">
            <Target size={19} />
          </span>
          <span>
            <strong>Gestão</strong>
            <small>Cobranças, carga e retornos pendentes</small>
          </span>
          <ChevronRight size={17} />
        </button>}
        <button
          className="panel more-action"
          type="button"
          onClick={() => onNavigate("contacts")}
        >
          <span className="more-action-icon more-action-icon-contact">
            <Users size={19} />
          </span>
          <span>
            <strong>Contatos</strong>
            <small>Casos recebidos e responsáveis</small>
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

function TaskReturnsSection({ task, currentEmployee, loadAttachmentContent, onDeleteAttachment }) {
  const [showAllReturns, setShowAllReturns] = useState(false);
  useEffect(() => { setShowAllReturns(false); }, [task?.id]);
  const returns = [...(task?.returns || [])].sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")));
  const latestReturn = returns.at(-1);
  const returnSeenKey = `planner:return-seen:${currentEmployee?.id || "anonymous"}:${task?.id || ""}`;
  const seenReturnAt = globalThis.localStorage?.getItem(returnSeenKey) || "";
  const hasUnreadReturn = Boolean(latestReturn?.createdAt && seenReturnAt < latestReturn.createdAt);
  useEffect(() => {
    if (latestReturn?.createdAt) globalThis.localStorage?.setItem(returnSeenKey, latestReturn.createdAt);
  }, [latestReturn?.createdAt, returnSeenKey]);
  if (!returns.length) return null;
  const visibleReturns = showAllReturns ? [...returns].reverse() : [latestReturn];
  const olderReturnsCount = returns.length - visibleReturns.length;
  return (
    <section className="drawer-section returns-section">
      <div className="drawer-section-heading">
        <div className="comment-section-title"><h3>Retornos</h3><span className="section-count">{returns.length}</span></div>
        <span className="comment-section-helper">Respostas recebidas</span>
      </div>
      {visibleReturns.map((item) => (
        <article className={`return-card ${item.id === latestReturn?.id ? "is-latest" : ""}`} key={item.id}>
          <header className="return-card-header">
            <div className="return-card-author"><Avatar name={item.author} small /><span><strong>{item.author}</strong><small>{formatCommentTimestamp(item.createdAt)}</small></span></div>
            {item.id === latestReturn?.id && <span className={`return-card-badge ${hasUnreadReturn ? "is-new" : ""}`}>{hasUnreadReturn ? "Novo retorno" : "Mais recente"}</span>}
          </header>
          <p className="return-card-text">{item.text}</p>
          <ReturnEvidenceList taskId={task.id} attachments={item.attachments} loadAttachmentContent={loadAttachmentContent} onDeleteAttachment={onDeleteAttachment} />
        </article>
      ))}
      {!showAllReturns && olderReturnsCount > 0 && <button className="comment-history-toggle" type="button" onClick={() => setShowAllReturns(true)}><ChevronDown size={14} aria-hidden="true" /> Mostrar {olderReturnsCount} {olderReturnsCount === 1 ? "retorno anterior" : "retornos anteriores"}</button>}
    </section>
  );
}

function formatRelativeTimestamp(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "agora";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}

function formatExecutionDay(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "RECENTE";
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "HOJE";
  if (date.toDateString() === yesterday.toDateString()) return "ONTEM";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function TaskDrawerContent({
  task: taskItem,
  state,
  teams = [],
  personalTags = [],
  onCreatePersonalTag,
  currentEmployee,
  loadAttachmentContent,
  showChecklistOnCard,
  onToggleChecklistOnCard,
  onClose,
  onRegisterWaitingReturn,
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
  const [showAllComments, setShowAllComments] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [subtaskToDelete, setSubtaskToDelete] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [showSaveOverlay, setShowSaveOverlay] = useState(false);
  const [saveProgress, setSaveProgress] = useState({
    label: "Salvando tarefa…",
    detail: "Validando alterações",
    current: 0,
    total: 1,
  });
  const [validationError, setValidationError] = useState("");
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const [showUnassignedPrompt, setShowUnassignedPrompt] = useState(false);
  const [showQuoteCompletionPrompt, setShowQuoteCompletionPrompt] = useState(false);
  const [draftAttachments, setDraftAttachments] = useState([]);
  const [pendingAttachmentRemovals, setPendingAttachmentRemovals] = useState(
    [],
  );
  const draftAttachmentsRef = useRef([]);
  const drawerBodyRef = useRef(null);
  const commentExpansionAnchorRef = useRef(null);
  const saveOverlayTimerRef = useRef(null);
  draftAttachmentsRef.current = draftAttachments;
  const saveCloseTimerRef = useRef(null);
  useEffect(() => {
    setForm(
      taskItem
        ? {
            ...taskItem,
            assignmentMode: taskItem.assignmentMode || (taskItem.teamId ? "team" : "people"),
            teamIds: taskItem.teamIds || (taskItem.teamId ? [taskItem.teamId] : []),
            teamNames: taskItem.teamNames || [],
            teamId: taskItem.teamId || "",
            assigneeIds: taskItem.assigneeIds || [],
            primaryAssigneeId: taskItem.primaryAssigneeId || taskItem.assigneeIds?.[0] || "",
            consultantIds: taskItem.consultantIds || taskItem.assigneeIds?.slice(1) || [],
            restrictedVisibility: Boolean(taskItem.restrictedVisibility),
            personalTagIds: normalizePersonalTagIds(taskItem.personalTagIds),
            quoteStatus: isQuoteTask(taskItem) ? taskItem.quoteStatus || state.quotes?.find((quote) => quote.id === taskItem.quoteId)?.status || quoteStatusForTaskStatus(taskItem.status) : taskItem.quoteStatus,
            assigneeName: normalizeAssigneeNames(
              taskItem.assigneeNames || taskItem.assigneeName,
            ).filter((name) => name !== "Não atribuído"),
            waitingContext: normalizeWaitingContext(taskItem.waitingContext),
          }
        : null,
    );
    setComment("");
    setShowAllComments(false);
    setShowHistory(false);
    setShowAllHistory(false);
    commentExpansionAnchorRef.current = null;
    setMentionActiveIndex(0);
    setNewSubtaskTitle("");
    setIsAddingSubtask(false);
    setSubtaskToDelete(null);
    setSaveState("idle");
    setShowSaveOverlay(false);
    setSaveProgress({
      label: "Salvando tarefa…",
      detail: "Validando alterações",
      current: 0,
      total: 1,
    });
    setValidationError("");
    setShowDiscardPrompt(false);
    setShowUnassignedPrompt(false);
    setShowQuoteCompletionPrompt(false);
    setDraftAttachments([]);
    setPendingAttachmentRemovals([]);
    if (saveCloseTimerRef.current)
      window.clearTimeout(saveCloseTimerRef.current);
    if (saveOverlayTimerRef.current)
      window.clearTimeout(saveOverlayTimerRef.current);
    return () => {
      if (saveCloseTimerRef.current)
        window.clearTimeout(saveCloseTimerRef.current);
      if (saveOverlayTimerRef.current)
        window.clearTimeout(saveOverlayTimerRef.current);
    };
  }, [taskItem?.id]);
  useEffect(
    () => () => draftAttachmentsRef.current.forEach(releaseDraftAttachment),
    [],
  );
  useLayoutEffect(() => {
    const anchor = commentExpansionAnchorRef.current;
    const container = drawerBodyRef.current;
    if (!anchor || !container || !showAllComments) return;
    container.scrollTop =
      anchor.scrollTop + (container.scrollHeight - anchor.scrollHeight);
    commentExpansionAnchorRef.current = null;
  }, [showAllComments]);
  if (!taskItem || !form) return null;
  const setMentionActiveIndex = () => undefined;
  const subtasks = isQuoteTask(taskItem) ? [] : state.tasks.filter(
    (item) => item.parentTaskId === taskItem.id,
  );
  const history = visibleTaskHistory(taskItem.history);
  const visibleHistory = showAllHistory ? history : history.slice(0, 5);
  const executionActor = deriveExecutionActor(taskItem, state.employees);
  const comments = taskItem.comments || [];
  const visibleComments = showAllComments ? comments : comments.slice(-10);
  const olderCommentsCount = comments.length - visibleComments.length;
  const olderCommentsLabel = olderCommentsCount === 1
    ? "mensagem anterior"
    : "mensagens anteriores";
  const expandComments = () => {
    const container = drawerBodyRef.current;
    if (container) {
      commentExpansionAnchorRef.current = {
        scrollTop: container.scrollTop,
        scrollHeight: container.scrollHeight,
      };
    }
    setShowAllComments(true);
  };
  const isOwnComment = (item) =>
    item.author === "Você" ||
    (state.currentUserId &&
      String(item.authorId || "")
        .replace(/[{}]/g, "")
        .toLowerCase() ===
      String(state.currentUserId).replace(/[{}]/g, "").toLowerCase()) ||
    (currentEmployee?.userId &&
      String(item.authorId || "")
        .replace(/[{}]/g, "")
        .toLowerCase() ===
        String(currentEmployee.userId).replace(/[{}]/g, "").toLowerCase()) ||
    (currentEmployee?.name &&
      normalizeText(item.author) === normalizeText(currentEmployee.name));
  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const setTaskStatus = (value) => {
    if (value === "done" && taskItem.status !== "done" && isQuoteTask(taskItem) && !taskItem.parentTaskId) {
      setShowQuoteCompletionPrompt(true);
      return;
    }
    setShowQuoteCompletionPrompt(false);
    set("status", value);
  };
  const visibleAttachments = [
    ...(taskItem.attachments || []).filter(
      (item) => !item.returnId && !pendingAttachmentRemovals.includes(item.id),
    ),
    ...draftAttachments,
  ];
  const isDirty =
    ["title", "status", "quoteStatus", "priority", "assignmentMode", "teamIds", "teamNames", "teamId", "teamName", "primaryAssigneeId", "consultantIds", "dueDate", "description", "waitingContext", "personalTagIds", "restrictedVisibility"].some(
      (key) =>
        JSON.stringify(key === "personalTagIds" ? normalizePersonalTagIds(form[key]) : form[key] || "") !== JSON.stringify(key === "personalTagIds" ? normalizePersonalTagIds(taskItem[key]) : taskItem[key] || ""),
    ) ||
    JSON.stringify(form.assigneeName || []) !==
      JSON.stringify(
        normalizeAssigneeNames(
          taskItem.assigneeNames || taskItem.assigneeName,
      ).filter((name) => name !== "Não atribuído"),
      ) ||
    JSON.stringify(form.assigneeIds || []) !== JSON.stringify(taskItem.assigneeIds || []) ||
    comment.length > 0 ||
    draftAttachments.length > 0 ||
    pendingAttachmentRemovals.length > 0;
  const currentDeadlineRole = deadlineRole(taskItem, currentEmployee);
  const headerStatus = statusById(form.status);
  const headerPriority = PRIORITIES.find((item) => item.id === form.priority) || PRIORITIES[1];
  const headerDueDate = form.dueDate ? formatDate(form.dueDate) : "Sem prazo";
  const dueDateChanged =
    String(form.dueDate || "") !== String(taskItem.dueDate || "");
  const deadlineValidation = validateDeadlineChange({
    task: taskItem,
    employee: currentEmployee,
    nextDueDate: form.dueDate,
    reason: form.deadlineChangeReason,
  });
  const waitingValidation = isQuoteTask(taskItem) && taskItem.status === "waiting" && form.status === "waiting"
    ? { allowed: true, error: "" }
    : validateWaitingContext(form.status, form.waitingContext);
  const canRegisterReturn = canRegisterWaitingReturn(taskItem, currentEmployee, teams);
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
    onAddSubtask(taskItem.id, title, true);
    setNewSubtaskTitle("");
    setIsAddingSubtask(false);
  };
  const submitComment = () => {
    if (!comment.trim()) return;
    onComment(taskItem.id, comment);
    setComment("");
  };
  const handleDraftAttachment = (id, filesOrFile) =>
    setDraftAttachments((current) => [
      ...current,
      ...toAttachmentFiles(filesOrFile).map((file) =>
        createDraftAttachment(file, "edit"),
      ),
    ]);
  const handlePaste = (event) => {
    const files = filesFromClipboard(event);
    if (!files.length) return;
    event.preventDefault();
    handleDraftAttachment("paste", files);
  };
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
  const handleSave = (allowUnassigned = false, quoteCompletion = null) => {
    if (saveState !== "idle") return Promise.resolve(false);
    setValidationError("");
    if (dueDateChanged && !deadlineValidation.allowed) {
      setValidationError(deadlineValidation.error);
      return Promise.resolve(false);
    }
    if (!waitingValidation.allowed) {
      setValidationError(waitingValidation.error);
      return Promise.resolve(false);
    }
    const nextAssignment = resolveTaskAssignment(
      { ...form, assigneeNames: form.assigneeName },
      teams,
      state.employees,
    );
    const missingResponsible = !hasTaskResponsible(nextAssignment);
    const missingDueDate = !String(form.dueDate || "").trim();
    if (!allowUnassigned && (missingResponsible || missingDueDate)) {
      setShowUnassignedPrompt(true);
      return Promise.resolve(false);
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
    setShowSaveOverlay(false);
    saveOverlayTimerRef.current = window.setTimeout(() => {
      saveOverlayTimerRef.current = null;
      setShowSaveOverlay(true);
    }, 180);
    return Promise.resolve(
      onSave(taskItem.id, {
        title: form.title,
        status: quoteCompletion ? "done" : form.status,
        ...(quoteCompletion || {}),
        priority: form.priority,
        assignmentMode: form.assignmentMode,
        teamIds: form.teamIds || [],
        teamNames: form.teamNames || [],
        teamId: form.teamId || "",
        assigneeIds: form.assigneeIds || [],
        primaryAssigneeId: form.primaryAssigneeId || "",
        consultantIds: form.consultantIds || [],
        assigneeNames: normalizeAssigneeNames(form.assigneeName),
        teamName: form.teamName,
        restrictedVisibility: Boolean(form.restrictedVisibility),
        dueDate: form.dueDate,
        deadlineChangeReason: dueDateChanged
          ? String(form.deadlineChangeReason || "").trim()
          : "",
        actorEmployeeId: currentEmployee?.id || "",
        actorUserId: currentEmployee?.userId || "",
        description: form.description,
        waitingContext: normalizeWaitingContext(form.waitingContext),
        personalTagIds: form.personalTagIds || [],
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
        if (saveOverlayTimerRef.current)
          window.clearTimeout(saveOverlayTimerRef.current);
        saveOverlayTimerRef.current = null;
        setShowSaveOverlay(false);
        setSaveState("success");
        saveCloseTimerRef.current = window.setTimeout(onClose, 620);
        return true;
      })
      .catch((error) => {
        if (saveOverlayTimerRef.current)
          window.clearTimeout(saveOverlayTimerRef.current);
        saveOverlayTimerRef.current = null;
        setShowSaveOverlay(false);
        setSaveState("idle");
        setValidationError(
          error.message || "Não foi possível salvar as alterações.",
        );
        return false;
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
        {saveState === "saving" && showSaveOverlay && (
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
          <div className="drawer-header-main">
            <div className="drawer-header-title-row">
              <span className="eyebrow">Detalhe da tarefa</span>
              <span className="drawer-code">
                {taskItem.quoteCode || "TAREFA"}
              </span>
            </div>
            <div className="drawer-header-context" aria-label="Resumo da tarefa">
              <span className={`drawer-context-item drawer-context-${headerStatus.tone}`}>
                <i aria-hidden="true" />
                {headerStatus.label}
              </span>
              <span className={`drawer-context-item drawer-context-${headerPriority.tone}`}>
                <Flag size={12} aria-hidden="true" />
                {headerPriority.label}
              </span>
              <span className="drawer-context-item drawer-context-date">
                <CalendarDays size={12} aria-hidden="true" />
                {headerDueDate}
              </span>
            </div>
          </div>
          {canRegisterReturn && (
            <button
              className="button button-secondary drawer-return-action"
              type="button"
              onClick={() => onRegisterWaitingReturn?.(taskItem.id)}
              disabled={saveState !== "idle"}
            >
              <CheckCircle2 size={15} />
              Registrar retorno
            </button>
          )}
          <button
            className="icon-button"
            onClick={requestClose}
            aria-label="Fechar detalhe"
            disabled={saveState !== "idle"}
          >
            <X size={19} />
          </button>
        </header>
        <div className="drawer-body" ref={drawerBodyRef} onPaste={handlePaste}>
          <section className="drawer-personal-tags" aria-label="Minhas tags">
            <PersonalTagPicker tags={personalTags} tasks={state.tasks || []} value={form.personalTagIds || []} onChange={(value) => set("personalTagIds", value)} onCreate={onCreatePersonalTag} />
          </section>
          <div className="drawer-title">
            <div className="drawer-title-field">
              <div className="drawer-title-label-row">
                <label className="drawer-title-label" htmlFor={`task-title-${taskItem.id}`}>Título da tarefa</label>
                <button
                  className={`task-visibility-button ${form.restrictedVisibility ? "is-active" : ""}`}
                  type="button"
                  onClick={() => set("restrictedVisibility", !form.restrictedVisibility)}
                  aria-label={form.restrictedVisibility ? "Mostrar tarefa para todos" : "Mostrar tarefa somente para responsáveis e criador"}
                  aria-pressed={Boolean(form.restrictedVisibility)}
                  title={form.restrictedVisibility ? "Mostrar para todos" : "Restringir aos responsáveis e criador"}
                >
                  {form.restrictedVisibility ? <EyeOff key="restricted" size={17} /> : <Eye key="public" size={17} />}
                </button>
              </div>
              <input
                id={`task-title-${taskItem.id}`}
                value={form.title}
                onChange={(event) => set("title", event.target.value)}
                placeholder="Escreva o título da tarefa"
                aria-label="Título da tarefa"
              />
            </div>
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
            <div className="drawer-status-priority-grid">
              <div className="status-field">
                <span className="status-field-label">Status</span>
                <StatusPicker value={form.status} onChange={setTaskStatus} />
              </div>
              <div className="priority-field">
                <span className="priority-field-label">Prioridade</span>
                <PriorityPicker
                  value={form.priority}
                  onChange={(value) => set("priority", value)}
                  includeUrgent
                />
              </div>
            </div>
            <div className="drawer-assignment-deadline-grid">
              <AssignmentFields form={form} setForm={setForm} employees={state.employees} teams={teams} />
              <label className="deadline-field">
                Prazo
                <DateInput
                  type="date"
                  value={form.dueDate || ""}
                  onChange={(event) => set("dueDate", event.target.value)}
                  title={currentDeadlineRole === "viewer" ? "Qualquer usuário pode alterar; informe o motivo" : ""}
                />
              </label>
            </div>
          </div>
          {form.status === "waiting" && (
            <WaitingContextFields
              value={form.waitingContext}
              onChange={(value) => set("waitingContext", value)}
              employees={state.employees}
              teams={teams}
              error={validationError && !waitingValidation.allowed ? validationError : ""}
            />
          )}
          <section className="drawer-section execution-section" aria-label="Execução atual">
            <div className="drawer-section-heading">
              <h3>Execução atual</h3>
              {executionActor && <span className="section-count"><Play size={11} aria-hidden="true" /></span>}
            </div>
            {executionActor ? (
              <div className="execution-summary" title={formatCommentTimestamp(executionActor.occurredAt)}>
                <Avatar name={executionActor.name} small />
                <div>
                  <strong>Em andamento por {executionActor.name}</strong>
                  <small>Iniciada {formatRelativeTimestamp(executionActor.occurredAt)} · {formatCommentTimestamp(executionActor.occurredAt)}</small>
                </div>
              </div>
            ) : (
              <div className="empty-inline">Nenhum executor identificado para a execução atual.</div>
            )}
          </section>
          {dueDateChanged && currentDeadlineRole !== "creator" && (
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
          {validationError && (form.status !== "waiting" || waitingValidation.allowed) && (
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
          <TaskReturnsSection task={taskItem} currentEmployee={currentEmployee} loadAttachmentContent={loadAttachmentContent} onDeleteAttachment={onDeleteAttachment} />
          <section className="drawer-section">
            <div className="drawer-section-heading">
              <h3>{isQuoteTask(taskItem) ? "Checklist" : taskItem.checklist?.length && !subtasks.length ? "Checklist do Planner" : "Subtarefas"}</h3>
              <div className="drawer-heading-actions">
                {!isQuoteTask(taskItem) && <label className="checklist-visibility-toggle">
                  <input
                    type="checkbox"
                    checked={showChecklistOnCard}
                    aria-label="Mostrar subtarefas no quadro"
                    onChange={(event) =>
                      onToggleChecklistOnCard(event.target.checked)
                    }
                  />
                  <span>Mostrar no quadro</span>
                </label>}
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setIsAddingSubtask(true)}
                >
                  <Plus size={14} />
                  {isQuoteTask(taskItem) ? "Adicionar item" : "Adicionar"}
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
                  placeholder={isQuoteTask(taskItem) ? "Digite o item do checklist" : "Digite o título da subtarefa"}
                  aria-label={isQuoteTask(taskItem) ? "Item do checklist" : "Título da subtarefa"}
                />
                <button
                  className="subtask-inline-action"
                  type="button"
                  onClick={submitSubtask}
                  disabled={!newSubtaskTitle.trim()}
                  aria-label={isQuoteTask(taskItem) ? "Salvar item do checklist" : "Salvar subtarefa"}
                >
                  <Check size={15} />
                </button>
              </div>
            )}
            {taskItem.checklist?.length && !subtasks.length
              ? <div className="subtask-list" aria-label="Checklist importado do Planner">
                  {taskItem.checklist.filter((item) => item?.title).map((item) => {
                    const content = <><span className="subtask-toggle" aria-hidden="true"><span className={`subtask-check ${item.done ? "checked" : ""}`}>{item.done && <Check size={13} />}</span></span><span>{item.title}</span></>;
                    return isQuoteTask(taskItem)
                      ? <button className={`subtask-row ${item.done ? "is-complete" : ""}`} type="button" key={item.id} onClick={() => onSave(taskItem.id, { checklist: taskItem.checklist.map((checkItem) => checkItem.id === item.id ? { ...checkItem, done: !checkItem.done } : checkItem) })}>{content}</button>
                      : <div className={`subtask-row ${item.done ? "is-complete" : ""}`} key={item.id}>{content}</div>;
                  })}
                </div>
              : subtasks.length
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
                    {subtaskToDelete?.id === subtask.id ? (
                      <div
                        className="subtask-remove-confirm"
                        role="group"
                        aria-label={`Confirmar remoção de ${subtask.title}`}
                      >
                        <button
                          className="button button-danger"
                          type="button"
                          onClick={() => {
                            setSubtaskToDelete(null);
                            onDelete(subtask.id);
                          }}
                        >
                          Remover
                        </button>
                        <button
                          className="button button-quiet"
                          type="button"
                          onClick={() => setSubtaskToDelete(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
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
                    )}
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
                <h3>Comentários</h3>
                <span className="section-count">{comments.length}</span>
              </div>
              <span className="comment-section-helper">Mensagens da equipe</span>
            </div>
            {olderCommentsCount > 0 && (
              <button
                type="button"
                className="comment-history-toggle"
                onClick={expandComments}
              >
                <ChevronUp size={14} aria-hidden="true" />
                Mostrar {olderCommentsCount} {olderCommentsLabel}
              </button>
            )}
            {comments.length ? visibleComments.map((item, index) => (
              <article
                className={`comment-row ${showAllComments && index < olderCommentsCount ? "comment-row-history" : ""} ${isOwnComment(item) ? "comment-own" : ""} ${item.syncStatus === "syncing" ? "item-syncing" : ""}`}
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
              <div className="comment-mention-field">
                <MentionableField
                  value={comment}
                  onChange={setComment}
                  employees={state.employees}
                  multiline
                  onSubmit={submitComment}
                  aria-label="Nova atualização da tarefa"
                  placeholder="O que a equipe precisa saber?"
                  maxLength={1000}
                  rows="2"
                />
              </div>
              <div className="comment-compose-footer">
                <button className="button button-secondary comment-submit" aria-label="Enviar comentário" title="Enviar comentário" disabled={!comment.trim()} onClick={submitComment}>
                  <Send size={14} aria-hidden="true" />
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
              <button className="history-toggle" type="button" onClick={() => setShowHistory((current) => !current)} aria-expanded={showHistory}>
                <span className="history-heading"><strong>Histórico da tarefa</strong><small>Alterações registradas nesta tarefa</small></span>
                <span className="section-count">{history.length}</span>
                {showHistory ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
              </button>
            </div>
            {showHistory && (
              history.length ? <div className="task-history-list">
                {visibleHistory.map((item, index) => {
                  const details = taskHistoryDetails(item, state.employees);
                  const date = new Date(item.createdAt);
                  const day = Number.isNaN(date.getTime()) ? "Data não informada" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
                  const previous = visibleHistory[index - 1];
                  const previousDate = previous && new Date(previous.createdAt);
                  const previousDay = previousDate && !Number.isNaN(previousDate.getTime()) ? previousDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "Data não informada";
                  return <React.Fragment key={item.id || `${item.createdAt}-${index}`}>
                    {day !== previousDay && <div className="task-history-day">{day}</div>}
                    <div className="task-history-event">
                      <span className="task-history-marker" aria-hidden="true" />
                      <div className="task-history-content">
                        <p>{details.title}</p>
                        {details.before !== undefined && <div className="task-history-change"><span>{details.before}</span><ChevronRight size={13} aria-hidden="true" /><strong>{details.after}</strong></div>}
                        {details.detail && <div className="task-history-detail">{details.detail}</div>}
                        <div className="task-history-meta"><span>{item.author || "Sistema"}</span><time dateTime={item.createdAt || undefined}>{Number.isNaN(date.getTime()) ? "Horário não informado" : date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time></div>
                      </div>
                    </div>
                  </React.Fragment>;
                })}
                {history.length > 5 && <button className="task-history-more" type="button" onClick={() => setShowAllHistory((current) => !current)}>{showAllHistory ? "Mostrar menos" : `Mostrar mais ${history.length - 5} alterações`}</button>}
              </div> : <div className="task-history-empty">Nenhuma alteração registrada nesta tarefa.</div>
            )}
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
            onClick={() => handleSave()}
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
        {showUnassignedPrompt && (
          <UnassignedTaskDialog
            taskTitle={taskItem.title}
            missingResponsible={!hasTaskResponsible(resolveTaskAssignment(
              { ...form, assigneeNames: form.assigneeName },
              teams,
              state.employees,
            ))}
            missingDueDate={!String(form.dueDate || "").trim()}
            onCancel={() => setShowUnassignedPrompt(false)}
            onConfirm={() => {
              setShowUnassignedPrompt(false);
              handleSave(true);
            }}
          />
        )}
        {showQuoteCompletionPrompt && (
          <QuoteCompletionDialog
            quote={(state.quotes || []).find((item) => item.id === taskItem.quoteId)}
            onCancel={() => setShowQuoteCompletionPrompt(false)}
            onConfirm={(completion) => handleSave(true, completion).then((success) => { if (success) setShowQuoteCompletionPrompt(false); return success; })}
          />
        )}
        {showDeletePrompt && (
          <DeleteTaskDialog
            taskTitle={taskItem.title}
            onCancel={onCancelDelete}
            onConfirm={onConfirmDelete}
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

function WaitingStatusModal({ task, employees = [], teams = [], onClose, onSave }) {
  const [waitingContext, setWaitingContext] = useState(() =>
    normalizeWaitingContext(task?.waitingContext),
  );
  const [validationError, setValidationError] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const closeButtonRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && saveState === "idle") {
        event.stopPropagation();
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, saveState]);

  if (!task) return null;

  const handleSave = () => {
    if (saveState !== "idle") return;
    const waitingValidation = validateWaitingContext("waiting", waitingContext);
    if (!waitingValidation.allowed) {
      setValidationError(waitingValidation.error);
      return;
    }
    setValidationError("");
    setSaveState("saving");
    Promise.resolve(onSave(task.id, waitingContext))
      .then((success) => {
        if (success) {
          onClose();
          return;
        }
        setSaveState("idle");
        setValidationError("Não foi possível salvar a tarefa. Tente novamente.");
      })
      .catch(() => {
        setSaveState("idle");
        setValidationError("Não foi possível salvar a tarefa. Tente novamente.");
      });
  };

  return (
    <div
      className="waiting-status-modal-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && saveState === "idle") onClose();
      }}
    >
      <section
        className="waiting-status-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="waiting-status-modal-header">
          <div className="waiting-status-modal-heading">
            <span className="waiting-status-modal-icon" aria-hidden="true">
              <Clock3 size={19} />
            </span>
            <div>
              <span className="eyebrow">Alterar status</span>
              <h2 id={titleId}>Mover para Aguardando</h2>
              <p>{task.title}</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Fechar alteração de status"
            disabled={saveState !== "idle"}
          >
            <X size={18} />
          </button>
        </header>
        <div className="waiting-status-modal-body">
          <p className="waiting-status-modal-intro">
            Preencha o contexto para deixar claro de quem depende o próximo passo.
          </p>
          <WaitingContextFields
            value={waitingContext}
            onChange={setWaitingContext}
            employees={employees}
            teams={teams}
            error={validationError}
          />
        </div>
        <footer className="waiting-status-modal-footer">
          <button
            className="button button-secondary"
            type="button"
            onClick={onClose}
            disabled={saveState !== "idle"}
          >
            Cancelar
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={handleSave}
            disabled={saveState !== "idle"}
          >
            {saveState === "saving" ? "Salvando…" : "Salvar e mover"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function WaitingReturnModal({ task, onClose, onSave }) {
  const [text, setText] = useState("");
  const [draftAttachments, setDraftAttachments] = useState([]);
  const [validationError, setValidationError] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const closeButtonRef = useRef(null);
  const draftAttachmentsRef = useRef([]);
  const textRef = useRef(null);
  const titleId = useId();
  draftAttachmentsRef.current = draftAttachments;

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && saveState === "idle") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, saveState]);

  useEffect(
    () => () => draftAttachmentsRef.current.forEach(releaseDraftAttachment),
    [],
  );

  if (!task) return null;

  const handleDraftAttachment = (id, filesOrFile) =>
    setDraftAttachments((current) => [
      ...current,
      ...toAttachmentFiles(filesOrFile).map((file) =>
        createDraftAttachment(file, "waiting-return"),
      ),
    ]);

  const handleDraftAttachmentDelete = (id, attachment) => {
    releaseDraftAttachment(attachment);
    setDraftAttachments((current) =>
      current.filter((item) => item.id !== attachment.id),
    );
  };

  const handlePaste = (event) => {
    const files = filesFromClipboard(event);
    if (!files.length) return;
    event.preventDefault();
    handleDraftAttachment("paste", files);
  };

  const handleSave = () => {
    if (saveState !== "idle") return;
    const returnText = text.trim();
    if (!returnText) {
      setValidationError("Informe o retorno recebido.");
      textRef.current?.focus();
      return;
    }
    setValidationError("");
    setSaveState("saving");
    Promise.resolve(
      onSave(task.id, {
        text: returnText,
        files: draftAttachments.map((attachment) => attachment.file).filter(Boolean),
      }),
    )
      .then((success) => {
        if (success) {
          onClose();
          return;
        }
        setSaveState("idle");
        setValidationError("Não foi possível registrar o retorno. Tente novamente.");
      })
      .catch((failure) => {
        setSaveState("idle");
        setValidationError(failure.message || "Não foi possível registrar o retorno. Tente novamente.");
      });
  };

  return (
    <div
      className="waiting-status-modal-layer waiting-return-modal-layer"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && saveState === "idle") onClose();
      }}
    >
      <section
        className="waiting-status-modal waiting-return-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onPaste={handlePaste}
      >
        <header className="waiting-status-modal-header">
          <div className="waiting-status-modal-heading">
            <span className="waiting-status-modal-icon waiting-return-modal-icon" aria-hidden="true">
              <CheckCircle2 size={19} />
            </span>
            <div>
              <span className="eyebrow">Atualizar andamento</span>
              <h2 id={titleId}>Registrar retorno</h2>
              <p>{task.title}</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Fechar registro de retorno"
            disabled={saveState !== "idle"}
          >
            <X size={18} />
          </button>
        </header>
        <div className="waiting-status-modal-body waiting-return-modal-body">
          <div className="waiting-return-context">
            <span>Contexto de Aguardando</span>
            <strong>{waitingContextSummary(task.waitingContext) || "Nenhum contexto detalhado foi informado."}</strong>
          </div>
          <label className="waiting-return-field">
            <span>O que foi retornado?</span>
            <textarea
              ref={textRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Descreva o retorno recebido e o que muda na tarefa."
              maxLength={1000}
              rows="5"
              aria-invalid={Boolean(validationError)}
            />
          </label>
          {validationError && <div className="field-error" role="alert">{validationError}</div>}
          <AttachmentSection
            taskId="waiting-return"
            attachments={draftAttachments}
            onAttachment={handleDraftAttachment}
            onDeleteAttachment={handleDraftAttachmentDelete}
            helperText="Anexe um comprovante ou outra evidência, se necessário."
          />
        </div>
        <footer className="waiting-status-modal-footer">
          <button
            className="button button-secondary"
            type="button"
            onClick={onClose}
            disabled={saveState !== "idle"}
          >
            Cancelar
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={handleSave}
            disabled={saveState !== "idle"}
          >
            {saveState === "saving" ? <><LoaderCircle size={16} className="spin" /> Salvando…</> : <><Check size={16} /> Registrar retorno</>}
          </button>
        </footer>
      </section>
    </div>
  );
}

function InlineSubtasksEditor({ items, setItems }) {
  const [draft, setDraft] = useState("");
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState(null);
  const add = () => {
    const title = draft.trim();
    if (!title) return;
    setItems((current) => [...current, title]);
    setDraft("");
  };
  return (
    <section className="creation-subtasks" data-empty={items.length === 0 ? "true" : "false"}>
      <div className="drawer-section-heading">
        <h3>Subtarefas</h3>
        <span className="section-hint">opcional</span>
      </div>
      {items.map((title, index) => (
        <div className="creation-subtask-row" key={`${title}-${index}`}>
          <span className="subtask-check" aria-hidden="true" />
          <span>{title}</span>
          {pendingDeleteIndex === index ? (
            <div
              className="subtask-remove-confirm"
              role="group"
              aria-label={`Confirmar remoção de ${title}`}
            >
              <button
                className="button button-danger"
                type="button"
                onClick={() => {
                  setItems((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  );
                  setPendingDeleteIndex(null);
                }}
              >
                Remover
              </button>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => setPendingDeleteIndex(null)}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              className="subtask-delete creation-subtask-delete"
              type="button"
              onClick={() => setPendingDeleteIndex(index)}
              aria-label={`Remover subtarefa ${title}`}
              title="Remover subtarefa"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ))}
      <div className="creation-subtask-input">
        <span className="subtask-check" aria-hidden="true" />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="Adicionar subtarefa"
          aria-label="Título da subtarefa"
        />
        <button
          className="subtask-inline-action"
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          aria-label="Adicionar subtarefa"
        >
          <Plus size={14} />
        </button>
      </div>
    </section>
  );
}

function NewTaskDrawer({ employees = [], teams = [], personalTags = [], tasks = [], onCreatePersonalTag, initialStatus = "todo", initialInput = {}, onClose, onSave }) {
  const [form, setForm] = useState({
    title: "",
    status: initialStatus,
    priority: "medium",
    assignmentMode: "team",
    teamIds: [],
    teamNames: [],
    teamId: "",
    assigneeName: [],
    assigneeIds: [],
    primaryAssigneeId: "",
    consultantIds: [],
    teamName: "",
    restrictedVisibility: true,
    dueDate: "",
    description: "",
    waitingContext: { ...EMPTY_WAITING_CONTEXT },
    ...initialInput,
    personalTagIds: normalizePersonalTagIds(initialInput.personalTagIds),
  });
  const [draftAttachments, setDraftAttachments] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const initialFormRef = useRef(form);
  const draftAttachmentsRef = useRef([]);
  draftAttachmentsRef.current = draftAttachments;
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const [showUnassignedPrompt, setShowUnassignedPrompt] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [validationError, setValidationError] = useState("");
  const [saveProgress, setSaveProgress] = useState({
    label: "Criando tarefa…",
    detail: "Preparando dados",
    current: 0,
    total: 1,
  });
  const saveCloseTimerRef = useRef(null);
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
    ) || draftAttachments.length > 0 || subtasks.length > 0;
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
  const handlePaste = (event) => {
    const files = filesFromClipboard(event);
    if (!files.length) return;
    event.preventDefault();
    handleDraftAttachment("paste", files);
  };
  const handleDraftAttachmentDelete = (id, attachment) => {
    releaseDraftAttachment(attachment);
    setDraftAttachments((current) =>
      current.filter((item) => item.id !== attachment.id),
    );
  };
  const handleCreate = (allowUnassigned = false) => {
    if (saveState !== "idle" || !form.title.trim()) return;
    const waitingValidation = validateWaitingContext(form.status, form.waitingContext);
    if (!waitingValidation.allowed) {
      setValidationError(waitingValidation.error);
      return;
    }
    const assignment = resolveTaskAssignment(form, teams, employees);
    const missingResponsible = !hasTaskResponsible(assignment);
    const missingDueDate = !String(form.dueDate || "").trim();
    if (!allowUnassigned && (missingResponsible || missingDueDate)) {
      setShowUnassignedPrompt(true);
      return;
    }
    setValidationError("");
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
          subtasks,
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
        <div className="drawer-body" onPaste={handlePaste}>
          <section className="drawer-personal-tags" aria-label="Minhas tags">
            <PersonalTagPicker tags={personalTags} tasks={tasks} value={form.personalTagIds || []} onChange={(value) => set("personalTagIds", value)} onCreate={onCreatePersonalTag} showAllTags />
          </section>
          <div className="drawer-title">
            <div className="drawer-title-field">
              <div className="drawer-title-label-row">
                <label className="drawer-title-label" htmlFor="new-task-title">Título da tarefa</label>
                <button
                  className={`task-visibility-button ${form.restrictedVisibility ? "is-active" : ""}`}
                  type="button"
                  onClick={() => set("restrictedVisibility", !form.restrictedVisibility)}
                  aria-label={form.restrictedVisibility ? "Mostrar tarefa para todos" : "Mostrar tarefa somente para responsáveis e criador"}
                  aria-pressed={Boolean(form.restrictedVisibility)}
                  title={form.restrictedVisibility ? "Mostrar para todos" : "Restringir aos responsáveis e criador"}
                >
                  {form.restrictedVisibility ? <EyeOff key="restricted" size={17} /> : <Eye key="public" size={17} />}
                </button>
              </div>
              <input
                id="new-task-title"
                autoFocus
                value={form.title}
                onChange={(event) => set("title", event.target.value)}
                placeholder="Ex.: Confirmar motorista"
                aria-label="Título da tarefa"
              />
            </div>
          </div>
          <div className="drawer-field-grid new-task-quick-fields">
            <div className="drawer-status-priority-grid">
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
                  includeUrgent
                />
              </div>
            </div>
            <div className="drawer-assignment-deadline-grid">
              <AssignmentFields form={form} setForm={setForm} employees={employees} teams={teams} />
              <label className="deadline-field">
                Prazo
                <DateInput
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => set("dueDate", event.target.value)}
                />
              </label>
            </div>
          </div>
          {form.status === "waiting" && (
            <WaitingContextFields
              value={form.waitingContext}
              onChange={(value) => set("waitingContext", value)}
              employees={employees}
              teams={teams}
              error={validationError}
            />
          )}
          {validationError && form.status !== "waiting" && (
            <div className="field-error" role="alert">{validationError}</div>
          )}
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
          <InlineSubtasksEditor items={subtasks} setItems={setSubtasks} />
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
            onClick={() => handleCreate()}
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
        {showUnassignedPrompt && (
          <UnassignedTaskDialog
            isCreation
            missingResponsible={!hasTaskResponsible(resolveTaskAssignment(form, teams, employees))}
            missingDueDate={!String(form.dueDate || "").trim()}
            onCancel={() => setShowUnassignedPrompt(false)}
            onConfirm={() => {
              setShowUnassignedPrompt(false);
              handleCreate(true);
            }}
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
  const navigationWindowRef = useRef(plannerNavigationWindow(window));
  const initialUrlStateRef = useRef(readPlannerUrlState(navigationWindowRef.current.location.search));
  const [active, setActive] = useState(initialUrlStateRef.current.view);
  const [readyView, setReadyView] = useState(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setReadyView(active), 180);
    return () => window.clearTimeout(timer);
  }, [active]);
  const [store] = useState(() => createDataStore());
  const [state, setState] = useState(() => ({
    tasks: [],
    contacts: [],
    contactLoading: true,
    contactLoadError: "",
    quotes: [],
    employees: [],
    teams: [],
    currentUserEmail: "",
    currentUserId: "",
    personalTags: [],
    quality: [],
    notifications: [],
    collectionEvents: [],
    live: store.live,
    loading: { core: true, quotes: true, quality: true, photos: true },
    loadErrors: {},
  }));
  const currentEmployee = resolveCurrentEmployee(
    state.employees,
    store.live,
    state.currentUserEmail,
  );
  const showManagement = canViewManagement(state.currentUserEmail);
  const [selectedId, setSelectedId] = useState(initialUrlStateRef.current.taskId);
  const [quoteToOpenId, setQuoteToOpenId] = useState(initialUrlStateRef.current.quoteId);
  const [selectedContactId, setSelectedContactId] = useState(initialUrlStateRef.current.contactId);
  const [waitingTaskId, setWaitingTaskId] = useState("");
  const [waitingQuoteId, setWaitingQuoteId] = useState("");
  const [waitingReturnTaskId, setWaitingReturnTaskId] = useState("");
  const [creating, setCreating] = useState(false);
  const [creatingStatus, setCreatingStatus] = useState("todo");
  const [creatingInput, setCreatingInput] = useState({});
  const [filters, setFilters] = useState(createDefaultFilters);
  const [taskScope, setTaskScope] = useState("mine");
  const [checklistVisibility, setChecklistVisibility] = useState(
    readChecklistVisibility,
  );
  const [notice, setNotice] = useState("");
  const [noticeAction, setNoticeAction] = useState(null);
  const [error, setError] = useState("");
  const [failedTaskDraft, setFailedTaskDraft] = useState(null);
  const [pendingTaskDraft, setPendingTaskDraft] = useState(null);
  const [pendingUnassignedCreate, setPendingUnassignedCreate] = useState(null);
  const [quoteCompletionRequest, setQuoteCompletionRequest] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const confirmedStateRef = useRef(null);
  const pendingMutationsRef = useRef(new Map());
  const refreshInFlightRef = useRef(false);
  const noticeTimerRef = useRef(null);
  const launchHandledRef = useRef(false);
  const urlStateRef = useRef(initialUrlStateRef.current);
  const handlingHistoryRef = useRef(false);
  const failedTaskReopenTimerRef = useRef(null);
  useEffect(() => {
    const navigationWindow = navigationWindowRef.current;
    const handlePopState = () => {
      const next = readPlannerUrlState(navigationWindow.location.search);
      handlingHistoryRef.current = true;
      urlStateRef.current = next;
      setActive(next.view);
      setSelectedId(next.taskId);
      setSelectedContactId(next.contactId);
      setQuoteToOpenId(next.quoteId);
    };
    navigationWindow.addEventListener("popstate", handlePopState);
    return () => navigationWindow.removeEventListener("popstate", handlePopState);
  }, []);
  useEffect(() => {
    const next = { view: active, taskId: selectedId, contactId: selectedContactId, quoteId: quoteToOpenId };
    if (
      next.view === urlStateRef.current.view &&
      next.taskId === urlStateRef.current.taskId &&
      next.contactId === urlStateRef.current.contactId &&
      next.quoteId === urlStateRef.current.quoteId
    ) {
      handlingHistoryRef.current = false;
      return;
    }
    urlStateRef.current = next;
    if (handlingHistoryRef.current) {
      handlingHistoryRef.current = false;
      return;
    }
    const navigationWindow = navigationWindowRef.current;
    navigationWindow.history.pushState(navigationWindow.history.state, "", plannerUrlForState(navigationWindow.location, next));
  }, [active, selectedId, selectedContactId, quoteToOpenId]);
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
  const defaultEmployee = resolveCurrentEmployee(
    state.employees,
    store.live,
    state.currentUserEmail,
  );
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
      const [supplemental, photos, contacts] = await Promise.allSettled([
        store.loadSupplemental(core),
        store.loadPhotos(core),
        store.loadContacts ? store.loadContacts(core) : Promise.resolve(core.contacts || []),
      ]);
      const current = confirmedStateRef.current || {};
      const patch = buildBackgroundRefreshPatch(
        current,
        core,
        { supplemental, photos, contacts },
      );
      patch.loadErrors = {
        ...(current.loadErrors || {}),
        ...(supplemental.status === "rejected"
          ? { supplemental: supplemental.reason?.message || "Dados complementares indisponíveis." }
          : { supplemental: undefined }),
        ...(photos.status === "rejected"
          ? { photos: photos.reason?.message || "Fotos indisponíveis." }
          : { photos: undefined }),
        ...(contacts.status === "rejected"
          ? { contactLoadError: contacts.reason?.message || "Contatos indisponíveis." }
          : { contactLoadError: undefined }),
      };
      mergeConfirmed(patch);
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
        (store.loadContacts ? store.loadContacts(core) : Promise.resolve(core.contacts || []))
          .then((contacts) => { if (activeRequest) mergeConfirmed({ contacts, contactLoading: false, contactLoadError: "" }); })
          .catch((failure) => {
            if (activeRequest) mergeConfirmed({ contactLoading: false, contactLoadError: failure.message || "Contatos indisponíveis." });
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
  const ensureTaskDetails = useCallback((taskId) => {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!taskId || !task || !isTaskVisibleToEmployee(task, currentEmployee, state.teams) || task.detailsLoaded || task.detailsLoading || !store.loadTaskDetails) return Promise.resolve(false);
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((item) => item.id === taskId ? { ...item, detailsLoading: true, detailsError: "" } : item),
    }));
    return store.loadTaskDetails(taskId)
      .then((details) => setState((current) => ({
        ...current,
        tasks: current.tasks.map((item) => item.id === taskId ? { ...item, ...details, detailsLoaded: true, detailsLoading: false, detailsError: "" } : item),
      })))
      .catch((failure) => setState((current) => ({
        ...current,
        tasks: current.tasks.map((item) => item.id === taskId ? { ...item, detailsLoading: false, detailsError: failure.message || "Não foi possível carregar o histórico." } : item),
      })));
  }, [currentEmployee, state.tasks, state.teams, store]);
  useEffect(() => {
    const task = state.tasks.find((item) => item.id === selectedId);
    if (!selectedId || !task || !isTaskVisibleToEmployee(task, currentEmployee, state.teams) || task.detailsLoaded || task.detailsLoading || !store.loadTaskDetails) return;
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((item) => item.id === selectedId ? { ...item, detailsLoading: true } : item),
    }));
    store.loadTaskDetails(selectedId)
      .then((details) => setState((current) => ({
        ...current,
        tasks: current.tasks.map((item) => item.id === selectedId ? { ...item, ...details, detailsLoaded: true, detailsLoading: false } : item),
      })))
      .catch((failure) => setState((current) => ({
        ...current,
        tasks: current.tasks.map((item) => item.id === selectedId ? { ...item, detailsLoading: false, detailsError: failure.message || "Não foi possível carregar o histórico." } : item),
      })));
  }, [currentEmployee, selectedId, state.tasks, state.teams, store]);
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
    const search = navigationWindowRef.current.location.search;
    const { taskId } = readPlannerUrlState(search);
    const params = new URLSearchParams(search);
    const data = new URLSearchParams((params.get("data") || "").replace(/^\?/, ""));
    const mode = params.get("mode") || data.get("mode") || "";
    const quoteSourceId = launchQuoteId(search);
    if (taskId) setSelectedId(taskId);
    if (quoteSourceId) {
      const openExistingOrCreate = (quote) =>
        Promise.resolve(store.ensureQuoteTask(state, quote))
          .then((next) => {
            confirmedStateRef.current = next;
            setState(applyPendingMutations(next));
            const task = next.tasks.find(
              (item) => item.quoteId === quote.id && !item.parentTaskId,
            );
            if (task) setSelectedId(task.id);
          })
          .catch((failure) =>
            showNotice(
              failure.message ||
                "Não foi possível abrir o acompanhamento da cotação.",
              5200,
            ),
          );
      const knownQuote = state.quotes.find((item) => item.id === quoteSourceId);
      if (knownQuote) {
        openExistingOrCreate(knownQuote);
      } else if (store.searchQuotes) {
        store
          .searchQuotes(quoteSourceId)
          .then((found) => {
            const quote = found.find((item) => item.id === quoteSourceId) || found[0];
            if (quote) return openExistingOrCreate(quote);
            showNotice("Cotação de origem não encontrada.", 5200);
          })
          .catch(() => showNotice("Cotação de origem não encontrada.", 5200));
      } else {
        showNotice("Cotação de origem não encontrada.", 5200);
      }
    } else if (mode === "create") {
      setCreating(true);
    }
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
    if (!taskItem || !isTaskVisibleToEmployee(taskItem, currentEmployee, state?.teams)) return undefined;
    const failedPatch = failedTaskDraft?.id === taskItem.id ? failedTaskDraft.patch : null;
    const pendingPatch = pendingTaskDraft?.id === taskItem.id ? pendingTaskDraft.patch : null;
    return failedPatch || pendingPatch
      ? { ...taskItem, ...pendingPatch, ...failedPatch, syncStatus: undefined }
      : taskItem;
  }, [currentEmployee, state, selectedId, failedTaskDraft, pendingTaskDraft]);
  const markTaskNotificationsRead = useCallback((taskId) => {
    if (!taskId || !store.markNotificationRead) return;
    const unread = (state.notifications || []).filter((item) => item.taskId === taskId && !item.readAt);
    if (!unread.length) return;
    const optimisticReadAt = new Date().toISOString();
    const unreadIds = new Set(unread.map((item) => item.id));
    setState((current) => ({
      ...current,
      notifications: (current.notifications || []).map((item) => unreadIds.has(item.id) ? { ...item, readAt: item.readAt || optimisticReadAt } : item),
    }));
    Promise.all(unread.map((item) => store.markNotificationRead(state, item.id)))
      .then(() => undefined)
      .catch((failure) => {
        setState((current) => ({
          ...current,
          notifications: (current.notifications || []).map((item) => unreadIds.has(item.id) && item.readAt === optimisticReadAt ? { ...item, readAt: "" } : item),
        }));
        showNotice(`Falha ao atualizar notificações: ${failure.message}`);
      });
  }, [state, store, showNotice]);
  const openTask = useCallback((id) => {
    const task = state.tasks.find((item) => item.id === id);
    if (task && !isTaskVisibleToEmployee(task, currentEmployee, state.teams)) {
      showNotice("Esta tarefa não está disponível para este usuário.", 3600);
      return;
    }
    markTaskNotificationsRead(id);
    setSelectedContactId("");
    setQuoteToOpenId("");
    setSelectedId(id);
  }, [currentEmployee, markTaskNotificationsRead, showNotice, state.tasks, state.teams]);
  const openContact = useCallback((id) => {
    setSelectedId("");
    setQuoteToOpenId("");
    setActive("contacts");
    setSelectedContactId(id);
  }, []);
  const closeTask = useCallback(() => {
    setSelectedId("");
    setPendingTaskDraft(null);
  }, []);
  const requestQuoteCompletion = useCallback((task, commit) => new Promise((resolve) => {
    const quote = (state.quotes || []).find((item) => item.id === task.quoteId);
    if (!quote) { showNotice("Cotação vinculada não encontrada."); resolve(false); return; }
    setQuoteCompletionRequest({
      quote,
      onConfirm: async (completion) => {
        const success = await commit(completion);
        if (success) { setQuoteCompletionRequest(null); resolve(true); }
        return success;
      },
      onCancel: () => { setQuoteCompletionRequest(null); resolve(false); },
    });
  }), [state.quotes, showNotice]);
  const closeContact = useCallback(() => setSelectedContactId(""), []);
  const openCreate = useCallback((status = "todo", initialInput = {}) => {
    const nextStatus = STATUSES.some((item) => item.id === status)
      ? status
      : "todo";
    setCreatingStatus(nextStatus);
    setCreatingInput(initialInput);
    setCreating(true);
  }, []);
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
    (id, value, groupBy = "status") => {
      const task = state.tasks.find((item) => item.id === id);
      if (!task) return Promise.resolve(false);
      let patch = { status: value };
      let successMessage = "Status atualizado.";
      if (groupBy === "team") {
        const team = (state.teams || []).find((item) => normalizeText(item.name) === normalizeText(value));
        if (!team) return Promise.resolve(false);
        patch = resolveTaskAssignment({ assignmentMode: "team", teamIds: [team.id] }, state.teams || [], state.employees || []);
        successMessage = "Equipe atualizada.";
      } else if (groupBy === "assignee") {
        const employee = (state.employees || []).find((item) => normalizeText(item.name) === normalizeText(value));
        patch = resolveTaskAssignment({ assignmentMode: "people", assigneeIds: employee ? [employee.id] : [] }, state.teams || [], state.employees || []);
        successMessage = "Responsável atualizado.";
      } else if (groupBy === "priority") {
        patch = { priority: value };
        successMessage = "Prioridade atualizada.";
      } else if (groupBy === "personalTag") {
        patch = { personalTagIds: value === "__none__" ? [] : [value] };
        successMessage = "Tag atualizada.";
      }
      const persist = async () => {
        const { personalTagIds, ...taskPatch } = patch;
        const nextState = Object.keys(taskPatch).length
          ? await store.updateTask(state, id, taskPatch)
          : state;
        return personalTagIds !== undefined && store.replaceTaskPersonalTags
          ? store.replaceTaskPersonalTags(nextState, id, personalTagIds, state.currentUserId || currentEmployee?.userId || "")
          : nextState;
      };
      const isCompleting = groupBy === "status" && value === "done" && task.status !== "done";
      if (groupBy === "status" && value === "waiting" && task.status !== "waiting") {
        const waitingValidation = validateWaitingContext("waiting", task.waitingContext);
        if (!waitingValidation.allowed) {
          setWaitingTaskId(id);
          return Promise.resolve(false);
        }
      }
      const quoteCompletion = isCompleting && isQuoteTask(task) && !task.parentTaskId;
      const complete = (completion) => {
        if (completion) patch = { ...patch, ...completion };
        if (isCompleting) prepareCompletionSound();
        return runOptimisticMutation(
          (current) => quoteCompletion ? current : applyOptimisticTaskPatch(current, id, patch),
          persist,
          store.live
            ? `${successMessage} Sincronizando...`
            : `${successMessage} No mock local.`,
          store.live ? `${successMessage} Sincronizada.` : successMessage,
        ).then((success) => {
          if (success && isCompleting) playCompletionSound();
          return success;
        });
      };
      return quoteCompletion ? requestQuoteCompletion(task, complete) : complete();
    },
    [currentEmployee?.userId, state, store, runOptimisticMutation, showNotice, requestQuoteCompletion],
  );
  const createPersonalTag = useCallback(
    (input = {}) => {
      if (!store.createPersonalTag) return Promise.resolve(false);
      const ownerUserId = state.currentUserId || currentEmployee?.userId || "";
      const optimisticId = `optimistic-personal-tag-${Date.now()}`;
      const optimisticTag = { id: optimisticId, name: String(input.name || "").trim().slice(0, 32), color: input.color || DEFAULT_PERSONAL_TAG_COLOR, sortOrder: (state.personalTags || []).length, archived: false, ownerUserId };
      return runOptimisticMutation(
        (current) => ({ ...current, personalTags: [...(current.personalTags || []), optimisticTag] }),
        () => store.createPersonalTag(state, { ...input, ownerUserId }),
        store.live ? "Tag criada. Sincronizando..." : "Tag criada no mock local.",
        store.live ? "Tag sincronizada." : "Tag criada.",
      );
    },
    [currentEmployee?.userId, runOptimisticMutation, state, store],
  );
  const updatePersonalTag = useCallback(
    (id, patch) => {
      if (!store.updatePersonalTag) return Promise.resolve(false);
      return runOptimisticMutation(
        (current) => ({ ...current, personalTags: (current.personalTags || []).map((tag) => tag.id === id ? { ...tag, ...patch } : tag) }),
        () => store.updatePersonalTag(state, id, patch),
        "Atualizando tag...",
        "Tag atualizada.",
      );
    },
    [runOptimisticMutation, state, store],
  );
  const archivePersonalTag = useCallback(
    (id) => {
      if (!store.archivePersonalTag) return Promise.resolve(false);
      return runOptimisticMutation(
        (current) => ({ ...current, personalTags: (current.personalTags || []).map((tag) => tag.id === id ? { ...tag, archived: true } : tag) }),
        () => store.archivePersonalTag(state, id),
        "Arquivando tag...",
        "Tag arquivada.",
      );
    },
    [runOptimisticMutation, state, store],
  );
  const reorderPersonalTags = useCallback(
    (orderedIds) => {
      if (!store.reorderPersonalTags) return Promise.resolve(false);
      const order = new Map(orderedIds.map((id, index) => [id, index]));
      return runOptimisticMutation(
        (current) => ({ ...current, personalTags: (current.personalTags || []).map((tag) => order.has(tag.id) ? { ...tag, sortOrder: order.get(tag.id) } : tag) }),
        () => store.reorderPersonalTags(state, orderedIds),
        "Reordenando tags...",
        "Ordem das tags salva.",
      );
    },
    [runOptimisticMutation, state, store],
  );
  const saveTask = useCallback(
    (id, patch) => {
      const existingTask = state.tasks.find((taskItem) => taskItem.id === id);
      if (existingTask && isQuoteTask(existingTask) && !existingTask.parentTaskId && existingTask.status !== "done" && patch.status === "done" && patch.responseSent === undefined) {
        return requestQuoteCompletion(existingTask, (completion) => saveTask(id, { ...patch, ...completion }));
      }
      const mentionText = [
        patch.title !== existingTask?.title ? patch.title : "",
        patch.description !== existingTask?.description ? patch.description : "",
      ].filter((value) => typeof value === "string").join(" ");
      const nextPatch = {
        ...patch,
        ...(patch.assignmentMode !== undefined || patch.teamIds !== undefined || patch.teamId !== undefined || patch.assigneeIds !== undefined || patch.assigneeNames !== undefined || patch.primaryAssigneeId !== undefined || patch.consultantIds !== undefined
          ? (() => {
              const assignment = resolveTaskAssignment(patch, state.teams || [], state.employees || []);
              return { ...assignment, assigneeName: assignment.assigneeNames.join(", ") };
            })()
          : {}),
        actorEmployeeId: currentEmployee?.id || "",
        actorUserId: currentEmployee?.userId || "",
        actorName: currentEmployee?.name || "Executor não identificado",
        mentionedEmployeeIds: mentionText ? mentionedEmployees(mentionText, state.employees).map((employee) => employee.id) : [],
      };
      const visibilityChanged = Boolean(existingTask)
        && patch.restrictedVisibility !== undefined
        && Boolean(patch.restrictedVisibility) !== Boolean(existingTask.restrictedVisibility);
      const previousVisibility = Boolean(existingTask?.restrictedVisibility);
      const isCompleting = existingTask?.status !== "done" && nextPatch.status === "done";
      if (isCompleting) prepareCompletionSound();
      const shouldReopen = id === selectedId;
      return runOptimisticMutation(
        (current) => isCompleting && isQuoteTask(existingTask) ? current : applyOptimisticTaskPatch(current, id, nextPatch),
        async () => {
      const { personalTagIds: _personalTagIds, ...taskPatch } = nextPatch;
      const nextState = await store.updateTask(state, id, taskPatch);
          return nextPatch.personalTagIds !== undefined && store.replaceTaskPersonalTags
            ? store.replaceTaskPersonalTags(nextState, id, nextPatch.personalTagIds, state.currentUserId || currentEmployee?.userId || "")
            : nextState;
        },
        "",
        "",
      ).then((success) => {
        if (success) {
          if (isCompleting) playCompletionSound();
          setPendingTaskDraft((current) => current?.id === id ? null : current);
          if (shouldReopen)
            setFailedTaskDraft((current) =>
              current?.id === id ? null : current,
            );
          if (visibilityChanged) {
            showNotice(
              nextPatch.restrictedVisibility ? "Tarefa ocultada." : "Tarefa visível para todos.",
              5600,
              {
                label: "Desfazer",
                onClick: () => runOptimisticMutation(
                  (current) => applyOptimisticTaskPatch(current, id, { restrictedVisibility: previousVisibility }),
                  () => store.updateTask(state, id, { restrictedVisibility: previousVisibility }),
                  "",
                  "",
                ),
              },
            );
          }
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
    [currentEmployee, state, store, runOptimisticMutation, selectedId, showNotice, requestQuoteCompletion],
  );
  const waitingTask = useMemo(
    () => state.tasks.find((item) => item.id === waitingTaskId),
    [state.tasks, waitingTaskId],
  );
  const saveWaitingStatus = useCallback(
    (id, waitingContext) =>
      saveTask(id, { status: "waiting", waitingContext }),
    [saveTask],
  );
  const waitingReturnTask = useMemo(
    () => state.tasks.find((item) => item.id === waitingReturnTaskId),
    [state.tasks, waitingReturnTaskId],
  );
  const openWaitingReturn = useCallback(
    (id) => {
      const task = state.tasks.find((item) => item.id === id);
      if (canRegisterWaitingReturn(task, currentEmployee, state.teams)) {
        setWaitingReturnTaskId(id);
      }
    },
    [currentEmployee, state.tasks, state.teams],
  );
  const registerWaitingReturn = useCallback(
    (id, input) => {
      const task = state.tasks.find((item) => item.id === id);
      if (!canRegisterWaitingReturn(task, currentEmployee, state.teams)) {
        showNotice("Você não pode registrar este retorno.", 5200);
        return Promise.resolve(false);
      }
      const mentionedEmployeeIds = mentionedEmployees(input.text, state.employees).map((employee) => employee.id);
      const operationInput = {
        ...input,
        returnId: globalThis.crypto?.randomUUID?.() || `return-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        actorEmployeeId: currentEmployee?.id || "",
        actorUserId: currentEmployee?.userId || "",
        mentionedEmployeeIds,
      };
      return runOptimisticMutation(
        (current) => addOptimisticReturn(
          applyOptimisticTaskPatch(current, id, { status: "doing", actorEmployeeId: currentEmployee?.id || "", actorUserId: currentEmployee?.userId || "", actorName: currentEmployee?.name || "Executor não identificado" }),
          id,
          { id: input.returnId, text: input.text, createdAt: new Date().toISOString(), author: currentEmployee?.name || "Você" },
        ),
        () => store.resolveWaitingReturn(state, id, { ...operationInput, actorName: currentEmployee?.name || "Executor não identificado" }),
        store.live ? "Registrando retorno..." : "Registrando retorno no mock local...",
        store.live ? "Retorno registrado." : "Retorno registrado localmente.",
      ).then((success) => {
        if (success && selectedId === id) setSelectedId("");
        return success;
      });
    },
    [currentEmployee, selectedId, showNotice, state, store, runOptimisticMutation],
  );
  const completeTask = useCallback(
    (id) => {
      const task = state.tasks.find((item) => item.id === id);
      if (!task || ["done", "cancelled"].includes(task.status))
        return Promise.resolve(false);
      if (isQuoteTask(task) && !task.parentTaskId)
        return saveTask(id, { status: "done" });
      const previousPatch = { status: task.status };
      const completePatch = { status: "done" };
      prepareCompletionSound();
      return runOptimisticMutation(
        (current) => applyOptimisticTaskPatch(current, id, { ...completePatch, actorEmployeeId: currentEmployee?.id || "", actorUserId: currentEmployee?.userId || "", actorName: currentEmployee?.name || "Executor não identificado" }),
        () => store.updateTask(state, id, { ...completePatch, actorEmployeeId: currentEmployee?.id || "", actorUserId: currentEmployee?.userId || "", actorName: currentEmployee?.name || "Executor não identificado" }),
        "",
        "",
      ).then((success) => {
        if (!success) return false;
        playCompletionSound();
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
    [state, store, runOptimisticMutation, showNotice, saveTask],
  );
  const collectTask = useCallback(
    (id) => {
      if (!store.collectTask) return Promise.resolve(false);
      const input = { actorEmployeeId: currentEmployee?.id || "", actorUserId: currentEmployee?.userId || "", actorName: currentEmployee?.name || "Você" };
      return runOptimisticMutation(
        (current) => ({ ...current, collectionEvents: [...(current.collectionEvents || []), { taskId: id, referenceDate: localDateKey(), occurredAt: new Date().toISOString(), actorEmployeeId: input.actorEmployeeId }] }),
        () => store.collectTask(state, id, input),
        store.live ? "Enviando cobrança..." : "Registrando cobrança local...",
        store.live ? "Cobrança enviada." : "Cobrança registrada.",
      );
    },
    [currentEmployee, runOptimisticMutation, state, store],
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
  const saveContact = useCallback(
    (input = {}) => {
      const { attachments: draftAttachments = [], ...inputWithoutAttachments } = input;
      const existing = (state.contacts || []).find((item) => item.id === inputWithoutAttachments.id);
      const actor = {
        actorEmployeeId: currentEmployee?.id || "",
        actorUserId: currentEmployee?.userId || "",
        actorName: currentEmployee?.name || "Você",
      };
      const hasAssignment = ["assignmentMode", "teamIds", "teamId", "assigneeIds", "assigneeName", "assigneeNames"]
        .some((key) => inputWithoutAttachments[key] !== undefined);
      const assignmentInput = hasAssignment
        ? inputWithoutAttachments
        : {
          ...inputWithoutAttachments,
          assigneeIds: inputWithoutAttachments.ownerEmployeeId ? [inputWithoutAttachments.ownerEmployeeId] : [],
          assigneeName: inputWithoutAttachments.ownerName ? [inputWithoutAttachments.ownerName] : [],
        };
      const assignment = resolveTaskAssignment(assignmentInput, state.teams || [], state.employees || []);
      const ownerId = inputWithoutAttachments.ownerEmployeeId || assignment.assigneeIds[0] || currentEmployee?.id || "";
      const owner = (state.employees || []).find((employee) => employee.id === ownerId);
      const contactInput = {
        ...inputWithoutAttachments,
        ...assignment,
        assigneeName: assignment.assigneeNames,
        ownerEmployeeId: ownerId,
        ownerName: inputWithoutAttachments.ownerName || owner?.name || assignment.teamName || "Não atribuído",
      };
      if (existing) {
        const patch = { ...contactInput, ...actor };
        return runOptimisticMutation(
          (current) => ({
            ...current,
            contacts: current.contacts.map((item) => item.id === existing.id
              ? normalizeContact({ ...item, ...patch }, { now: new Date().toISOString() })
              : item),
          }),
          () => store.updateContact(state, existing.id, patch),
          store.live ? "Caso em sincronização..." : "Caso atualizado no mock local.",
          store.live ? "Caso sincronizado." : "Caso atualizado.",
        );
      }
      const created = createContactPayload({ ...contactInput, ...actor }, owner || currentEmployee || {});
      const optimistic = { ...created, id: `optimistic-contact-${Date.now()}`, history: [] };
      return runOptimisticMutation(
        (current) => ({ ...current, contacts: [optimistic, ...(current.contacts || [])] }),
        () => Promise.resolve(store.createContact(state, { ...contactInput, ...actor })).then((createdState) => {
          if (!draftAttachments.length) return createdState;
          const createdContact = (createdState?.contacts || []).find((item) => item.subject === contactInput.subject && item.senderName === contactInput.senderName);
          if (!createdContact?.id) throw new Error("O caso foi criado, mas não foi possível localizar seu registro para enviar os anexos.");
          return draftAttachments.reduce(
            (queue, attachment) => queue.then((currentState) => store.addContactAttachment(currentState, createdContact.id, attachment.file || attachment, attachment.previewUrl || "")),
            Promise.resolve(createdState),
          );
        }),
        store.live ? "Caso em sincronização..." : "Caso adicionado no mock local.",
        store.live ? "Caso sincronizado." : "Caso criado.",
      );
    },
    [currentEmployee, runOptimisticMutation, state, store],
  );
  const handleWhatsAppIntake = useCallback(async (input) => {
    if (!store.createContactFromWhatsAppIntake) throw new Error("Integração WhatsApp não disponível neste modo.");
    const result = await store.createContactFromWhatsAppIntake(confirmedStateRef.current || state, {
      ...input,
      actorEmployeeId: currentEmployee?.id || "",
      actorUserId: currentEmployee?.userId || "",
      actorName: currentEmployee?.name || "Você",
    });
    if (!result?.state) throw new Error("Planner não retornou o estado após o intake WhatsApp.");
    confirmedStateRef.current = result.state;
    setState(applyPendingMutations(result.state));
    showNotice(result.status === "duplicate" ? "Triagem já registrada." : result.status === "updated" ? "Caso WhatsApp atualizado." : "Caso WhatsApp criado.");
    return { status: result.status, contactId: result.contactId, taskId: result.taskId };
  }, [applyPendingMutations, currentEmployee, showNotice, state, store]);
  useEffect(() => installPlannerBridge({ onIntake: handleWhatsAppIntake }), [handleWhatsAppIntake]);
  const createQuote = useCallback(async (input = {}) => {
    if (!store.createQuote) return Promise.resolve(false);
    const { attachments = [], ...quoteInput } = input;
    const previousIds = new Set((confirmedStateRef.current || state).quotes?.map((quote) => quote.id) || []);
    let linkedTaskId = "";
    const created = await runOptimisticMutation(
      (current) => current,
      async () => {
        const next = await store.createQuote(confirmedStateRef.current || state, { ...quoteInput, actorEmployeeId: currentEmployee?.id || "" });
        const quote = (next.quotes || []).find((item) => !previousIds.has(item.id));
        linkedTaskId = (next.tasks || []).find((task) => task.quoteId === quote?.id && !task.parentTaskId)?.id || "";
        return next;
      },
      store.live ? "Cotação em sincronização…" : "Criando cotação no mock local…",
      store.live ? "Cotação enviada para sincronização." : "Cotação criada no mock local.",
    );
    if (!created || !attachments.length) return created;
    if (!linkedTaskId) { showNotice("Cotação criada, mas a tarefa para anexos não foi localizada.", 5200); return true; }
    let failures = 0;
    for (const file of attachments) {
      try {
        showNotice(`Enviando anexo ${attachments.indexOf(file) + 1} de ${attachments.length}…`);
        const previewUrl = store.live ? "" : await fileToDataUrl(file);
        const next = await store.addAttachment(confirmedStateRef.current || state, linkedTaskId, file, previewUrl);
        confirmedStateRef.current = next;
        setState(applyPendingMutations(next));
      } catch (error) {
        failures += 1;
        console.warn("[Planner] anexo da cotação não enviado", error);
      }
    }
    showNotice(failures ? `Cotação criada. ${failures} anexo(s) não foram enviados; abra a cotação para tentar novamente.` : `Cotação criada com ${attachments.length} anexo(s).`, failures ? 6000 : 3000);
    return true;
  }, [applyPendingMutations, currentEmployee, runOptimisticMutation, showNotice, state, store]);
  const updateQuote = useCallback((id, patch = {}) => {
    if (!store.updateQuote) return Promise.resolve(false);
    return runOptimisticMutation(
      (current) => ["Cotada", "Respondida ao cliente"].includes(patch.status) ? current : ({ ...current, quotes: (current.quotes || []).map((quote) => quote.id === id ? { ...quote, ...patch, syncStatus: "syncing" } : quote), tasks: patch.status && patch.status !== current.quotes?.find((quote) => quote.id === id)?.status ? (current.tasks || []).map((task) => task.quoteId === id && !task.parentTaskId ? { ...task, status: taskStatusForQuoteStatus(patch.status), quoteStatus: patch.status, ...(patch.waitingContext ? { waitingContext: normalizeWaitingContext(patch.waitingContext) } : {}) } : task) : current.tasks }),
      () => store.updateQuote(confirmedStateRef.current || state, id, { ...patch, actorEmployeeId: currentEmployee?.id || "" }),
      store.live ? "Cotação em sincronização…" : "Cotação atualizada no mock local.",
      store.live ? "Cotação sincronizada." : "Cotação atualizada.",
    );
  }, [currentEmployee, runOptimisticMutation, state, store]);
  const waitingQuote = state.quotes.find((quote) => quote.id === waitingQuoteId);
  const waitingQuoteTask = waitingQuote && state.tasks.find((task) => task.quoteId === waitingQuoteId && !task.parentTaskId);
  const saveWaitingQuote = useCallback((id, waitingContext) => {
    const quote = state.quotes.find((item) => item.id === waitingQuoteId);
    if (!quote || !state.tasks.some((task) => task.id === id && task.quoteId === quote.id)) return Promise.resolve(false);
    return updateQuote(quote.id, { status: "Aguardando informação", waitingContext });
  }, [state.quotes, state.tasks, updateQuote, waitingQuoteId]);
  const markQuoteSent = useCallback((id) => {
    if (!store.markQuoteSent) return Promise.resolve(false);
    return runOptimisticMutation(
      (current) => ({ ...current, quotes: (current.quotes || []).map((quote) => quote.id === id ? { ...quote, responseSent: true, status: "Respondida ao cliente", finalizationAt: "" } : quote), tasks: (current.tasks || []).map((task) => task.quoteId === id && !task.parentTaskId ? { ...task, status: "done", quoteStatus: "Respondida ao cliente" } : task) }),
      () => store.markQuoteSent(confirmedStateRef.current || state, id),
      store.live ? "Registrando envio…" : "Registrando envio no mock…",
      store.live ? "Envio registrado." : "Envio registrado no mock.",
    );
  }, [runOptimisticMutation, state, store]);
  const setQuoteOutcome = useCallback((id, outcome, reason = "") => {
    if (!store.setQuoteOutcome) return Promise.resolve(false);
    const finalizationAt = new Date().toISOString();
    return runOptimisticMutation(
      (current) => ({ ...current, quotes: (current.quotes || []).map((quote) => quote.id === id ? { ...quote, status: outcome, lossReason: outcome === "Perdida" ? reason : "", finalizationAt } : quote), tasks: (current.tasks || []).map((task) => task.quoteId === id && !task.parentTaskId ? { ...task, status: "done", quoteStatus: outcome, completedAt: finalizationAt } : task) }),
      () => store.setQuoteOutcome(confirmedStateRef.current || state, id, outcome, reason),
      store.live ? "Registrando resultado…" : "Registrando resultado no mock…",
      store.live ? "Resultado registrado." : "Resultado registrado no mock.",
    );
  }, [runOptimisticMutation, state, store]);
  const archiveContact = useCallback(
    (contact) => {
      const archivedAt = new Date().toISOString();
      const actor = { actorEmployeeId: currentEmployee?.id || "", author: currentEmployee?.name || "Você" };
      return runOptimisticMutation(
        (current) => ({
          ...current,
          contacts: current.contacts.map((item) => item.id === contact.id
            ? { ...item, archivedAt, updatedAt: archivedAt, history: [...(item.history || []), createContactEvent("archived", item, actor, archivedAt)] }
            : item),
        }),
        () => store.archiveContact(state, contact.id, actor),
        store.live ? "Caso em sincronização..." : "Arquivando caso...",
        store.live ? "Caso arquivado." : "Caso arquivado no mock local.",
      ).then((success) => {
        if (success) closeContact();
        return success;
      });
    },
    [closeContact, currentEmployee, runOptimisticMutation, state, store],
  );
  const addContactNote = useCallback(
    (id, value) => {
      const note = { id: `optimistic-note-${Date.now()}`, text: String(value || "").trim(), author: currentEmployee?.name || "Você", createdAt: new Date().toISOString() };
      if (!note.text) return Promise.resolve(false);
      return runOptimisticMutation(
        (current) => ({ ...current, contacts: current.contacts.map((item) => item.id === id ? { ...item, notes: [...(item.notes || []), note], history: [...(item.history || []), { id: note.id, type: "note", text: "Nota interna adicionada.", createdAt: note.createdAt, author: note.author }] } : item) }),
        () => store.addContactNote(state, id, value, { actorEmployeeId: currentEmployee?.id || "", author: currentEmployee?.name || "Você" }),
        store.live ? "Nota em sincronização..." : "Nota salva no mock local.",
        store.live ? "Nota sincronizada." : "Nota adicionada.",
      );
    },
    [currentEmployee, runOptimisticMutation, state, store],
  );
  const addContactAttachment = useCallback(
    (id, filesOrFile) => {
      const files = toAttachmentFiles(filesOrFile);
      if (!files.length) return Promise.resolve(false);
      return files.reduce((queue, file, index) => queue.then(() => {
        const baseState = confirmedStateRef.current || state;
        return fileToDataUrl(file).then((previewUrl) => runOptimisticMutation(
          (current) => ({ ...current, contacts: current.contacts.map((item) => item.id === id ? { ...item, attachments: [...(item.attachments || []), { id: `optimistic-contact-file-${Date.now()}-${index}`, name: file.name || "Arquivo", mimeType: file.type || "", size: file.size || 0, previewUrl, createdAt: new Date().toISOString(), syncStatus: "syncing" }] } : item) }),
          () => store.addContactAttachment(baseState, id, file, previewUrl),
          files.length > 1 ? `Anexo ${index + 1} de ${files.length} na fila...` : store.live ? "Anexo em envio..." : "Anexo adicionado no mock local.",
          files.length > 1 ? `Anexo ${index + 1} de ${files.length} salvo.` : store.live ? "Anexo salvo no SharePoint." : "Anexo salvo localmente.",
        ));
      }), Promise.resolve(true));
    },
    [runOptimisticMutation, state, store],
  );
  const removeContactAttachment = useCallback(
    (id, attachment) => runOptimisticMutation(
      (current) => ({ ...current, contacts: current.contacts.map((item) => item.id === id ? { ...item, attachments: (item.attachments || []).filter((entry) => entry.id !== attachment.id) } : item) }),
      () => store.deleteContactAttachment(confirmedStateRef.current || state, id, attachment),
      store.live ? "Anexo removido. Sincronizando SharePoint..." : "Anexo removido no mock local.",
      store.live ? "Anexo removido do SharePoint." : "Anexo removido localmente.",
    ),
    [runOptimisticMutation, state, store],
  );
  const [taskFromContact, setTaskFromContact] = useState(null);
  const createTaskFromContact = useCallback((contact) => {
    setTaskFromContact(buildLinkedTaskInput(contact));
  }, []);
  const saveTeam = useCallback(
    (input) => {
      const operation = input.id
        ? store.updateTeam(state, input.id, input)
        : store.createTeam(state, input);
      return Promise.resolve(operation)
        .then((next) => {
          confirmedStateRef.current = next;
          setState(applyPendingMutations(next));
          showNotice(input.id ? "Equipe atualizada." : "Equipe criada.");
          return true;
        })
        .catch((failure) => {
          showNotice(failure.message || "Não foi possível salvar a equipe.", 5200);
          return false;
        });
    },
    [applyPendingMutations, showNotice, state, store],
  );
  const deleteTeam = useCallback(
    (id) => Promise.resolve(store.deleteTeam(state, id))
      .then((next) => {
        confirmedStateRef.current = next;
        setState(applyPendingMutations(next));
        showNotice("Equipe apagada.");
        return true;
      })
      .catch((failure) => {
        showNotice(failure.message || "Não foi possível apagar a equipe.", 5200);
        return false;
      }),
    [applyPendingMutations, showNotice, state, store],
  );
  const importPlannerTasks = useCallback(
    (rows) => Promise.resolve(store.importPlannerTasks(confirmedStateRef.current || state, rows))
      .then((result) => {
        confirmedStateRef.current = result.nextState;
        setState(applyPendingMutations(result.nextState));
        showNotice(`${result.createdCount} tarefa(s) importada(s).`);
        return result;
      })
      .catch((failure) => {
        showNotice(failure.message || "Não foi possível importar as tarefas.", 5200);
        throw failure;
      }),
    [applyPendingMutations, showNotice, state, store],
  );
  const createNewTask = useCallback(
    (input) => {
      const {
        subtasks = [],
        attachments = [],
        onProgress,
        ...taskInput
      } = input;
      const assignment = resolveTaskAssignment(taskInput, state.teams || [], state.employees || []);
      const commonTask = {
        ...buildTaskCreationInput(taskInput),
        ...assignment,
        assigneeName: assignment.assigneeNames.join(", "),
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
          const parent = findCreatedMainTask(
            state.tasks,
            nextState.tasks,
            commonTask.title,
          );
          if (!parent) throw new Error("Tarefa criada, mas não foi possível localizar o registro para enviar os anexos.");
          const withTags = commonTask.personalTagIds !== undefined && store.replaceTaskPersonalTags
            ? store.replaceTaskPersonalTags(nextState, parent.id, commonTask.personalTagIds, state.currentUserId || currentEmployee?.userId || "")
            : nextState;
          return Promise.resolve(withTags).then((taggedState) => {
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
            Promise.resolve(taggedState),
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
    (parentId, title, allowUnassigned = false) => {
      const parent = state.tasks.find((taskItem) => taskItem.id === parentId);
      if (isQuoteTask(parent || {})) {
        const checklistItem = { id: `check-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: String(title || "").trim(), done: false };
        if (!checklistItem.title) return Promise.resolve(false);
        return runOptimisticMutation(
          (current) => applyOptimisticTaskPatch(current, parentId, { checklist: [...(current.tasks.find((taskItem) => taskItem.id === parentId)?.checklist || []), checklistItem] }),
          () => store.updateTask(state, parentId, { checklist: [...(parent.checklist || []), checklistItem] }),
          store.live ? "Checklist sincronizado." : "Item adicionado ao checklist.",
          "Item adicionado ao checklist.",
        );
      }
      const input = {
        title,
        description: "",
        priority: "medium",
        assigneeName: "Não atribuído",
        teamName: "Operação",
        dueDate: "",
      };
      const missingResponsible = !hasTaskResponsible(input);
      const missingDueDate = !String(input.dueDate || "").trim();
      if (!allowUnassigned && (missingResponsible || missingDueDate)) {
        setPendingUnassignedCreate({ kind: "subtask", parentId, title, missingResponsible, missingDueDate });
        return Promise.resolve(false);
      }
      runOptimisticCreate(
        input,
        () => store.createSubtask(state, parentId, input),
        store.live ? "Subtarefa sincronizada." : "Subtarefa salva localmente.",
        parentId,
      );
    },
    [state, store, runOptimisticCreate, runOptimisticMutation],
  );
  const createQualityTask = useCallback(
    (item, allowUnassigned = false) => {
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
      const missingResponsible = !hasTaskResponsible(input);
      const missingDueDate = !String(input.dueDate || "").trim();
      if (!allowUnassigned && (missingResponsible || missingDueDate)) {
        setPendingUnassignedCreate({ kind: "quality", item, missingResponsible, missingDueDate });
        return Promise.resolve(false);
      }
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
    if (!store.live) window.dispatchEvent(new Event("planner-service-types-changed"));
    setSelectedId("");
  }, [store, runMutation]);
  const adminCleanup = useCallback((action) => runMutation(store.adminCleanup(state, action), "Limpeza administrativa concluída."), [state, store, runMutation]);
  const sendNotificationTest = useCallback((input) => {
    if (!store.live || !store.sendNotificationTest) return Promise.reject(new Error("O envio de teste exige o ambiente Dataverse conectado."));
    const actor = resolveCurrentEmployee(state.employees, store.live, state.currentUserEmail);
    return store.sendNotificationTest(state, { ...input, actorEmployeeId: actor?.id || "", actorUserId: actor?.userId || "" }).then((result) => {
      const next = result?.state || result;
      confirmedStateRef.current = next;
      setState(applyPendingMutations(next));
      const delivery = result?.emailDispatch;
      if (delivery?.status === "sent") showNotice("Push de teste enviado.");
      else if (delivery?.status === "failed" || delivery?.status === "noAddress" || delivery?.status === "unknown") showNotice(delivery.text || "Push de teste não enviado.", 5200);
      else showNotice("Evento criado. O Flow ainda não confirmou o push.", 4200);
      return delivery || true;
    });
  }, [applyPendingMutations, showNotice, state, store]);
  const addComment = useCallback(
    (id, text) => {
      const actor = resolveCurrentEmployee(
        state.employees,
        store.live,
        state.currentUserEmail,
      );
      const mentionedEmployeeIds = mentionedEmployees(text, state.employees).map((employee) => employee.id);
      const context = { actorEmployeeId: actor?.id || "", actorUserId: actor?.userId || "", mentionedEmployeeIds };
      return (
      runOptimisticMutation(
        (current) => addOptimisticComment(current, id, text),
        async () => {
          const next = await store.addComment(state, id, text, context);
          if (!store.live || !store.loadNotifications || !actor?.id) return next;
          return { ...next, notifications: await store.loadNotifications(actor.id) };
        },
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
                  returns: (taskItem.returns || []).map((returnItem) => ({
                    ...returnItem,
                    attachments: (returnItem.attachments || []).filter(
                      (item) => item.id !== attachment.id,
                    ),
                  })),
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
    () => normalizeWorkItems(state || {}, currentEmployee),
    [state?.tasks, state?.quality, state?.teams, currentEmployee?.id],
  );
  useEffect(() => {
    if (!currentEmployee?.id || !store.loadNotifications) return undefined;
    let activeRequest = true;
    const refresh = () => store.loadNotifications(currentEmployee.id)
      .then((notifications) => {
        if (activeRequest) {
          const current = confirmedStateRef.current || {};
          mergeConfirmed({
            notifications,
            loadErrors: { ...(current.loadErrors || {}), notifications: undefined },
          });
        }
      })
      .catch((failure) => {
        if (activeRequest) {
          const current = confirmedStateRef.current || {};
          mergeConfirmed({
            loadErrors: { ...(current.loadErrors || {}), notifications: failure.message || "Notificações indisponíveis." },
          });
        }
      });
    refresh();
    const onVisibilityChange = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const timer = window.setInterval(refresh, 15000);
    return () => { activeRequest = false; document.removeEventListener("visibilitychange", onVisibilityChange); window.clearInterval(timer); };
  }, [currentEmployee?.id, mergeConfirmed, store]);
  const markNotificationRead = useCallback((notificationId) => {
    if (!store.markNotificationRead) return;
    const notification = (state.notifications || []).find((item) => item.id === notificationId);
    if (!notification || notification.readAt) return;
    const optimisticReadAt = new Date().toISOString();
    setState((current) => ({
      ...current,
      notifications: (current.notifications || []).map((item) => item.id === notificationId ? { ...item, readAt: optimisticReadAt } : item),
    }));
    showNotice("Notificação marcada como lida.", 2400);
    store.markNotificationRead(state, notificationId).then(setState).catch((failure) => {
      setState((current) => ({
        ...current,
        notifications: (current.notifications || []).map((item) => item.id === notificationId && item.readAt === optimisticReadAt ? { ...item, readAt: "" } : item),
      }));
      showNotice(`Falha ao atualizar notificação: ${failure.message}`, 4200);
    });
  }, [state, store, showNotice]);
  useEffect(() => {
    if (selectedId) markTaskNotificationsRead(selectedId);
  }, [selectedId, markTaskNotificationsRead]);
  const markAllNotificationsRead = useCallback(() => {
    if (!currentEmployee?.id || !store.markAllNotificationsRead) return;
    const optimisticReadAt = new Date().toISOString();
    const unreadIds = new Set(
      notificationsVisibleToEmployee(state.notifications || [], state.tasks || [], currentEmployee, state.teams || [])
        .filter((item) => item.recipientEmployeeId === currentEmployee.id && !item.readAt)
        .map((item) => item.id),
    );
    if (!unreadIds.size) return;
    setState((current) => ({
      ...current,
      notifications: (current.notifications || []).map((item) => unreadIds.has(item.id) ? { ...item, readAt: optimisticReadAt } : item),
    }));
    showNotice("Todas as notificações foram marcadas como lidas.", 2600);
    store.markAllNotificationsRead(state, currentEmployee.id).then(setState).catch((failure) => {
      setState((current) => ({
        ...current,
        notifications: (current.notifications || []).map((item) => unreadIds.has(item.id) && item.readAt === optimisticReadAt ? { ...item, readAt: "" } : item),
      }));
      showNotice(`Falha ao atualizar notificações: ${failure.message}`, 4200);
    });
  }, [currentEmployee?.id, state, store, showNotice]);
  const openNotification = useCallback((item) => {
    if (item.contactId) {
      if (!item.readAt) markNotificationRead(item.id);
      openContact(item.contactId);
    } else if (item.taskId) {
      openTask(item.taskId);
    }
  }, [markNotificationRead, openContact, openTask]);
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
  const visibleTasks = useMemo(
    () => (state.tasks || []).filter((task) => isTaskVisibleToEmployee(task, currentEmployee, state.teams)),
    [currentEmployee, state.tasks, state.teams],
  );
  const visibleNotifications = useMemo(
    () => notificationsVisibleToEmployee(
      (state.notifications || []).filter((item) => item.recipientEmployeeId === currentEmployee?.id),
      state.tasks || [],
      currentEmployee,
      state.teams || [],
    ),
    [currentEmployee, state.notifications, state.tasks, state.teams],
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
        onCreate={openCreate}
        tasks={state.tasks}
        live={store.live}
        currentEmployee={null}
        personalStats={taskStats([])}
        openTaskCount={0}
        onRefresh={refreshInBackground}
        refreshing={refreshing}
        canViewManagement={false}
      >
        <DataLoadingView
          loading={state.loading}
          error={state.loadErrors?.core}
          view={active}
        />
      </AppShell>
    );
  const viewState = {
    ...state,
    tasks: visibleTasks.map((task) => {
      const quote = task.quoteId ? state.quotes.find((item) => item.id === task.quoteId) : null;
      return isQuoteTask(task) && !task.parentTaskId && quote
        ? { ...task, quoteStatus: quote.status }
        : task;
    }),
    workItems,
  };
  const personalItems = currentEmployee
    ? workItems.filter((item) => isAssignedToEmployee(item, currentEmployee))
    : [];
  const personalStats = workItemStats(filterWorkItems(personalItems));
  const openTaskCount = visibleTasks.filter(
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
              onCreate={openCreate}
              employees={state.employees}
              teams={state.teams}
              personalTags={state.personalTags}
              onCreatePersonalTag={createPersonalTag}
              onUpdatePersonalTag={updatePersonalTag}
              onArchivePersonalTag={archivePersonalTag}
              onReorderPersonalTags={reorderPersonalTags}
            />
          }
          onClearFilters={() => setFilters(createDefaultFilters())}
          onChangeMode={onCentralModeChange}
          onOpenTask={openTask}
          onOpenSource={(item) => store.openSource?.(item)}
          onCompleteTask={completeTask}
        />
      );
    if (active === "management")
      return <ManagementView state={viewState} currentEmployee={currentEmployee} onOpenTask={openTask} onCollect={collectTask} onRegisterWaitingReturn={openWaitingReturn} />;
    if (active === "contacts")
      return (
        <ContactsView
          contacts={state.contacts}
          employees={state.employees}
          teams={state.teams}
          quotes={state.quotes}
          tasks={visibleTasks}
          currentEmployee={currentEmployee}
          selectedContactId={selectedContactId}
          contactLoading={state.contactLoading}
          contactLoadError={state.contactLoadError}
          onSelect={(id) => id ? openContact(id) : closeContact()}
          onSave={saveContact}
          onArchive={archiveContact}
          onAddNote={addContactNote}
          onAttachment={addContactAttachment}
          onDeleteAttachment={removeContactAttachment}
          loadAttachmentContent={store.loadAttachmentContent}
          onCreateTask={createTaskFromContact}
          AttachmentSectionComponent={AttachmentSection}
        />
      );
    if (active === "quotes")
      return state.loading?.quotes ? <LoadingFallback label="Carregando cotações" view="quotes" quoteView={readQuoteViewPreference()} /> : <QuotesView state={viewState} currentEmployee={currentEmployee} WaitingContextFieldsComponent={WaitingContextFields} ReturnsSectionComponent={TaskReturnsSection} onOpenTask={openTask} onCreateQuote={createQuote} onUpdateQuote={updateQuote} onRequestWaitingQuote={setWaitingQuoteId} onRegisterWaitingReturn={openWaitingReturn} onMarkQuoteSent={markQuoteSent} onSetQuoteOutcome={setQuoteOutcome} onEnsureTaskDetails={ensureTaskDetails} onAttachment={addAttachment} onDeleteAttachment={removeAttachment} loadAttachmentContent={store.loadAttachmentContent} AttachmentSectionComponent={AttachmentSection} selectedQuoteId={quoteToOpenId} onSelectQuote={setQuoteToOpenId} workspaceEnabled={QUOTE_WORKSPACE_V2_ENABLED} hybridEnabled={QUOTE_HYBRID_V3_ENABLED} />;
    if (active === "board")
      return (
        <BoardView
          state={viewState}
          currentEmployee={currentEmployee}
          checklistVisibility={checklistVisibility}
          onOpen={openTask}
          onToggleSubtask={saveTask}
          onMove={moveTask}
          onComplete={completeTask}
          onRegisterWaitingReturn={openWaitingReturn}
          onCreate={openCreate}
          filters={filters}
          setFilters={setFilters}
          onNavigate={navigate}
          taskScope={taskScope}
          onScopeChange={onTaskScopeChange}
          personalTags={state.personalTags}
          tasks={visibleTasks}
          onCreatePersonalTag={createPersonalTag}
          onUpdatePersonalTag={updatePersonalTag}
          onArchivePersonalTag={archivePersonalTag}
          onReorderPersonalTags={reorderPersonalTags}
        />
      );
    if (active === "list")
      return (
        <ListView
          state={viewState}
          currentEmployee={currentEmployee}
          onOpen={openTask}
          onCreate={openCreate}
          filters={filters}
          setFilters={setFilters}
          onNavigate={navigate}
          taskScope={taskScope}
          onScopeChange={onTaskScopeChange}
          personalTags={state.personalTags}
          tasks={visibleTasks}
          onCreatePersonalTag={createPersonalTag}
          onUpdatePersonalTag={updatePersonalTag}
          onArchivePersonalTag={archivePersonalTag}
          onReorderPersonalTags={reorderPersonalTags}
        />
      );
    if (active === "calendar")
      return (
        <CalendarView
          state={viewState}
          currentEmployee={currentEmployee}
          onOpen={openTask}
          onCreate={openCreate}
          filters={filters}
          setFilters={setFilters}
          onNavigate={navigate}
          taskScope={taskScope}
          onScopeChange={onTaskScopeChange}
          personalTags={state.personalTags}
          onCreatePersonalTag={createPersonalTag}
          onUpdatePersonalTag={updatePersonalTag}
          onArchivePersonalTag={archivePersonalTag}
          onReorderPersonalTags={reorderPersonalTags}
        />
      );
    if (active === "more") return <MoreView onNavigate={navigate} canViewManagement={showManagement} />;
    if (active === "quality")
      return state.loading?.quality ? (
        <LoadingFallback view="quality" />
      ) : (
        <Suspense fallback={<LoadingFallback view="quality" />}>
          <LazyQualityView
            state={viewState}
            currentEmployee={currentEmployee}
            onCreate={createQualityTask}
            onCreateTask={openCreate}
            filters={filters}
            setFilters={setFilters}
          />
        </Suspense>
      );
    return (
      <Suspense fallback={<LoadingFallback view="settings" />}>
          <LazySettingsView onReset={reloadData} onAdminCleanup={adminCleanup} onSendNotificationTest={sendNotificationTest} live={store.live} teams={state.teams} tasks={state.tasks} contacts={state.contacts} notifications={state.notifications} employees={state.employees} personalTags={state.personalTags} onCreatePersonalTag={createPersonalTag} onUpdatePersonalTag={updatePersonalTag} onArchivePersonalTag={archivePersonalTag} onReorderPersonalTags={reorderPersonalTags} onSaveTeam={saveTeam} onDeleteTeam={deleteTeam} onImportPlannerTasks={importPlannerTasks} />
      </Suspense>
    );
  };
  return (
    <AppShell
      active={active}
      onNavigate={navigate}
      onCreate={openCreate}
      tasks={state.tasks}
      contacts={state.contacts}
      live={store.live}
      currentEmployee={currentEmployee}
      teams={state.teams}
      personalStats={personalStats}
      openTaskCount={openTaskCount}
      notifications={visibleNotifications}
      notificationError={state.loadErrors?.notifications || ""}
      onOpenNotification={openNotification}
      onOpenContact={openNotification}
      onMarkNotificationRead={markNotificationRead}
      onMarkAllNotificationsRead={markAllNotificationsRead}
      onRefresh={refreshInBackground}
      refreshing={refreshing}
      canViewManagement={showManagement}
    >
      {readyView === active ? renderPage() : <LoadingFallback view={active} quoteView={readQuoteViewPreference()} />}
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
      {pendingUnassignedCreate && (
        <UnassignedTaskDialog
          isCreation
          missingResponsible={pendingUnassignedCreate.missingResponsible}
          missingDueDate={pendingUnassignedCreate.missingDueDate}
          onCancel={() => setPendingUnassignedCreate(null)}
          onConfirm={() => {
            const pending = pendingUnassignedCreate;
            setPendingUnassignedCreate(null);
            if (pending.kind === "quality")
              createQualityTask(pending.item, true);
            else createSubtask(pending.parentId, pending.title, true);
          }}
        />
      )}
      {quoteCompletionRequest && (
        <QuoteCompletionDialog
          quote={quoteCompletionRequest.quote}
          onCancel={quoteCompletionRequest.onCancel}
          onConfirm={quoteCompletionRequest.onConfirm}
        />
      )}
      {waitingTask && (
        <WaitingStatusModal
          task={waitingTask}
          employees={state.employees}
          teams={state.teams}
          onClose={() => setWaitingTaskId("")}
          onSave={saveWaitingStatus}
        />
      )}
      {waitingQuoteTask && (
        <WaitingStatusModal
          task={{ ...waitingQuoteTask, title: waitingQuote.code || waitingQuote.title || waitingQuoteTask.title }}
          employees={state.employees}
          teams={state.teams}
          onClose={() => setWaitingQuoteId("")}
          onSave={saveWaitingQuote}
        />
      )}
      {waitingReturnTask && (
        <WaitingReturnModal
          task={waitingReturnTask}
          onClose={() => setWaitingReturnTaskId("")}
          onSave={registerWaitingReturn}
        />
      )}
      {selected && (
        <TaskDrawer
          task={selected}
          state={state}
          teams={state.teams}
          personalTags={state.personalTags}
          onCreatePersonalTag={createPersonalTag}
          currentEmployee={currentEmployee}
          showChecklistOnCard={Boolean(checklistVisibility[selected.id])}
          onToggleChecklistOnCard={(visible) =>
            setChecklistVisibilityForTask(selected.id, visible)
          }
          onClose={closeTask}
          onRegisterWaitingReturn={openWaitingReturn}
          onSave={saveTask}
          onDelete={deleteTask}
          onComment={addComment}
          onAttachment={addAttachment}
          onDeleteAttachment={removeAttachment}
          onOpenQuote={(id) => {
            setQuoteToOpenId(id);
            setActive("quotes");
            closeTask();
            showNotice(
              `Cotação ${state.quotes.find((quote) => quote.id === id)?.code || ""} vinculada.`,
            );
          }}
          onAddSubtask={createSubtask}
        />
      )}
      {taskFromContact && (
        <NewTaskDrawer
          employees={state.employees}
          teams={state.teams}
          personalTags={state.personalTags}
          onCreatePersonalTag={createPersonalTag}
          initialInput={taskFromContact}
          onClose={() => setTaskFromContact(null)}
          onSave={createNewTask}
        />
      )}
      {creating && (
        <NewTaskDrawer
          employees={state.employees}
          teams={state.teams}
          personalTags={state.personalTags}
          onCreatePersonalTag={createPersonalTag}
          initialStatus={creatingStatus}
          initialInput={creatingInput}
          onClose={() => setCreating(false)}
          onSave={createNewTask}
        />
      )}
    </AppShell>
  );
}
