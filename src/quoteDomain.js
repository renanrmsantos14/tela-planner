export const QUOTE_STATUSES = [
  "Nova",
  "Em análise pelo financeiro",
  "Aguardando informação",
  "Cotada",
  "Respondida ao cliente",
  "Perdida",
  "Cancelada",
  "Convertida em serviço",
];

export const QUOTE_PRIORITIES = [
  { id: "low", label: "Baixa" },
  { id: "medium", label: "Média" },
  { id: "high", label: "Alta" },
  { id: "urgent", label: "Urgente" },
];

export const QUOTE_CHANNELS = ["WhatsApp", "Telefone", "E-mail"];

const VAN_NOTES = [
  "É imprescindível o envio da lista de passageiros (nome completo e CPF) de cada passageiro com 36 horas antes do atendimento, para que tenhamos tempo hábil de solicitar autorização da viagem junto aos órgãos competentes.",
  "Sem essa autorização, infelizmente o veículo não poderá sair de nossa base.",
  "Os veículos desta categoria suportam até 15 passageiros.",
  "Caso seja utilizada a rodovia Rodoanel para evitar trânsito, acrescentar taxa de R$95,00 para cada utilização.",
  "Visando sua segurança, a definição do motorista acontecerá somente no dia anterior à viagem, preservando o descanso entre jornadas.",
  "Esse e-mail é exclusivo para cotação e não garante o agendamento do serviço. Caso aprovado, devolva sua confirmação ao consultor da Betinhos.",
];

const EXECUTIVE_NOTES = [
  "Esse e-mail é exclusivo para cotação e não garante o agendamento do serviço. Caso aprovado, devolva sua confirmação ao consultor da Betinhos.",
  "A definição do motorista acontece próximo à data do atendimento para preservar descanso e segurança operacional.",
  "Caso precise de suporte, acione a equipe Betinhos pelos canais oficiais do atendimento.",
];

const ASSET_NAMES = {
  banner: "new_cotacao_banner.png",
  header: "new_cotacao_header_solicitacao.png",
  vehicle: "new_cotacao_banner_veiculos.png",
  commitments: "new_cotacao_compromissos.png",
  vanVehicle: "new_cotacao_van_veiculos.png",
  vanInfo: "new_cotacao_van_info.png",
};

export function isVanVehicle(vehicleType) {
  return String(vehicleType || "").toLowerCase().includes("van");
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(date);
}

function formatMoney(value) {
  if (value === "" || value === null || value === undefined) return "Valor sob consulta";
  const number = typeof value === "number" ? value : Number(String(value).replace(/[^0-9,-]/g, "").replace(/\./g, "").replace(",", "."));
  if (Number.isNaN(number)) return String(value);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(number).replace(/\u00a0/g, " ");
}

export function buildQuoteRouteText(quote = {}) {
  const origin = String(quote.origin || "").trim();
  const destination = String(quote.destination || "").trim();
  const departure = formatDateTime(quote.serviceDate);
  const returning = formatDateTime(quote.returnDate);
  const lines = [];
  if (origin || destination) lines.push(`${origin || "Origem a definir"} → ${destination || "Destino a definir"}`);
  if (departure) lines.push(`Saída: ${departure}`);
  if (quote.returnDate && returning) lines.push(`Retorno: ${returning}`);
  if (quote.passengers) lines.push(`Passageiros: ${quote.passengers}`);
  return lines.length ? lines : ["Roteiro a definir."];
}

export function validateQuoteDraft(input = {}) {
  const required = [
    ["title", "título interno"],
    ["client", "cliente/empresa"],
    ["clientContact", "contato do cliente"],
    ["channel", "canal de entrada"],
    ["serviceType", "tipo de serviço"],
    ["origin", "origem"],
    ["destination", "destino"],
    ["serviceDate", "data e hora do serviço"],
    ["deadline", "prazo para responder"],
  ];
  const missing = required.filter(([key]) => !String(input[key] ?? "").trim()).map(([, label]) => label);
  if (String(input.status || "") === "Perdida" && !String(input.lossReason || "").trim()) missing.push("motivo da perda");
  return missing.length ? { valid: false, missing, error: `Informe: ${missing.join(", ")}.` } : { valid: true, missing: [], error: "" };
}

function assetUrl(baseUrl, filename) {
  if (!baseUrl) return filename;
  return `${String(baseUrl).replace(/\/$/, "")}/WebResources/${filename}`;
}

export function buildQuoteEmailHtml(quote = {}, assets = {}) {
  const baseUrl = assets.baseUrl || assets.clientUrl || "";
  const names = { ...ASSET_NAMES, ...(assets.names || {}) };
  const van = isVanVehicle(quote.vehicleType);
  const intro = quote.clientContact || quote.client || "cliente";
  const route = buildQuoteRouteText(quote);
  const notes = [...(van ? VAN_NOTES : EXECUTIVE_NOTES), ...String(quote.commercialTerms || "").split(/\r?\n+/).map((item) => item.trim()).filter(Boolean)];
  const orderNotes = route.map((line) => `<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#ffffff;">&#8226; ${escapeHtml(line)}</p>`).join("");
  const important = notes.map((line) => `<tr><td style="padding:0 0 12px;font-size:14px;line-height:1.65;color:#171512;">&#8226; ${escapeHtml(line)}</td></tr>`).join("");
  const value = escapeHtml(formatMoney(quote.value));
  const subject = escapeHtml(quote.subject || `Cotação ${quote.code || ""}${quote.client ? ` - ${quote.client}` : ""}`.trim());
  return [
    "<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>", subject, "</title>",
    "<style>body{-webkit-text-size-adjust:100%;}.cotacao-fluid-img{display:block;width:100%;height:auto;border:0;}@media(max-width:640px){.a4-sheet{width:100%!important;max-width:100%!important;min-height:0!important}.cotacao-col,.cotacao-img-pair{display:block!important;width:100%!important}.cotacao-value{font-size:26px!important}}</style></head>",
    "<body style=\"margin:0;padding:0;background:#0a2f41;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"background:#0a2f41;margin:0;padding:0;\"><tr><td align=\"center\">",
    "<table class=\"a4-sheet\" role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"794\" style=\"width:794px;max-width:794px;min-height:1123px;background:#d9d9d9;border-collapse:collapse;font-family:Segoe UI,Arial,sans-serif;color:#171512;\">",
    `<tr><td><img class="cotacao-fluid-img" src="${escapeHtml(assetUrl(baseUrl, names.banner))}" alt="Betinhos Executive Service" width="794"></td></tr>`,
    `<tr><td style="padding:24px 42px 14px;background:#d9d9d9;"><p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Olá ${escapeHtml(intro)},</p><p style="margin:0 0 12px;font-size:14px;line-height:1.62;">A <strong>Betinhos Executive Service</strong> é uma empresa de traslados e serviços executivos presente no estado de São Paulo há mais de 37 anos e, ao longo dessas décadas, mantemos compromisso com Non Compliance, EHS e Safe Fleet.</p><p style="margin:0;font-size:14px;line-height:1.7;">Abaixo segue sua cotação no mesmo formato do material aprovado, com foco nas informações do atendimento e sem a assinatura final.</p></td></tr>`,
    `<tr><td style="background:#0a2f41;padding:0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr><td class="cotacao-col" valign="middle" width="50%" style="width:50%;padding:24px 22px;text-align:center;"><img src="${escapeHtml(assetUrl(baseUrl, names.header))}" alt="Betinhos Executive Service" width="340" style="display:block;width:100%;max-width:340px;height:auto;border:0;margin:0 auto;"></td><td class="cotacao-col" valign="top" width="50%" style="width:50%;padding:22px 24px 24px;color:#ffffff;"><p style="margin:0 0 10px;font-size:15px;line-height:1.35;color:#ffffff;"><em>Roteiro do atendimento</em></p>${orderNotes}</td></tr></table></td></tr>`,
    `<tr><td style="background:#d9d9d9;padding:0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr><td class="cotacao-img-pair" width="50%" style="width:50%;padding:16px 10px 18px 18px;text-align:center;"><img src="${escapeHtml(assetUrl(baseUrl, van ? names.vanVehicle : names.vehicle))}" alt="${van ? "Van executiva Betinhos" : "Frota executiva Betinhos"}" width="360" style="display:block;width:100%;max-width:360px;height:auto;border:0;margin:0 auto;"></td><td class="cotacao-img-pair" width="50%" style="width:50%;padding:16px 18px 18px 10px;text-align:center;"><img src="${escapeHtml(assetUrl(baseUrl, van ? names.vanInfo : names.commitments))}" alt="${van ? "Informações da van executiva" : "Compromissos operacionais Betinhos"}" width="360" style="display:block;width:100%;max-width:360px;height:auto;border:0;margin:0 auto;"></td></tr></table></td></tr>`,
    `<tr><td style="background:#0a2f41;padding:22px 34px 24px;text-align:center;"><p style="margin:0 0 8px;font-size:17px;line-height:1.42;color:#ffffff;font-weight:700;">Com base nesse comprometimento, faço saber que o custo total é de</p><p class="cotacao-value" style="margin:0 0 12px;font-size:30px;line-height:1.15;color:#ffffff;font-weight:700;">${value}</p><p style="margin:0;font-size:15px;line-height:1.42;color:#ffffff;font-weight:700;">Veja abaixo informações importantes para sua contratação</p></td></tr>`,
    `<tr><td style="background:#d9d9d9;padding:22px 34px 24px;"><p style="margin:0 0 14px;font-size:16px;line-height:1.35;font-weight:700;">OBSERVAÇÕES IMPORTANTES:</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">${important}</table></td></tr>`,
    "</table></td></tr></table></body></html>",
  ].join("");
}

export function buildQuotePlainText(quote = {}) {
  const route = buildQuoteRouteText(quote).map((line) => `• ${line}`).join("\n");
  const notes = [...(isVanVehicle(quote.vehicleType) ? VAN_NOTES : EXECUTIVE_NOTES), ...String(quote.commercialTerms || "").split(/\r?\n+/).map((item) => item.trim()).filter(Boolean)].map((line) => `• ${line}`).join("\n");
  return [`Cotação ${quote.code || ""}`.trim(), `Olá ${quote.clientContact || quote.client || "cliente"},`, "", route, "", `Custo total: ${formatMoney(quote.value)}`, "", "OBSERVAÇÕES IMPORTANTES:", notes].join("\n");
}

export async function copyQuoteToClipboard(quote, assets = {}) {
  const html = buildQuoteEmailHtml(quote, assets);
  const text = buildQuotePlainText(quote);
  if (typeof navigator !== "undefined" && navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]);
    return { html, text, method: "clipboard" };
  }
  if (typeof document !== "undefined") {
    const holder = document.createElement("div");
    holder.contentEditable = "true";
    holder.innerHTML = html;
    holder.style.position = "fixed";
    holder.style.left = "-9999px";
    document.body.appendChild(holder);
    const selection = document.getSelection();
    const range = document.createRange();
    range.selectNodeContents(holder);
    selection?.removeAllRanges();
    selection?.addRange(range);
    const copied = document.execCommand?.("copy");
    selection?.removeAllRanges();
    holder.remove();
    if (copied) return { html, text, method: "execCommand" };
  }
  throw new Error("O navegador não permitiu copiar a cotação.");
}

export function quoteSubject(quote = {}) {
  return `Cotação ${quote.code || ""}${quote.client ? ` - ${quote.client}` : ""}`.trim();
}
