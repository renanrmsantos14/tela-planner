import assert from "node:assert/strict";
import test from "node:test";
import { WHATSAPP_BRIDGE, installPlannerBridge } from "../src/whatsappBridge.js";

function fakeWindow() {
  const listeners = new Map();
  const messages = [];
  const value = {
    location: { origin: "https://planner.example" },
    postMessage(message, origin) { messages.push({ message, origin }); },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    async dispatch(data, origin = "https://planner.example") { return listeners.get("message")?.({ source: value, origin, data }); },
    messages,
  };
  return value;
}

function intake() {
  return {
    requestId: "wa-r-1",
    conversationKey: "5511999990000",
    senderName: "Ana",
    senderPhone: "+55 (11) 99999-0000",
    messages: [{ text: "Preciso de orçamento", sentAt: "2026-09-11T10:00:00Z", direction: "inbound" }],
    classification: { category: "orcamento", priority: "high", summary: "Solicitação de orçamento" },
  };
}

test("bridge responde handshake e rejeita origem incorreta", async () => {
  const previous = globalThis.window;
  const current = fakeWindow();
  globalThis.window = current;
  const dispose = installPlannerBridge({ onIntake: async () => ({ status: "created", contactId: "c-1", taskId: "t-1" }) });
  await current.dispatch({ type: WHATSAPP_BRIDGE.hello, clientNonce: "client-1" });
  assert.equal(current.messages[0].message.type, WHATSAPP_BRIDGE.ready);
  const nonce = current.messages[0].message.plannerNonce;
  await current.dispatch({ type: WHATSAPP_BRIDGE.intake, plannerNonce: nonce, payload: intake() }, "https://evil.example");
  assert.equal(current.messages.length, 1);
  await current.dispatch({ type: WHATSAPP_BRIDGE.intake, plannerNonce: nonce, payload: intake() });
  assert.equal(current.messages.at(-1).message.status, "created");
  dispose();
  globalThis.window = previous;
});
