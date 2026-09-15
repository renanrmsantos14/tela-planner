import test from "node:test";
import assert from "node:assert/strict";
import {
  buildQuoteEmailHtml,
  buildQuotePlainText,
  buildQuoteRouteText,
  filterQuotes,
  getQuoteMetrics,
  getQuoteNextAction,
  isVanVehicle,
  isQuoteTransitionAllowed,
  validateQuoteStep,
  validateQuoteDraft,
} from "../src/quoteDomain.js";

const base = {
  code: "COT-0042",
  title: "Transfer executivo",
  client: "ACME & Filhos",
  clientContact: "Iara <teste>",
  serviceType: "Transfer",
  vehicleType: "Van executiva",
  origin: "GRU",
  destination: "Faria Lima",
  serviceDate: "2026-09-10T14:45",
  returnDate: "2026-09-10T22:00",
  passengers: "8",
  value: "R$ 1.092,30",
  commercialTerms: "Pagamento <30 dias>",
  deadline: "2026-09-09",
};

test("valida campos mínimos e exige motivo somente para Perdida", () => {
  assert.equal(validateQuoteDraft({}).valid, false);
  assert.equal(validateQuoteDraft({ ...base, title: "", status: "Nova" }).missing.includes("título interno"), true);
  assert.equal(validateQuoteDraft({ ...base, status: "Perdida" }).missing.includes("motivo da perda"), true);
  assert.equal(validateQuoteDraft({ ...base, channel: "WhatsApp", clientPhone: "11999999999", status: "Perdida", lossReason: "Preço" }).valid, true);
});

test("gera roteiro com e sem retorno", () => {
  assert.deepEqual(buildQuoteRouteText(base), ["GRU → Faria Lima", "Saída: 10/09/2026, 14:45", "Retorno: 10/09/2026, 22:00", "Passageiros: 8"]);
  assert.equal(buildQuoteRouteText({ ...base, returnDate: "" }).some((line) => line.startsWith("Retorno")), false);
});

test("seleciona modelo van e escapa conteúdo dinâmico", () => {
  assert.equal(isVanVehicle(base.vehicleType), true);
  const html = buildQuoteEmailHtml(base, { baseUrl: "https://crm.example" });
  assert.equal(html.includes("new_cotacao_van_veiculos.png"), true);
  assert.equal(html.includes("ACME &amp; Filhos"), true);
  assert.equal(html.includes("Iara &lt;teste&gt;"), true);
  assert.equal(html.includes("Pagamento &lt;30 dias&gt;"), true);
  assert.equal((html.match(/<tr>/g) || []).length >= 6, true);
});

test("seleciona modelo executivo e oferece fallback textual", () => {
  const html = buildQuoteEmailHtml({ ...base, vehicleType: "Sedan executivo" });
  assert.equal(html.includes("new_cotacao_banner_veiculos.png"), true);
  assert.equal(html.includes("new_cotacao_compromissos.png"), true);
  assert.match(buildQuotePlainText(base), /Custo total: R\$ 1\.092,30/);
});

test("valida cada etapa e o contato exigido pelo canal", () => {
  assert.deepEqual(Object.keys(validateQuoteStep({}, "client").errors), ["title", "client", "clientContact", "channel"]);
  assert.equal(validateQuoteStep({ ...base, channel: "WhatsApp", clientPhone: "" }, "client").errors.clientPhone, "Informe o telefone.");
  assert.equal(validateQuoteStep({ ...base, channel: "E-mail", clientEmail: "invalido" }, "client").errors.clientEmail, "Informe um e-mail válido.");
  assert.equal(validateQuoteStep({ ...base, channel: "E-mail", clientEmail: "iara@acme.com" }, "client").valid, true);
  assert.equal(validateQuoteStep(base, "service").valid, true);
  assert.equal(validateQuoteStep({ ...base, deadline: "" }, "commercial").errors.deadline, "Informe o prazo para responder.");
  assert.equal(validateQuoteStep(base, "review").valid, false);
  assert.equal(validateQuoteStep({ ...base, channel: "Telefone", clientPhone: "11999999999" }, "review").valid, true);
});

test("filtra cotações e calcula indicadores operacionais", () => {
  const quotes = [
    { id: "q1", code: "COT-1", client: "Acme", status: "Nova", priority: "high", deadline: "2026-09-14" },
    { id: "q2", code: "COT-2", client: "Beta", status: "Aguardando informação", priority: "medium", deadline: "2026-09-15" },
    { id: "q3", code: "COT-3", client: "Gama", status: "Convertida em serviço", priority: "low", deadline: "2026-09-10" },
  ];
  const tasks = [{ id: "t1", quoteId: "q1", assigneeIds: ["e1"] }, { id: "t2", quoteId: "q2", assigneeIds: [] }];
  assert.deepEqual(getQuoteMetrics(quotes, tasks, "2026-09-15"), { active: 2, overdue: 1, dueToday: 1, waiting: 1, unassigned: 1 });
  assert.deepEqual(filterQuotes(quotes, tasks, { query: "acme", priority: "high", responsible: "e1" }, "2026-09-15").map((item) => item.id), ["q1"]);
  assert.deepEqual(filterQuotes(quotes, tasks, { deadline: "overdue" }, "2026-09-15").map((item) => item.id), ["q1"]);
});

test("define próxima ação e transições válidas", () => {
  assert.equal(getQuoteNextAction({ status: "Nova" }).primary.status, "Em análise pelo financeiro");
  assert.equal(getQuoteNextAction({ status: "Cotada" }).primary.id, "copy");
  assert.equal(getQuoteNextAction({ status: "Perdida" }).primary.status, "Nova");
  assert.equal(isQuoteTransitionAllowed("Nova", "Cotada"), true);
  assert.equal(isQuoteTransitionAllowed("Convertida em serviço", "Cotada"), false);
  assert.equal(isQuoteTransitionAllowed("Perdida", "Nova"), true);
});
