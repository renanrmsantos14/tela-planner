import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { buildQuoteRouteText, formatMoney, isVanVehicle, loadQuoteImages, QUOTE_ASSET_NAMES, quoteEmailNotes, quoteSubject } from "./quoteDomain.js";

function wrap(text, max) {
  const words = String(text || "").replace(/[→↔]/g, "->").replace(/[—–]/g, "-").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > max && line) { lines.push(line); line = word; } else line = `${line} ${word}`.trim();
  }
  if (line) lines.push(line);
  return lines;
}

function fitImage(page, image, x, y, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, { x: x + (maxWidth - width) / 2, y: y + (maxHeight - height) / 2, width, height });
}

export async function createQuotePdf(quote, { baseUrl = "", signal, fetcher, assets } = {}) {
  const artwork = assets || await loadQuoteImages(quote, { baseUrl, signal, fetcher });
  signal?.throwIfAborted?.();
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.04, 0.18, 0.25);
  page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.85, 0.85, 0.85) });
  const image = async (name) => pdf.embedPng(artwork.files[name]);
  let y = 810;
  const banner = await image(QUOTE_ASSET_NAMES.banner);
  fitImage(page, banner, 0, y - 58, 595, 58); y -= 78;
  page.drawText(`Olá ${quote.clientContact || quote.client || "cliente"},`, { x: 32, y, size: 13, font: bold, color: navy }); y -= 24;
  for (const line of wrap("A Betinhos Executive Service é uma empresa de traslados e serviços executivos presente no estado de São Paulo há mais de 37 anos, com compromisso com Non Compliance, EHS e Safe Fleet.", 88)) { page.drawText(line, { x: 32, y, size: 9, font, color: rgb(0.09, 0.08, 0.07) }); y -= 14; }
  y -= 8;
  page.drawRectangle({ x: 0, y: y - 105, width: 595, height: 105, color: navy });
  const header = await image(QUOTE_ASSET_NAMES.header); fitImage(page, header, 25, y - 92, 240, 85);
  page.drawText("Roteiro do atendimento", { x: 300, y: y - 26, size: 11, font: bold, color: rgb(1, 1, 1) });
  let routeY = y - 45;
  for (const line of buildQuoteRouteText(quote)) { page.drawText(`• ${String(line).replace(/[→↔]/g, "->").replace(/[—–]/g, "-")}`, { x: 300, y: routeY, size: 9, font, color: rgb(1, 1, 1) }); routeY -= 14; }
  y -= 130;
  const van = isVanVehicle(quote.vehicleType);
  const vehicle = await image(van ? QUOTE_ASSET_NAMES.vanVehicle : QUOTE_ASSET_NAMES.vehicle);
  const info = await image(van ? QUOTE_ASSET_NAMES.vanInfo : QUOTE_ASSET_NAMES.commitments);
  fitImage(page, vehicle, 28, y - 120, 260, 110); fitImage(page, info, 307, y - 120, 260, 110); y -= 145;
  page.drawRectangle({ x: 0, y: y - 68, width: 595, height: 68, color: navy });
  page.drawText("Custo total", { x: 32, y: y - 25, size: 11, font: bold, color: rgb(1, 1, 1) });
  page.drawText(formatMoney(quote.value), { x: 32, y: y - 50, size: 19, font: bold, color: rgb(1, 1, 1) }); y -= 96;
  page.drawText("OBSERVAÇÕES IMPORTANTES:", { x: 32, y, size: 11, font: bold, color: navy }); y -= 18;
  for (const note of quoteEmailNotes(quote).slice(0, 8)) { for (const line of wrap(`• ${note}`, 88)) { if (y < 28) break; page.drawText(line, { x: 32, y, size: 8, font, color: rgb(0.09, 0.08, 0.07) }); y -= 11; } }
  const bytes = await pdf.save();
  return { blob: new Blob([bytes], { type: "application/pdf" }), filename: `${quoteSubject(quote).replace(/[<>:"/\\|?*]/g, "-") || "Cotação"}.pdf` };
}

export function downloadQuotePdf(result) {
  const url = URL.createObjectURL(result.blob); const anchor = document.createElement("a");
  anchor.href = url; anchor.download = result.filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
