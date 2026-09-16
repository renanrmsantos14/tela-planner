import React, { forwardRef } from "react";
import { QUOTE_CHANNELS, QUOTE_PRIORITIES } from "../quoteDomain";
import { InputSelect } from "../AssignmentFields.jsx";
import { useQuoteServiceTypes } from "../useQuoteServiceTypes.js";

export function QuoteField({ id, label, error, required = false, wide = false, children }) {
  return <label className={`quote-v3-field drawer-title-field${wide ? " quote-v3-field-wide" : ""}${error ? " is-invalid" : ""}`} htmlFor={id}>
    <span className="drawer-title-label">{label}{required && <b aria-hidden="true"> *</b>}</span>
    {children}
    {error && <small id={`${id}-error`} className="quote-v3-field-error">{error}</small>}
  </label>;
}

export const FormTextInput = forwardRef(function FormTextInput({ error, className = "", ...props }, ref) {
  const errorId = props.id && error ? `${props.id}-error` : undefined;
  return <input ref={ref} {...props} className={`form-general-input${className ? ` ${className}` : ""}`} aria-invalid={error ? true : undefined} aria-describedby={errorId || props["aria-describedby"]} />;
});

export const FormTextArea = forwardRef(function FormTextArea({ error, className = "", ...props }, ref) {
  const errorId = props.id && error ? `${props.id}-error` : undefined;
  return <textarea ref={ref} {...props} className={`form-general-input form-general-textarea${className ? ` ${className}` : ""}`} aria-invalid={error ? true : undefined} aria-describedby={errorId || props["aria-describedby"]} />;
});

export function QuoteClientFields({ draft, update, errors = {} }) {
  return <div className="quote-v3-form-grid">
    <QuoteField id="quote-title" label="Título interno" required error={errors.title} wide><FormTextInput id="quote-title" error={errors.title} value={draft.title || ""} onChange={(event) => update("title", event.target.value)} placeholder="Ex.: Transfer executivo · GRU" /></QuoteField>
    <QuoteField id="quote-client" label="Cliente / empresa" required error={errors.client}><FormTextInput id="quote-client" error={errors.client} value={draft.client || ""} onChange={(event) => update("client", event.target.value)} /></QuoteField>
    <QuoteField id="quote-contact" label="Contato" required error={errors.clientContact}><FormTextInput id="quote-contact" error={errors.clientContact} value={draft.clientContact || ""} onChange={(event) => update("clientContact", event.target.value)} /></QuoteField>
    <QuoteField id="quote-channel" label="Canal" required error={errors.channel}><InputSelect value={draft.channel || ""} onChange={(value) => update("channel", value)} options={QUOTE_CHANNELS} placeholder="Selecione" /></QuoteField>
    <QuoteField id="quote-phone" label="Telefone / WhatsApp" required={["WhatsApp", "Telefone"].includes(draft.channel)} error={errors.clientPhone}><FormTextInput id="quote-phone" type="tel" error={errors.clientPhone} value={draft.clientPhone || ""} onChange={(event) => update("clientPhone", event.target.value)} /></QuoteField>
    <QuoteField id="quote-email" label="E-mail" required={draft.channel === "E-mail"} error={errors.clientEmail}><FormTextInput id="quote-email" type="email" error={errors.clientEmail} value={draft.clientEmail || ""} onChange={(event) => update("clientEmail", event.target.value)} /></QuoteField>
  </div>;
}

export function QuoteServiceFields({ draft, update, errors = {} }) {
  const { options, error } = useQuoteServiceTypes();
  const available = draft.serviceType && !options.includes(draft.serviceType) ? [draft.serviceType, ...options] : options;
  return <div className="quote-v3-form-grid">
    <QuoteField id="quote-service" label="Tipo de serviço" required error={errors.serviceType}><select id="quote-service" className="form-general-input" required value={draft.serviceType || ""} onChange={(event) => update("serviceType", event.target.value)}><option value="">Selecione</option>{available.map((item) => <option key={item} value={item}>{item}</option>)}</select>{error && <small role="alert">{error}</small>}</QuoteField>
    <QuoteField id="quote-vehicle" label="Veículo"><FormTextInput id="quote-vehicle" value={draft.vehicleType || ""} onChange={(event) => update("vehicleType", event.target.value)} /></QuoteField>
    <QuoteField id="quote-origin" label="Origem" required error={errors.origin}><FormTextInput id="quote-origin" error={errors.origin} value={draft.origin || ""} onChange={(event) => update("origin", event.target.value)} /></QuoteField>
    <QuoteField id="quote-destination" label="Destino" required error={errors.destination}><FormTextInput id="quote-destination" error={errors.destination} value={draft.destination || ""} onChange={(event) => update("destination", event.target.value)} /></QuoteField>
    <QuoteField id="quote-service-date" label="Data e hora" required error={errors.serviceDate}><FormTextInput id="quote-service-date" type="datetime-local" error={errors.serviceDate} value={draft.serviceDate || ""} onChange={(event) => update("serviceDate", event.target.value)} /></QuoteField>
    <QuoteField id="quote-return-date" label="Retorno"><FormTextInput id="quote-return-date" type="datetime-local" value={draft.returnDate || ""} onChange={(event) => update("returnDate", event.target.value)} /></QuoteField>
    <QuoteField id="quote-passengers" label="Passageiros"><FormTextInput id="quote-passengers" type="number" min="1" value={draft.passengers || ""} onChange={(event) => update("passengers", event.target.value)} /></QuoteField>
    <QuoteField id="quote-notes" label="Observações" wide><FormTextArea id="quote-notes" rows="3" value={draft.notes || ""} onChange={(event) => update("notes", event.target.value)} /></QuoteField>
  </div>;
}

export function QuoteCommercialFields({ draft, update, errors = {}, employees = [] }) {
  const assigned = draft.assigneeIds?.[0] || "";
  return <div className="quote-v3-form-grid">
    <QuoteField id="quote-deadline" label="Prazo para responder" required error={errors.deadline}><FormTextInput id="quote-deadline" type="date" error={errors.deadline} value={draft.deadline || ""} onChange={(event) => update("deadline", event.target.value)} /></QuoteField>
    <QuoteField id="quote-priority" label="Prioridade"><InputSelect value={draft.priority || "medium"} onChange={(value) => update("priority", value)} options={QUOTE_PRIORITIES.map((item) => ({ value: item.id, label: item.label }))} /></QuoteField>
    <QuoteField id="quote-assignee" label="Responsável individual"><InputSelect value={assigned} onChange={(value) => { const employee = employees.find((item) => item.id === value); update("assigneeIds", employee ? [employee.id] : []); update("assigneeNames", employee ? [employee.name] : []); }} options={employees.map((item) => ({ value: item.id, label: item.name }))} placeholder="Sem responsável" /></QuoteField>
    <QuoteField id="quote-team" label="Equipe"><output id="quote-team" className="quote-v3-readonly">Financeiro</output></QuoteField>
    <QuoteField id="quote-value" label="Valor total (BRL)"><FormTextInput id="quote-value" value={draft.value || ""} onChange={(event) => update("value", event.target.value)} placeholder="Opcional" /></QuoteField>
    <QuoteField id="quote-terms" label="Condições comerciais" wide><FormTextArea id="quote-terms" rows="3" value={draft.commercialTerms || ""} onChange={(event) => update("commercialTerms", event.target.value)} placeholder="Opcional" /></QuoteField>
  </div>;
}
