import React from "react";
import { QUOTE_CHANNELS, QUOTE_PRIORITIES } from "../quoteDomain";
import { InputSelect } from "../AssignmentFields.jsx";

export function QuoteField({ id, label, error, required = false, wide = false, children }) {
  return <label className={`quote-v3-field drawer-title-field${wide ? " quote-v3-field-wide" : ""}`} htmlFor={id}>
    <span className="drawer-title-label">{label}{required && <b aria-hidden="true"> *</b>}</span>
    {children}
    {error && <small id={`${id}-error`} className="quote-v3-field-error">{error}</small>}
  </label>;
}

export function QuoteClientFields({ draft, update, errors = {} }) {
  return <div className="quote-v3-form-grid">
    <QuoteField id="quote-title" label="Título interno" required error={errors.title} wide><input id="quote-title" aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "quote-title-error" : undefined} value={draft.title || ""} onChange={(event) => update("title", event.target.value)} placeholder="Ex.: Transfer executivo · GRU" /></QuoteField>
    <QuoteField id="quote-client" label="Cliente / empresa" required error={errors.client}><input id="quote-client" aria-invalid={Boolean(errors.client)} value={draft.client || ""} onChange={(event) => update("client", event.target.value)} /></QuoteField>
    <QuoteField id="quote-contact" label="Contato" required error={errors.clientContact}><input id="quote-contact" aria-invalid={Boolean(errors.clientContact)} value={draft.clientContact || ""} onChange={(event) => update("clientContact", event.target.value)} /></QuoteField>
    <QuoteField id="quote-channel" label="Canal" required error={errors.channel}><InputSelect value={draft.channel || ""} onChange={(value) => update("channel", value)} options={QUOTE_CHANNELS} placeholder="Selecione" /></QuoteField>
    <QuoteField id="quote-phone" label="Telefone / WhatsApp" required={["WhatsApp", "Telefone"].includes(draft.channel)} error={errors.clientPhone}><input id="quote-phone" type="tel" aria-invalid={Boolean(errors.clientPhone)} value={draft.clientPhone || ""} onChange={(event) => update("clientPhone", event.target.value)} /></QuoteField>
    <QuoteField id="quote-email" label="E-mail" required={draft.channel === "E-mail"} error={errors.clientEmail}><input id="quote-email" type="email" aria-invalid={Boolean(errors.clientEmail)} value={draft.clientEmail || ""} onChange={(event) => update("clientEmail", event.target.value)} /></QuoteField>
  </div>;
}

export function QuoteServiceFields({ draft, update, errors = {} }) {
  return <div className="quote-v3-form-grid">
    <QuoteField id="quote-service" label="Tipo de serviço" required error={errors.serviceType}><input id="quote-service" aria-invalid={Boolean(errors.serviceType)} value={draft.serviceType || ""} onChange={(event) => update("serviceType", event.target.value)} /></QuoteField>
    <QuoteField id="quote-vehicle" label="Veículo"><input id="quote-vehicle" value={draft.vehicleType || ""} onChange={(event) => update("vehicleType", event.target.value)} /></QuoteField>
    <QuoteField id="quote-origin" label="Origem" required error={errors.origin}><input id="quote-origin" aria-invalid={Boolean(errors.origin)} value={draft.origin || ""} onChange={(event) => update("origin", event.target.value)} /></QuoteField>
    <QuoteField id="quote-destination" label="Destino" required error={errors.destination}><input id="quote-destination" aria-invalid={Boolean(errors.destination)} value={draft.destination || ""} onChange={(event) => update("destination", event.target.value)} /></QuoteField>
    <QuoteField id="quote-service-date" label="Data e hora" required error={errors.serviceDate}><input id="quote-service-date" type="datetime-local" aria-invalid={Boolean(errors.serviceDate)} value={draft.serviceDate || ""} onChange={(event) => update("serviceDate", event.target.value)} /></QuoteField>
    <QuoteField id="quote-return-date" label="Retorno"><input id="quote-return-date" type="datetime-local" value={draft.returnDate || ""} onChange={(event) => update("returnDate", event.target.value)} /></QuoteField>
    <QuoteField id="quote-passengers" label="Passageiros"><input id="quote-passengers" type="number" min="1" value={draft.passengers || ""} onChange={(event) => update("passengers", event.target.value)} /></QuoteField>
    <QuoteField id="quote-notes" label="Observações" wide><textarea id="quote-notes" rows="3" value={draft.notes || ""} onChange={(event) => update("notes", event.target.value)} /></QuoteField>
  </div>;
}

export function QuoteCommercialFields({ draft, update, errors = {}, employees = [] }) {
  const assigned = draft.assigneeIds?.[0] || "";
  return <div className="quote-v3-form-grid">
    <QuoteField id="quote-deadline" label="Prazo para responder" required error={errors.deadline}><input id="quote-deadline" type="date" aria-invalid={Boolean(errors.deadline)} value={draft.deadline || ""} onChange={(event) => update("deadline", event.target.value)} /></QuoteField>
    <QuoteField id="quote-priority" label="Prioridade"><InputSelect value={draft.priority || "medium"} onChange={(value) => update("priority", value)} options={QUOTE_PRIORITIES.map((item) => ({ value: item.id, label: item.label }))} /></QuoteField>
    <QuoteField id="quote-assignee" label="Responsável individual"><InputSelect value={assigned} onChange={(value) => { const employee = employees.find((item) => item.id === value); update("assigneeIds", employee ? [employee.id] : []); update("assigneeNames", employee ? [employee.name] : []); }} options={employees.map((item) => ({ value: item.id, label: item.name }))} placeholder="Sem responsável" /></QuoteField>
    <QuoteField id="quote-team" label="Equipe"><output id="quote-team" className="quote-v3-readonly">Financeiro</output></QuoteField>
    <QuoteField id="quote-value" label="Valor total (BRL)"><input id="quote-value" value={draft.value || ""} onChange={(event) => update("value", event.target.value)} placeholder="Opcional" /></QuoteField>
    <QuoteField id="quote-terms" label="Condições comerciais" wide><textarea id="quote-terms" rows="3" value={draft.commercialTerms || ""} onChange={(event) => update("commercialTerms", event.target.value)} placeholder="Opcional" /></QuoteField>
  </div>;
}
