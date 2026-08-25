import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  ChevronDown,
  FileText,
  Link2,
  Search,
  X,
} from "lucide-react";
import { formatDate, normalizeText } from "./domain";

const DEFAULT_STATUS_ORDER = [
  "Nova",
  "Em análise",
  "Aguardando fornecedor",
  "Respondida",
];

const QUOTE_SORT_COLUMNS = [
  ["code", "Cotação"],
  ["client", "Cliente"],
  ["status", "Status"],
  ["deadline", "Prazo"],
  ["value", "Valor"],
];

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isOpenQuote(quote) {
  return normalizeText(quote?.status) !== "respondida";
}

function isOverdueQuote(quote) {
  return Boolean(quote?.deadline) && isOpenQuote(quote) && quote.deadline < todayKey();
}

function statusTone(status) {
  const normalized = normalizeText(status);
  if (normalized === "respondida") return "success";
  if (normalized === "aguardando fornecedor") return "warning";
  if (normalized === "em analise") return "action";
  return "neutral";
}

function QuoteStatus({ status }) {
  return (
    <span className={`quote-status quote-status-${statusTone(status)}`}>
      <span className="badge-dot" />
      {status || "Sem status"}
    </span>
  );
}

function quoteSortValue(quote, key) {
  if (key === "deadline") return quote.deadline || "9999-12-31";
  if (key === "value") {
    const value = Number.parseFloat(String(quote.value || "").replace(/[^0-9,-]/g, "").replace(".", "").replace(",", "."));
    return Number.isNaN(value) ? -1 : value;
  }
  return normalizeText(quote[key]);
}

function compareQuotes(left, right, key) {
  const leftValue = quoteSortValue(left, key);
  const rightValue = quoteSortValue(right, key);
  if (typeof leftValue === "number" && typeof rightValue === "number") return leftValue - rightValue;
  return String(leftValue).localeCompare(String(rightValue), "pt-BR");
}

export default function QuotesView({ state, onOpenTask }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState({ key: "", direction: "asc" });
  const [selectedQuote, setSelectedQuote] = useState(null);
  const quotes = state.quotes || [];
  const tasksByQuote = useMemo(() => {
    const map = new Map();
    (state.tasks || []).forEach((task) => {
      if (!task.quoteId || map.has(task.quoteId)) return;
      map.set(task.quoteId, task);
    });
    return map;
  }, [state.tasks]);
  const statuses = useMemo(() => {
    const available = new Set(quotes.map((quote) => quote.status).filter(Boolean));
    return [
      ...DEFAULT_STATUS_ORDER.filter((item) => available.has(item)),
      ...[...available].filter((item) => !DEFAULT_STATUS_ORDER.includes(item)),
    ];
  }, [quotes]);
  const filteredQuotes = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    const filtered = quotes.filter((quote) => {
      const matchesQuery = !normalizedQuery || [quote.code, quote.title, quote.client, quote.status]
        .some((value) => normalizeText(value).includes(normalizedQuery));
      return matchesQuery && (!status || quote.status === status);
    });
    if (!sort.key) return filtered;
    const direction = sort.direction === "desc" ? -1 : 1;
    return [...filtered].sort((left, right) => compareQuotes(left, right, sort.key) * direction || String(left.id).localeCompare(String(right.id)));
  }, [query, quotes, sort, status]);
  const metrics = useMemo(() => ({
    total: quotes.length,
    open: quotes.filter(isOpenQuote).length,
    answered: quotes.filter((quote) => normalizeText(quote.status) === "respondida").length,
    overdue: quotes.filter(isOverdueQuote).length,
  }), [quotes]);
  const selectSort = (key) => setSort((current) => ({
    key,
    direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
  }));
  const openQuoteDetails = (quote) => setSelectedQuote(quote);
  const selectedTask = selectedQuote ? tasksByQuote.get(selectedQuote.id) : null;

  return (
    <div className="page-content quotes-page" data-view="quotes">
      <div className="page-header">
        <div>
          <span className="eyebrow">ACOMPANHAMENTO COMERCIAL</span>
          <h1>Cotações</h1>
          <p>Consulte status, prazos e valores das cotações em andamento.</p>
        </div>
        <span className="quotes-readonly-note">
          <FileText size={15} />
          Consulta operacional
        </span>
      </div>

      <div className="metric-grid quotes-metrics">
        <div className="metric-card metric-navy"><div className="metric-icon"><FileText size={18} /></div><div><span>Total</span><strong>{metrics.total}</strong></div></div>
        <div className="metric-card metric-action"><div className="metric-icon"><Clock3 size={18} /></div><div><span>Em andamento</span><strong>{metrics.open}</strong></div></div>
        <div className="metric-card metric-success"><div className="metric-icon"><CheckCircle2 size={18} /></div><div><span>Respondidas</span><strong>{metrics.answered}</strong></div></div>
        <div className="metric-card metric-danger"><div className="metric-icon"><CalendarDays size={18} /></div><div><span>Prazo vencido</span><strong>{metrics.overdue}</strong></div></div>
      </div>

      <section className="panel quotes-panel">
        <div className="panel-heading quotes-panel-heading">
          <div>
            <span className="eyebrow">REGISTROS DISPONÍVEIS</span>
            <h2>Base de cotações</h2>
          </div>
          <span className="panel-count">{filteredQuotes.length}</span>
        </div>
        <div className="quotes-toolbar">
          <label className="search-field" htmlFor="quotes-search">
            <Search size={16} />
            <input
              id="quotes-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar número, cliente ou serviço"
            />
          </label>
          <label className="quotes-status-filter" htmlFor="quotes-status">
            <span>Status</span>
            <select id="quotes-status" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos os status</option>
              {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        {filteredQuotes.length ? (
          <div className="quotes-table" role="table" aria-label="Cotações">
            <div className="quotes-table-header" role="row">
              {QUOTE_SORT_COLUMNS.map(([key, label]) => (
                <div key={key} role="columnheader" aria-sort={sort.key === key ? `${sort.direction}ending` : "none"}>
                  <button className={sort.key === key ? "table-sort-button active" : "table-sort-button"} type="button" onClick={() => selectSort(key)}>
                    <span>{label}</span>
                    {sort.key === key && <ChevronDown className={sort.direction === "asc" ? "sort-icon ascending" : "sort-icon"} size={14} aria-hidden="true" />}
                  </button>
                </div>
              ))}
              <span>Ação</span>
            </div>
            {filteredQuotes.map((quote) => {
              const task = tasksByQuote.get(quote.id);
              const overdue = isOverdueQuote(quote);
              return (
                <div
                  className="quotes-table-row"
                  role="button"
                  tabIndex={0}
                  aria-label={`Abrir detalhes de ${quote.code || quote.title}`}
                  key={quote.id}
                  onClick={() => openQuoteDetails(quote)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openQuoteDetails(quote);
                    }
                  }}
                >
                  <div className="quote-main"><span className="quote-code">{quote.code || "Sem número"}</span><strong>{quote.title || "Sem título"}</strong></div>
                  <span className="quote-client">{quote.client || "Cliente não informado"}</span>
                  <QuoteStatus status={quote.status} />
                  <span className={`quote-deadline ${overdue ? "is-overdue" : ""}`}><CalendarDays size={13} />{formatDate(quote.deadline)}</span>
                  <strong className="quote-value">{quote.value || "—"}</strong>
                  {task ? (
                    <button className="quote-task-link" type="button" onClick={(event) => { event.stopPropagation(); onOpenTask?.(task.id); }}>
                      <Link2 size={14} />
                      Ver tarefa
                    </button>
                  ) : <span className="quote-no-task">Sem tarefa</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="quotes-empty" role="status">
            <FileText size={28} />
            <strong>Nenhuma cotação encontrada</strong>
            <span>Ajuste a busca ou o filtro de status.</span>
          </div>
        )}
      </section>
      {selectedQuote && (
        <div className="drawer-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedQuote(null); }}>
          <aside className="task-drawer quote-detail-drawer" aria-label={`Detalhes da cotação ${selectedQuote.code || ""}`}>
            <header className="drawer-header">
              <div>
                <span className="eyebrow">CONSULTA DE COTAÇÃO</span>
                <span className="drawer-code">{selectedQuote.code || "SEM NÚMERO"}</span>
              </div>
              <button className="icon-button" type="button" onClick={() => setSelectedQuote(null)} aria-label="Fechar detalhes da cotação"><X size={19} /></button>
            </header>
            <div className="drawer-body">
              <div className="quote-detail-title"><span className="quote-code">{selectedQuote.code || "Sem número"}</span><h2>{selectedQuote.title || "Sem título"}</h2></div>
              <div className="quote-detail-grid">
                <div><span>Cliente</span><strong>{selectedQuote.client || "Cliente não informado"}</strong></div>
                <div><span>Status</span><QuoteStatus status={selectedQuote.status} /></div>
                <div><span>Prazo de resposta</span><strong className={isOverdueQuote(selectedQuote) ? "danger-text" : ""}>{formatDate(selectedQuote.deadline)}</strong></div>
                <div><span>Valor cotado</span><strong>{selectedQuote.value || "—"}</strong></div>
              </div>
              <div className="quote-detail-note"><FileText size={16} /><span>Esta tela é somente para consulta. A criação e a solicitação de cotações acontecem fora do Planner.</span></div>
            </div>
            <footer className="drawer-footer">
              {selectedTask && <button className="button button-secondary" type="button" onClick={() => { setSelectedQuote(null); onOpenTask?.(selectedTask.id); }}><Link2 size={15} />Ver tarefa vinculada</button>}
              <button className="button button-quiet" type="button" onClick={() => setSelectedQuote(null)}>Fechar</button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}
