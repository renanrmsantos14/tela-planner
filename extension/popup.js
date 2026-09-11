const SETTINGS_KEY = "betinhos.triage.settings.v1";
const endpoint = document.querySelector("#endpoint");
const sessionToken = document.querySelector("#sessionToken");
const queue = document.querySelector("#queue");
const status = document.querySelector("#status");

async function render() {
  const stored = await chrome.storage.local.get([SETTINGS_KEY, "betinhos.triage.queue.v1"]);
  endpoint.value = stored[SETTINGS_KEY]?.endpoint || "";
  sessionToken.value = stored[SETTINGS_KEY]?.sessionToken || "";
  queue.replaceChildren(...(stored["betinhos.triage.queue.v1"] || []).map((item) => {
    const row = document.createElement("li");
    row.append(`${item.classification?.priority || "medium"} · ${item.classification?.summary || item.senderName} `);
    const approve = document.createElement("button");
    approve.type = "button";
    approve.textContent = "Enviar";
    approve.addEventListener("click", async () => {
      const result = await chrome.runtime.sendMessage({ type: "triage-approve", item });
      status.textContent = result?.ok ? "Enviado ao Planner." : result?.error || "Falha ao enviar.";
      render();
    });
    row.append(approve);
    return row;
  }));
  status.textContent = `Fila de triagem · ${queue.children.length}`;
}

document.querySelector("#save").addEventListener("click", async () => {
  await chrome.storage.local.set({ [SETTINGS_KEY]: { endpoint: endpoint.value.trim(), sessionToken: sessionToken.value.trim() } });
  status.textContent = "Configuração salva.";
});
document.querySelector("#scan").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const result = await chrome.runtime.sendMessage({ type: "scan-active", tabId: tab?.id });
  status.textContent = result?.ok ? "Triagem adicionada." : result?.error || "Não foi possível classificar.";
  render();
});
render();
