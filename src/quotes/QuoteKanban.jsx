import React, { memo, useCallback, useMemo } from "react";
import { BadgeDollarSign, CalendarDays, CircleHelp, ClipboardList, Clock3, FileText, GripVertical, ScanSearch, Send } from "lucide-react";
import { QUOTE_OPEN_STATUSES, QUOTE_PRIORITIES } from "../quoteDomain";
import { formatDate, waitingContextSummary } from "../domain";
import KanbanBoard from "../KanbanBoard.jsx";

const STATUS_META = {
  "Nova": { tone: "neutral", Icon: ClipboardList },
  "Em análise pelo financeiro": { tone: "action", Icon: ScanSearch },
  "Aguardando informação": { tone: "warning", Icon: CircleHelp },
  "Cotada": { tone: "purple", Icon: BadgeDollarSign },
  "Respondida ao cliente": { tone: "success", Icon: Send },
};

const PRIORITY_TONES = { low: "neutral", medium: "action", high: "warning", urgent: "danger" };
const TODAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const QuoteCard = memo(function QuoteCard({ quote, task, isDragging, onOpen, onDragStart, onDragEnd }) {
  const priority = QUOTE_PRIORITIES.find((item) => item.id === quote.priority) || QUOTE_PRIORITIES[1];
  const overdue = Boolean(quote.deadline && quote.deadline < TODAY);
  const waitingSummary = quote.status === "Aguardando informação" ? waitingContextSummary(task?.waitingContext) : "";
  return <article
    className={`task-card quote-kanban-card${overdue ? " task-overdue" : ""}${isDragging ? " task-card-dragging" : ""}`}
    draggable
    tabIndex="0"
    data-kanban-id={quote.id}
    onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/quote-id", quote.id); onDragStart(event); }}
    onDragEnd={onDragEnd}
    onClick={() => onOpen?.(quote.id)}
    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen?.(quote.id); } }}
  >
    <div className="task-card-top"><span className={`priority priority-${PRIORITY_TONES[priority.id] || "neutral"}`} aria-label={`Prioridade: ${priority.label}`}>{priority.label}</span>{overdue && <span className="overdue-label">Vencida</span>}<span className={overdue ? "date-chip overdue" : "date-chip"} title={`Prazo: ${formatDate(quote.deadline)}`}><CalendarDays size={13} aria-hidden="true" />{formatDate(quote.deadline)}</span></div>
    <div className="task-card-title-row"><h3>{quote.client || quote.title || "Cotação sem cliente"}</h3></div>
    <div className="task-link"><GripVertical size={13} aria-hidden="true" /><FileText size={13} aria-hidden="true" /><em>{quote.code || "Sem número"}{quote.title ? ` · ${quote.title}` : ""}</em></div>
    {waitingSummary && <div className="task-waiting-summary" title={waitingSummary}><Clock3 size={13} /><span>{waitingSummary}</span></div>}
    {(quote.serviceType || quote.origin || quote.destination) && <p className="task-description">{[quote.serviceType, [quote.origin, quote.destination].filter(Boolean).join(" → ")].filter(Boolean).join(" · ")}</p>}
  </article>;
});

export default function QuoteKanban({ quotes, tasksByQuote, onOpen, onMove }) {
  const columns = useMemo(() => QUOTE_OPEN_STATUSES.map((status) => ({ id: status, label: status, tone: STATUS_META[status]?.tone || "neutral" })), []);
  const quotesByColumn = useMemo(() => Object.fromEntries(QUOTE_OPEN_STATUSES.map((status) => [status, quotes.filter((quote) => quote.status === status)])), [quotes]);
  const getSourceColumnId = useCallback((quote) => quote?.status || "", []);
  const getDropIndex = useCallback((grouped, columnId, draggedQuote) => {
    if (!draggedQuote) return 0;
    return [...(grouped[columnId] || []), draggedQuote].sort((left, right) => String(left.deadline || "9999-12-31").localeCompare(String(right.deadline || "9999-12-31"))).findIndex((quote) => quote.id === draggedQuote.id);
  }, []);
  const handleMove = useCallback((quote, status) => {
    if (!status || status === quote.status) return false;
    return onMove?.(quote, status);
  }, [onMove]);
  const handleBoardMove = useCallback((quoteId, column) => {
    const quote = quotes.find((item) => item.id === quoteId);
    return quote ? handleMove(quote, column.id) : false;
  }, [handleMove, quotes]);
  return <div className="quote-v3-kanban-shell" aria-label="Kanban de cotações"><KanbanBoard
    items={quotes}
    columns={columns}
    itemsByColumn={quotesByColumn}
    getSourceColumnId={getSourceColumnId}
    getDropIndex={getDropIndex}
    onMove={handleBoardMove}
    itemLabel="cotação"
    itemLabelPlural="cotações"
    transferType="text/quote-id"
    renderColumnIcon={(column) => { const Icon = STATUS_META[column.id]?.Icon || ClipboardList; return <Icon className={`status-column-icon status-column-icon-${column.tone}`} size={17} strokeWidth={2.2} aria-hidden="true" />; }}
    renderCard={(quote, dragProps) => <QuoteCard key={quote.id} quote={quote} task={tasksByQuote.get(quote.id)} onOpen={onOpen} {...dragProps} />}
  /></div>;
}
