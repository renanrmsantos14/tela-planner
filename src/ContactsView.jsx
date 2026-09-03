import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Check,
  CheckCircle2,
  Clock3,
  ChevronDown,
  FileText,
  Flag,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Send,
  UserRound,
  X,
} from "lucide-react";
import SearchableSelect from "./SearchableSelect.jsx";
import AssignmentFields from "./AssignmentFields.jsx";
import PageHeader from "./PageHeader.jsx";
import {
  CONTACT_CHANNELS,
  CONTACT_PRIORITIES,
  CONTACT_STATUSES,
  CONTACT_STATUS_TRANSITIONS,
  contactChannelLabel,
  contactPermissions,
  contactPriorityLabel,
  contactStatusLabel,
  filterContacts,
  sortContacts,
} from "./contactDomain.js";

const CHANNEL_ICON = { whatsapp: MessageCircle, email: Mail, phone: Phone };
const STATUS_ICON = { new: MessageCircle, in_progress: Send, waiting: Clock3, resolved: CheckCircle2, archived: Archive };

function formatContactDate(value, withTime = false) {
  if (!value) return "Sem data";
  const date = new Date(withTime ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", withTime ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short" }).format(date).replace(" de ", " ");
}

function contactAttachmentFiles(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value.length === "number" && !value.name) return Array.from(value).filter(Boolean);
  return [value];
}

function createContactDraftAttachment(file) {
  return {
    id: `contact-draft-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`,
    name: file.name || "Arquivo",
    mimeType: file.type || "",
    size: file.size || 0,
    previewUrl: globalThis.URL?.createObjectURL ? globalThis.URL.createObjectURL(file) : "",
    file,
    syncStatus: "pending",
  };
}

function releaseContactDraftAttachment(attachment) {
  if (attachment?.previewUrl?.startsWith("blob:") && globalThis.URL?.revokeObjectURL) globalThis.URL.revokeObjectURL(attachment.previewUrl);
}

function contactFilesFromClipboard(event) {
  const clipboard = event.clipboardData;
  const files = Array.from(clipboard?.files || []).filter(Boolean);
  if (files.length) return files;
  return Array.from(clipboard?.items || []).filter((item) => item.kind === "file").map((item) => item.getAsFile?.()).filter(Boolean);
}

function ContactStatusPicker({ value, onChange, disabled = false, options = CONTACT_STATUSES }) {
  const selected = CONTACT_STATUSES.find((item) => item.id === value) || CONTACT_STATUSES[0];
  return (
    <div className="status-picker contact-status-picker" role="group" aria-label={`Status atual: ${selected.label}`}>
      <div className="status-picker-options">
        {options.map((item) => {
          const Icon = STATUS_ICON[item.id] || CheckCircle2;
          const active = item.id === value;
          return (
            <button key={item.id} type="button" className={`status-option status-option-${item.id}${active ? " is-selected" : ""}`} aria-label={item.label} aria-pressed={active} title={item.label} disabled={disabled} onClick={() => onChange(item.id)}>
              <Icon size={17} strokeWidth={2.2} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <span className="status-picker-current">{selected.label}</span>
    </div>
  );
}

function ContactPriorityPicker({ value, onChange, disabled = false }) {
  const selected = CONTACT_PRIORITIES.find((item) => item.id === value) || CONTACT_PRIORITIES[1];
  return (
    <div className="priority-picker contact-priority-picker" role="group" aria-label={`Prioridade atual: ${selected.label}`}>
      <div className="priority-picker-options">
        {CONTACT_PRIORITIES.map((item) => {
          const active = item.id === value;
          return (
            <button key={item.id} type="button" className={`priority-option priority-option-${item.id}${active ? " is-selected" : ""}`} aria-label={item.label} aria-pressed={active} title={item.label} disabled={disabled} onClick={() => onChange(item.id)}>
              <Flag size={18} strokeWidth={2.2} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <span className="priority-picker-current">{contactPriorityLabel(selected.id)}</span>
    </div>
  );
}

function emptyDraft(currentEmployee) {
  return {
    subject: "",
    senderName: "",
    senderPhone: "",
    senderEmail: "",
    channel: "whatsapp",
    priority: "medium",
    status: "new",
    assignmentMode: "people",
    teamIds: [],
    teamNames: [],
    teamId: "",
    teamName: "",
    assigneeName: currentEmployee?.name ? [currentEmployee.name] : [],
    assigneeIds: currentEmployee?.id ? [currentEmployee.id] : [],
    ownerEmployeeId: currentEmployee?.id || "",
    ownerName: currentEmployee?.name || "Não atribuído",
    receivedAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    summary: "",
    lastMessage: "",
    dueDate: "",
    clientId: "",
    quoteId: "",
    resolutionOutcome: "",
    sourceUrl: "",
  };
}

function draftFromContact(contact) {
  const assigneeIds = Array.isArray(contact.assigneeIds) && contact.assigneeIds.length
    ? contact.assigneeIds
    : contact.ownerEmployeeId
      ? [contact.ownerEmployeeId]
      : [];
  const assigneeName = Array.isArray(contact.assigneeName)
    ? contact.assigneeName
    : Array.isArray(contact.assigneeNames) && contact.assigneeNames.length
      ? contact.assigneeNames
      : contact.ownerName
        ? [contact.ownerName]
        : [];
  const teamIds = Array.isArray(contact.teamIds)
    ? contact.teamIds
    : contact.teamId
      ? [contact.teamId]
      : [];
  const teamNames = Array.isArray(contact.teamNames)
    ? contact.teamNames
    : contact.teamName
      ? [contact.teamName]
      : [];
  return {
    ...contact,
    assignmentMode: contact.assignmentMode === "team" ? "team" : "people",
    teamIds,
    teamNames,
    teamId: contact.teamId || teamIds[0] || "",
    teamName: contact.teamName || teamNames.join(", "),
    assigneeIds,
    assigneeName,
    ownerEmployeeId: contact.ownerEmployeeId || assigneeIds[0] || "",
    ownerName: contact.ownerName || assigneeName[0] || teamNames.join(", ") || "Não atribuído",
  };
}

function assignmentKey(value = {}) {
  const asList = (entry) => (Array.isArray(entry) ? entry : entry ? [entry] : []).map(String);
  return JSON.stringify({
    assignmentMode: value.assignmentMode === "team" ? "team" : "people",
    teamIds: asList(value.teamIds || value.teamId),
    assigneeIds: asList(value.assigneeIds || value.ownerEmployeeId),
    assigneeNames: asList(value.assigneeNames || value.assigneeName || value.ownerName),
  });
}

function ContactDrawer({
  contact,
  currentEmployee,
  employees,
  teams,
  quotes,
  tasks,
  AttachmentSectionComponent,
  loadAttachmentContent,
  onClose,
  onSave,
  onAddNote,
  onAttachment,
  onDeleteAttachment,
  onCreateTask,
  isNew = false,
}) {
  const [draft, setDraft] = useState(() => (isNew ? emptyDraft(currentEmployee) : draftFromContact(contact)));
  const [draftAttachments, setDraftAttachments] = useState([]);
  const draftAttachmentsRef = useRef([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  draftAttachmentsRef.current = draftAttachments;
  useEffect(() => () => draftAttachmentsRef.current.forEach(releaseContactDraftAttachment), []);
  const permissions = contactPermissions(contact || draft, { employeeId: currentEmployee?.id, isManager: currentEmployee?.isManager });
  const canEdit = isNew || permissions.canEdit;
  const quoteOptions = [{ value: "", label: "Sem vínculo" }, ...quotes.map((quote) => ({ value: quote.id, label: `${quote.code || "Cotação"} · ${quote.title || quote.client || ""}`, search: `${quote.code || ""} ${quote.title || ""} ${quote.client || ""}` }))];
  const relatedTasks = (tasks || []).filter((task) => task.contactId === contact?.id || contact?.linkedTaskIds?.includes(task.id));
  const ChannelIcon = CHANNEL_ICON[draft.channel] || MessageCircle;
  const channelField = draft.channel === "email" ? "senderEmail" : "senderPhone";
  const channelFieldLabel = draft.channel === "email" ? "E-mail do remetente" : "Telefone do remetente";
  const channelFieldType = draft.channel === "email" ? "email" : "tel";
  const availableStatuses = isNew ? CONTACT_STATUSES : CONTACT_STATUSES.filter((item) => (CONTACT_STATUS_TRANSITIONS[contact.status] || [contact.status]).includes(item.id));
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const setAssignmentForm = (updater) => setDraft((current) => {
    const next = typeof updater === "function" ? updater(current) : updater;
    const assigneeIds = Array.isArray(next.assigneeIds) ? next.assigneeIds : [];
    const primary = employees.find((employee) => String(employee.id) === String(assigneeIds[0]));
    const selectedNames = Array.isArray(next.assigneeName) ? next.assigneeName : [];
    const teamLabel = Array.isArray(next.teamNames) ? next.teamNames.filter(Boolean).join(", ") : "";
    const assignmentLabel = next.assignmentMode === "team"
      ? teamLabel || primary?.name
      : primary?.name || selectedNames[0];
    return {
      ...next,
      ownerEmployeeId: primary?.id || "",
      ownerName: assignmentLabel || "Não atribuído",
    };
  });
  const assignmentChanged = !isNew && assignmentKey(draft) !== assignmentKey(contact);
  const submit = async (event) => {
    event.preventDefault();
    setSaveError("");
    setSaving(true);
    try {
      const success = await onSave(isNew ? { ...draft, attachments: draftAttachments } : draft);
      if (!success) setSaveError("Não foi possível salvar o caso.");
      else onClose();
    } catch (error) {
      setSaveError(error.message || "Não foi possível salvar o caso.");
    } finally {
      setSaving(false);
    }
  };
  const handleDraftAttachment = (id, filesOrFile) => {
    const files = contactAttachmentFiles(filesOrFile);
    if (!files.length) return;
    if (!isNew) {
      onAttachment?.(id, files);
      return;
    }
    setDraftAttachments((current) => [...current, ...files.map(createContactDraftAttachment)]);
  };
  const handleDraftAttachmentDelete = (id, attachment) => {
    if (!isNew) {
      onDeleteAttachment?.(id, attachment);
      return;
    }
    releaseContactDraftAttachment(attachment);
    setDraftAttachments((current) => current.filter((item) => item.id !== attachment.id));
  };
  const handlePaste = (event) => {
    const files = contactFilesFromClipboard(event);
    if (!files.length) return;
    event.preventDefault();
    handleDraftAttachment("paste", files);
  };
  const visibleAttachments = isNew ? draftAttachments : contact.attachments || [];
  const addNote = async () => {
    if (!note.trim() || !contact?.id) return;
    setSaving(true);
    try {
      const success = await onAddNote(contact.id, note);
      if (success) setNote("");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="drawer-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="task-drawer contact-drawer" aria-label={isNew ? "Novo caso de atendimento" : `Caso ${contact.subject}`}>
        <header className="drawer-header">
          <div className="drawer-header-main">
            <span className="eyebrow">{isNew ? "Entrada manual" : "Caso de atendimento"}</span>
            <div className="drawer-header-title-row"><strong className="drawer-code">{isNew ? "NOVO CASO" : contact.id}</strong></div>
            {!isNew && <div className="drawer-header-context"><span className="drawer-context-item drawer-context-neutral">{contactChannelLabel(draft.channel)} · {draft.senderName}</span><span className="drawer-context-item drawer-context-date">Recebido {formatContactDate(draft.receivedAt, true)}</span></div>}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar caso"><X size={18} /></button>
        </header>
        <form id="contact-form" className="drawer-body contact-drawer-body" onSubmit={submit} onPaste={handlePaste}>
          <div className="drawer-title">
            <span className="contact-title-icon"><ChannelIcon size={18} aria-hidden="true" /></span>
            <label className="drawer-title-field" htmlFor="contact-subject">
              <span className="drawer-title-label">Assunto do caso</span>
              <input id="contact-subject" autoFocus={isNew} value={draft.subject} onChange={(event) => update("subject", event.target.value)} placeholder="Ex.: Solicitação de traslado" aria-label="Assunto do caso" disabled={!canEdit || saving} required />
            </label>
          </div>
          {!canEdit && <div className="contact-readonly-note"><UserRound size={16} /> Este caso está sob responsabilidade de outra pessoa.</div>}
          {!isNew && canEdit && <div className="contact-drawer-actions"><button className="button button-secondary" type="button" onClick={() => onCreateTask(contact)} disabled={saving}><Plus size={14} /> Criar task</button><span>O status do caso não muda.</span></div>}
          <div className="drawer-field-grid contact-core-grid">
            <label>Remetente<input value={draft.senderName} onChange={(event) => update("senderName", event.target.value)} disabled={!canEdit || saving} required /></label>
            <label>Canal<SearchableSelect value={draft.channel} onChange={(value) => update("channel", value)} options={CONTACT_CHANNELS.map((item) => ({ value: item.id, label: item.label }))} placeholder="Selecione o canal" clearable={false} disabled={!canEdit || saving} aria-label="Canal do caso" /></label>
            <label className="contact-channel-field">{channelFieldLabel}<input type={channelFieldType} value={draft[channelField] || ""} onChange={(event) => update(channelField, event.target.value)} disabled={!canEdit || saving} placeholder={draft.channel === "email" ? "nome@empresa.com" : "(00) 00000-0000"} /></label>
          </div>
          <div className="drawer-field-grid contact-quick-fields">
            <div className="drawer-status-priority-grid">
              <div className="status-field"><span className="status-field-label">Status</span><ContactStatusPicker value={draft.status} options={availableStatuses} onChange={(value) => update("status", value)} disabled={!canEdit || saving} /></div>
              <div className="priority-field"><span className="priority-field-label">Prioridade</span><ContactPriorityPicker value={draft.priority} onChange={(value) => update("priority", value)} disabled={!canEdit || saving} /></div>
            </div>
            <div className="drawer-assignment-deadline-grid contact-assignment-grid">
              <AssignmentFields form={draft} setForm={setAssignmentForm} employees={employees} teams={teams} />
              <label className="deadline-field">Prazo<input type="date" value={draft.dueDate || ""} onChange={(event) => update("dueDate", event.target.value)} disabled={!canEdit || saving} /></label>
            </div>
          </div>
          {draft.status === "resolved" && <label className="drawer-description contact-resolution-field">Resultado da resolução (opcional)<textarea value={draft.resolutionOutcome || ""} onChange={(event) => update("resolutionOutcome", event.target.value)} disabled={!canEdit || saving} placeholder="Ex.: retorno confirmado com o cliente" rows={2} /></label>}
          {assignmentChanged && <label className="drawer-description contact-transfer-field">Motivo da transferência (opcional)<input value={draft.transferReason || ""} onChange={(event) => update("transferReason", event.target.value)} disabled={!canEdit || saving} placeholder="Ex.: cobertura da operação" /></label>}
          <section className="drawer-section contact-context-section">
            <div className="drawer-section-heading"><h3>Mensagem recebida</h3><span className="contact-context-date">{formatContactDate(draft.lastMessageAt, true)}</span></div>
            <textarea className="contact-message-editor" value={draft.lastMessage || ""} onChange={(event) => update("lastMessage", event.target.value)} disabled={!canEdit || saving} rows={3} placeholder="Registre a mensagem ou o pedido recebido..." aria-label="Mensagem recebida" />
            <details className="contact-inline-details">
              <summary><span>Adicionar resumo interno</span><ChevronDown size={15} aria-hidden="true" /></summary>
              <label className="drawer-description">Resumo<textarea value={draft.summary || ""} onChange={(event) => update("summary", event.target.value)} disabled={!canEdit || saving} rows={2} placeholder="Uma linha para orientar a tratativa" /></label>
            </details>
          </section>
          <details className="contact-drawer-details">
            <summary><span>Cliente, cotação e origem</span><span className="contact-detail-summary-meta">{draft.clientId || draft.quoteId || draft.sourceUrl ? "Configurado" : "Opcional"}<ChevronDown size={15} aria-hidden="true" /></span></summary>
            <div className="contact-details-content">
              <div className="drawer-field-grid contact-links-grid">
                <label>Cliente<input value={draft.clientId || ""} onChange={(event) => update("clientId", event.target.value)} disabled={!canEdit || saving} placeholder="ID do cliente" /></label>
                <label>Cotação<SearchableSelect value={draft.quoteId || ""} onChange={(value) => update("quoteId", value)} options={quoteOptions} placeholder="Sem vínculo" disabled={!canEdit || saving} aria-label="Cotação vinculada" /></label>
              </div>
              {draft.sourceUrl && <a className="contact-source-link" href={draft.sourceUrl} target="_blank" rel="noreferrer">Abrir origem recebida</a>}
            </div>
          </details>
          {!isNew && (
            <details className="contact-drawer-details">
              <summary><span>Notas internas</span><span className="contact-detail-summary-meta">{contact.notes?.length || 0}<ChevronDown size={15} aria-hidden="true" /></span></summary>
              <div className="contact-details-content">{(contact.notes || []).map((item) => <div className="contact-note-row" key={item.id}><strong>{item.author || "Você"}</strong><p>{item.text}</p><small>{formatContactDate(item.createdAt, true)}</small></div>)}<div className="comment-compose"><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Registrar uma nota interna" disabled={!canEdit || saving} rows={2} /><button className="button button-secondary" type="button" onClick={addNote} disabled={!note.trim() || saving}><Plus size={14} /> Adicionar nota</button></div></div>
            </details>
          )}
          {AttachmentSectionComponent && <AttachmentSectionComponent taskId={isNew ? "new-contact" : contact.id} attachments={visibleAttachments} loadAttachmentContent={loadAttachmentContent} onAttachment={handleDraftAttachment} onDeleteAttachment={handleDraftAttachmentDelete} itemLabel="ao caso" helperText={isNew ? "Os arquivos só serão enviados quando você clicar em Criar caso." : "Arquivos usados na tratativa deste caso."} />}
          {!isNew && (
            <details className="contact-drawer-details" open={relatedTasks.length > 0}>
              <summary><span>Tasks vinculadas</span><span className="contact-detail-summary-meta">{relatedTasks.length}<ChevronDown size={15} aria-hidden="true" /></span></summary>
              <div className="contact-details-content">{relatedTasks.length ? relatedTasks.map((task) => <div className="contact-related-task" key={task.id}><span>{task.title}</span><small>{task.status === "done" ? "Concluída" : "Em acompanhamento"}</small></div>) : <p className="empty-inline">Nenhuma task vinculada.</p>}{!canEdit && <p className="contact-detail-hint">O responsável pelo caso pode criar uma task vinculada.</p>}<button className="button button-secondary contact-create-task" type="button" onClick={() => onCreateTask(contact)} disabled={!canEdit}><Plus size={14} /> Criar task</button></div>
            </details>
          )}
          {!isNew && <details className="contact-drawer-details"><summary><span>Histórico</span><span className="contact-detail-summary-meta">{contact.history?.length || 0}<ChevronDown size={15} aria-hidden="true" /></span></summary><div className="contact-details-content">{(contact.history || []).slice().reverse().map((item) => <div className="history-row" key={item.id}><span className="history-dot" /><div><strong>{item.text}</strong><small>{item.author || "Sistema"} · {formatContactDate(item.createdAt, true)}</small></div></div>)}</div></details>}
          {saveError && <div className="drawer-error" role="alert">{saveError}</div>}
        </form>
        <footer className="drawer-footer">
          <button className="button button-quiet" type="button" onClick={onClose}>Cancelar</button>
          {canEdit && <button className="button button-primary" type="submit" form="contact-form" disabled={saving}>{saving ? "Salvando…" : <><Check size={15} /> {isNew ? "Criar caso" : "Salvar alterações"}</>}</button>}
        </footer>
      </aside>
    </div>
  );
}

export default function ContactsView({
  contacts = [],
  employees = [],
  teams = [],
  quotes = [],
  tasks = [],
  currentEmployee,
  selectedContactId = "",
  contactLoading = false,
  contactLoadError = "",
  onSelect,
  onSave,
  onAddNote,
  onAttachment,
  onDeleteAttachment,
  loadAttachmentContent,
  onCreateTask,
  AttachmentSectionComponent,
}) {
  const [filters, setFilters] = useState({ query: "", channel: "", status: "", priority: "", owner: "" });
  const [creating, setCreating] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const selected = contacts.find((item) => item.id === selectedContactId);
  const visibleContacts = useMemo(() => sortContacts(filterContacts(contacts, { query: filters.query, channel: filters.channel ? [filters.channel] : [], status: filters.status ? [filters.status] : [], priority: filters.priority ? [filters.priority] : [], owner: filters.owner ? [filters.owner] : [] })), [contacts, filters]);
  useEffect(() => { if (selectedContactId && !selected) onSelect(""); }, [selectedContactId, selected, onSelect]);
  return (
    <div className="page-content contacts-page">
      <PageHeader eyebrow="Atendimento" title="Contatos" description="Organize os casos recebidos e mantenha cada retorno no responsável certo." action={<button className="button button-primary" type="button" onClick={() => setCreating(true)}><Plus size={15} /> Novo caso</button>} />
      <div className="metric-grid contact-metrics">
        {[{ id: "new", label: "Novos", value: contacts.filter((item) => item.status === "new").length, icon: MessageCircle }, { id: "in_progress", label: "Em atendimento", value: contacts.filter((item) => item.status === "in_progress").length, icon: Send }, { id: "waiting", label: "Aguardando", value: contacts.filter((item) => item.status === "waiting").length, icon: Clock3 }, { id: "overdue", label: "Vencidos", value: contacts.filter((item) => item.dueDate && item.dueDate < new Date().toISOString().slice(0, 10) && !["resolved", "archived"].includes(item.status)).length, icon: FileText }].map((metric) => { const Icon = metric.icon; return <article className="metric-card" key={metric.id}><span className="metric-icon"><Icon size={17} /></span><div><strong>{metric.value}</strong><span>{metric.label}</span></div></article>; })}
      </div>
      <div className={`filter-bar contacts-filter-bar ${filterOpen ? "is-expanded" : ""}`}>
        <button className="filter-toggle button button-quiet" type="button" onClick={() => setFilterOpen((value) => !value)}><span>Filtros</span><span>{filterOpen ? "−" : "+"}</span></button>
        <div className="search-field filter-search"><Search size={16} /><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Buscar assunto, remetente ou mensagem" aria-label="Buscar contatos" /></div>
        <div className="filter-bar-content"><select value={filters.channel} onChange={(event) => setFilters((current) => ({ ...current, channel: event.target.value }))} aria-label="Filtrar por canal"><option value="">Todos os canais</option>{CONTACT_CHANNELS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} aria-label="Filtrar por status"><option value="">Todos os status</option>{CONTACT_STATUSES.filter((item) => item.id !== "archived").map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))} aria-label="Filtrar por prioridade"><option value="">Todas as prioridades</option>{CONTACT_PRIORITIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><select value={filters.owner} onChange={(event) => setFilters((current) => ({ ...current, owner: event.target.value }))} aria-label="Filtrar por responsável"><option value="">Todos os responsáveis</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="button button-quiet" type="button" onClick={() => setFilters({ query: "", channel: "", status: "", priority: "", owner: "" })}>Limpar filtros</button></div>
      </div>
      <section className="panel contacts-panel"><div className="panel-heading"><div><span className="eyebrow">Inbox operacional</span><h2>Casos recebidos</h2></div><span className="panel-count">{visibleContacts.length}</span></div>{contactLoadError && <div className="contact-load-error" role="alert">{contactLoadError}</div>}{contactLoading ? <div className="contact-empty"><Clock3 size={25} /><strong>Carregando contatos…</strong></div> : visibleContacts.length ? <div className="contacts-list">{visibleContacts.map((contact) => { const ChannelIcon = CHANNEL_ICON[contact.channel] || MessageCircle; const StatusIcon = STATUS_ICON[contact.status] || CheckCircle2; return <button className={`contact-row priority-${contact.priority}`} key={contact.id} type="button" onClick={() => onSelect(contact.id)}><span className="contact-row-priority" /><span className="contact-row-main"><span className="contact-row-top"><strong>{contact.subject}</strong><span className={`badge contact-status-badge status-${contact.status}`}>{contactStatusLabel(contact.status)}</span></span><span className="contact-row-message">{contact.lastMessage || contact.summary || "Sem mensagem registrada."}</span><span className="contact-row-meta"><span><ChannelIcon size={13} /> {contact.senderName}</span><span><UserRound size={13} /> {contact.ownerName}</span><span><StatusIcon size={13} /> {contactChannelLabel(contact.channel)}</span></span></span><span className="contact-row-date"><time>{formatContactDate(contact.lastMessageAt, true)}</time>{contact.dueDate && <small className={contact.dueDate < new Date().toISOString().slice(0, 10) ? "is-overdue" : ""}>Prazo {formatContactDate(contact.dueDate)}</small>}</span></button>; })}</div> : <div className="contact-empty"><MessageCircle size={28} /><strong>Nenhum caso encontrado</strong><span>Novos contatos recebidos aparecerão nesta caixa.</span></div>}</section>
      {!creating && !selected && <button className="mobile-fab contacts-mobile-fab" type="button" onClick={() => setCreating(true)} aria-label="Criar novo caso" title="Novo caso"><Plus size={22} strokeWidth={2.5} aria-hidden="true" /></button>}
      {selected && <ContactDrawer contact={selected} currentEmployee={currentEmployee} employees={employees} teams={teams} quotes={quotes} tasks={tasks} AttachmentSectionComponent={AttachmentSectionComponent} loadAttachmentContent={loadAttachmentContent} onClose={() => onSelect("")} onSave={onSave} onAddNote={onAddNote} onAttachment={onAttachment} onDeleteAttachment={onDeleteAttachment} onCreateTask={onCreateTask} />}
      {creating && <ContactDrawer isNew currentEmployee={currentEmployee} employees={employees} teams={teams} quotes={quotes} tasks={tasks} AttachmentSectionComponent={AttachmentSectionComponent} loadAttachmentContent={loadAttachmentContent} onAttachment={onAttachment} onDeleteAttachment={onDeleteAttachment} onClose={() => setCreating(false)} onSave={async (draft) => { const success = await onSave(draft); if (success) setCreating(false); return success; }} />}
    </div>
  );
}
