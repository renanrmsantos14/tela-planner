import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeMicrosoftEmail } from "../src/dataverse.js";

test("normaliza e-mail Microsoft antes de procurar usuário", () => {
  assert.equal(normalizeMicrosoftEmail("  RENAN@Betinhos.OnMicrosoft.Com  "), "renan@betinhos.onmicrosoft.com");
  assert.equal(normalizeMicrosoftEmail(null), "");
});

test("vínculo automático não sobrescreve lookup e exige correspondência única ativa", async () => {
  const source = await readFile(new URL("../src/dataverse.js", import.meta.url), "utf8");

  assert.match(source, /if \(employee\._cr40f_usuariodataverse_value\) return;/);
  assert.match(source, /internalemailaddress eq '\$\{escapedEmail\}' and isdisabled eq false&\$top=2/);
  assert.match(source, /if \(exactUsers\.length !== 1\)/);
  assert.match(source, /bindLookup\(xrm, payload, EMPLOYEE_TABLE, "cr40f_usuariodataverse", "systemuser", userId\)/);
});
