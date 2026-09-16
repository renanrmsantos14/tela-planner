import test from "node:test";
import assert from "node:assert/strict";
import { createMockQuoteServiceType, deleteMockQuoteServiceType, loadMockQuoteServiceTypes, resetMockQuoteServiceTypes, updateMockQuoteServiceType } from "../src/mockQuoteServiceTypes.js";

test("catálogo mock persiste inclusão, renomeação, arquivamento e restauração", () => {
  const values = new Map();
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  try {
    const initial = loadMockQuoteServiceTypes();
    assert.ok(initial.length > 0);
    const created = createMockQuoteServiceType(" Serviço teste ").at(-1);
    assert.equal(created.name, "Serviço teste");
    assert.throws(() => createMockQuoteServiceType("servico teste"), /Já existe/);
    updateMockQuoteServiceType(created.id, { name: "Serviço editado", archived: true });
    assert.deepEqual(loadMockQuoteServiceTypes().find((item) => item.id === created.id), { ...created, name: "Serviço editado", archived: true });
    updateMockQuoteServiceType(created.id, { archived: false });
    assert.equal(loadMockQuoteServiceTypes().find((item) => item.id === created.id).archived, false);
    resetMockQuoteServiceTypes();
    assert.deepEqual(loadMockQuoteServiceTypes(), initial);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});

test("exclui tipo mock somente quando não existe cotação vinculada", () => {
  const values = new Map();
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  try {
    const created = createMockQuoteServiceType("Serviço de teste").at(-1);
    assert.throws(() => deleteMockQuoteServiceType(created.id, [{ serviceTypeId: created.id }]), /vinculado/);
    assert.throws(() => deleteMockQuoteServiceType(created.id, [{ serviceType: created.name }]), /vinculado/);
    assert.ok(loadMockQuoteServiceTypes().some((item) => item.id === created.id));
    deleteMockQuoteServiceType(created.id, []);
    assert.ok(!loadMockQuoteServiceTypes().some((item) => item.id === created.id));
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});
