import assert from "node:assert/strict";
import test from "node:test";
import { createDataStore } from "../src/dataverse.js";

test("save live confirma a tarefa sem recarregar todo o estado", async () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.window = {
    Xrm: {
      Utility: {
        getGlobalContext: () => ({
          getClientUrl: () => "https://org.crm.dynamics.com",
          userSettings: { userId: "user-1" },
        }),
      },
      WebApi: {},
    },
  };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method });
    const body = url.includes("EntityDefinitions")
      ? JSON.stringify({ value: [{ ReferencingAttribute: "cr40f_tarefa", ReferencingEntityNavigationPropertyName: "cr40f_tarefa", ReferencedEntity: "cr40f_plannertarefa" }] })
      : "";
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => null },
      text: async () => body,
    };
  };

  try {
    const store = createDataStore();
    const state = {
      live: true,
      tasks: [{
        id: "task-1",
        title: "Antigo",
        status: "todo",
        priority: "medium",
        description: "",
        dueDate: "",
        waitingContext: {},
        assigneeIds: [],
        assigneeNames: [],
        detailsLoaded: true,
      }],
      quotes: [{ id: "quote-1" }],
      teams: [],
      employees: [],
    };
    const next = await store.updateTask(state, "task-1", { title: "Novo" });

    assert.equal(calls.length, 3);
    assert.deepEqual(calls.map((call) => call.method), ["PATCH", undefined, "POST"]);
    assert.equal(next.tasks[0].title, "Novo");
    assert.equal(next.tasks[0].syncStatus, undefined);
    assert.equal(next.tasks[0].detailsLoaded, false);
    assert.deepEqual(next.quotes, state.quotes);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
