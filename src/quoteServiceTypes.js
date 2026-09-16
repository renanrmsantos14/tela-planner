export const DEFAULT_SERVICE_TYPES = ["Transfer", "Diária", "Viagem", "Serviço por hora", "Evento", "Mensal", "Receptivo", "Executivo corporativo", "Outro"];

export function normalizeServiceTypes(value) {
  const entries = Array.isArray(value) ? value : String(value || "").split(/\r?\n/);
  return [...new Map(entries.map((item) => String(item).trim()).filter(Boolean).map((item) => [item.toLocaleLowerCase("pt-BR"), item])).values()];
}
