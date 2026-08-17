import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("mantém a pilha de responsáveis horizontal na Central", async () => {
  const css = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const stackRule = css.match(/\.central-row-meta \.avatar-stack\s*\{([^}]*)\}/)?.[1] || "";

  assert.match(stackRule, /display:\s*inline-flex/);
});
