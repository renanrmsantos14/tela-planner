import React, { useEffect, useMemo, useState } from "react";
import { AlarmClock, CalendarDays, CircleHelp, FileText, LayoutGrid, List, Plus, Search, UserRound, UserRoundX } from "lucide-react";
import { formatDate } from "../domain";
import { filterQuotes, getQuoteMetrics, QUOTE_PRIORITIES, QUOTE_STATUSES, QUOTE_TERMINAL_STATUSES } from "../quoteDomain";
import QuoteCreateDrawer from "./QuoteCreateDrawer";
import QuoteKanban from "./QuoteKanban";
import QuoteManagementDrawer from "./QuoteManagementDrawer";
import { InputSelect } from "../AssignmentFields.jsx";
import { FormTextArea, FormTextInput } from "./QuoteFields";

const VIEW_KEY = "betinhos-quotes-hybrid-v3-view";

function QuoteStatus({ status }) { return <span className="quote-v3-status"><span />{status || "Sem status"}</span>; }

function MoveDialog({ move, saving, onCancel, onConfirm }) {
  const [reason, setReason] = useState("");
  const terminal = QUOTE_TERMINAL_STATUSES.includes(move.status);
  const loss = move.status === "Perdida";
  return <div className="quote-v3-confirm-layer"><form className="quote-v3-dialog" role="dialog" aria-modal="true" onSubmit={(event) => { event.preventDefault(); if (!loss || reason.trim()) onConfirm(reason.trim()); }}><h3>{terminal ? `Mover para ${move.status}?` : "Alterar status?"}</h3><p>{terminal ? "A cotação e a tarefa vinculada serão encerradas." : `${move.quote.code} passará para ${move.status}.`}</p>{loss && <label htmlFor="quote-move-reason">Motivo da perda<FormTextArea id="quote-move-reason" autoFocus required value={reason} onChange={(event) => setReason(event.target.value)} /></label>}<div><button className="button button-secondary" type="button" onClick={onCancel}>Voltar</button><button className="button button-primary" type="submit" disabled={saving || (loss && !reason.trim())}>{saving ? "Atualizando…" : "Confirmar"}</button></div></form></div>;
}

export default function HybridQuotesView({ state, onOpenTask, onCreateQuote, onUpdateQuote, onMarkQuoteSent, onSetQuoteOutcome, selectedQuoteId, onSelectQuote, onEnsureTaskDetails }) {
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState(() => { try { return localStorage.getItem(VIEW_KEY) || "list"; } catch { return "list"; } });
  const [filters, setFilters] = useState({ query: "", responsible: "", priority: "", status: "", deadline: "" });
  const [pendingMove, setPendingMove] = useState(null);
  const [moving, setMoving] = useState(false);
  const quotes = state.quotes || [];
  const tasks = state.tasks || [];
  const tasksByQuote = useMemo(() => new Map(tasks.filter((task) => task.quoteId && !task.parentTaskId).map((task) => [task.quoteId, task])), [tasks]);
  const filtered = useMemo(() => filterQuotes(quotes, tasks, filters), [filters, quotes, tasks]);
  const metrics = useMemo(() => getQuoteMetrics(quotes, tasks), [quotes, tasks]);
  const selectedQuote = quotes.find((quote) => quote.id === selectedQuoteId);
  const selectedTask = selectedQuote ? tasksByQuote.get(selectedQuote.id) : null;
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const changeView = (next) => { setView(next); try { localStorage.setItem(VIEW_KEY, next); } catch { /* storage opcional */ } };
  const requestMove = (quote, status) => { if (QUOTE_TERMINAL_STATUSES.includes(status)) setPendingMove({ quote, status }); else onUpdateQuote?.(quote.id, { status }); };
  const confirmMove = async (reason) => { setMoving(true); try { const result = await onSetQuoteOutcome?.(pendingMove.quote.id, pendingMove.status, reason); if (result !== false) setPendingMove(null); } finally { setMoving(false); } };
  useEffect(() => { if (view !== "list" && view !== "kanban") changeView("list"); }, [view]);

  return <div className="page-content quotes-page quote-v3-page" data-view="quotes"><div className="page-header"><div><span className="eyebrow">ACOMPANHAMENTO COMERCIAL</span><h1>Cotações</h1><p>Cadastre, priorize e acompanhe a resposta sem sair da gestão.</p></div><button className="button button-primary" type="button" onClick={() => setCreating(true)}><Plus size={15} />Nova cotação</button></div>
    <div className="quote-v3-metrics" aria-label="Indicadores de cotações">{[
      ["Ativas", metrics.active, FileText, "active", () => setFilters((current) => ({ ...current, status: "", deadline: "" }))],
      ["Atrasadas", metrics.overdue, AlarmClock, "overdue", () => setFilter("deadline", "overdue")],
      ["Vencem hoje", metrics.dueToday, CalendarDays, "today", () => setFilter("deadline", "today")],
      ["Aguardando", metrics.waiting, CircleHelp, "waiting", () => setFilter("status", "Aguardando informação")],
      ["Sem responsável", metrics.unassigned, UserRoundX, "unassigned", () => setFilter("responsible", "unassigned")],
    ].map(([label, value, Icon, tone, action]) => <button className={`quote-v3-metric quote-v3-metric-${tone}`} key={label} type="button" onClick={action}><span className="quote-v3-metric-icon" aria-hidden="true"><Icon size={17} strokeWidth={2} /></span><span className="quote-v3-metric-label">{label}</span><strong>{value}</strong></button>)}</div>
    <section className="panel quote-v3-panel"><div className="quote-v3-toolbar"><label className="search-field" htmlFor="quotes-search"><Search size={16} /><FormTextInput id="quotes-search" value={filters.query} onChange={(event) => setFilter("query", event.target.value)} placeholder="Buscar cotação, cliente ou serviço" /></label><InputSelect value={filters.responsible} onChange={(value) => setFilter("responsible", value)} options={[{ value: "unassigned", label: "Sem responsável" }, ...(state.employees || []).map((item) => ({ value: item.id, label: item.name }))]} placeholder="Responsável: todos" /><InputSelect value={filters.priority} onChange={(value) => setFilter("priority", value)} options={QUOTE_PRIORITIES.map((item) => ({ value: item.id, label: item.label }))} placeholder="Prioridade: todas" /><InputSelect value={filters.status} onChange={(value) => setFilter("status", value)} options={QUOTE_STATUSES} placeholder="Status: todos" /><InputSelect value={filters.deadline} onChange={(value) => setFilter("deadline", value)} options={[{ value: "overdue", label: "Atrasadas" }, { value: "today", label: "Vencem hoje" }, { value: "no-deadline", label: "Sem prazo" }]} placeholder="Prazo: todos" /><div className="quote-v3-view-toggle" aria-label="Visualização"><button type="button" className={view === "list" ? "active" : ""} aria-pressed={view === "list"} onClick={() => changeView("list")}><List size={15} />Lista</button><button type="button" className={view === "kanban" ? "active" : ""} aria-pressed={view === "kanban"} onClick={() => changeView("kanban")}><LayoutGrid size={15} />Kanban</button></div></div>
      <div className="quote-v3-results"><span>{filtered.length} cotações</span>{Object.values(filters).some(Boolean) && <button className="button button-quiet" type="button" onClick={() => setFilters({ query: "", responsible: "", priority: "", status: "", deadline: "" })}>Limpar filtros</button>}</div>
      {view === "kanban" ? <QuoteKanban quotes={filtered} tasksByQuote={tasksByQuote} onOpen={onSelectQuote} onMove={requestMove} /> : filtered.length ? <div className="quote-v3-list" role="table" aria-label="Cotações"><div className="quote-v3-list-head" role="row"><span>Cotação</span><span>Cliente</span><span>Status</span><span>Responsável</span><span>Prazo</span><span>Prioridade</span></div>{filtered.map((quote) => { const task = tasksByQuote.get(quote.id); return <button className="quote-v3-list-row" role="row" key={quote.id} type="button" onClick={() => onSelectQuote?.(quote.id)}><span className="quote-main"><b>{quote.code || "Sem número"}</b><small>{quote.title || "Sem título"}</small></span><strong>{quote.client || "Não informado"}</strong><QuoteStatus status={quote.status} /><span><UserRound size={13} />{task?.assigneeNames?.join(", ") || "Sem responsável"}</span><span className="quote-deadline"><CalendarDays size={13} />{formatDate(quote.deadline)}</span><span>{QUOTE_PRIORITIES.find((item) => item.id === quote.priority)?.label || "Média"}</span></button>; })}</div> : <div className="quotes-empty"><FileText size={26} /><strong>Nenhuma cotação encontrada</strong><span>Ajuste os filtros para ampliar o resultado.</span></div>}
    </section>
    {creating && <QuoteCreateDrawer employees={state.employees || []} onClose={() => setCreating(false)} onCreate={onCreateQuote} />}
    {selectedQuote && <QuoteManagementDrawer quote={selectedQuote} task={selectedTask} employees={state.employees || []} onClose={() => onSelectQuote?.("")} onOpenTask={(id) => { onSelectQuote?.(""); onOpenTask?.(id); }} onEnsureTaskDetails={onEnsureTaskDetails} onUpdate={onUpdateQuote} onMarkSent={onMarkQuoteSent} onOutcome={onSetQuoteOutcome} />}
    {pendingMove && <MoveDialog move={pendingMove} saving={moving} onCancel={() => setPendingMove(null)} onConfirm={confirmMove} />}
  </div>;
}
