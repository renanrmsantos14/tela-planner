export const QUOTE_STATUSES = [
  "Nova",
  "Em análise pelo financeiro",
  "Aguardando informação",
  "Cotada",
  "Respondida ao cliente",
  "Perdida",
  "Cancelada",
  "Aceita pelo cliente",
];

export const QUOTE_PRIORITIES = [
  { id: "low", label: "Baixa" },
  { id: "medium", label: "Média" },
  { id: "high", label: "Alta" },
  { id: "urgent", label: "Urgente" },
];

export const QUOTE_VEHICLE_VALUES = Object.freeze({
  "Básico": 202410000,
  Executivo: 202410001,
  Blindado: 202410002,
  Van: 202410003,
  "Van Blindado": 202410004,
  Spin: 202410005,
  "Somente Motorista": 202410006,
});

export const QUOTE_OPEN_STATUSES = QUOTE_STATUSES.slice(0, 5);
export const QUOTE_TERMINAL_STATUSES = QUOTE_STATUSES.slice(5);
export const QUOTE_COMPLETED_STATUSES = ["Cotada", "Respondida ao cliente"];

export function validateQuoteCommercial(input = {}) {
  const errors = {};
  const raw = String(input.value ?? "").trim();
  const normalized = raw.replace(/^R\$\s*/i, "").replace(/\s/g, "");
  const number = normalized.includes(",")
    ? Number(normalized.replace(/\./g, "").replace(",", "."))
    : Number(normalized);
  if (!raw || !/^[\d.,]+$/.test(normalized) || !Number.isFinite(number) || number <= 0) errors.value = "Informe um valor maior que zero.";
  return { valid: Object.keys(errors).length === 0, errors };
}
export const QUOTE_CREATE_STEPS = [
  { id: "client", label: "Cliente" },
  { id: "service", label: "Serviço" },
  { id: "commercial", label: "Prazo e comercial" },
];

const STEP_FIELDS = {
  client: [
    ["title", "Informe o título interno."],
    ["client", "Informe o cliente ou empresa."],
    ["clientContact", "Informe o nome do solicitante."],
  ],
  service: [
    ["origin", "Informe a origem."],
    ["destination", "Informe o destino."],
  ],
  commercial: [],
};

export function validateQuoteStep(input = {}, stepId = "review") {
  if (stepId === "review") {
    const errors = Object.fromEntries(["client", "service", "commercial"].flatMap((step) => Object.entries(validateQuoteStep(input, step).errors)));
    return { valid: Object.keys(errors).length === 0, errors };
  }
  const errors = {};
  for (const [field, message] of STEP_FIELDS[stepId] || []) {
    if (!String(input[field] ?? "").trim()) errors[field] = message;
  }
  if (stepId === "service") {
    for (const field of ["origin", "destination"]) if (String(input[field] || "").length > 10000) errors[field] = "Máximo de 10.000 caracteres.";
    if (String(input.notes || "").length > 4000) errors.notes = "O pedido do cliente excede 4.000 caracteres, limite do Dataverse.";
  }
  if (stepId === "client") {
    const phone = String(input.clientPhone || "").trim();
    const email = String(input.clientEmail || "").trim();
    if (!phone && !email) errors.clientPhone = "Informe pelo menos o telefone ou o e-mail.";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.clientEmail = "Informe um e-mail válido.";
  }
  if (stepId === "commercial" && QUOTE_COMPLETED_STATUSES.includes(input.status)) Object.assign(errors, validateQuoteCommercial(input).errors);
  return { valid: Object.keys(errors).length === 0, errors };
}

function saoPauloToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isQuoteOpen(status) {
  return QUOTE_OPEN_STATUSES.includes(status);
}

export function filterQuotes(quotes = [], tasks = [], filters = {}, today = saoPauloToday()) {
  const taskByQuote = new Map(tasks.filter((task) => task.quoteId && !task.parentTaskId).map((task) => [task.quoteId, task]));
  const needle = String(filters.query || "").trim().toLocaleLowerCase("pt-BR");
  return quotes.filter((quote) => {
    const task = taskByQuote.get(quote.id);
    const searchable = [quote.code, quote.title, quote.client, quote.clientContact, quote.status].join(" ").toLocaleLowerCase("pt-BR");
    if (needle && !searchable.includes(needle)) return false;
    const selected = (value) => Array.isArray(value) ? value : value ? [value] : [];
    if (selected(filters.status).length && !selected(filters.status).includes(quote.status)) return false;
    if (selected(filters.priority).length && !selected(filters.priority).includes(quote.priority)) return false;
    const responsible = selected(filters.responsible);
    if (responsible.length && !responsible.some((id) => id === "unassigned" ? !(task?.assigneeIds || []).length : (task?.assigneeIds || []).includes(id))) return false;
    const deadline = selected(filters.deadline);
    if (deadline.length && !deadline.some((value) =>
      value === "overdue" && isQuoteOpen(quote.status) && quote.deadline && quote.deadline < today ||
      value === "today" && isQuoteOpen(quote.status) && quote.deadline === today ||
      value === "no-deadline" && !quote.deadline
    )) return false;
    return true;
  });
}

export function getQuoteMetrics(quotes = [], tasks = [], today = saoPauloToday()) {
  const taskByQuote = new Map(tasks.filter((task) => task.quoteId && !task.parentTaskId).map((task) => [task.quoteId, task]));
  const active = quotes.filter((quote) => isQuoteOpen(quote.status));
  return {
    active: active.length,
    overdue: active.filter((quote) => quote.deadline && quote.deadline < today).length,
    dueToday: active.filter((quote) => quote.deadline === today).length,
    waiting: active.filter((quote) => quote.status === "Aguardando informação").length,
    unassigned: active.filter((quote) => !(taskByQuote.get(quote.id)?.assigneeIds || []).length).length,
  };
}

export function getQuoteNextAction(quote = {}) {
  const actions = {
    Nova: { primary: { id: "transition", label: "Iniciar análise", status: "Em análise pelo financeiro" }, secondary: [] },
    "Em análise pelo financeiro": { primary: { id: "transition", label: "Marcar cotada", status: "Cotada" }, secondary: [{ id: "transition", label: "Aguardar informação", status: "Aguardando informação" }] },
    "Aguardando informação": { primary: { id: "transition", label: "Retomar análise", status: "Em análise pelo financeiro" }, secondary: [] },
    Cotada: { primary: { id: "copy", label: "Copiar proposta" }, secondary: [{ id: "sent", label: "Marcar enviada", status: "Respondida ao cliente" }] },
    "Respondida ao cliente": { primary: { id: "outcome", label: "Registrar aceite", status: "Aceita pelo cliente" }, secondary: [{ id: "outcome", label: "Registrar perda", status: "Perdida" }, { id: "outcome", label: "Cancelar", status: "Cancelada" }] },
  };
  return actions[quote.status] || { primary: { id: "transition", label: "Reabrir como Nova", status: "Nova" }, secondary: [] };
}

export function isQuoteTransitionAllowed(from, to) {
  if (from === to) return false;
  if (QUOTE_TERMINAL_STATUSES.includes(from)) return to === "Nova";
  return QUOTE_OPEN_STATUSES.includes(from) && QUOTE_STATUSES.includes(to);
}

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

export function quoteEmailNotes(quote = {}) {
  return [...(isVanVehicle(quote.vehicleType) ? VAN_NOTES : EXECUTIVE_NOTES), ...String(quote.commercialTerms || "").split(/\r?\n+/).map((item) => item.trim()).filter(Boolean)];
}

export const QUOTE_ASSET_NAMES = {
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

export function formatMoney(value) {
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
    ["clientContact", "nome do solicitante"],
    ["origin", "origem"],
    ["destination", "destino"],
  ];
  const missing = required.filter(([key]) => !String(input[key] ?? "").trim()).map(([, label]) => label);
  const stepErrors = { ...validateQuoteStep(input, "review").errors, ...validateQuoteStep(input, "commercial").errors };
  if (stepErrors.clientPhone && !missing.includes("telefone ou e-mail")) missing.push("telefone ou e-mail");
  if (stepErrors.clientEmail && !missing.includes("e-mail válido")) missing.push("e-mail válido");
  if (stepErrors.value) missing.push("valor total maior que zero");
  if (String(input.status || "") === "Perdida" && !String(input.lossReason || "").trim()) missing.push("motivo da perda");
  return missing.length ? { valid: false, missing, error: `Informe: ${missing.join(", ")}.` } : { valid: true, missing: [], error: "" };
}

function assetUrl(baseUrl, filename, imageUrls = {}) {
  if (imageUrls[filename]) return imageUrls[filename];
  if (!baseUrl) return filename;
  return `${String(baseUrl).replace(/\/$/, "")}/WebResources/${filename}`;
}

export function buildQuoteEmailHtml(quote = {}, assets = {}) {
  const baseUrl = assets.baseUrl || assets.clientUrl || "";
  const names = { ...QUOTE_ASSET_NAMES, ...(assets.names || {}) };
  const van = isVanVehicle(quote.vehicleType);
  const intro = quote.clientContact || quote.client || "cliente";
  const route = buildQuoteRouteText(quote);
  const notes = quoteEmailNotes(quote);
  const orderNotes = route.map((line) => `<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#ffffff;">&#8226; ${escapeHtml(line)}</p>`).join("");
  const important = notes.map((line) => `<tr><td style="padding:0 0 12px;font-size:14px;line-height:1.65;color:#171512;">&#8226; ${escapeHtml(line)}</td></tr>`).join("");
  const value = escapeHtml(formatMoney(quote.value));
  const subject = escapeHtml(quote.subject || `Cotação ${quote.code || ""}${quote.client ? ` - ${quote.client}` : ""}`.trim());
  return [
    "<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>", subject, "</title>",
    "<style>body{-webkit-text-size-adjust:100%;}.cotacao-fluid-img{display:block;width:100%;height:auto;border:0;}@media(max-width:640px){.a4-sheet{width:100%!important;max-width:100%!important;min-height:0!important}.cotacao-col,.cotacao-img-pair{display:block!important;width:100%!important}.cotacao-value{font-size:26px!important}}</style></head>",
    "<body style=\"margin:0;padding:0;background:#0a2f41;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" style=\"background:#0a2f41;margin:0;padding:0;\"><tr><td align=\"center\">",
    "<table class=\"a4-sheet\" role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"794\" style=\"width:794px;max-width:794px;min-height:1123px;background:#d9d9d9;border-collapse:collapse;font-family:Segoe UI,Arial,sans-serif;color:#171512;\">",
    `<tr><td><img class="cotacao-fluid-img" src="${escapeHtml(assetUrl(baseUrl, names.banner, assets.imageUrls))}" alt="Betinhos Executive Service" width="794"></td></tr>`,
    `<tr><td style="padding:24px 42px 14px;background:#d9d9d9;"><p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Olá ${escapeHtml(intro)},</p><p style="margin:0 0 12px;font-size:14px;line-height:1.62;">A <strong>Betinhos Executive Service</strong> é uma empresa de traslados e serviços executivos presente no estado de São Paulo há mais de 37 anos e, ao longo dessas décadas, mantemos compromisso com Non Compliance, EHS e Safe Fleet.</p><p style="margin:0;font-size:14px;line-height:1.7;">Abaixo segue sua cotação no mesmo formato do material aprovado, com foco nas informações do atendimento e sem a assinatura final.</p></td></tr>`,
    `<tr><td style="background:#0a2f41;padding:0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr><td class="cotacao-col" valign="middle" width="50%" style="width:50%;padding:24px 22px;text-align:center;"><img src="${escapeHtml(assetUrl(baseUrl, names.header, assets.imageUrls))}" alt="Betinhos Executive Service" width="340" style="display:block;width:100%;max-width:340px;height:auto;border:0;margin:0 auto;"></td><td class="cotacao-col" valign="top" width="50%" style="width:50%;padding:22px 24px 24px;color:#ffffff;"><p style="margin:0 0 10px;font-size:15px;line-height:1.35;color:#ffffff;"><em>Roteiro do atendimento</em></p>${orderNotes}</td></tr></table></td></tr>`,
    `<tr><td style="background:#d9d9d9;padding:0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;"><tr><td class="cotacao-img-pair" width="50%" style="width:50%;padding:16px 10px 18px 18px;text-align:center;"><img src="${escapeHtml(assetUrl(baseUrl, van ? names.vanVehicle : names.vehicle, assets.imageUrls))}" alt="${van ? "Van executiva Betinhos" : "Frota executiva Betinhos"}" width="360" style="display:block;width:100%;max-width:360px;height:auto;border:0;margin:0 auto;"></td><td class="cotacao-img-pair" width="50%" style="width:50%;padding:16px 18px 18px 10px;text-align:center;"><img src="${escapeHtml(assetUrl(baseUrl, van ? names.vanInfo : names.commitments, assets.imageUrls))}" alt="${van ? "Informações da van executiva" : "Compromissos operacionais Betinhos"}" width="360" style="display:block;width:100%;max-width:360px;height:auto;border:0;margin:0 auto;"></td></tr></table></td></tr>`,
    `<tr><td style="background:#0a2f41;padding:22px 34px 24px;text-align:center;"><p style="margin:0 0 8px;font-size:17px;line-height:1.42;color:#ffffff;font-weight:700;">Com base nesse comprometimento, faço saber que o custo total é de</p><p class="cotacao-value" style="margin:0 0 12px;font-size:30px;line-height:1.15;color:#ffffff;font-weight:700;">${value}</p><p style="margin:0;font-size:15px;line-height:1.42;color:#ffffff;font-weight:700;">Veja abaixo informações importantes para sua contratação</p></td></tr>`,
    `<tr><td style="background:#d9d9d9;padding:22px 34px 24px;"><p style="margin:0 0 14px;font-size:16px;line-height:1.35;font-weight:700;">OBSERVAÇÕES IMPORTANTES:</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">${important}</table></td></tr>`,
    "</table></td></tr></table></body></html>",
  ].join("");
}

export function buildQuotePlainText(quote = {}) {
  const route = buildQuoteRouteText(quote).map((line) => `• ${line}`).join("\n");
  const notes = quoteEmailNotes(quote).map((line) => `• ${line}`).join("\n");
  return [`Cotação ${quote.code || ""}`.trim(), `Olá ${quote.clientContact || quote.client || "cliente"},`, "", route, "", `Custo total: ${formatMoney(quote.value)}`, "", "OBSERVAÇÕES IMPORTANTES:", notes].join("\n");
}

export async function loadQuoteImages(quote, { baseUrl = "", signal, fetcher = fetch } = {}) {
  const names = [QUOTE_ASSET_NAMES.banner, QUOTE_ASSET_NAMES.header,
    ...(isVanVehicle(quote.vehicleType)
      ? [QUOTE_ASSET_NAMES.vanVehicle, QUOTE_ASSET_NAMES.vanInfo]
      : [QUOTE_ASSET_NAMES.vehicle, QUOTE_ASSET_NAMES.commitments])];
  const files = {};
  const imageUrls = {};
  await Promise.all(names.map(async (name) => {
    const response = await fetcher(assetUrl(baseUrl, name), { signal, credentials: "same-origin" });
    if (!response.ok) throw new Error(`Não foi possível carregar a imagem ${name}.`);
    const blob = await response.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length < 24 || bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) throw new Error(`A imagem ${name} está indisponível.`);
    signal?.throwIfAborted?.();
    let binary = "";
    for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
    files[name] = bytes;
    imageUrls[name] = `data:image/png;base64,${btoa(binary)}`;
  }));
  return { files, imageUrls };
}

export async function copyQuoteToClipboard(quote, assets = {}) {
  const prepared = assets.imageUrls ? assets : { ...assets, ...await loadQuoteImages(quote, assets) };
  const html = buildQuoteEmailHtml(quote, prepared);
  const text = buildQuotePlainText(quote);
  assets.signal?.throwIfAborted?.();
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
