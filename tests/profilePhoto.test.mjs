import test from "node:test";
import assert from "node:assert/strict";
import { microsoftProfilePhotoUrl } from "../src/dataverse.js";

test("monta a foto do perfil Microsoft 365 pelo e-mail do usuário vinculado", () => {
  assert.equal(
    microsoftProfilePhotoUrl("renan+planner@betinhos.onmicrosoft.com"),
    "https://outlook.office.com/owa/service.svc/s/GetPersonaPhoto?email=renan%2Bplanner%40betinhos.onmicrosoft.com&UA=0&size=HR96x96",
  );
});

test("não cria URL de foto sem usuário vinculado", () => {
  assert.equal(microsoftProfilePhotoUrl(""), "");
});
