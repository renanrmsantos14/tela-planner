import React, { useMemo, useState } from "react";
import { AlarmClock, CalendarDays, ChevronDown, CircleHelp, FileText, LayoutGrid, List, ListFilter, Plus, Search, UserRound, X } from "lucide-react";
import { formatDate } from "../domain";
import { filterQuotes, getQuoteMetrics, QUOTE_PRIORITIES, QUOTE_STATUSES, QUOTE_TERMINAL_STATUSES, validateQuoteCommercial } from "../quoteDomain";
import QuoteCreateDrawer from "./QuoteCreateDrawer";
import QuoteKanban from "./QuoteKanban";
import QuoteManagementDrawer from "./QuoteManagementDrawer";
import { SearchableMultiSelect } from "../SearchableSelect.jsx";
import { FormMoneyInput, FormTextArea, FormTextInput } from "./QuoteFields";
import { readQuoteViewPreference, saveQuoteViewPreference } from "./quoteViewPreference";

function QuoteStatus({ status }) { return <span className="quote-v3-status"><span />{status || "Sem status"}</span>; }

function MoveDialog({ move, task, saving, onCancel, onConfirm, onAttachment, onDeleteAttachment, loadAttachmentContent, AttachmentSectionComponent }) {
  const [reason, setReason] = useState("");
  const [value, setValue] = useState(move.quote.value || "");
  const [commercialTerms, setCommercialTerms] = useState(move.quote.commercialTerms || "");
  const [sentConfirmed, setSentConfirmed] = useState(false);
  const terminal = QUOTE_TERMINAL_STATUSES.includes(move.status);
  const loss = move.status === "Perdida";
  const commercial = ["Cotada", "Respondida ao cliente"].includes(move.status);
  const validCommercial = validateQuoteCommercial({ value, commercialTerms }).valid;
  return <div className="quote-v3-confirm-layer"><form className="quote-v3-dialog" role="dialog" aria-modal="true" onSubmit={(event) => { event.preventDefault(); if ((!loss || reason.trim()) && (!commercial || validCommercial) && (move.status !== "Respondida ao cliente" || sentConfirmed)) onConfirm(reason.trim(), commercial ? { value, commercialTerms, ...(move.status === "Respondida ao cliente" ? { responseSent: true } : {}) } : {}); }}><h3>{commercial ? "Informar dados comerciais" : terminal ? `Mover para ${move.status}?` : "Alterar status?"}</h3><p>{commercial ? "Informe o valor total e as condições comerciais da proposta." : terminal ? "A cotação e a tarefa vinculada serão encerradas." : `${move.quote.code} passará para ${move.status}.`}</p>{commercial && <><label htmlFor="quote-move-value">Valor total (BRL)<FormMoneyInput id="quote-move-value" autoFocus required value={value} onChange={(event) => setValue(event.target.value)} placeholder="R$ 0,00" /></label><label htmlFor="quote-move-terms">Condições comerciais<FormTextArea id="quote-move-terms" required rows="4" value={commercialTerms} onChange={(event) => setCommercialTerms(event.target.value)} /></label>{move.status === "Respondida ao cliente" && <label><input type="checkbox" checked={sentConfirmed} onChange={(event) => setSentConfirmed(event.target.checked)} />Confirmo que a proposta já foi enviada ao cliente.</label>}{task && AttachmentSectionComponent && <AttachmentSectionComponent taskId={task.id} attachments={task.attachments || []} loadAttachmentContent={loadAttachmentContent} onAttachment={onAttachment} onDeleteAttachment={onDeleteAttachment} itemLabel="à cotação" helperText="" showPreview={false} allowOpen={false} compact />}</>}{loss && <label htmlFor="quote-move-reason">Motivo da perda<FormTextArea id="quote-move-reason" autoFocus required rows="4" value={reason} onChange={(event) => setReason(event.target.value)} /></label>}<div><button className="button button-secondary" type="button" onClick={onCancel}>Voltar</button><button className="button button-primary" type="submit" disabled={saving || (loss && !reason.trim()) || (commercial && !validCommercial) || (move.status === "Respondida ao cliente" && !sentConfirmed)}>{saving ? "Atualizando…" : "Confirmar"}</button></div></form></div>;
}

export default function HybridQuotesView({ state, currentEmployee, WaitingContextFieldsComponent, ReturnsSectionComponent, onOpenTask, onCreateQuote, onUpdateQuote, onDeleteQuote, onRequestWaitingQuote, onRegisterWaitingReturn, onMarkQuoteSent, onSetQuoteOutcome, selectedQuoteId, onSelectQuote, onEnsureTaskDetails, onAttachment, onDeleteAttachment, loadAttachmentContent, AttachmentSectionComponent }) {
  const [creating, setCreating] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [view, setView] = useState(readQuoteViewPreference);
  const [filters, setFilters] = useState({ query: "", responsible: [], priority: [], status: [], deadline: [] });
  const [pendingMove, setPendingMove] = useState(null);
  const [moving, setMoving] = useState(false);
  const quotes = (state.quotes || []).filter((quote) => isQuoteOpen(quote.status));
  const tasks = state.tasks || [];
  const tasksByQuote = useMemo(() => new Map(tasks.filter((task) => task.quoteId && !task.parentTaskId).map((task) => [task.quoteId, task])), [tasks]);
  const filtered = useMemo(() => filterQuotes(quotes, tasks, filters), [filters, quotes, tasks]);
  const metrics = useMemo(() => getQuoteMetrics(quotes, tasks), [quotes, tasks]);
  const selectedQuote = quotes.find((quote) => quote.id === selectedQuoteId);
  const selectedTask = selectedQuote ? tasksByQuote.get(selectedQuote.id) : null;
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const changeView = (next) => { setView(next); saveQuoteViewPreference(next); };
  const requestMove = (quote, status) => { if (status === "Aguardando informação") onRequestWaitingQuote?.(quote.id); else if (["Cotada", "Respondida ao cliente"].includes(status) || QUOTE_TERMINAL_STATUSES.includes(status)) setPendingMove({ quote, status }); else onUpdateQuote?.(quote.id, { status }); };
  const confirmMove = async (reason, commercial = {}) => { setMoving(true); try { const result = ["Cotada", "Respondida ao cliente"].includes(pendingMove.status) ? await onUpdateQuote?.(pendingMove.quote.id, { status: pendingMove.status, ...commercial }) : await onSetQuoteOutcome?.(pendingMove.quote.id, pendingMove.status, reason); if (result !== false) setPendingMove(null); } finally { setMoving(false); } };

  return <div className="page-content quotes-page quote-v3-page" data-view="quotes"><div className="page-header"><div><span className="eyebrow">ACOMPANHAMENTO COMERCIAL</span><h1>Cotações</h1><p>Cadastre, priorize e acompanhe a resposta sem sair da gestão.</p></div><button className="button button-primary" type="button" onClick={() => setCreating(true)}><Plus size={15} />Nova cotação</button></div>
    <div className="quote-v3-metrics" aria-label="Indicadores de cotações">{[
      ["Ativas", metrics.active, FileText, "active", () => setFilters((current) => ({ ...current, status: [], deadline: [] }))],
      ["Atrasadas", metrics.overdue, AlarmClock, "overdue", () => setFilter("deadline", ["overdue"])],
      ["Vencem hoje", metrics.dueToday, CalendarDays, "today", () => setFilter("deadline", ["today"])],
      ["Aguardando", metrics.waiting, CircleHelp, "waiting", () => setFilter("status", ["Aguardando informação"])],
    ].map(([label, value, Icon, tone, action]) => <button className={`quote-v3-metric quote-v3-metric-${tone}`} key={label} type="button" onClick={action}><span className="quote-v3-metric-icon" aria-hidden="true"><Icon size={17} strokeWidth={2} /></span><span className="quote-v3-metric-label">{label}</span><strong>{value}</strong></button>)}</div>
    <section className="panel quote-v3-panel"><div className={`quote-v3-toolbar${filtersExpanded ? " is-expanded" : ""}`}>
      <div className="search-field"><Search size={16} /><FormTextInput id="quotes-search" aria-label="Buscar cotações" value={filters.query} onChange={(event) => setFilter("query", event.target.value)} placeholder="Buscar cotação, cliente ou serviço" />{filters.query && <button className="search-field-clear" type="button" aria-label="Limpar busca" onClick={() => setFilter("query", "")}><X size={14} /></button>}</div>
      <button className="quote-v3-filter-toggle" type="button" aria-expanded={filtersExpanded} onClick={() => setFiltersExpanded((value) => !value)}><ListFilter size={15} />Filtros<ChevronDown size={15} /></button>
      <div className="quote-v3-filter-controls">
      <SearchableMultiSelect value={filters.responsible} onChange={(value) => setFilter("responsible", value)} options={[{ value: "unassigned", label: "Sem responsável" }, ...(state.employees || []).map((item) => ({ value: item.id, label: item.name }))]} placeholder="Todos os responsáveis" />
      <SearchableMultiSelect value={filters.status} onChange={(value) => setFilter("status", value)} options={QUOTE_STATUSES.map((status) => ({ value: status, label: status }))} placeholder="Todos os status" />
      <SearchableMultiSelect value={filters.priority} onChange={(value) => setFilter("priority", value)} options={QUOTE_PRIORITIES.map((item) => ({ value: item.id, label: item.label }))} placeholder="Todas as prioridades" />
      <SearchableMultiSelect value={filters.deadline} onChange={(value) => setFilter("deadline", value)} options={[{ value: "overdue", label: "Atrasadas" }, { value: "today", label: "Vencem hoje" }, { value: "no-deadline", label: "Sem prazo" }]} placeholder="Todos os prazos" />
      </div>
      <div className="quote-v3-view-toggle" aria-label="Visualização"><button type="button" className={view === "list" ? "active" : ""} aria-pressed={view === "list"} onClick={() => changeView("list")}><List size={15} />Lista</button><button type="button" className={view === "kanban" ? "active" : ""} aria-pressed={view === "kanban"} onClick={() => changeView("kanban")}><LayoutGrid size={15} />Kanban</button></div>
    </div>
      {(filters.query || filters.responsible.length || filters.priority.length || filters.status.length || filters.deadline.length) > 0 && <div className="quote-v3-results"><span>{filtered.length} cotações</span><button className="button button-quiet" type="button" onClick={() => setFilters({ query: "", responsible: [], priority: [], status: [], deadline: [] })}>Limpar filtros</button></div>}
      {view === "kanban" ? <QuoteKanban quotes={filtered} tasksByQuote={tasksByQuote} currentEmployee={currentEmployee} teams={state.teams} onOpen={onSelectQuote} onRegisterWaitingReturn={onRegisterWaitingReturn} onMove={requestMove} /> : filtered.length ? <div className="quote-v3-list" role="table" aria-label="Cotações"><div className="quote-v3-list-head" role="row"><span>Cotação</span><span>Cliente</span><span>Status</span><span>Responsável</span><span>Prazo</span><span>Prioridade</span></div>{filtered.map((quote) => { const task = tasksByQuote.get(quote.id); return <button className="quote-v3-list-row" role="row" key={quote.id} type="button" onClick={() => onSelectQuote?.(quote.id)}><span className="quote-main"><b>{quote.code || "Sem número"}</b><small>{quote.title || "Sem título"}</small></span><strong>{quote.client || "Não informado"}</strong><QuoteStatus status={quote.status} /><span><UserRound size={13} />{task?.assigneeNames?.join(", ") || "Financeiro"}</span><span className="quote-deadline"><CalendarDays size={13} />{formatDate(quote.deadline)}</span><span>{QUOTE_PRIORITIES.find((item) => item.id === quote.priority)?.label || "Média"}</span></button>; })}</div> : <div className="quotes-empty"><FileText size={26} /><strong>Nenhuma cotação encontrada</strong><span>Ajuste os filtros para ampliar o resultado.</span></div>}
    </section>
    {creating && <QuoteCreateDrawer employees={state.employees || []} onClose={() => setCreating(false)} onCreate={onCreateQuote} AttachmentSectionComponent={AttachmentSectionComponent} />}
    {selectedQuote && <QuoteManagementDrawer quote={selectedQuote} task={selectedTask} employees={state.employees || []} teams={state.teams || []} currentEmployee={currentEmployee} WaitingContextFieldsComponent={WaitingContextFieldsComponent} ReturnsSectionComponent={ReturnsSectionComponent} onClose={() => onSelectQuote?.("")} onOpenTask={(id) => { onSelectQuote?.(""); onOpenTask?.(id); }} onEnsureTaskDetails={onEnsureTaskDetails} onUpdate={onUpdateQuote} onRequestWaiting={() => onRequestWaitingQuote?.(selectedQuote.id)} onRegisterWaitingReturn={onRegisterWaitingReturn} onMarkSent={onMarkQuoteSent} onOutcome={onSetQuoteOutcome} onAttachment={onAttachment} onDeleteAttachment={onDeleteAttachment} loadAttachmentContent={loadAttachmentContent} AttachmentSectionComponent={AttachmentSectionComponent} />}
    {pendingMove && <MoveDialog move={pendingMove} task={tasksByQuote.get(pendingMove.quote.id)} saving={moving} onCancel={() => setPendingMove(null)} onConfirm={confirmMove} onAttachment={onAttachment} onDeleteAttachment={onDeleteAttachment} loadAttachmentContent={loadAttachmentContent} AttachmentSectionComponent={AttachmentSectionComponent} />}
  </div>;
}
