import test from "node:test";
import assert from "node:assert/strict";

import { bumpPatch, formatDisplayVersion } from "../scripts/write-version.mjs";

test("incrementa somente o patch da versão", () => {
  assert.equal(bumpPatch("0.1.9"), "0.1.10");
});

test("formata versão para exibição no padrão do aplicativo", () => {
  assert.equal(formatDisplayVersion("0.1.10", new Date("2026-08-17T12:00:00Z")), "v0.1.10 17/08/2026");
});
