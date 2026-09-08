import test from "node:test";
import assert from "node:assert/strict";
import { fetchPlannerPlans } from "../src/plannerGraph.js";

test("carrega planos do usuário, pagina e ordena pelo nome exibido", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    const payload = calls.length === 1
      ? { value: [{ id: "z", title: "Zeta" }], "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/planner/plans?$skiptoken=next" }
      : { value: [{ id: "a", title: "Alpha" }, { id: "sem-nome" }] };
    return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const plans = await fetchPlannerPlans({ token: "token" });
    assert.deepEqual(plans, [
      { id: "a", displayName: "Alpha" },
      { id: "sem-nome", displayName: "Plano sem nome" },
      { id: "z", displayName: "Zeta" },
    ]);
    assert.deepEqual(calls, [
      "https://graph.microsoft.com/v1.0/me/planner/plans",
      "https://graph.microsoft.com/v1.0/me/planner/plans?$skiptoken=next",
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});
