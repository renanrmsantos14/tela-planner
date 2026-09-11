import assert from "node:assert/strict";
import test from "node:test";
import {
  maskSensitiveText,
  messageFingerprint,
  normalizeWhatsAppIntake,
  normalizeTriageResult,
  validateWhatsAppIntake,
} from "../src/whatsappBridge.js";

test("mascara dados pessoais e financeiros antes da triagem", () => {
  assert.equal(maskSensitiveText("CPF 123.456.789-09 e cartão 4111111111111111"), "CPF [CPF] e cartão [DADO_FINANCEIRO]");
  assert.equal(maskSensitiveText("ana@example.com"), "[EMAIL]");
});

test("fingerprint é determinístico e normaliza telefone", () => {
  assert.equal(messageFingerprint({ senderPhone: "+55 (11) 99999-0000", text: "Oi", sentAt: "2026-09-11T10:00:00Z" }), messageFingerprint({ senderPhone: "5511999990000", text: "Oi", sentAt: "2026-09-11T10:00:00Z" }));
});

test("normaliza urgência e limita a resposta da IA", () => {
  const result = normalizeTriageResult({ category: "inexistente", priority: "urgent", confidence: 2, summary: " x ", dueDate: "2026-09-11" });
  assert.deepEqual(result, { category: "outro", priority: "urgent", summary: "x", nextAction: "", dueDate: "2026-09-11", confidence: 1 });
});

test("valida intake mínimo e mantém somente últimas oito mensagens", () => {
  const messages = Array.from({ length: 10 }, (_, index) => ({ text: `Mensagem ${index}`, direction: "inbound", sentAt: String(index) }));
  const validation = validateWhatsAppIntake({ requestId: "r-1", conversationKey: "c-1", senderName: "Ana", senderPhone: "5511999990000", messages, classification: { summary: "Pedido", priority: "medium" } });
  assert.equal(validation.allowed, true);
  assert.equal(validation.value.messages.length, 8);
  assert.equal(validation.value.messages[0].text, "Mensagem 2");
  assert.equal(normalizeWhatsAppIntake({ classification: {} }).source, "whatsapp-web");
});
