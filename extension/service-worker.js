import { parseActiveConversation } from "./whatsapp-parser.js";
import { requestTriage } from "./triage.js";
import { resolveWahaPhone } from "./waha.js";

const QUEUE_KEY = "betinhos.triage.queue.v1";
const SETTINGS_KEY = "betinhos.triage.settings.v1";

async function readQueue() {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  return Array.isArray(stored[QUEUE_KEY]) ? stored[QUEUE_KEY] : [];
}

async function writeQueue(queue) {
  await chrome.storage.local.set({ [QUEUE_KEY]: queue.slice(-100) });
  await chrome.action.setBadgeText({ text: queue.length ? String(Math.min(queue.length, 99)) : "" });
}

async function triageActiveTab(tabId) {
  if (!tabId) throw new Error("Nenhuma aba ativa encontrada.");
  const settings = (await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY] || {};
  let response = await chrome.tabs.sendMessage(tabId, { type: "triage-active" });
  if (!response.senderPhone && settings.wahaEnabled) {
    const senderPhone = await resolveWahaPhone({ endpoint: settings.wahaEndpoint, apiKey: settings.wahaApiKey, session: settings.wahaSession, chatId: response.chatId });
    if (senderPhone) response = { ...response, senderPhone, phoneSource: "waha" };
  }
  const triage = await requestTriage(settings.endpoint, response, settings.sessionToken || "");
  const queue = await readQueue();
  if (!queue.some((item) => item.requestId === triage.requestId)) queue.push({ ...triage, createdAt: new Date().toISOString(), status: "pending" });
  await writeQueue(queue);
  await chrome.notifications.create(`triage-${triage.requestId}`, { type: "basic", iconUrl: "icon.svg", title: "Nova triagem no Planner", message: triage.classification?.summary || "Conversa aguardando revisão." });
  return triage;
}

async function approveIntake(item, sendResponse) {
  const tabs = await chrome.tabs.query({ url: ["https://*.dynamics.com/*"] });
  const plannerTab = tabs[0];
  if (!plannerTab?.id) { sendResponse({ ok: false, error: "Abra o Planner em uma aba antes de aprovar." }); return; }
  const nonce = (await chrome.storage.session.get("plannerNonce")).plannerNonce;
  if (!nonce) { sendResponse({ ok: false, error: "Planner ainda não está conectado à extensão." }); return; }
  const result = await chrome.tabs.sendMessage(plannerTab.id, { type: "planner-intake", payload: { type: "betinhos.whatsapp.bridge.intake", plannerNonce: nonce, payload: item } }).catch((error) => ({ error: error.message }));
  if (result?.error) { sendResponse({ ok: false, error: result.error }); return; }
  sendResponse({ ok: true });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "scan-active" && (sender.tab?.id || message.tabId)) {
    triageActiveTab(sender.tab?.id || message.tabId).then((data) => sendResponse({ ok: true, data })).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === "queue") {
    readQueue().then((data) => sendResponse({ ok: true, data }));
    return true;
  }
  if (message.type === "settings") {
    chrome.storage.local.set({ [SETTINGS_KEY]: message.value || {} }).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "triage-approve") {
    approveIntake(message.item, sendResponse).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === "planner-response") {
    const response = message.response || {};
    readQueue().then(async (queue) => {
      const next = queue.map((item) => item.requestId === response.requestId ? { ...item, status: response.status, plannerResponse: response } : item);
      await writeQueue(next.filter((item) => !["created", "updated", "duplicate"].includes(item.status)));
    }).catch(() => {});
  }
});

chrome.runtime.onInstalled.addListener(() => chrome.action.setBadgeText({ text: "" }));
