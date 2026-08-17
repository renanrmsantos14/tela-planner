import test from "node:test";
import assert from "node:assert/strict";
import { graphPhotoEndpoint } from "../src/graphPhotos.js";

test("monta o endpoint Graph com o Object ID do usuário vinculado", () => {
  assert.equal(
    graphPhotoEndpoint("{91bad67f-021a-4b01-9f04-e9be7cf577f1}"),
    "https://graph.microsoft.com/v1.0/users/91bad67f-021a-4b01-9f04-e9be7cf577f1/photo/$value",
  );
});

test("não cria endpoint sem usuário vinculado", () => {
  assert.equal(graphPhotoEndpoint(""), "");
});
