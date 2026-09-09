import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  ChevronDown,
  FileText,
  Link2,
  Plus,
  Save,
  ArrowLeft,
  Eye,
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

const QUOTE_FORM_FIELDS = [
  ["client", "Cliente / empresa", "text"], ["clientContact", "Contato", "text"], ["clientEmail", "E-mail", "email"], ["clientPhone", "WhatsApp / telefone", "tel"],
  ["serviceType", "Tipo de serviço", "text"], ["vehicleType", "Tipo de veículo", "text"], ["origin", "Origem", "text"], ["destination", "Destino", "text"],
  ["passengers", "Passageiros", "number"], ["serviceDate", "Data/hora do serviço", "datetime-local"], ["returnDate", "Data/hora do retorno", "datetime-local"],
  ["deadline", "Prazo para responder", "date"], ["value", "Valor cotado", "text"], ["commercialTerms", "Condição comercial", "textarea"], ["notes", "Observações do pedido", "textarea"],
];

function QuoteWorkspace({ quote, onBack, onSave, saving = false }) {
  const [draft, setDraft] = useState(() => ({ status: "Nova", priority: "medium", ...(quote || {}) }));
  const [preview, setPreview] = useState(false);
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = (event) => { event.preventDefault(); if (!draft.title?.trim() || !draft.client?.trim()) return; onSave?.(draft); };
  const previewName = draft.clientContact || draft.client || "cliente";
  return (
    <section className="panel quote-workspace" role="dialog" aria-modal="true" aria-label={quote ? `Editar cotação ${quote.code}` : "Nova cotação"}>
      <header className="quote-workspace-header">
        <div><button className="button button-quiet" type="button" onClick={onBack}><ArrowLeft size={15} />Voltar para a lista</button><span className="eyebrow">{quote ? "EDIÇÃO OPERACIONAL" : "NOVA SOLICITAÇÃO"}</span><h2>{quote ? `${quote.code || "Cotação"} · editar` : "Criar cotação"}</h2></div>
        <div className="quote-workspace-actions"><button className="button button-secondary" type="button" onClick={() => setPreview((value) => !value)}><Eye size={15} />{preview ? "Ocultar prévia" : "Prévia do e-mail"}</button><button className="button button-primary" type="submit" form="quote-workspace-form" disabled={saving}><Save size={15} />{saving ? "Salvando…" : "Salvar cotação"}</button></div>
      </header>
      <div className="quote-workspace-layout">
        <form id="quote-workspace-form" className="quote-form" onSubmit={submit}>
          <div className="quote-form-section"><span className="eyebrow">IDENTIFICAÇÃO</span><label>Título<input required value={draft.title || ""} onChange={(event) => update("title", event.target.value)} placeholder="Ex.: Transfer executivo · Aeroporto GRU" /></label><div className="quote-form-grid"><label>Status<select value={draft.status || "Nova"} onChange={(event) => update("status", event.target.value)}>{DEFAULT_STATUS_ORDER.map((item) => <option key={item}>{item}</option>)}</select></label><label>Prioridade<select value={draft.priority || "medium"} onChange={(event) => update("priority", event.target.value)}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></label></div></div>
          <div className="quote-form-section"><span className="eyebrow">DADOS DA SOLICITAÇÃO</span><div className="quote-form-grid">{QUOTE_FORM_FIELDS.map(([key, label, type]) => <label key={key}>{label}{type === "textarea" ? <textarea rows={3} value={draft[key] || ""} onChange={(event) => update(key, event.target.value)} /> : <input type={type} value={draft[key] || ""} onChange={(event) => update(key, event.target.value)} />}</label>)}</div></div>
          <p className="quote-form-hint">Ao salvar uma nova cotação, o acompanhamento principal é criado junto no modo local. No Dataverse, a operação será liberada após publicação do contrato transacional.</p>
        </form>
        {preview && <aside className="quote-email-preview" aria-label="Prévia do e-mail da cotação"><div className="quote-email-preview-bar"><span>Prévia do e-mail</span><small>{draft.code || "Rascunho"}</small></div><div className="quote-email-sheet"><strong>Olá, {previewName}.</strong><p>Recebemos sua solicitação de cotação e preparamos um resumo executivo dos dados registrados.</p><hr /><h3>{draft.title || "Nova cotação"}</h3><dl><div><dt>Serviço</dt><dd>{draft.serviceType || "A definir"}</dd></div><div><dt>Veículo</dt><dd>{draft.vehicleType || "A definir"}</dd></div><div><dt>Rota</dt><dd>{[draft.origin, draft.destination].filter(Boolean).join(" → ") || "A definir"}</dd></div><div><dt>Valor</dt><dd>{draft.value || "Em composição"}</dd></div></dl><p className="quote-email-note">Valores e condições sujeitos à validação operacional e comercial.</p></div></aside>}
      </div>
    </section>
  );
}

export default function QuotesView({ state, onOpenTask, onCreateQuote, onUpdateQuote, workspaceEnabled = true }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState({ key: "", direction: "asc" });
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [editingQuote, setEditingQuote] = useState(null);
  const [savingQuote, setSavingQuote] = useState(false);
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
          <p>{workspaceEnabled ? "Gerencie dados, prazos, valores e acompanhamento das cotações." : "Consulte status, prazos e valores das cotações em andamento."}</p>
        </div>
          {workspaceEnabled && <button className="button button-primary" type="button" onClick={() => setEditingQuote({})}><Plus size={15} />Nova cotação</button>}
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
      {workspaceEnabled && editingQuote && <div className="quote-workspace-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingQuote(null); }}><QuoteWorkspace quote={editingQuote.id ? quotes.find((item) => item.id === editingQuote.id) || editingQuote : editingQuote} saving={savingQuote} onBack={() => setEditingQuote(null)} onSave={(draft) => { setSavingQuote(true); const operation = draft.id ? onUpdateQuote?.(draft.id, draft) : onCreateQuote?.(draft); Promise.resolve(operation).finally(() => setSavingQuote(false)).then((success) => { if (success !== false) setEditingQuote(null); }); }} /></div>}
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
              <div className="quote-detail-note"><FileText size={16} /><span>{workspaceEnabled ? "Dados comerciais e operacionais podem ser editados no workspace da cotação." : "Esta tela é somente para consulta. A criação e a solicitação de cotações acontecem fora do Planner."}</span></div>
            </div>
            <footer className="drawer-footer">
              {workspaceEnabled && <button className="button button-primary" type="button" onClick={() => { setEditingQuote(selectedQuote); setSelectedQuote(null); }}><Save size={15} />Editar cotação</button>}
              {selectedTask && <button className="button button-secondary" type="button" onClick={() => { setSelectedQuote(null); onOpenTask?.(selectedTask.id); }}><Link2 size={15} />Ver tarefa vinculada</button>}
              <button className="button button-quiet" type="button" onClick={() => setSelectedQuote(null)}>Fechar</button>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}
