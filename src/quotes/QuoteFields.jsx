import React, { forwardRef, useEffect, useRef, useState } from "react";
import { ContactRound, PencilLine } from "lucide-react";
import { formatMoney, parseQuoteMoney, QUOTE_VEHICLE_VALUES } from "../quoteDomain";
import { loadQuoteClients, loadQuoteRequesters } from "../dataverse";
import { InputSelect } from "../AssignmentFields.jsx";
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

function moneyDisplay(value) {
  if (value === "" || value === null || value === undefined) return "";
  const number = parseQuoteMoney(value);
  return Number.isFinite(number) ? formatMoney(number) : String(value);
}

export const FormMoneyInput = forwardRef(function FormMoneyInput({ error, className = "", value, onChange, ...props }, ref) {
  const [editing, setEditing] = useState(false);
  return <FormTextInput ref={ref} {...props} value={editing ? String(value ?? "") : moneyDisplay(value)} onChange={onChange} onFocus={(event) => { setEditing(true); props.onFocus?.(event); }} onBlur={(event) => { setEditing(false); props.onBlur?.(event); }} error={error} inputMode="decimal" type="text" className={className} />;
});

const FormDateInput = forwardRef(function FormDateInput({ error, className = "", ...props }, ref) {
  const errorId = props.id && error ? `${props.id}-error` : undefined;
  const handleKeyDown = (event) => {
    props.onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== "Tab") return;
    const scope = event.currentTarget.closest(".quote-v3-drawer-body");
    if (!scope) return;
    const controls = [...scope.querySelectorAll("input:not([type='hidden']), textarea, [data-searchable-select-trigger], [role='radio'][tabindex='0'], button:not([type='submit']):not([tabindex='-1'])")]
      .filter((control) => !control.disabled && control.tabIndex >= 0 && control.offsetParent !== null && !control.closest("[hidden]"));
    const next = controls[controls.indexOf(event.currentTarget) + (event.shiftKey ? -1 : 1)];
    if (!next) return;
    event.preventDefault();
    next.focus();
  };
  return <DateInput ref={ref} {...props} onKeyDown={handleKeyDown} className={`form-general-input${className ? ` ${className}` : ""}`} aria-invalid={error ? true : undefined} aria-describedby={errorId || props["aria-describedby"]} />;
});

export const FormTextArea = forwardRef(function FormTextArea({ error, className = "", ...props }, ref) {
  const errorId = props.id && error ? `${props.id}-error` : undefined;
  return <textarea ref={ref} {...props} className={`form-general-input form-general-textarea${className ? ` ${className}` : ""}`} aria-invalid={error ? true : undefined} aria-describedby={errorId || props["aria-describedby"]} />;
});

export function QuoteClientFields({ draft, update, errors = {} }) {
  const [clients, setClients] = useState([]);
  const [clientError, setClientError] = useState("");
  const [mode, setMode] = useState("registered");
  const [requesters, setRequesters] = useState([]);
  const [requesterError, setRequesterError] = useState("");
  const [requesterMode, setRequesterMode] = useState("registered");
  const [selectedRequesterId, setSelectedRequesterId] = useState("");
  const [pendingRequester, setPendingRequester] = useState(null);
  const automaticValues = useRef({});
  const selectMode = (value) => { if (value === mode) return; setMode(value); update("clientId", ""); update("client", ""); };
  const selectRequesterMode = (value) => { if (value === requesterMode) return; setRequesterMode(value); setSelectedRequesterId(""); update("clientContact", ""); };
  const applyRequester = (requester, overwrite = false) => {
    if (!requester) return;
    const values = { clientContact: requester.name, clientId: requester.clientId, client: requester.clientName, clientEmail: requester.email, clientPhone: requester.phone };
    for (const [key, value] of Object.entries(values)) {
      if (!value) continue;
      if (overwrite || !String(draft[key] || "").trim() || draft[key] === automaticValues.current[key] || key === "clientContact") update(key, value);
    }
    automaticValues.current = values;
    setPendingRequester(null);
  };
  const chooseRequester = (value) => {
    const requester = requesters.find((item) => item.id === value);
    setSelectedRequesterId(value);
    const pairs = [["client", requester?.clientName], ["clientEmail", requester?.email], ["clientPhone", requester?.phone]];
    const conflicts = pairs.some(([key, next]) => next && String(draft[key] || "").trim() && draft[key] !== next && draft[key] !== automaticValues.current[key]);
    if (conflicts) { update("clientContact", requester?.name || ""); setPendingRequester(requester); }
    else applyRequester(requester);
  };
  useEffect(() => {
    let active = true;
    loadQuoteClients().then(({ clients: rows }) => {
      if (!active) return;
      setClients(rows);
    }).catch(() => { if (active) setClientError("Não foi possível carregar os clientes cadastrados. Use o nome livre."); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    loadQuoteRequesters().then((rows) => {
      if (!active) return;
      setRequesters(rows);
      if (draft.clientContact && !rows.some((item) => item.name === draft.clientContact)) setRequesterMode("custom");
    }).catch(() => { if (active) setRequesterError("Não foi possível carregar os solicitantes cadastrados. Use o nome livre."); });
    return () => { active = false; };
  }, []);
  return <div className="quote-v3-form-grid">
    <QuoteField id="quote-title" label="Título interno" required error={errors.title} wide><FormTextInput id="quote-title" error={errors.title} value={draft.title || ""} onChange={(event) => update("title", event.target.value)} placeholder="Ex.: Transfer executivo · GRU" /></QuoteField>
    <div className={`quote-v3-field quote-v3-client-field drawer-title-field${errors.client ? " is-invalid" : ""}`}>
    <div className="quote-v3-client-heading"><label className="drawer-title-label" htmlFor="quote-client">Cliente / empresa<b aria-hidden="true"> *</b></label><div className="assignment-mode quote-v3-client-mode" role="group" aria-label="Origem do cliente"><button type="button" className={mode === "registered" ? "is-selected" : ""} aria-label="Cliente cadastrado" title="Cliente cadastrado" aria-pressed={mode === "registered"} onClick={() => selectMode("registered")}><ContactRound size={13} aria-hidden="true" /></button><button type="button" className={mode === "custom" ? "is-selected" : ""} aria-label="Digitar nome livre" title="Digitar nome livre" aria-pressed={mode === "custom"} onClick={() => selectMode("custom")}><PencilLine size={13} aria-hidden="true" /></button></div></div>
      {mode === "registered" ? <InputSelect value={draft.clientId || ""} onChange={(value) => { const client = clients.find((item) => item.id === value); update("clientId", client?.id || ""); update("client", client?.name || ""); }} options={clients.map((client) => ({ value: client.id, label: client.name }))} placeholder="Selecione um cliente" /> : <FormTextInput id="quote-client" error={errors.client} value={draft.client || ""} onChange={(event) => { update("client", event.target.value); update("clientId", ""); }} placeholder="Digite o nome do cliente" />}
      {errors.client && <small id="quote-client-error" className="quote-v3-field-error">{errors.client}</small>}{clientError && <small role="status">{clientError}</small>}
    </div>
    <div className={`quote-v3-field quote-v3-client-field drawer-title-field${errors.clientContact ? " is-invalid" : ""}`}>
    <div className="quote-v3-client-heading"><label className="drawer-title-label" htmlFor="quote-contact">Nome do solicitante<b aria-hidden="true"> *</b></label><div className="assignment-mode quote-v3-client-mode" role="group" aria-label="Origem do solicitante"><button type="button" className={requesterMode === "registered" ? "is-selected" : ""} aria-label="Solicitante cadastrado" title="Solicitante cadastrado" aria-pressed={requesterMode === "registered"} onClick={() => selectRequesterMode("registered")}><ContactRound size={13} aria-hidden="true" /></button><button type="button" className={requesterMode === "custom" ? "is-selected" : ""} aria-label="Digitar solicitante livre" title="Digitar solicitante livre" aria-pressed={requesterMode === "custom"} onClick={() => selectRequesterMode("custom")}><PencilLine size={13} aria-hidden="true" /></button></div></div>
      {requesterMode === "registered" ? <SearchableSelect variant="person-client" value={requesters.some((item) => item.id === selectedRequesterId && item.name === draft.clientContact) ? selectedRequesterId : requesters.find((item) => item.name === draft.clientContact)?.id || ""} onChange={chooseRequester} options={requesters.map((item) => ({ value: item.id, label: item.name, subtitle: item.clientName, search: [item.clientName, item.email, item.phone].filter(Boolean).join(" ") }))} placeholder="Selecione um solicitante" aria-label="Nome do solicitante" /> : <FormTextInput id="quote-contact" error={errors.clientContact} value={draft.clientContact || ""} onChange={(event) => update("clientContact", event.target.value)} placeholder="Digite o nome do solicitante" />}
      {errors.clientContact && <small id="quote-contact-error" className="quote-v3-field-error">{errors.clientContact}</small>}{requesterError && <small role="status">{requesterError}</small>}
      {pendingRequester && <div className="quote-requester-conflict" role="alert"><span>O cadastro possui empresa ou contato diferente.</span><div><button type="button" onClick={() => setPendingRequester(null)}>Manter dados atuais</button><button type="button" onClick={() => applyRequester(pendingRequester, true)}>Usar dados do cadastro</button></div></div>}
    </div>
    <QuoteField id="quote-phone" label="Telefone / WhatsApp" error={errors.clientPhone}><FormTextInput id="quote-phone" type="tel" error={errors.clientPhone} value={draft.clientPhone || ""} onChange={(event) => update("clientPhone", event.target.value)} /></QuoteField>
    <QuoteField id="quote-email" label="E-mail" error={errors.clientEmail}><FormTextInput id="quote-email" type="email" error={errors.clientEmail} value={draft.clientEmail || ""} onChange={(event) => update("clientEmail", event.target.value)} /></QuoteField>
  </div>;
}

export function QuoteServiceFields({ draft, update, errors = {} }) {
  return <div className="quote-v3-form-grid">
    <QuoteField id="quote-vehicle" label="Tipo de veículo"><InputSelect value={draft.vehicleType || ""} onChange={(value) => update("vehicleType", value)} options={VEHICLE_TYPES} placeholder="Selecione" /></QuoteField>
    <QuoteField id="quote-passengers" label="Número de passageiros"><FormTextInput id="quote-passengers" type="number" min="1" value={draft.passengers || ""} onChange={(event) => update("passengers", event.target.value)} /></QuoteField>
    <QuoteField id="quote-origin" label="Origem" required error={errors.origin}><FormTextArea id="quote-origin" error={errors.origin} rows="2" value={draft.origin || ""} onChange={(event) => update("origin", event.target.value)} /></QuoteField>
    <QuoteField id="quote-destination" label="Destino" required error={errors.destination}><FormTextArea id="quote-destination" error={errors.destination} rows="2" value={draft.destination || ""} onChange={(event) => update("destination", event.target.value)} /></QuoteField>
    <QuoteField id="quote-service-date" label="Data e hora" error={errors.serviceDate}><FormDateInput id="quote-service-date" type="datetime-local" error={errors.serviceDate} value={draft.serviceDate || ""} onChange={(event) => update("serviceDate", event.target.value)} /></QuoteField>
    <QuoteField id="quote-return-date" label="Retorno"><FormDateInput id="quote-return-date" type="datetime-local" value={draft.returnDate || ""} onChange={(event) => update("returnDate", event.target.value)} /></QuoteField>
    <QuoteField id="quote-notes" label="Pedido do cliente" error={errors.notes} wide><FormTextArea id="quote-notes" error={errors.notes} rows="5" maxLength="4000" value={draft.notes || ""} onChange={(event) => update("notes", event.target.value)} placeholder="Cole aqui a mensagem original do cliente, sem alterar o texto." /><small>Este texto será incluído na proposta enviada ao cliente.</small></QuoteField>
  </div>;
}

export function QuoteCommercialFields({ draft, update, errors = {} }) {
  const showCommercialResult = ["Cotada", "Respondida ao cliente"].includes(draft.status);
  return <div className="quote-v3-form-grid">
    <QuoteField id="quote-deadline" label="Prazo para responder" error={errors.deadline}><FormDateInput id="quote-deadline" type="date" error={errors.deadline} value={draft.deadline || ""} onChange={(event) => update("deadline", event.target.value)} /></QuoteField>
    <div className="quote-v3-field drawer-title-field quote-v3-priority-field"><span className="drawer-title-label">Prioridade</span><PriorityPicker value={draft.priority || "medium"} onChange={(value) => update("priority", value)} includeUrgent /></div>
    {showCommercialResult && <QuoteField id="quote-value" label="Valor total (BRL)" required error={errors.value}><FormMoneyInput id="quote-value" required value={draft.value || ""} onChange={(event) => update("value", event.target.value)} placeholder="R$ 0,00" /></QuoteField>}
    {showCommercialResult && <QuoteField id="quote-commercial-terms" label="Condições comerciais" error={errors.commercialTerms} wide><FormTextArea id="quote-commercial-terms" rows="4" value={draft.commercialTerms || ""} onChange={(event) => update("commercialTerms", event.target.value)} placeholder="Prazo, pagamento, espera, cancelamento e demais condições" /></QuoteField>}
  </div>;
}
