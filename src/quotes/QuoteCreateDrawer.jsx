import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { QUOTE_CREATE_STEPS, validateQuoteStep } from "../quoteDomain";
import { QuoteClientFields, QuoteCommercialFields, QuoteServiceFields } from "./QuoteFields";
import MissingDeadlineDialog from "./MissingDeadlineDialog";

const INITIAL_DRAFT = { status: "Nova", priority: "medium", channel: "WhatsApp", assigneeIds: [], assigneeNames: [] };

function ReviewSection({ title, onEdit, children }) {
  return <section className="quote-v3-review-section"><header><h3>{title}</h3><button type="button" className="button button-quiet" onClick={onEdit}>Corrigir</button></header>{children}</section>;
}

export default function QuoteCreateDrawer({ employees = [], onClose, onCreate, AttachmentSectionComponent }) {
  const [draft, setDraft] = useState(INITIAL_DRAFT);
  const [attachments, setAttachments] = useState([]);
  const attachmentsRef = useRef([]);
  attachmentsRef.current = attachments;
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmMissingDeadline, setConfirmMissingDeadline] = useState(false);
  const initialFocusRef = useRef(null);
  const changed = attachments.length > 0 || JSON.stringify(draft) !== JSON.stringify(INITIAL_DRAFT);
  const step = QUOTE_CREATE_STEPS[stepIndex];
  const update = (key, value) => { setDraft((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: "" })); };
  const requestClose = () => changed && !saving ? setConfirmClose(true) : onClose?.();

  useEffect(() => { initialFocusRef.current?.focus(); }, []);
  useEffect(() => () => attachmentsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl)), []);
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === "Escape" && !confirmClose) requestClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const validateCurrent = () => {
    const result = validateQuoteStep(draft, step.id);
    setErrors(result.errors);
    if (!result.valid) setTimeout(() => document.getElementById(`quote-${Object.keys(result.errors)[0]?.replace("clientContact", "contact").replace("clientPhone", "phone").replace("clientEmail", "email").replace("serviceType", "service").replace("serviceDate", "service-date")}`)?.focus(), 0);
    return result.valid;
  };
  const next = () => { if (validateCurrent()) setStepIndex((current) => Math.min(current + 1, QUOTE_CREATE_STEPS.length - 1)); };
  const addAttachments = (_taskId, files) => setAttachments((current) => [
    ...current,
    ...Array.from(files || []).map((file) => ({
      id: `quote-${crypto.randomUUID()}`,
      name: file.name,
      mimeType: file.type,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
      file,
      syncStatus: "pending",
    })),
  ]);
  const removeAttachment = (_taskId, attachment) => {
    setAttachments((current) => current.filter((item) => item.id !== attachment.id));
    URL.revokeObjectURL(attachment.previewUrl);
  };
  const handlePaste = (event) => {
    const files = Array.from(event.clipboardData?.files || []);
    if (!files.length) return;
    event.preventDefault();
    addAttachments("paste", files);
  };
  const submit = async (confirmedWithoutDeadline = false) => {
    const result = validateQuoteStep(draft, "review");
    setErrors(result.errors);
    if (!result.valid) { document.getElementById("quote-review-errors")?.focus(); return; }
    if (!draft.deadline && !confirmedWithoutDeadline) { setConfirmMissingDeadline(true); return; }
    setConfirmMissingDeadline(false);
    setSaving(true); setSaveError("");
    try {
      const success = await onCreate?.({ ...draft, status: "Nova", attachments: attachments.map((item) => item.file) });
      if (success !== false) onClose?.();
      else setSaveError("Não foi possível criar a cotação. Revise os dados e tente novamente.");
    } catch (error) { setSaveError(error.message || "Não foi possível criar a cotação."); }
    finally { setSaving(false); }
  };

  return <div className="quote-v3-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
    <aside className="quote-v3-drawer quote-v3-create" role="dialog" aria-modal="true" aria-labelledby="quote-create-title">
      <header className="quote-v3-drawer-header"><div><span className="eyebrow">NOVA SOLICITAÇÃO</span><h2 id="quote-create-title">Criar cotação</h2></div><button ref={initialFocusRef} className="icon-button" type="button" onClick={requestClose} aria-label="Fechar cadastro"><X size={20} /></button></header>
      <ol className="quote-v3-stepper" aria-label="Etapas do cadastro">{QUOTE_CREATE_STEPS.map((item, index) => <li key={item.id} className={index === stepIndex ? "active" : index < stepIndex ? "done" : ""} aria-current={index === stepIndex ? "step" : undefined}><button type="button" disabled={index > stepIndex} onClick={() => setStepIndex(index)}><span>{index < stepIndex ? <Check size={14} /> : index + 1}</span>{item.label}</button></li>)}</ol>
      <div className="quote-v3-drawer-body" onPaste={handlePaste}><div className="quote-v3-step-progress" role="progressbar" aria-valuemin="1" aria-valuemax="4" aria-valuenow={stepIndex + 1}><span style={{ width: `${((stepIndex + 1) / 4) * 100}%` }} /></div>
        <div className="quote-v3-step-heading"><span>Etapa {stepIndex + 1} de 4</span><h3>{step.label}</h3></div>
        {step.id === "client" && <QuoteClientFields draft={draft} update={update} errors={errors} />}
        {step.id === "service" && <><QuoteServiceFields draft={draft} update={update} errors={errors} />{AttachmentSectionComponent && <AttachmentSectionComponent taskId="new-quote" attachments={attachments} onAttachment={addAttachments} onDeleteAttachment={removeAttachment} itemLabel="à cotação" helperText="Os arquivos serão enviados após criar a cotação." />}</>}
        {step.id === "commercial" && <QuoteCommercialFields draft={draft} update={update} errors={errors} />}
        {step.id === "review" && <div className="quote-v3-review">
          {Object.keys(errors).length > 0 && <div id="quote-review-errors" className="quote-v3-error-summary" role="alert" tabIndex="-1"><strong>Revise os campos abaixo:</strong><ul>{Object.entries(errors).map(([field, message]) => <li key={field}><button type="button" onClick={() => { const targetStep = STEP_BY_FIELD[field] ?? 0; setStepIndex(targetStep); setTimeout(() => document.querySelector(`[aria-invalid="true"]`)?.focus(), 0); }}>{message}</button></li>)}</ul></div>}
          <ReviewSection title="Cliente" onEdit={() => setStepIndex(0)}><p><strong>{draft.client}</strong> · {draft.clientContact}</p><p>{draft.channel}: {draft.channel === "E-mail" ? draft.clientEmail : draft.clientPhone}</p></ReviewSection>
          <ReviewSection title="Serviço" onEdit={() => setStepIndex(1)}><p>{draft.serviceType} · {draft.vehicleType || "Veículo a definir"}</p><p>{draft.origin} → {draft.destination}</p><p>{draft.serviceDate}</p>{draft.notes && <p className="quote-v3-review-request">Pedido do cliente: {draft.notes}</p>}{attachments.length > 0 && <p>{attachments.length} anexo(s) selecionado(s)</p>}</ReviewSection>
          <ReviewSection title="Prazo e comercial" onEdit={() => setStepIndex(2)}><p>Prazo: {draft.deadline} · Prioridade: {draft.priority}</p><p>Acompanhamento: Financeiro</p><p>{draft.value || "Valor não informado"}</p></ReviewSection>
        </div>}
        {saveError && <p className="quote-v3-save-error" role="alert">{saveError}</p>}
      </div>
      <footer className="quote-v3-drawer-footer"><button className="button button-quiet" type="button" onClick={requestClose}>Cancelar</button><div>{stepIndex > 0 && <button className="button button-secondary" type="button" onClick={() => setStepIndex((current) => current - 1)} disabled={saving}><ArrowLeft size={15} />Voltar</button>}{step.id === "review" ? <button className="button button-primary" type="button" onClick={() => submit()} disabled={saving}>{saving ? <><span className="quote-v3-spinner" />Criando cotação…</> : <><Check size={15} />Confirmar e criar</>}</button> : <button className="button button-primary" type="button" onClick={next}><span>Avançar</span><ArrowRight size={15} /></button>}</div></footer>
    </aside>
    {confirmMissingDeadline && <MissingDeadlineDialog onCancel={() => { setConfirmMissingDeadline(false); setStepIndex(2); }} onConfirm={() => submit(true)} />}
    {confirmClose && <div className="quote-v3-confirm-layer"><div className="quote-v3-dialog" role="alertdialog" aria-modal="true" aria-labelledby="quote-discard-title"><h3 id="quote-discard-title">Descartar alterações?</h3><p>Os dados desta cotação existem apenas neste navegador e serão perdidos.</p><div><button className="button button-secondary" type="button" onClick={() => setConfirmClose(false)}>Continuar editando</button><button className="button button-danger" type="button" onClick={onClose}>Descartar</button></div></div></div>}
  </div>;
}

const STEP_BY_FIELD = { title: 0, client: 0, clientContact: 0, channel: 0, clientPhone: 0, clientEmail: 0, serviceType: 1, origin: 1, destination: 1, notes: 1, serviceDate: 1, deadline: 2 };
