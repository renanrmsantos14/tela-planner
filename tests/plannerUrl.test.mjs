import assert from "node:assert/strict";
import test from "node:test";

import { plannerUrlForState, readPlannerUrlState } from "../src/plannerUrl.js";

test("lê view e tarefa do envelope data do WebResource", () => {
  assert.deepEqual(readPlannerUrlState("?data=view%3Dcalendar%26taskId%3DTASK-1"), {
    view: "calendar",
    taskId: "TASK-1",
  });
});

test("ignora view desconhecida para não renderizar tela vazia", () => {
  assert.equal(readPlannerUrlState("?data=view%3Dinexistente").view, "board");
});

test("gera URL compartilhável e preserva parâmetros externos", () => {
  const url = plannerUrlForState(
    { pathname: "/WebResources/new_TelaPlanner.html", search: "?org=betinhos", hash: "#top" },
    { view: "management", taskId: "TASK-2" },
  );

  const parsed = new URL(url, "https://example.test");
  assert.equal(parsed.searchParams.get("org"), "betinhos");
  assert.deepEqual(readPlannerUrlState(parsed.search), { view: "management", taskId: "TASK-2" });
  assert.equal(parsed.hash, "#top");
});

test("remove parâmetros de lançamento conflitantes ao abrir tarefa", () => {
  const url = plannerUrlForState(
    { pathname: "/WebResources/new_TelaPlanner.html", search: "?data=source%3Dquote%26sourceId%3DQ-1", hash: "" },
    { view: "board", taskId: "TASK-3" },
  );

  const parsed = new URL(url, "https://example.test");
  const data = new URLSearchParams(parsed.searchParams.get("data"));
  assert.equal(data.get("taskId"), "TASK-3");
  assert.equal(data.has("source"), false);
  assert.equal(data.has("sourceId"), false);
});
