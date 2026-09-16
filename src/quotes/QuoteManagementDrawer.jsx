import React, { useEffect, useMemo, useRef, useState } from "react";
import { Copy, ExternalLink, Link2, Save, X } from "lucide-react";
import { buildQuoteEmailHtml, copyQuoteToClipboard, QUOTE_OPEN_STATUSES, quoteSubject, validateQuoteStep } from "../quoteDomain";
import { canRegisterWaitingReturn, formatDate, normalizeWaitingContext, validateWaitingContext } from "../domain";
import { QuoteClientFields, QuoteCommercialFields, QuoteServiceFields } from "./QuoteFields";
import MissingDeadlineDialog from "./MissingDeadlineDialog";

function StatusBadge({ status }) { return <span className="quote-v3-status"><span />{status || "Sem status"}</span>; }

export default function QuoteManagementDrawer({ quote, task, employees = [], teams = [], currentEmployee, WaitingContextFieldsComponent, ReturnsSectionComponent, onClose, onOpenTask, onEnsureTaskDetails, onUpdate, onRegisterWaitingReturn, onAttachment, onDeleteAttachment, loadAttachmentContent, AttachmentSectionComponent }) {
  const [tab, setTab] = useState("summary");
  const [draft, setDraft] = useState(quote);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirmMissingDeadline, setConfirmMissingDeadline] = useState(false);
  const [waitingContext, setWaitingContext] = useState(() => normalizeWaitingContext(task?.waitingContext));
  const [waitingError, setWaitingError] = useState("");
  const closeRef = useRef(null);
  const history = useMemo(() => [...(task?.history || [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))), [task?.history]);
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  useEffect(() => { closeRef.current?.focus(); onEnsureTaskDetails?.(task?.id); }, [onEnsureTaskDetails, task?.id]);
  useEffect(() => { setDraft(quote); }, [quote]);
  useEffect(() => { setWaitingContext(normalizeWaitingContext(task?.waitingContext)); setWaitingError(""); }, [task?.id, task?.waitingContext]);
  useEffect(() => { const handler = (event) => { if (event.key === "Escape") preview ? setPreview(false) : onClose?.(); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [onClose, preview]);

  const run = async (operation) => {
    setSaving(true);
    try { return await operation(); }
    catch { return false; }
    finally { setSaving(false); }
  };
  const save = async (confirmedWithoutDeadline = false) => {
    const validation = validateQuoteStep(draft, "review"); setErrors(validation.errors);
    if (!validation.valid) return;
    if (!draft.deadline && !confirmedWithoutDeadline) { setConfirmMissingDeadline(true); return; }
    setConfirmMissingDeadline(false);
    await run(() => onUpdate?.(quote.id, draft));
  };
  const saveWaitingContext = async () => {
    const validation = validateWaitingContext("waiting", waitingContext);
    if (!validation.allowed) { setWaitingError(validation.error); return; }
    setWaitingError("");
    const result = await run(() => onUpdate?.(quote.id, { waitingContext }));
    if (result === false) setWaitingError("Não foi possível salvar o contexto. Tente novamente.");
  };
  const waitingChanged = JSON.stringify(normalizeWaitingContext(task?.waitingContext)) !== JSON.stringify(waitingContext);
  const copy = async () => {
    setCopyFailed(false);
    const result = await run(() => copyQuoteToClipboard(draft, { baseUrl: window.location.origin }));
    if (result === false) setCopyFailed(true);
  };

  return <div className="quote-v3-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}><aside className="quote-v3-drawer quote-v3-management" role="dialog" aria-modal="true" aria-labelledby="quote-management-title">
    <header className="quote-v3-drawer-header"><div><span className="quote-code">{draft.code || "Sem número"}</span><h2 id="quote-management-title">{draft.client || draft.title}</h2><div className="quote-v3-header-meta"><StatusBadge status={draft.status} /><span>{task?.assigneeNames?.join(", ") || "Financeiro"}</span><span className={draft.deadline && draft.deadline < new Date().toISOString().slice(0, 10) && QUOTE_OPEN_STATUSES.includes(draft.status) ? "danger-text" : ""}>Prazo {formatDate(draft.deadline)}</span></div></div><button ref={closeRef} className="icon-button" type="button" onClick={onClose} aria-label="Fechar cotação"><X size={20} /></button></header>
    <nav className="quote-v3-tabs" aria-label="Detalhes da cotação">{[["summary", "Resumo"], ["data", "Dados"], ["activity", "Atividade"]].map(([id, label]) => <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => { setTab(id); if (id === "activity") onEnsureTaskDetails?.(task?.id); }}>{label}</button>)}</nav>
    <div className="quote-v3-drawer-body">
      {tab === "summary" && <div className="quote-v3-summary">
        <section className="quote-v3-facts"><div><span>Serviço</span><strong>{draft.serviceType || "Não informado"}</strong></div><div><span>Rota</span><strong>{draft.origin || "—"} → {draft.destination || "—"}</strong></div><div><span>Data</span><strong>{formatDate(draft.serviceDate)}</strong></div><div><span>Valor</span><strong>{draft.value || "Não informado"}</strong></div></section>
        {draft.status === "Aguardando informação" && task && WaitingContextFieldsComponent && <div className="quote-v3-waiting">
          <WaitingContextFieldsComponent value={waitingContext} onChange={setWaitingContext} employees={employees} teams={teams} error={waitingError} />
          <div className="quote-v3-waiting-actions">
            {canRegisterWaitingReturn(task, currentEmployee, teams) && onRegisterWaitingReturn && <button className="button button-secondary drawer-return-action" type="button" onClick={() => onRegisterWaitingReturn(task.id)}>Registrar retorno</button>}
            {waitingChanged && <button className="button button-primary" type="button" disabled={saving} onClick={saveWaitingContext}>{saving ? "Salvando…" : "Salvar contexto"}</button>}
          </div>
        </div>}
        {task && ReturnsSectionComponent && <ReturnsSectionComponent task={task} currentEmployee={currentEmployee} loadAttachmentContent={loadAttachmentContent} onDeleteAttachment={onDeleteAttachment} />}
        <section className="quote-v3-recent"><header><h3>Últimos eventos</h3><button className="button button-quiet" type="button" onClick={() => setTab("activity")}>Ver histórico</button></header>{task?.detailsLoading ? <p>Carregando atividade…</p> : task?.detailsError ? <p className="quote-v3-inline-warning">Histórico indisponível. As demais ações continuam disponíveis.</p> : history.slice(0, 3).map((item) => <article key={item.id}><span>{item.text}</span><small>{formatDate(item.createdAt)} · {item.author || "Sistema"}</small></article>)}</section>
      </div>}
      {tab === "data" && <><form className="quote-v3-data" onSubmit={(event) => { event.preventDefault(); save(); }}><section><h3>Cliente</h3><QuoteClientFields draft={draft} update={update} errors={errors} /></section><section><h3>Serviço</h3><QuoteServiceFields draft={draft} update={update} errors={errors} /></section><section><h3>Prazo e comercial</h3><QuoteCommercialFields draft={draft} update={update} errors={errors} /></section><button className="button button-primary" type="submit" disabled={saving}><Save size={15} />{saving ? "Salvando…" : "Salvar dados"}</button></form>{task && AttachmentSectionComponent && <AttachmentSectionComponent taskId={task.id} attachments={task.attachments || []} loadAttachmentContent={loadAttachmentContent} onAttachment={onAttachment} onDeleteAttachment={onDeleteAttachment} itemLabel="à cotação" helperText="Anexos da cotação ficam vinculados à tarefa de acompanhamento." />}</>}
      {tab === "activity" && <section className="quote-v3-activity">{task?.detailsLoading ? <p>Carregando histórico…</p> : task?.detailsError ? <div className="quote-v3-inline-warning"><strong>Histórico indisponível</strong><span>{task.detailsError}</span><button className="button button-secondary" type="button" onClick={() => onEnsureTaskDetails?.(task.id)}>Tentar novamente</button></div> : history.length ? history.map((item) => <article key={item.id}><span className="history-dot" /><div><strong>{item.text}</strong><small>{formatDate(item.createdAt)} · {item.author || "Sistema"}</small></div></article>) : <p>Nenhum evento registrado.</p>}</section>}
    </div>
    <footer className="quote-v3-drawer-footer quote-v3-management-footer"><div><button className="button button-secondary" type="button" onClick={() => setPreview(true)}><ExternalLink size={15} />Abrir prévia</button>{task && <button className="button button-quiet" type="button" onClick={() => onOpenTask?.(task.id)}><Link2 size={15} />Ver tarefa</button>}</div>{draft.status === "Cotada" && <button className="button button-primary" type="button" disabled={saving} onClick={copy}><Copy size={15} />{copyFailed ? "Falha ao copiar · tentar novamente" : "Copiar proposta"}</button>}</footer>
  </aside>
  {preview && <div className="quote-v3-preview" role="dialog" aria-modal="true" aria-label="Prévia da cotação"><header><div><strong>Prévia para Outlook</strong><small>{quoteSubject(draft)}</small></div><button className="icon-button" type="button" onClick={() => setPreview(false)} aria-label="Fechar prévia"><X size={20} /></button></header><iframe title="Prévia da tabela para Outlook" srcDoc={buildQuoteEmailHtml(draft, { baseUrl: window.location.origin })} /></div>}
  {confirmMissingDeadline && <MissingDeadlineDialog onCancel={() => { setConfirmMissingDeadline(false); document.getElementById("quote-deadline")?.focus(); }} onConfirm={() => save(true)} />}
  </div>;
}
