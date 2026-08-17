import test from "node:test";
import assert from "node:assert/strict";
import { dataverseImageUrl } from "../src/dataverse.js";

test("monta a URL autenticada da foto armazenada no Dataverse", () => {
  assert.equal(
    dataverseImageUrl("https://org.crm.dynamics.com", "ABC-123", "cr40f_funcionarioses", "cr40f_foto"),
    "https://org.crm.dynamics.com/api/data/v9.2/cr40f_funcionarioses(ABC-123)/cr40f_foto/$value",
  );
});

test("não cria URL de imagem sem registro com foto", () => {
  assert.equal(dataverseImageUrl("https://org.crm.dynamics.com", "", "cr40f_funcionarioses", "cr40f_foto"), "");
});
