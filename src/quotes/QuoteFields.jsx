import React, { forwardRef, useEffect, useState } from "react";
import { ContactRound, PencilLine } from "lucide-react";
import { QUOTE_CHANNELS, QUOTE_VEHICLE_VALUES } from "../quoteDomain";
import { loadQuoteClients } from "../dataverse";
import { InputSelect } from "../AssignmentFields.jsx";
import { useQuoteServiceTypes } from "../useQuoteServiceTypes.js";
import PriorityPicker from "../PriorityPicker.jsx";
import { DateInput } from "../DateInput.jsx";
import SearchableSelect from "../SearchableSelect.jsx";

const VEHICLE_TYPES = Object.keys(QUOTE_VEHICLE_VALUES).map((label) => ({ value: label, label }));

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

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function moneyDisplay(value) {
  if (value === "" || value === null || value === undefined) return "";
  if (typeof value === "number") return formatBRL(value);
  const text = String(value).trim();
  if (!text) return "";
  const normalized = text.replace(/R\$\s?/i, "").replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? formatBRL(number) : text;
}

export const FormMoneyInput = forwardRef(function FormMoneyInput({ error, className = "", value, onChange, ...props }, ref) {
  const handleChange = (event) => {
    const digits = String(event.target.value || "").replace(/\D/g, "");
    const cents = digits ? Number(digits) / 100 : 0;
    onChange?.({ target: { value: digits ? formatBRL(cents) : "" } });
  };
  return <FormTextInput ref={ref} {...props} value={moneyDisplay(value)} onChange={handleChange} error={error} inputMode="numeric" type="text" className={className} />;
});

const FormDateInput = forwardRef(function FormDateInput({ error, className = "", ...props }, ref) {
  const errorId = props.id && error ? `${props.id}-error` : undefined;
  return <DateInput ref={ref} {...props} className={`form-general-input${className ? ` ${className}` : ""}`} aria-invalid={error ? true : undefined} aria-describedby={errorId || props["aria-describedby"]} />;
});

export const FormTextArea = forwardRef(function FormTextArea({ error, className = "", ...props }, ref) {
  const errorId = props.id && error ? `${props.id}-error` : undefined;
  return <textarea ref={ref} {...props} className={`form-general-input form-general-textarea${className ? ` ${className}` : ""}`} aria-invalid={error ? true : undefined} aria-describedby={errorId || props["aria-describedby"]} />;
});

export function QuoteClientFields({ draft, update, errors = {} }) {
  const [clients, setClients] = useState([]);
  const [clientError, setClientError] = useState("");
  const [mode, setMode] = useState("registered");
  const selectMode = (value) => { if (value === mode) return; setMode(value); update("clientId", ""); update("client", ""); };
  useEffect(() => {
    let active = true;
    loadQuoteClients().then(({ clients: rows }) => {
      if (!active) return;
      setClients(rows);
    }).catch(() => { if (active) setClientError("Não foi possível carregar os clientes cadastrados. Use o nome livre."); });
    return () => { active = false; };
  }, []);
  return <div className="quote-v3-form-grid">
    <QuoteField id="quote-title" label="Título interno" required error={errors.title} wide><FormTextInput id="quote-title" error={errors.title} value={draft.title || ""} onChange={(event) => update("title", event.target.value)} placeholder="Ex.: Transfer executivo · GRU" /></QuoteField>
    <div className={`quote-v3-field quote-v3-client-field drawer-title-field${errors.client ? " is-invalid" : ""}`}>
      <div className="quote-v3-client-heading"><label className="drawer-title-label" htmlFor="quote-client">Cliente / empresa<b aria-hidden="true"> *</b></label><div className="assignment-mode quote-v3-client-mode" role="group" aria-label="Origem do cliente"><button type="button" className={mode === "registered" ? "is-selected" : ""} aria-label="Cliente cadastrado" title="Cliente cadastrado" aria-pressed={mode === "registered"} onClick={() => selectMode("registered")}><ContactRound size={13} aria-hidden="true" /></button><button type="button" className={mode === "custom" ? "is-selected" : ""} aria-label="Digitar nome livre" title="Digitar nome livre" aria-pressed={mode === "custom"} onClick={() => selectMode("custom")}><PencilLine size={13} aria-hidden="true" /></button></div></div>
      {mode === "registered" ? <InputSelect value={draft.clientId || ""} onChange={(value) => { const client = clients.find((item) => item.id === value); update("clientId", client?.id || ""); update("client", client?.name || ""); }} options={clients.map((client) => ({ value: client.id, label: client.name }))} placeholder="Selecione um cliente" /> : <FormTextInput id="quote-client" error={errors.client} value={draft.client || ""} onChange={(event) => { update("client", event.target.value); update("clientId", ""); }} placeholder="Digite o nome do cliente" />}
      {errors.client && <small id="quote-client-error" className="quote-v3-field-error">{errors.client}</small>}{clientError && <small role="status">{clientError}</small>}
    </div>
    <QuoteField id="quote-contact" label="Nome do solicitante" required error={errors.clientContact}><FormTextInput id="quote-contact" error={errors.clientContact} value={draft.clientContact || ""} onChange={(event) => update("clientContact", event.target.value)} /></QuoteField>
    <QuoteField id="quote-channel" label="Canal" required error={errors.channel}><InputSelect value={draft.channel || ""} onChange={(value) => update("channel", value)} options={QUOTE_CHANNELS} placeholder="Selecione" /></QuoteField>
    <QuoteField id="quote-phone" label="Telefone / WhatsApp" required={["WhatsApp", "Telefone"].includes(draft.channel)} error={errors.clientPhone}><FormTextInput id="quote-phone" type="tel" error={errors.clientPhone} value={draft.clientPhone || ""} onChange={(event) => update("clientPhone", event.target.value)} /></QuoteField>
    <QuoteField id="quote-email" label="E-mail" required={draft.channel === "E-mail"} error={errors.clientEmail}><FormTextInput id="quote-email" type="email" error={errors.clientEmail} value={draft.clientEmail || ""} onChange={(event) => update("clientEmail", event.target.value)} /></QuoteField>
  </div>;
}

export function QuoteServiceFields({ draft, update, errors = {} }) {
  const { options, error } = useQuoteServiceTypes();
  const available = options.filter((item) => !item.archived || item.id === draft.serviceTypeId);
  return <div className="quote-v3-form-grid">
    <QuoteField id="quote-service" label="Tipo de serviço" required error={errors.serviceType}><SearchableSelect required clearable={false} value={draft.serviceTypeId || available.find((item) => item.name === draft.serviceType)?.id || ""} onChange={(value) => { const type = available.find((item) => item.id === value); update("serviceTypeId", type?.id || ""); update("serviceType", type?.name || ""); }} options={available.map((item) => ({ value: item.id, label: item.name }))} placeholder="Selecione" aria-label="Tipo de serviço" />{error && <small role="alert">{error}</small>}</QuoteField>
    <QuoteField id="quote-vehicle" label="Tipo de veículo"><InputSelect value={draft.vehicleType || ""} onChange={(value) => update("vehicleType", value)} options={VEHICLE_TYPES} placeholder="Selecione" /></QuoteField>
    <QuoteField id="quote-origin" label="Origem" required error={errors.origin}><FormTextArea id="quote-origin" error={errors.origin} rows="2" value={draft.origin || ""} onChange={(event) => update("origin", event.target.value)} /></QuoteField>
    <QuoteField id="quote-destination" label="Destino" required error={errors.destination}><FormTextArea id="quote-destination" error={errors.destination} rows="2" value={draft.destination || ""} onChange={(event) => update("destination", event.target.value)} /></QuoteField>
    <QuoteField id="quote-service-date" label="Data e hora" required error={errors.serviceDate}><FormDateInput id="quote-service-date" type="datetime-local" error={errors.serviceDate} value={draft.serviceDate || ""} onChange={(event) => update("serviceDate", event.target.value)} /></QuoteField>
    <QuoteField id="quote-return-date" label="Retorno"><FormDateInput id="quote-return-date" type="datetime-local" value={draft.returnDate || ""} onChange={(event) => update("returnDate", event.target.value)} /></QuoteField>
    <QuoteField id="quote-passengers" label="Número de passageiros" wide><FormTextInput id="quote-passengers" type="number" min="1" value={draft.passengers || ""} onChange={(event) => update("passengers", event.target.value)} /></QuoteField>
    <QuoteField id="quote-notes" label="Pedido do cliente" error={errors.notes} wide><FormTextArea id="quote-notes" error={errors.notes} rows="5" value={draft.notes || ""} onChange={(event) => update("notes", event.target.value)} placeholder="Cole aqui a mensagem original do cliente, sem alterar o texto." /></QuoteField>
  </div>;
}

export function QuoteCommercialFields({ draft, update, errors = {} }) {
  return <div className="quote-v3-form-grid">
    <QuoteField id="quote-deadline" label="Prazo para responder" error={errors.deadline}><FormDateInput id="quote-deadline" type="date" error={errors.deadline} value={draft.deadline || ""} onChange={(event) => update("deadline", event.target.value)} /></QuoteField>
    <div className="quote-v3-field drawer-title-field quote-v3-priority-field"><span className="drawer-title-label">Prioridade</span><PriorityPicker value={draft.priority || "medium"} onChange={(value) => update("priority", value)} includeUrgent /></div>
    <QuoteField id="quote-value" label="Valor total (BRL)"><FormTextInput id="quote-value" value={draft.value || ""} onChange={(event) => update("value", event.target.value)} placeholder="Opcional" /></QuoteField>
    <QuoteField id="quote-terms" label="Condições comerciais" wide><FormTextArea id="quote-terms" rows="3" value={draft.commercialTerms || ""} onChange={(event) => update("commercialTerms", event.target.value)} placeholder="Opcional" /></QuoteField>
  </div>;
}
