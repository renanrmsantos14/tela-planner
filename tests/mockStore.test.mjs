import test from "node:test";
import assert from "node:assert/strict";
import { addAttachment, addComment, createTask, ensureQuoteTask, seedState, updateTask } from "../src/mockStore.js";

function withStorage() {
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}

test("cria e atualiza tarefa sem alterar a referência original", () => {
  withStorage();
  const initial = seedState();
  const next = createTask(initial, { title: "Nova etapa", quoteId: "quote-1008", quoteCode: "COT-1008", quoteTitle: "Transfer", dueDate: "2026-08-05" });
  assert.equal(next.tasks.length, initial.tasks.length + 1);
  const created = next.tasks.at(-1);
  const updated = updateTask(next, created.id, { status: "done" });
  assert.equal(updated.tasks.at(-1).status, "done");
  assert.equal(initial.tasks.length, 6);
});

test("adiciona comentário e anexo mock", () => {
  withStorage();
  const initial = seedState();
  const commented = addComment(initial, "task-1", "Cliente confirmou o horário.");
  const attached = addAttachment(commented, "task-1", "confirmacao.png");
  const task = attached.tasks.find((item) => item.id === "task-1");
  assert.equal(task.comments.length, 1);
  assert.equal(task.attachments[0].name, "confirmacao.png");
});

test("cria tarefa principal para cotação sem duplicar", () => {
  withStorage();
  const initial = seedState();
  const quote = initial.quotes.find((item) => item.id === "quote-1008");
  const same = ensureQuoteTask(initial, quote);
  assert.equal(same.tasks.length, initial.tasks.length);
});
