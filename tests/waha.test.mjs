import assert from "node:assert/strict";
import test from "node:test";
import { chatIdFromDomValue, extractWahaPhone, normalizeWahaEndpoint, resolveWahaPhone } from "../extension/waha.js";

test("WAHA aceita somente endpoint local", () => {
  assert.equal(normalizeWahaEndpoint("http://127.0.0.1:3000/"), "http://127.0.0.1:3000");
  assert.equal(normalizeWahaEndpoint("https://example.com"), "");
});

test("extrai chatId e telefone de payloads WAHA", () => {
  assert.equal(chatIdFromDomValue("true_23423462304912@lid_AAAA"), "23423462304912@lid");
  assert.equal(extractWahaPhone({ lid: "23423462304912@lid", pn: "5511999990000@c.us" }), "+5511999990000");
});

test("resolve um @lid com uma única consulta autenticada", async () => {
  const calls = [];
  const phone = await resolveWahaPhone({ endpoint: "http://127.0.0.1:3000", apiKey: "local-key", session: "default", chatId: "23423462304912@lid", fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ pn: "5511999990000@c.us" }), { status: 200 });
  } });
  assert.equal(phone, "+5511999990000");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers["X-Api-Key"], "local-key");
});
