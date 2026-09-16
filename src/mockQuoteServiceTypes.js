import { DEFAULT_SERVICE_TYPES } from "./quoteServiceTypes.js";

const STORAGE_KEY = "planner-mock-service-types-v1";

function seed() {
  return DEFAULT_SERVICE_TYPES.map((name, order) => ({ id: `mock-${order}`, name, archived: false, order }));
}

export function loadMockQuoteServiceTypes() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : seed();
  } catch {
    return seed();
  }
}

function save(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  return items;
}

export function createMockQuoteServiceType(value) {
  const name = String(value || "").trim();
  if (!name) throw new Error("Informe o nome do tipo de serviço.");
  const current = loadMockQuoteServiceTypes();
  if (current.some((item) => item.name.localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0)) throw new Error("Já existe um tipo de serviço com esse nome.");
  return save([...current, { id: `mock-${crypto.randomUUID()}`, name, archived: false, order: Math.max(-1, ...current.map((item) => item.order)) + 1 }]);
}

export function updateMockQuoteServiceType(id, patch) {
  const current = loadMockQuoteServiceTypes();
  if (!current.some((item) => item.id === id)) throw new Error("Tipo de serviço não encontrado.");
  const changes = {};
  if (Object.hasOwn(patch, "name")) {
    const name = String(patch.name || "").trim();
    if (!name) throw new Error("Informe o nome do tipo de serviço.");
    if (current.some((item) => item.id !== id && item.name.localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0)) throw new Error("Já existe um tipo de serviço com esse nome.");
    changes.name = name;
  }
  if (Object.hasOwn(patch, "archived")) changes.archived = Boolean(patch.archived);
  return save(current.map((item) => item.id === id ? { ...item, ...changes } : item));
}

export function resetMockQuoteServiceTypes() {
  return save(seed());
}
