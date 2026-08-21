import test from "node:test";
import assert from "node:assert/strict";
import { createDataStore } from "../src/dataverse.js";

test("fora do Model-driven app usa mock local sem chamar Dataverse", async () => {
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCalls += 1; throw new Error("fetch não deveria ser chamado no modo local"); };

  try {
    delete globalThis.window;
    const store = createDataStore();
    const state = await store.load();
    assert.equal(store.live, false);
    assert.equal(state.live, false);
    assert.ok(state.tasks.length > 0);
    await store.createTask(state, { title: "Tarefa local" });
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("modo local expõe bootstrap por etapas sem bloquear dados essenciais", async () => {
  const originalWindow = globalThis.window;
  try {
    delete globalThis.window;
    const store = createDataStore();
    const core = await store.loadCore();
    assert.equal(core.loading.core, false);
    assert.equal(core.loading.quotes, false);
    assert.ok(core.tasks.length > 0);
    const supplemental = await store.loadSupplemental(core);
    assert.equal(supplemental.loading.quality, false);
    const details = await store.loadTaskDetails(core.tasks[0].id);
    assert.equal(details.taskId, core.tasks[0].id);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("com Xrm disponível mantém adapter live", () => {
  const originalWindow = globalThis.window;
  globalThis.window = { Xrm: { Utility: { getGlobalContext: () => ({ getClientUrl: () => "https://org.crm.dynamics.com" }) }, WebApi: {} } };
  try {
    assert.equal(createDataStore().live, true);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
