import { maskSensitiveText, messageFingerprint, normalizeWhatsAppPhone } from "../src/whatsappBridge.js";

export const DEFAULT_TRIAGE_ENDPOINT = "http://127.0.0.1:8765";

export function buildTriageRequest(conversation = {}) {
  const senderPhone = normalizeWhatsAppPhone(conversation.senderPhone);
  const messages = (conversation.messages || []).slice(-8).map((message) => ({ ...message, text: maskSensitiveText(message.text).slice(0, 2000) }));
  const last = messages.at(-1) || {};
  return {
    requestId: messageFingerprint({ senderPhone, text: last.text, sentAt: last.sentAt }),
    conversationKey: senderPhone || conversation.senderName,
    senderName: conversation.senderName,
    senderPhone,
    messages,
    source: "whatsapp-web",
  };
}

export async function requestTriage(endpoint, conversation, sessionToken = "") {
  if (!endpoint) throw new Error("Configure o endpoint da IA na extensão.");
  const body = buildTriageRequest(conversation);
  const response = await fetch(endpoint.replace(/\/$/, "") + "/v1/triage", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(sessionToken ? { Authorization: `Bearer ${sessionToken}`, "X-Local-Token": sessionToken } : {}) },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "A IA não respondeu.");
  return { ...body, classification: payload.data || payload };
}
