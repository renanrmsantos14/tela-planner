import React from "react";
import { ChevronDown } from "lucide-react";
import { PRIORITIES } from "../domain";
import "./QuoteReview.css";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatReviewDate(value, withTime = false) {
  if (!value) return "Não informado";
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::\d{2})?)?$/.exec(String(value));
  if (!match) return "Data a conferir";
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  if (year < 1900 || year > 2100 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return "Data a conferir";
  if (withTime && (!hourText || Number(hourText) > 23 || Number(minuteText) > 59)) return "Data a conferir";
  return `${day} ${MONTHS[month - 1]} ${year}${withTime ? ` · ${hourText}:${minuteText}` : ""}`;
}

function detailText(value) {
  return String(value ?? "").trim() || "Não informado";
}

function Detail({ label, children }) {
  return <div className="quote-review-detail"><dt>{label}</dt><dd>{children}</dd></div>;
}

function DetailGroup({ title, step, onEditStep, disabled, children }) {
  return <section className="quote-review-detail-group">
    <div className="quote-review-detail-heading"><h3>{title}</h3><button type="button" onClick={() => onEditStep(step)} aria-label={`Editar ${title.toLowerCase()}`} disabled={disabled}>Editar</button></div>
    <dl>{children}</dl>
  </section>;
}

export default function QuoteReview({ draft, attachments, onEditStep, saving = false }) {
  const contact = [draft.clientPhone, draft.clientEmail].filter((value) => String(value || "").trim()).join(" · ");
  const priority = PRIORITIES.find((item) => item.id === draft.priority)?.label || "Não informada";

  return <div className="quote-review">
    <section className="quote-review-trip" aria-label="Resumo do serviço">
      <div className="quote-review-trip-heading">
        <span>Rota do serviço</span>
        <button type="button" onClick={() => onEditStep(1)} aria-label="Editar serviço" disabled={saving}>Editar</button>
      </div>
      <div className="quote-review-route">
        <strong>{detailText(draft.origin)}</strong>
        <span aria-hidden="true">→</span>
        <strong>{detailText(draft.destination)}</strong>
      </div>
      <p className="quote-review-date">{formatReviewDate(draft.serviceDate, true)}</p>
    </section>

    <div className="quote-review-facts">
      <div className="quote-review-fact">
        <span>Cliente</span>
        <strong>{detailText(draft.client)}</strong>
        <button type="button" onClick={() => onEditStep(0)} aria-label="Editar cliente" disabled={saving}>Editar</button>
      </div>
      <div className="quote-review-fact">
        <span>Prazo</span>
        <strong>{formatReviewDate(draft.deadline)}</strong>
        <button type="button" onClick={() => onEditStep(2)} aria-label="Editar prazo e comercial" disabled={saving}>Editar</button>
      </div>
    </div>

    <details className="quote-review-more">
      <summary><span>Mais detalhes da cotação</span><ChevronDown size={20} aria-hidden="true" /></summary>
      <div className="quote-review-more-content">
        <DetailGroup title="Cliente" step={0} onEditStep={onEditStep} disabled={saving}>
          <Detail label="Título interno">{detailText(draft.title)}</Detail>
          <Detail label="Solicitante">{detailText(draft.clientContact)}</Detail>
          <Detail label="Contato">{detailText(contact)}</Detail>
        </DetailGroup>
        <DetailGroup title="Serviço" step={1} onEditStep={onEditStep} disabled={saving}>
          <Detail label="Veículo">{draft.vehicleType || "A definir"}</Detail>
          {draft.returnDate && <Detail label="Retorno">{formatReviewDate(draft.returnDate, true)}</Detail>}
          {draft.passengers && <Detail label="Passageiros">{draft.passengers}</Detail>}
          <Detail label="Pedido do cliente"><span className="quote-review-long-text">{detailText(draft.notes)}</span></Detail>
          <Detail label="Anexos">{attachments.length ? <ul className="quote-review-attachments">{attachments.map((item) => <li key={item.id}>{item.name}</li>)}</ul> : "Nenhum anexo"}</Detail>
        </DetailGroup>
        <DetailGroup title="Prazo e comercial" step={2} onEditStep={onEditStep} disabled={saving}>
          <Detail label="Prioridade">{priority}</Detail>
          <Detail label="Valor">{detailText(draft.value)}</Detail>
          <Detail label="Condições comerciais"><span className="quote-review-long-text">{detailText(draft.commercialTerms)}</span></Detail>
          <Detail label="Acompanhamento">Financeiro</Detail>
        </DetailGroup>
      </div>
    </details>

    <p className="quote-review-status">Criada com status Nova</p>
  </div>;
}
