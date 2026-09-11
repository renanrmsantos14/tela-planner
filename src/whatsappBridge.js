export const WHATSAPP_BRIDGE = Object.freeze({
  hello: "betinhos.whatsapp.bridge.hello",
  ready: "betinhos.whatsapp.bridge.ready",
  intake: "betinhos.whatsapp.bridge.intake",
  response: "betinhos.whatsapp.bridge.response",
});

const CATEGORIES = new Set(["orcamento", "reserva", "duvida", "reclamacao", "follow_up", "outro"]);
const PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const DIRECTIONS = new Set(["inbound", "outbound"]);

export function maskSensitiveText(value = "") {
  return String(value)
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF]" )
    .replace(/\b\d{13,19}\b/g, "[DADO_FINANCEIRO]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL]");
}

export function normalizeWhatsAppPhone(value = "") {
  const digits = String(value).replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

export function messageFingerprint({ senderPhone = "", text = "", sentAt = "" } = {}) {
  const input = `${normalizeWhatsAppPhone(senderPhone)}|${String(sentAt).trim()}|${String(text).trim().toLocaleLowerCase("pt-BR")}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `wa-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function normalizeTriageResult(input = {}) {
  const category = CATEGORIES.has(input.category) ? input.category : "outro";
  const priority = PRIORITIES.has(input.priority) ? input.priority : "medium";
  const confidence = Number(input.confidence);
  return {
    category,
    priority,
    summary: String(input.summary || "").trim().slice(0, 500),
    nextAction: String(input.nextAction || "").trim().slice(0, 500),
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(input.dueDate || "")) ? input.dueDate : null,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
  };
}

export function normalizeWhatsAppIntake(input = {}) {
  const classification = normalizeTriageResult(input.classification);
  return {
    requestId: String(input.requestId || "").trim(),
    conversationKey: String(input.conversationKey || "").trim(),
    senderName: String(input.senderName || "").trim().slice(0, 160),
    senderPhone: normalizeWhatsAppPhone(input.senderPhone),
    messages: (Array.isArray(input.messages) ? input.messages : [])
      .filter((message) => message && DIRECTIONS.has(message.direction) && String(message.text || "").trim())
      .slice(-8)
      .map((message) => ({
        text: maskSensitiveText(message.text).slice(0, 2000),
        sentAt: String(message.sentAt || "").trim(),
        direction: message.direction,
      })),
    classification,
    source: "whatsapp-web",
  };
}

export function validateWhatsAppIntake(input = {}) {
  const normalized = normalizeWhatsAppIntake(input);
  if (!normalized.requestId) return { allowed: false, error: "Triagem sem requestId." };
  if (!normalized.conversationKey) return { allowed: false, error: "Triagem sem conversationKey." };
  if (!normalized.senderName) return { allowed: false, error: "Triagem sem nome do remetente." };
  if (!normalized.senderPhone) return { allowed: false, error: "Triagem sem telefone do remetente." };
  if (!normalized.messages.length) return { allowed: false, error: "Triagem sem mensagens." };
  if (!normalized.classification.summary) return { allowed: false, error: "Triagem sem resumo." };
  return { allowed: true, value: normalized };
}

export function createBridgeNonce() {
  return globalThis.crypto?.randomUUID?.() || `planner-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function installPlannerBridge({ onIntake, allowedOrigin = "" } = {}) {
  if (typeof window === "undefined") return () => {};
  const nonce = createBridgeNonce();
  const origin = allowedOrigin || window.location.origin;
  const handleMessage = async (event) => {
    if (event.source !== window || event.origin !== origin) return;
    const data = event.data || {};
    if (data.type === WHATSAPP_BRIDGE.hello) {
      window.postMessage({ type: WHATSAPP_BRIDGE.ready, clientNonce: data.clientNonce || "", plannerNonce: nonce }, origin);
      return;
    }
    if (data.type !== WHATSAPP_BRIDGE.intake || data.plannerNonce !== nonce) return;
    const validation = validateWhatsAppIntake(data.payload);
    if (!validation.allowed) {
      window.postMessage({ type: WHATSAPP_BRIDGE.response, requestId: data.payload?.requestId || "", status: "error", message: validation.error }, origin);
      return;
    }
    try {
      const result = await onIntake?.(validation.value);
      window.postMessage({ type: WHATSAPP_BRIDGE.response, requestId: validation.value.requestId, ...result }, origin);
    } catch (error) {
      window.postMessage({ type: WHATSAPP_BRIDGE.response, requestId: validation.value.requestId, status: "error", message: error?.message || "Falha ao gravar no Planner." }, origin);
    }
  };
  window.addEventListener("message", handleMessage);
  return () => window.removeEventListener("message", handleMessage);
}
