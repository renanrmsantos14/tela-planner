import test from "node:test";
import assert from "node:assert/strict";
import { adminCleanup, seedState } from "../src/mockStore.js";

globalThis.localStorage = { setItem() {}, getItem() { return null; } };

test("limpeza administrativa remove somente tasks concluídas", () => {
  const state = seedState();
  const next = adminCleanup(state, "completed_tasks");
  assert.ok(next.tasks.length < state.tasks.length);
  assert.ok(next.tasks.every((task) => task.status !== "done"));
});

test("limpeza administrativa remove tasks, tags e notificações por ação", () => {
  const state = { ...seedState(), personalTags: [{ id: "tag-1" }], personalTagAssignments: [{ id: "relation-1" }], notifications: [{ id: "notification-1" }], tasks: [{ id: "task-1", status: "todo", personalTagIds: ["tag-1"] }] };
  assert.deepEqual(adminCleanup(state, "all_tasks").tasks, []);
  const withoutTags = adminCleanup(state, "all_tags");
  assert.deepEqual(withoutTags.personalTags, []);
  assert.deepEqual(withoutTags.personalTagAssignments, []);
  assert.deepEqual(withoutTags.tasks[0].personalTagIds, []);
  assert.deepEqual(adminCleanup(state, "notifications").notifications, []);
});

test("limpeza administrativa rejeita ação desconhecida", () => {
  assert.throws(() => adminCleanup(seedState(), "unknown"), /inválida/);
});
