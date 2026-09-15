import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Copy, ExternalLink, FileText, Link2, Save, Send, X } from "lucide-react";
import { buildQuoteEmailHtml, copyQuoteToClipboard, getQuoteNextAction, QUOTE_OPEN_STATUSES, QUOTE_TERMINAL_STATUSES, quoteSubject, validateQuoteStep } from "../quoteDomain";
import { formatDate } from "../domain";
import { FormTextArea, QuoteClientFields, QuoteCommercialFields, QuoteServiceFields } from "./QuoteFields";

function StatusBadge({ status }) { return <span className="quote-v3-status"><span />{status || "Sem status"}</span>; }

function OutcomeDialog({ status, onCancel, onConfirm, saving }) {
  const [reason, setReason] = useState("");
  const needsReason = status === "Perdida";
  return <div className="quote-v3-confirm-layer"><form className="quote-v3-dialog" role="dialog" aria-modal="true" onSubmit={(event) => { event.preventDefault(); if (!needsReason || reason.trim()) onConfirm(reason.trim()); }}><h3>{status === "Convertida em serviço" ? "Confirmar conversão?" : status === "Perdida" ? "Registrar perda" : "Cancelar cotação?"}</h3><p>Esta ação encerra a cotação e conclui a tarefa vinculada.</p>{needsReason && <label htmlFor="quote-loss-reason">Motivo da perda<FormTextArea id="quote-loss-reason" autoFocus required rows="3" value={reason} onChange={(event) => setReason(event.target.value)} /></label>}<div><button className="button button-secondary" type="button" onClick={onCancel}>Voltar</button><button className={status === "Convertida em serviço" ? "button button-primary" : "button button-danger"} type="submit" disabled={saving || (needsReason && !reason.trim())}>{saving ? "Registrando…" : "Confirmar"}</button></div></form></div>;
}

export default function QuoteManagementDrawer({ quote, task, employees = [], onClose, onOpenTask, onEnsureTaskDetails, onUpdate, onMarkSent, onOutcome }) {
  const [tab, setTab] = useState("summary");
  const [draft, setDraft] = useState(quote);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [preview, setPreview] = useState(false);
  const [outcome, setOutcome] = useState("");
  const closeRef = useRef(null);
  const nextAction = getQuoteNextAction(draft);
  const history = useMemo(() => [...(task?.history || [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))), [task?.history]);
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  useEffect(() => { closeRef.current?.focus(); onEnsureTaskDetails?.(task?.id); }, [onEnsureTaskDetails, task?.id]);
  useEffect(() => { setDraft(quote); }, [quote]);
  useEffect(() => { const handler = (event) => { if (event.key === "Escape") preview ? setPreview(false) : onClose?.(); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [onClose, preview]);

  const run = async (operation, successMessage) => {
    setSaving(true); setFeedback("");
    try { const result = await operation(); if (result !== false) setFeedback(successMessage); return result; }
    catch (error) { setFeedback(error.message || "Não foi possível concluir a ação."); return false; }
    finally { setSaving(false); }
  };
  const save = async () => {
    const validation = validateQuoteStep(draft, "review"); setErrors(validation.errors);
    if (!validation.valid) { setFeedback("Revise os campos obrigatórios."); return; }
    await run(() => onUpdate?.(quote.id, draft), "Dados atualizados.");
  };
  const transition = async (status) => {
    if (QUOTE_TERMINAL_STATUSES.includes(status)) { setOutcome(status); return; }
    const result = await run(() => onUpdate?.(quote.id, { status, ...(status === "Nova" ? { responseSent: false, finalizationAt: "" } : {}) }), "Status atualizado.");
    if (result !== false) setDraft((current) => ({ ...current, status }));
  };
  const confirmOutcome = async (reason) => {
    const result = await run(() => onOutcome?.(quote.id, outcome, reason), "Resultado registrado.");
    if (result !== false) { setDraft((current) => ({ ...current, status: outcome, lossReason: reason })); setOutcome(""); }
  };
  const copy = async () => { await run(async () => { await copyQuoteToClipboard(draft, { baseUrl: window.location.origin }); return true; }, "Proposta copiada. Cole no corpo de uma nova mensagem do Outlook."); };
  const execute = (action) => { if (action.id === "copy") copy(); else if (action.id === "sent") run(() => onMarkSent?.(quote.id), "Envio registrado.").then((result) => { if (result !== false) setDraft((current) => ({ ...current, status: "Respondida ao cliente", responseSent: true })); }); else transition(action.status); };

  return <div className="quote-v3-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}><aside className="quote-v3-drawer quote-v3-management" role="dialog" aria-modal="true" aria-labelledby="quote-management-title">
    <header className="quote-v3-drawer-header"><div><span className="quote-code">{draft.code || "Sem número"}</span><h2 id="quote-management-title">{draft.client || draft.title}</h2><div className="quote-v3-header-meta"><StatusBadge status={draft.status} /><span>{task?.assigneeNames?.join(", ") || "Sem responsável"}</span><span className={draft.deadline && draft.deadline < new Date().toISOString().slice(0, 10) && QUOTE_OPEN_STATUSES.includes(draft.status) ? "danger-text" : ""}>Prazo {formatDate(draft.deadline)}</span></div></div><button ref={closeRef} className="icon-button" type="button" onClick={onClose} aria-label="Fechar cotação"><X size={20} /></button></header>
    <nav className="quote-v3-tabs" aria-label="Detalhes da cotação">{[["summary", "Resumo"], ["data", "Dados"], ["activity", "Atividade"]].map(([id, label]) => <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => { setTab(id); if (id === "activity") onEnsureTaskDetails?.(task?.id); }}>{label}</button>)}</nav>
    <div className="quote-v3-drawer-body">
      {tab === "summary" && <div className="quote-v3-summary"><section className="quote-v3-next-action"><span className="eyebrow">PRÓXIMA AÇÃO</span><h3>{nextAction.primary.label}</h3><p>{draft.status === "Respondida ao cliente" ? "Registre a decisão do cliente para encerrar o acompanhamento." : "Mantenha o status alinhado com a tarefa Financeiro."}</p></section><section className="quote-v3-facts"><div><span>Serviço</span><strong>{draft.serviceType || "Não informado"}</strong></div><div><span>Rota</span><strong>{draft.origin || "—"} → {draft.destination || "—"}</strong></div><div><span>Data</span><strong>{formatDate(draft.serviceDate)}</strong></div><div><span>Valor</span><strong>{draft.value || "Não informado"}</strong></div></section><section className="quote-v3-recent"><header><h3>Últimos eventos</h3><button className="button button-quiet" type="button" onClick={() => setTab("activity")}>Ver histórico</button></header>{task?.detailsLoading ? <p>Carregando atividade…</p> : task?.detailsError ? <p className="quote-v3-inline-warning">Histórico indisponível. As demais ações continuam disponíveis.</p> : history.slice(0, 3).map((item) => <article key={item.id}><span>{item.text}</span><small>{formatDate(item.createdAt)} · {item.author || "Sistema"}</small></article>)}</section></div>}
      {tab === "data" && <form className="quote-v3-data" onSubmit={(event) => { event.preventDefault(); save(); }}><section><h3>Cliente</h3><QuoteClientFields draft={draft} update={update} errors={errors} /></section><section><h3>Serviço</h3><QuoteServiceFields draft={draft} update={update} errors={errors} /></section><section><h3>Prazo e comercial</h3><QuoteCommercialFields draft={draft} update={update} errors={errors} employees={employees} /></section><button className="button button-primary" type="submit" disabled={saving}><Save size={15} />{saving ? "Salvando…" : "Salvar dados"}</button></form>}
      {tab === "activity" && <section className="quote-v3-activity">{task?.detailsLoading ? <p>Carregando histórico…</p> : task?.detailsError ? <div className="quote-v3-inline-warning"><strong>Histórico indisponível</strong><span>{task.detailsError}</span><button className="button button-secondary" type="button" onClick={() => onEnsureTaskDetails?.(task.id)}>Tentar novamente</button></div> : history.length ? history.map((item) => <article key={item.id}><span className="history-dot" /><div><strong>{item.text}</strong><small>{formatDate(item.createdAt)} · {item.author || "Sistema"}</small></div></article>) : <p>Nenhum evento registrado.</p>}</section>}
      {feedback && <p className="quote-v3-feedback" role="status">{feedback}</p>}
    </div>
    <footer className="quote-v3-drawer-footer quote-v3-management-footer"><div><button className="button button-secondary" type="button" onClick={() => setPreview(true)}><ExternalLink size={15} />Abrir prévia</button>{task && <button className="button button-quiet" type="button" onClick={() => onOpenTask?.(task.id)}><Link2 size={15} />Ver tarefa</button>}</div><div>{nextAction.secondary.map((action) => <button key={`${action.id}-${action.status}`} className="button button-secondary" type="button" disabled={saving} onClick={() => execute(action)}>{action.id === "sent" ? <Send size={15} /> : null}{action.label}</button>)}<button className="button button-primary" type="button" disabled={saving} onClick={() => execute(nextAction.primary)}>{nextAction.primary.id === "copy" ? <Copy size={15} /> : nextAction.primary.id === "outcome" ? <CheckCircle2 size={15} /> : null}{nextAction.primary.label}</button></div></footer>
  </aside>
  {preview && <div className="quote-v3-preview" role="dialog" aria-modal="true" aria-label="Prévia da cotação"><header><div><strong>Prévia para Outlook</strong><small>{quoteSubject(draft)}</small></div><button className="icon-button" type="button" onClick={() => setPreview(false)} aria-label="Fechar prévia"><X size={20} /></button></header><iframe title="Prévia da tabela para Outlook" srcDoc={buildQuoteEmailHtml(draft, { baseUrl: window.location.origin })} /></div>}
  {outcome && <OutcomeDialog status={outcome} saving={saving} onCancel={() => setOutcome("")} onConfirm={confirmOutcome} />}
  </div>;
}
