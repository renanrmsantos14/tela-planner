import test from "node:test";
import assert from "node:assert/strict";
import { normalizeServiceTypes } from "../src/quoteServiceTypes.js";

test("normaliza opções editadas sem duplicatas ou linhas vazias", () => {
  assert.deepEqual(normalizeServiceTypes(" Transfer \n\nDiária\ntransfer\n Evento "), ["transfer", "Diária", "Evento"]);
});
