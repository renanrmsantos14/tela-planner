import test from "node:test";
import assert from "node:assert/strict";
import {
  buildQuoteEmailHtml,
  buildQuotePlainText,
  buildQuoteRouteText,
  isVanVehicle,
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
  assert.equal(validateQuoteDraft({ ...base, channel: "WhatsApp", status: "Perdida", lossReason: "Preço" }).valid, true);
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
