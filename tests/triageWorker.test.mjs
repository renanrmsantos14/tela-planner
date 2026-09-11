import assert from "node:assert/strict";
import test from "node:test";
import worker from "../serverless/triage-worker.js";

test("Worker rejeita payload sem mensagens e não expõe segredo", async () => {
  const response = await worker.fetch(new Request("https://triage.example/v1/triage", { method: "POST", body: JSON.stringify({}) }), { DEEPSEEK_API_KEY: "secret", TRIAGE_TOKEN: "token" });
  assert.equal(response.status, 401);
  assert.equal(await response.json().then((body) => body.error), "Unauthorized");
});

test("Worker valida payload depois da autenticação", async () => {
  const response = await worker.fetch(new Request("https://triage.example/v1/triage", { method: "POST", headers: { Authorization: "Bearer token" }, body: JSON.stringify({}) }), { DEEPSEEK_API_KEY: "secret", TRIAGE_TOKEN: "token" });
  assert.equal(response.status, 400);
  assert.equal(await response.json().then((body) => body.error), "Payload de conversa inválido.");
});
