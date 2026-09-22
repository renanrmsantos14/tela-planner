import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildQuoteEmailHtml, copyQuoteToClipboard, loadQuoteImages, QUOTE_ASSET_NAMES } from "../src/quoteDomain.js";
import { createQuoteWord } from "../src/quoteWord.js";
import { createQuotePdf } from "../src/quotePdf.js";
import { createQuoteDraft } from "../src/mailGraph.js";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9n0ZkAAAAASUVORK5CYII=", "base64");
const quote = { code: "COT-1007", client: "Cliente", clientContact: "Renan", origin: "GRU", destination: "Paulista", vehicleType: "Executivo", value: "R$ 1.000,00", commercialTerms: "Pagamento em 30 dias" };
const fetcher = async () => ({ ok: true, blob: async () => new Blob([png], { type: "image/png" }) });

test("WebResources locais contêm os seis PNGs usados pelas cotações", async () => {
  for (const name of Object.values(QUOTE_ASSET_NAMES)) {
    const bytes = await readFile(new URL(`../public/WebResources/${name}`, import.meta.url));
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${name} deve ser PNG válido`);
    assert.ok(bytes.length > 1000, `${name} não pode estar vazio`);
  }
});

test("carrega todas as imagens e incorpora seus bytes no HTML copiado", async () => {
  const images = await loadQuoteImages(quote, { baseUrl: "https://crm.example", fetcher });
  assert.equal(Object.keys(images.files).length, 4);
  const html = buildQuoteEmailHtml(quote, { baseUrl: "https://crm.example", imageUrls: images.imageUrls });
  assert.equal((html.match(/src="data:image\/png;base64,/g) || []).length, 4);
  assert.doesNotMatch(html, /src="https:\/\/crm.example\/WebResources\//);
});

test("copia o HTML editado do preview sem reconstruir a proposta original", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalClipboardItem = Object.getOwnPropertyDescriptor(globalThis, "ClipboardItem");
  let copied;
  class MockClipboardItem { constructor(data) { this.data = data; } }
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { write: async ([item]) => { copied = item; } } } });
  Object.defineProperty(globalThis, "ClipboardItem", { configurable: true, value: MockClipboardItem });
  try {
    const html = '<!DOCTYPE html><html><body><p>Texto editado</p><img src="data:image/png;base64,abc"></body></html>';
    const text = "Texto editado";
    const result = await copyQuoteToClipboard(quote, { html, text });
    assert.equal(result.html, html);
    assert.equal(result.text, text);
    assert.equal(await copied.data["text/html"].text(), html);
    assert.equal(await copied.data["text/plain"].text(), text);
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else delete globalThis.navigator;
    if (originalClipboardItem) Object.defineProperty(globalThis, "ClipboardItem", originalClipboardItem);
    else delete globalThis.ClipboardItem;
  }
});

test("falha inteira se uma imagem não puder ser carregada", async () => {
  await assert.rejects(loadQuoteImages(quote, { fetcher: async () => ({ ok: false }) }), /Não foi possível carregar a imagem/);
});

test("Word contém conteúdo editável e quatro imagens incorporadas", async () => {
  const { blob, filename } = await createQuoteWord(quote, { fetcher });
  const archive = Buffer.from(await blob.arrayBuffer()).toString("latin1");
  assert.equal(filename, "Cotação COT-1007 - Cliente.docx");
  assert.match(archive, /word\/document.xml/);
  assert.equal((archive.match(/word\/media\//g) || []).length >= 4, true);
});

test("Word pode usar exatamente o HTML exibido no preview", async () => {
  const html = '<!DOCTYPE html><html><body><table class="a4-sheet"><tr><td>Visual idêntico ao preview</td></tr></table></body></html>';
  const { blob, filename } = await createQuoteWord(quote, { html });
  assert.equal(filename, "Cotação COT-1007 - Cliente.doc");
  assert.equal(blob.type, "application/msword;charset=utf-8");
  assert.match(await blob.text(), /Visual idêntico ao preview/);
});

test("cancelamento impede preparar Word após carregar imagens", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(createQuoteWord(quote, { signal: controller.signal, fetcher }), /AbortError/);
});

test("PDF usa os mesmos quatro assets e produz arquivo PDF", async () => {
  const result = await createQuotePdf(quote, { fetcher });
  assert.equal(result.filename, "Cotação COT-1007 - Cliente.pdf");
  assert.equal(result.blob.type, "application/pdf");
  assert.match(Buffer.from(await result.blob.arrayBuffer()).toString("latin1", 0, 8), /%PDF-1\./);
});

test("rascunho Graph transforma imagens em anexos inline CID", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (requests.length === 1) return { ok: true, status: 201, json: async () => ({ id: "draft-1", webLink: "https://outlook.office.com/mail/draft-1" }) };
    return { ok: true, status: 201, json: async () => ({ id: `attachment-${requests.length}` }) };
  };
  try {
    const assets = await loadQuoteImages(quote, { fetcher });
    const result = await createQuoteDraft({ token: "token", quote: { ...quote, clientEmail: "cliente@example.com" }, mode: "body", assets: { ...assets, buildHtml: buildQuoteEmailHtml } });
    assert.equal(result.id, "draft-1");
    const body = JSON.parse(requests[0].options.body);
    assert.equal(body.toRecipients[0].emailAddress.address, "cliente@example.com");
    assert.match(body.body.content, /cid:quote-/);
    assert.equal(requests.length, 5);
    assert.equal(JSON.parse(requests[1].options.body).isInline, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rascunho exige destinatário antes de chamar Graph", async () => {
  await assert.rejects(createQuoteDraft({ token: "token", quote, mode: "body", assets: { files: {}, buildHtml: buildQuoteEmailHtml } }), /e-mail do cliente/);
});

test("modo anexo não adiciona imagens inline e usa sessão para arquivo grande", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (requests.length === 1) return { ok: true, status: 201, json: async () => ({ id: "draft-2", webLink: "https://outlook.office.com/mail/draft-2" }) };
    if (requests.length === 2) return { ok: true, status: 200, json: async () => ({ uploadUrl: "https://upload.example/session" }) };
    return { ok: true, status: requests.length === 12 ? 201 : 202, json: async () => ({}) };
  };
  try {
    const assets = { files: { "one.png": new Uint8Array([1]) }, buildHtml: buildQuoteEmailHtml };
    const large = new Uint8Array(3 * 1024 * 1024 + 1);
    await createQuoteDraft({ token: "token", quote: { ...quote, clientEmail: "cliente@example.com" }, mode: "attachment", attachment: { name: "Cotação.pdf", bytes: large, contentType: "application/pdf" }, assets });
    assert.equal(requests.length, 12);
    assert.doesNotMatch(JSON.parse(requests[0].options.body).body.content, /cid:/);
    assert.match(requests[1].url, /createUploadSession/);
    assert.equal(requests[2].options.headers.Authorization, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
