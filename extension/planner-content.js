const WHATSAPP_BRIDGE = { hello: "betinhos.whatsapp.bridge.hello", ready: "betinhos.whatsapp.bridge.ready", response: "betinhos.whatsapp.bridge.response" };

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "planner-intake") return;
  window.postMessage(message.payload, window.location.origin);
  sendResponse({ ok: true });
});

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin || event.data?.type !== WHATSAPP_BRIDGE.ready) return;
  chrome.storage.session.set({ plannerNonce: event.data.plannerNonce || "" });
});

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== window.location.origin || event.data?.type !== WHATSAPP_BRIDGE.response) return;
  chrome.runtime.sendMessage({ type: "planner-response", response: event.data }).catch(() => {});
});

const sendHello = () => window.postMessage({ type: WHATSAPP_BRIDGE.hello, clientNonce: crypto.randomUUID() }, window.location.origin);
sendHello();
setInterval(sendHello, 2000);
