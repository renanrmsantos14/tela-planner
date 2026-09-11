let lastUnreadCount = 0;
let scheduled = null;

function cleanText(value = "") { return String(value).replace(/\s+/g, " ").trim(); }
function parseActiveConversation(documentRef = document) {
  const header = documentRef.querySelector("header [title], header span[dir='auto'], [data-testid='conversation-info-header-chat-title']");
  const senderName = cleanText(header?.getAttribute("title") || header?.textContent || "");
  const messageNodes = [...documentRef.querySelectorAll("[data-testid='msg-container'], .message-in, .message-out")];
  const messages = messageNodes.slice(-8).map((node) => ({ text: cleanText(node.querySelector("span[dir='ltr'], .copyable-text span")?.textContent || node.textContent || ""), sentAt: node.querySelector("[data-pre-plain-text]")?.getAttribute("data-pre-plain-text") || new Date().toISOString(), direction: node.classList.contains("message-out") ? "outbound" : "inbound" })).filter((message) => message.text);
  const phone = cleanText(documentRef.querySelector("header [data-id], header [data-testid='conversation-info-header']")?.getAttribute("data-id") || "");
  return { senderName, senderPhone: phone.replace(/@.*$/, ""), messages };
}
function findUnreadConversationRows(documentRef = document) {
  return [...documentRef.querySelectorAll("[aria-label*='unread' i], [data-testid='icon-unread-count'], span[aria-label*='mensagem não lida' i]")].map((node) => node.closest("[data-testid='cell-frame-container'], [role='listitem'], div[tabindex='-1']")).filter(Boolean);
}

function sendRuntimeMessage(message) {
  try {
    const pending = chrome.runtime.sendMessage(message);
    pending?.catch?.(() => {});
  } catch (_) {}
}

function notifyScan() {
  if (scheduled) return;
  scheduled = setTimeout(() => {
    scheduled = null;
    const unreadCount = findUnreadConversationRows(document).length;
    if (unreadCount > lastUnreadCount) sendRuntimeMessage({ type: "scan-active" });
    lastUnreadCount = unreadCount;
  }, 700);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "triage-active") sendResponse(parseActiveConversation(document));
});

new MutationObserver(notifyScan).observe(document.body, { childList: true, subtree: true });
