import React, { useEffect, useRef, useState } from "react";
import "./QuoteEmailComposer.css";
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
  const [editingPreview, setEditingPreview] = useState(false);
  const [previewEdited, setPreviewEdited] = useState(false);
  const [previewResetKey, setPreviewResetKey] = useState(0);
  const [inlineToolbarPosition, setInlineToolbarPosition] = useState(null);
  const closeRef = useRef(null);
  const composerController = useRef(null);
  const previewFrameRef = useRef(null);
  const previewViewportRef = useRef(null);
  const inlineToolbarRef = useRef(null);
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
  const positionInlineToolbar = () => {
    const frame = previewFrameRef.current;
    const viewport = previewViewportRef.current;
    const document = frame?.contentDocument;
    if (!document?.body.classList.contains("quote-email-editing") || !viewport) {
      setInlineToolbarPosition(null);
      return;
    }
    const selectionNode = document.getSelection()?.anchorNode;
    const selectionElement = selectionNode?.nodeType === 1 ? selectionNode : selectionNode?.parentElement;
    const target = selectionElement?.closest('[contenteditable="true"]') || document.activeElement?.closest?.('[contenteditable="true"]');
    if (!target) { setInlineToolbarPosition(null); return; }
    const frameRect = frame.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const toolbarWidth = inlineToolbarRef.current?.offsetWidth || 264;
    const toolbarHeight = inlineToolbarRef.current?.offsetHeight || 42;
    const left = Math.max(8, Math.min(frameRect.left - viewportRect.left + targetRect.left, viewport.clientWidth - toolbarWidth - 8));
    const above = frameRect.top - viewportRect.top + targetRect.top - toolbarHeight - 8;
    const below = frameRect.top - viewportRect.top + targetRect.bottom + 8;
    const top = above >= 8 ? above : Math.min(below, viewport.clientHeight - toolbarHeight - 8);
    setInlineToolbarPosition({ left, top });
  };
  const setPreviewEditing = (enabled) => {
    const document = previewFrameRef.current?.contentDocument;
    if (!document?.body) return;
    document.body.classList.toggle("quote-email-editing", enabled);
    let editorStyle = document.getElementById("quote-email-editor-style");
    if (enabled && !editorStyle) {
      editorStyle = document.createElement("style");
      editorStyle.id = "quote-email-editor-style";
      editorStyle.textContent = ".quote-email-editing p[contenteditable]:hover,.quote-email-editing td[contenteditable]:hover{outline:1px dashed #7da9ff;outline-offset:3px;cursor:text}.quote-email-editing p[contenteditable]:focus,.quote-email-editing td[contenteditable]:focus{outline:2px solid #3978e8;outline-offset:3px;border-radius:2px}";
      document.head.appendChild(editorStyle);
    } else if (!enabled) editorStyle?.remove();
    const editableBlocks = [...document.body.querySelectorAll("p, td")].filter((element) =>
      element.textContent.trim() && !element.querySelector("p, td, table, img") && !(element.tagName === "TD" && element.querySelector("p"))
    );
    editableBlocks.forEach((block) => {
      block.contentEditable = enabled ? "true" : "false";
      block.spellcheck = enabled;
    });
    document.body.querySelectorAll("img").forEach((image) => { image.contentEditable = "false"; image.draggable = false; });
    setEditingPreview(enabled);
    if (!enabled) setInlineToolbarPosition(null);
    else requestAnimationFrame(positionInlineToolbar);
    if (enabled) setComposerMessage("Edite os textos no preview. As mudanças entram no e-mail copiado; PDF e Word usam os dados salvos.");
    else setComposerMessage(previewEdited ? "Texto editado. Copiar, PDF e Word usarão exatamente esta versão." : "");
  };
  const getEditedPreview = () => {
    const document = previewFrameRef.current?.contentDocument;
    if (!document?.body) return {};
    const copy = document.documentElement.cloneNode(true);
    copy.querySelectorAll("[contenteditable]").forEach((element) => element.removeAttribute("contenteditable"));
    copy.querySelectorAll("[spellcheck]").forEach((element) => element.removeAttribute("spellcheck"));
    copy.querySelector("#quote-email-editor-style")?.remove();
    copy.querySelector("body")?.classList.remove("quote-email-editing");
    const body = copy.querySelector("body");
    if (body) body.style.removeProperty("zoom");
    return { html: `<!DOCTYPE html>${copy.outerHTML}`, text: document.body.innerText || document.body.textContent || "" };
  };
  const formatPreview = (command) => {
    const document = previewFrameRef.current?.contentDocument;
    if (!document?.execCommand(command, false)) return;
    requestAnimationFrame(positionInlineToolbar);
  };
  useEffect(() => {
    if (!composerOpen) return undefined;
    setEditingPreview(false);
    setPreviewEdited(false);
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
      const currentPreview = getEditedPreview();
      if (action === "copy") {
        await copyQuoteToClipboard(draft, { ...assets, ...(previewEdited ? getEditedPreview() : {}), signal: controller.signal });
        if (!controller.signal.aborted) setComposerMessage("Cotação copiada. Abra o Outlook app, crie um e-mail e cole com Ctrl+V.");
      } else if (action === "word") {
        const word = await createQuoteWord(draft, { baseUrl: window.location.origin, signal: controller.signal, assets, html: currentPreview.html });
        if (!controller.signal.aborted) { downloadQuoteWord(word); setComposerMessage("Word baixado com o mesmo visual do preview."); }
      } else if (action === "pdf") {
        const pdf = await createQuotePdf(draft, { baseUrl: window.location.origin, signal: controller.signal, assets, html: currentPreview.html });
        if (!controller.signal.aborted) { downloadQuotePdf(pdf); setComposerMessage("PDF baixado com o mesmo visual do preview."); }
      } else {
        const token = await acquireMailToken();
        let attachment;
        if (composerMode !== "body") {
          const result = attachmentFormat === "pdf"
            ? await createQuotePdf(draft, { baseUrl: window.location.origin, signal: controller.signal, assets, html: currentPreview.html })
            : await createQuoteWord(draft, { baseUrl: window.location.origin, signal: controller.signal, assets, html: currentPreview.html });
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
    <div className="quote-v3-preview-viewport" ref={previewViewportRef}>{editingPreview && inlineToolbarPosition && <div ref={inlineToolbarRef} className="quote-v3-inline-toolbar" role="toolbar" aria-label="Formatação do texto" style={inlineToolbarPosition}>{[["bold", <strong>B</strong>, "Negrito"], ["italic", <em>I</em>, "Itálico"], ["underline", <span style={{ textDecoration: "underline" }}>U</span>, "Sublinhado"], ["insertUnorderedList", "•", "Lista com marcadores"], ["insertOrderedList", "1.", "Lista numerada"]].map(([command, label, title]) => <button key={command} className="quote-v3-inline-format-button" type="button" title={title} aria-label={title} onMouseDown={(event) => event.preventDefault()} onClick={() => formatPreview(command)}>{label}</button>)}</div>}<iframe key={previewResetKey} ref={previewFrameRef} title="Proposta para Outlook" onLoad={() => { fitEmailPreview(); const document = previewFrameRef.current?.contentDocument; const syncToolbar = () => requestAnimationFrame(positionInlineToolbar); document?.addEventListener("selectionchange", syncToolbar); document?.body?.addEventListener("focusin", syncToolbar); document?.body?.addEventListener("mouseup", syncToolbar); document?.body?.addEventListener("keyup", syncToolbar); document?.body?.addEventListener("input", () => { setPreviewEdited(true); requestAnimationFrame(() => { fitEmailPreview(); positionInlineToolbar(); }); }); document?.body?.addEventListener("keydown", (event) => { if (event.key === "Tab" && event.target.isContentEditable) { event.preventDefault(); document.execCommand(event.shiftKey ? "outdent" : "indent", false); } }); document?.body?.addEventListener("paste", (event) => { if (!event.target.isContentEditable) return; event.preventDefault(); document.execCommand("insertText", false, event.clipboardData?.getData("text/plain") || ""); }); if (editingPreview) setPreviewEditing(true); }} srcDoc={previewHtml || buildQuoteEmailHtml(draft, { baseUrl: window.location.origin })} /></div>
    <footer className="quote-v3-composer-actions"><header className="quote-v3-preview-header"><div><span className="quote-v3-preview-kicker">Pré-visualização</span><strong>{quoteSubject(draft)}</strong></div><button className="icon-button" type="button" onClick={closeComposer} aria-label="Fechar montagem do email"><X size={20} /></button></header><span role="status">{composerBusy ? "Preparando arquivos…" : composerMessage || "O modelo copiado inclui as imagens."}</span><button className="button button-secondary" type="button" aria-pressed={editingPreview} disabled={Boolean(composerBusy) || !previewHtml} onClick={() => setPreviewEditing(!editingPreview)}>{editingPreview ? "Concluir edição" : "Editar texto"}</button>{previewEdited && <button className="button button-quiet" type="button" disabled={Boolean(composerBusy)} onClick={() => { setPreviewEdited(false); setEditingPreview(false); setPreviewResetKey((key) => key + 1); setComposerMessage("Edições descartadas."); }}>Reverter edições</button>}<button className="button button-primary" type="button" disabled={Boolean(composerBusy)} onClick={() => composeAction("copy")}><Copy size={15} />Copiar modelo completo</button><div><button className="button button-secondary" type="button" disabled={Boolean(composerBusy)} onClick={() => composeAction("pdf")}><Download size={15} />Baixar PDF</button><button className="button button-secondary" type="button" disabled={Boolean(composerBusy)} onClick={() => composeAction("word")}><Download size={15} />Baixar Word</button></div></footer>
  </section></div>}
  {confirmMissingDeadline && <MissingDeadlineDialog onCancel={() => { setConfirmMissingDeadline(false); document.getElementById("quote-deadline")?.focus(); }} onConfirm={() => save(true)} />}
  {resultOpen && <div className="quote-v3-confirm-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setResultOpen(false); }}><form className="quote-v3-dialog" role="dialog" aria-modal="true" aria-label="Registrar resultado da cotação" onSubmit={registerResult}><h3>Registrar resultado</h3><fieldset><legend>Resultado da cotação</legend>{["Aceita pelo cliente", "Perdida", "Cancelada"].map((status) => <label key={status}><input type="radio" name="quote-result" checked={resultStatus === status} onChange={() => { setResultStatus(status); setResultError(""); }} />{status}</label>)}</fieldset>{resultStatus === "Perdida" && <label htmlFor="quote-result-reason">Motivo da perda<textarea id="quote-result-reason" required maxLength={1000} value={lossReason} onChange={(event) => setLossReason(event.target.value)} /></label>}{resultError && <p role="alert">{resultError}</p>}<div><button className="button button-secondary" type="button" onClick={() => setResultOpen(false)}>Voltar</button><button className="button button-primary" type="submit" disabled={saving || (resultStatus === "Perdida" && !lossReason.trim())}>{saving ? "Salvando…" : "Confirmar"}</button></div></form></div>}
  {deleteOpen && <QuoteDeleteDialog quote={quote} onCancel={() => setDeleteOpen(false)} onDelete={onDeleteQuote} />}
  </div>;
}
