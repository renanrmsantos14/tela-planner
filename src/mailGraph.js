const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const SMALL_ATTACHMENT_LIMIT = 3 * 1024 * 1024;

function toBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return btoa(binary);
}

async function graphRequest(path, token, options = {}) {
  const response = await fetch(`${GRAPH_BASE_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) {
    let detail = "";
    try { detail = (await response.json())?.error?.message || ""; } catch { /* response may be empty */ }
    throw new Error(`Microsoft Graph: ${response.status}${detail ? ` — ${detail}` : ""}`);
  }
  return response.status === 204 ? null : response.json();
}

async function addAttachment(messageId, token, attachment) {
  const bytes = attachment.bytes instanceof Uint8Array ? attachment.bytes : new Uint8Array(attachment.bytes);
  if (bytes.byteLength < SMALL_ATTACHMENT_LIMIT) {
    return graphRequest(`/me/messages/${encodeURIComponent(messageId)}/attachments`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: attachment.name,
        contentType: attachment.contentType || "application/octet-stream",
        contentBytes: toBase64(bytes),
        ...(attachment.isInline ? { isInline: true, contentId: attachment.contentId } : {}),
      }),
    });
  }

  const session = await graphRequest(`/me/messages/${encodeURIComponent(messageId)}/attachments/createUploadSession`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ AttachmentItem: { attachmentType: "file", name: attachment.name, size: bytes.byteLength, isInline: Boolean(attachment.isInline), contentId: attachment.contentId || undefined } }),
  });
  const chunkSize = 320 * 1024;
  for (let start = 0; start < bytes.byteLength; start += chunkSize) {
    const end = Math.min(start + chunkSize, bytes.byteLength) - 1;
    const response = await fetch(session.uploadUrl, {
      method: "PUT",
      headers: { "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${bytes.byteLength}` },
      body: bytes.slice(start, end + 1),
    });
    if (!response.ok && response.status !== 201 && response.status !== 202) throw new Error(`Microsoft Graph: falha no upload de ${attachment.name} (${response.status}).`);
  }
  return { name: attachment.name, uploaded: true };
}

export async function createQuoteDraft({ token, quote, mode = "body", attachment, assets, subject }) {
  const clientEmail = String(quote?.clientEmail || "").trim();
  if (!clientEmail) throw new Error("Informe o e-mail do cliente antes de criar o rascunho.");
  if (!assets?.files || !Object.keys(assets.files).length) throw new Error("As imagens da cotação ainda não foram carregadas.");

  const inlineAttachments = mode === "attachment" ? [] : Object.entries(assets.files).map(([name, bytes]) => ({
    name,
    bytes,
    contentType: "image/png",
    contentId: `quote-${name.replace(/[^a-z0-9]/gi, "-")}`,
    isInline: true,
  }));
  const imageUrls = Object.fromEntries(inlineAttachments.map((item) => [item.name, `cid:${item.contentId}`]));
  const bodyHtml = assets.buildHtml(quote, { imageUrls });
  const draft = await graphRequest("/me/messages?$select=id,webLink", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: subject || `Cotação ${quote.code || ""}${quote.client ? ` - ${quote.client}` : ""}`.trim(),
      body: { contentType: "HTML", content: mode === "attachment" ? `<p>Olá ${quote.clientContact || quote.client || "cliente"},</p><p>Segue a cotação em anexo.</p>` : bodyHtml },
      toRecipients: [{ emailAddress: { address: clientEmail } }],
    }),
  });
  for (const inline of inlineAttachments) await addAttachment(draft.id, token, inline);
  if ((mode === "attachment" || mode === "both") && attachment) await addAttachment(draft.id, token, attachment);
  return draft;
}

export function openDraftInOutlook(draft) {
  if (!draft?.webLink) throw new Error("O rascunho foi criado, mas o Outlook não retornou o link de abertura.");
  window.open(draft.webLink, "_blank", "noopener,noreferrer");
}

export { toBase64 };
