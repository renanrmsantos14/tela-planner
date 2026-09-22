import React, { useEffect, useRef, useState } from "react";
import { Copy, Download, ExternalLink, Link2, Save, Trash2, X } from "lucide-react";
import { buildQuoteEmailHtml, copyQuoteToClipboard, loadQuoteImages, QUOTE_OPEN_STATUSES, QUOTE_TERMINAL_STATUSES, quoteSubject, validateQuoteStep } from "../quoteDomain";
import { createQuoteWord, downloadQuoteWord } from "../quoteWord";
import { createQuotePdf, downloadQuotePdf } from "../quotePdf";
import { acquireMailToken } from "../msalConfig";
import { createQuoteDraft, openDraftInOutlook } from "../mailGraph";
import { canRegisterWaitingReturn, formatDate, normalizeWaitingContext, validateWaitingContext } from "../domain";
import { QuoteClientFields, QuoteCommercialFields, QuoteServiceFields } from "./QuoteFields";
import MissingDeadlineDialog from "./MissingDeadlineDialog";
import TaskHistorySection from "../TaskHistorySection";
import QuoteDeleteDialog from "./QuoteDeleteDialog";

function StatusBadge({ status }) { return <span className="quote-v3-status"><span />{status || "Sem status"}</span>; }

export default function QuoteManagementDrawer({ quote, task, employees = [], teams = [], currentEmployee, WaitingContextFieldsComponent, ReturnsSectionComponent, onClose, onOpenTask, onEnsureTaskDetails, onUpdate, onOutcome, onDeleteQuote, onRegisterWaitingReturn, onAttachment, onDeleteAttachment, loadAttachmentContent, AttachmentSectionComponent }) {
  const [draft, setDraft] = useState(quote);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerBusy, setComposerBusy] = useState("");
  const [composerMessage, setComposerMessage] = useState("");
  const [composerMode, setComposerMode] = useState("body");
  const [attachmentFormat, setAttachmentFormat] = useState("pdf");
  const [composerEmail, setComposerEmail] = useState(quote.clientEmail || "");
  const [confirmMissingDeadline, setConfirmMissingDeadline] = useState(false);
  const [waitingContext, setWaitingContext] = useState(() => normalizeWaitingContext(task?.waitingContext));
  const [waitingError, setWaitingError] = useState("");
  const [resultOpen, setResultOpen] = useState(false);
  const [resultStatus, setResultStatus] = useState("Aceita pelo cliente");
  const [lossReason, setLossReason] = useState("");
  const [resultError, setResultError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const closeRef = useRef(null);
  const composerController = useRef(null);
  const previewFrameRef = useRef(null);
  const previewViewportRef = useRef(null);
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

  useEffect(() => { closeRef.current?.focus(); onEnsureTaskDetails?.(task?.id); }, [onEnsureTaskDetails, task?.id]);
  useEffect(() => { setDraft(quote); }, [quote]);
  useEffect(() => { setComposerEmail(quote.clientEmail || ""); }, [quote.clientEmail]);
  useEffect(() => { setWaitingContext(normalizeWaitingContext(task?.waitingContext)); setWaitingError(""); }, [task?.id, task?.waitingContext]);
  const closeComposer = () => { composerController.current?.abort(); composerController.current = null; setComposerBusy(""); setComposerMessage(""); setComposerOpen(false); };
  useEffect(() => { const handler = (event) => { if (event.key === "Escape") deleteOpen ? setDeleteOpen(false) : composerOpen ? closeComposer() : onClose?.(); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [onClose, composerOpen, deleteOpen]);
  useEffect(() => () => composerController.current?.abort(), []);
  const fitEmailPreview = () => {
    const frame = previewFrameRef.current;
    const viewport = previewViewportRef.current;
    const document = frame?.contentDocument;
    if (!document?.body || !viewport) return;
    document.body.style.zoom = "1";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    const naturalWidth = document.documentElement.scrollWidth || 794;
    const naturalHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
    const scale = Math.min(1, (viewport.clientWidth - 32) / naturalWidth, (viewport.clientHeight - 32) / naturalHeight);
    document.body.style.zoom = String(Math.max(.35, scale));
  };
  useEffect(() => {
    if (!composerOpen) return undefined;
    const controller = new AbortController();
    setPreviewHtml(buildQuoteEmailHtml(draft, { baseUrl: window.location.origin }));
    loadQuoteImages(draft, { baseUrl: window.location.origin, signal: controller.signal })
      .then((assets) => {
        if (!controller.signal.aborted) setPreviewHtml(buildQuoteEmailHtml(draft, { ...assets, baseUrl: window.location.origin }));
      })
      .catch(() => {});
    const viewport = previewViewportRef.current;
    const observer = viewport && typeof ResizeObserver !== "undefined" ? new ResizeObserver(fitEmailPreview) : null;
    if (viewport) observer?.observe(viewport);
    requestAnimationFrame(fitEmailPreview);
    return () => { controller.abort(); observer?.disconnect(); };
  }, [composerOpen, draft]);

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
  const registerResult = async (event) => {
    event.preventDefault();
    const reason = lossReason.trim();
    if (resultStatus === "Perdida" && !reason) { setResultError("Informe o motivo da perda."); return; }
    if (reason.length > 1000) { setResultError("Motivo da perda excede 1.000 caracteres."); return; }
    setResultError("");
    const success = await run(() => onOutcome?.(quote.id, resultStatus, reason));
    if (success === false) setResultError("Não foi possível registrar o resultado. Tente novamente.");
    else setResultOpen(false);
  };
  const reopen = async () => {
    const success = await run(() => onUpdate?.(quote.id, { status: "Nova", responseSent: false, finalizationAt: "", lossReason: "" }));
    if (success === false) setResultError("Não foi possível reabrir a cotação. Tente novamente.");
  };
  const composeAction = async (action) => {
    const controller = new AbortController();
    composerController.current = controller;
    setComposerBusy(action);
    setComposerMessage("");
    try {
      if (action === "draft" && !composerEmail.trim()) throw new Error("Informe o e-mail do cliente para criar o rascunho.");
      const assets = await loadQuoteImages(draft, { baseUrl: window.location.origin, signal: controller.signal });
      if (action === "copy") {
        await copyQuoteToClipboard(draft, { ...assets, signal: controller.signal });
        if (!controller.signal.aborted) setComposerMessage("Cotação copiada. Abra o Outlook app, crie um e-mail e cole com Ctrl+V.");
      } else if (action === "word") {
        const word = await createQuoteWord(draft, { baseUrl: window.location.origin, signal: controller.signal, assets });
        if (!controller.signal.aborted) { downloadQuoteWord(word); setComposerMessage("Modelo Word baixado com imagens incorporadas."); }
      } else if (action === "pdf") {
        const pdf = await createQuotePdf(draft, { baseUrl: window.location.origin, signal: controller.signal, assets });
        if (!controller.signal.aborted) { downloadQuotePdf(pdf); setComposerMessage("PDF baixado com imagens incorporadas."); }
      } else {
        const token = await acquireMailToken();
        let attachment;
        if (composerMode !== "body") {
          const result = attachmentFormat === "pdf"
            ? await createQuotePdf(draft, { baseUrl: window.location.origin, signal: controller.signal, assets })
            : await createQuoteWord(draft, { baseUrl: window.location.origin, signal: controller.signal, assets });
          attachment = { name: result.filename, bytes: new Uint8Array(await result.blob.arrayBuffer()), contentType: attachmentFormat === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
        }
        const draftResult = await createQuoteDraft({ token, quote: { ...draft, clientEmail: composerEmail.trim() }, mode: composerMode, attachment, assets: { ...assets, buildHtml: buildQuoteEmailHtml }, subject: quoteSubject(draft) });
        openDraftInOutlook(draftResult);
        if (!controller.signal.aborted) setComposerMessage("Rascunho criado no Outlook. Revise e envie manualmente; a cotação continua sem status de enviada.");
      }
    } catch (error) {
      if (!controller.signal.aborted) setComposerMessage(error.message || "Não foi possível preparar a proposta.");
    } finally {
      if (composerController.current === controller) { composerController.current = null; setComposerBusy(""); }
    }
  };

  return <div className="quote-v3-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}><aside className="quote-v3-drawer quote-v3-management" role="dialog" aria-modal="true" aria-labelledby="quote-management-title">
    <header className="quote-v3-drawer-header"><div><span className="quote-code">{draft.code || "Sem número"}</span><h2 id="quote-management-title">{draft.client || draft.title}</h2><div className="quote-v3-header-meta"><StatusBadge status={draft.status} /><span>{task?.assigneeNames?.join(", ") || "Financeiro"}</span><span className={draft.deadline && draft.deadline < new Date().toISOString().slice(0, 10) && QUOTE_OPEN_STATUSES.includes(draft.status) ? "danger-text" : ""}>Prazo {formatDate(draft.deadline)}</span></div></div><button ref={closeRef} className="icon-button" type="button" onClick={onClose} aria-label="Fechar cotação"><X size={20} /></button></header>
    <div className="quote-v3-drawer-body">
      <form className="quote-v3-data" onSubmit={(event) => { event.preventDefault(); save(); }}><section><h3>Cliente</h3><QuoteClientFields draft={draft} update={update} errors={errors} /></section><section><h3>Serviço</h3><QuoteServiceFields draft={draft} update={update} errors={errors} /></section><section><h3>Prazo e comercial</h3><QuoteCommercialFields draft={draft} update={update} errors={errors} /></section><button className="button button-primary" type="submit" disabled={saving}><Save size={15} />{saving ? "Salvando…" : "Salvar dados"}</button></form>
      {task && AttachmentSectionComponent && <AttachmentSectionComponent taskId={task.id} attachments={task.attachments || []} loadAttachmentContent={loadAttachmentContent} onAttachment={onAttachment} onDeleteAttachment={onDeleteAttachment} itemLabel="à cotação" helperText="Anexos da cotação ficam vinculados à tarefa de acompanhamento." />}
      {draft.status === "Aguardando informação" && task && WaitingContextFieldsComponent && <div className="quote-v3-waiting">
        <WaitingContextFieldsComponent value={waitingContext} onChange={setWaitingContext} employees={employees} teams={teams} error={waitingError} />
        <div className="quote-v3-waiting-actions">
          {canRegisterWaitingReturn(task, currentEmployee, teams) && onRegisterWaitingReturn && <button className="button button-secondary drawer-return-action" type="button" onClick={() => onRegisterWaitingReturn(task.id)}>Registrar retorno</button>}
          {waitingChanged && <button className="button button-primary" type="button" disabled={saving} onClick={saveWaitingContext}>{saving ? "Salvando…" : "Salvar contexto"}</button>}
        </div>
      </div>}
      {task && ReturnsSectionComponent && <ReturnsSectionComponent task={task} currentEmployee={currentEmployee} loadAttachmentContent={loadAttachmentContent} onDeleteAttachment={onDeleteAttachment} />}
      {QUOTE_TERMINAL_STATUSES.includes(draft.status) && <section className="quote-v3-result"><h3>Resultado</h3><strong>{draft.status}</strong><span>Finalizada em {draft.finalizationAt ? new Date(draft.finalizationAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "data não informada"}</span>{draft.status === "Perdida" && <p>Motivo: {draft.lossReason || "Não registrado"}</p>}</section>}
      <TaskHistorySection history={task?.history} employees={employees} loading={task?.detailsLoading} error={task?.detailsError} onRetry={task ? () => onEnsureTaskDetails?.(task.id) : undefined} />
    </div>
    <footer className="quote-v3-drawer-footer quote-v3-management-footer"><div><button className="button button-secondary" type="button" onClick={() => { setComposerMessage(""); setComposerOpen(true); }}><ExternalLink size={15} />Montar email</button>{task && <button className="button button-quiet" type="button" onClick={() => onOpenTask?.(task.id)}><Link2 size={15} />Ver tarefa</button>}{draft.status === "Respondida ao cliente" && <button className="button button-primary" type="button" disabled={saving} onClick={() => { setResultError(""); setResultOpen(true); }}>Registrar resultado</button>}{QUOTE_TERMINAL_STATUSES.includes(draft.status) && <button className="button button-secondary" type="button" disabled={saving} onClick={reopen}>Reabrir cotação</button>}{onDeleteQuote && <button className="button button-danger" type="button" disabled={saving} onClick={() => setDeleteOpen(true)}><Trash2 size={15} />Excluir cotação</button>}</div>{resultError && !resultOpen && <span role="alert">{resultError}</span>}</footer>
  </aside>
  {composerOpen && <div className="quote-v3-composer-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) closeComposer(); }}><section className="quote-v3-preview" role="dialog" aria-modal="true" aria-label="Montar email da cotação">
    <header className="quote-v3-preview-header"><div><span className="quote-v3-preview-kicker">Pré-visualização</span><strong>{quoteSubject(draft)}</strong></div><button className="icon-button" type="button" onClick={closeComposer} aria-label="Fechar montagem do email"><X size={20} /></button></header>
    <div className="quote-v3-preview-viewport" ref={previewViewportRef}><iframe ref={previewFrameRef} title="Proposta para Outlook" onLoad={fitEmailPreview} srcDoc={previewHtml || buildQuoteEmailHtml(draft, { baseUrl: window.location.origin })} /></div>
    <footer className="quote-v3-composer-actions"><span role="status">{composerBusy ? "Preparando arquivos…" : composerMessage}</span><button className="button button-primary" type="button" disabled={Boolean(composerBusy)} onClick={() => composeAction("copy")}><Copy size={15} />Copiar modelo completo</button><div><button className="button button-secondary" type="button" disabled={Boolean(composerBusy)} onClick={() => composeAction("pdf")}><Download size={15} />Baixar PDF</button><button className="button button-secondary" type="button" disabled={Boolean(composerBusy)} onClick={() => composeAction("word")}><Download size={15} />Baixar Word</button></div></footer>
  </section></div>}
  {confirmMissingDeadline && <MissingDeadlineDialog onCancel={() => { setConfirmMissingDeadline(false); document.getElementById("quote-deadline")?.focus(); }} onConfirm={() => save(true)} />}
  {resultOpen && <div className="quote-v3-confirm-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setResultOpen(false); }}><form className="quote-v3-dialog" role="dialog" aria-modal="true" aria-label="Registrar resultado da cotação" onSubmit={registerResult}><h3>Registrar resultado</h3><fieldset><legend>Resultado da cotação</legend>{["Aceita pelo cliente", "Perdida", "Cancelada"].map((status) => <label key={status}><input type="radio" name="quote-result" checked={resultStatus === status} onChange={() => { setResultStatus(status); setResultError(""); }} />{status}</label>)}</fieldset>{resultStatus === "Perdida" && <label htmlFor="quote-result-reason">Motivo da perda<textarea id="quote-result-reason" required maxLength={1000} value={lossReason} onChange={(event) => setLossReason(event.target.value)} /></label>}{resultError && <p role="alert">{resultError}</p>}<div><button className="button button-secondary" type="button" onClick={() => setResultOpen(false)}>Voltar</button><button className="button button-primary" type="submit" disabled={saving || (resultStatus === "Perdida" && !lossReason.trim())}>{saving ? "Salvando…" : "Confirmar"}</button></div></form></div>}
  {deleteOpen && <QuoteDeleteDialog quote={quote} onCancel={() => setDeleteOpen(false)} onDelete={onDeleteQuote} />}
  </div>;
}
