import assert from "node:assert/strict";
import test from "node:test";
import { readQuoteViewPreference, saveQuoteViewPreference } from "../src/quotes/quoteViewPreference.js";

test("visualização de cotações usa Kanban sem preferência válida e preserva Lista", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
  };
  assert.equal(readQuoteViewPreference(storage), "kanban");
  saveQuoteViewPreference("list", storage);
  assert.equal(readQuoteViewPreference(storage), "list");
  saveQuoteViewPreference("kanban", storage);
  assert.equal(readQuoteViewPreference(storage), "kanban");
  saveQuoteViewPreference("invalid", storage);
  assert.equal(readQuoteViewPreference(storage), "kanban");
  values.set("betinhos-quotes-hybrid-v3-view", "invalid");
  assert.equal(readQuoteViewPreference(storage), "kanban");
});
