import assert from "node:assert/strict";
import test from "node:test";
import {
  addContactNote,
  createContact,
  createTask,
  seedState,
  updateContact,
} from "../src/mockStore.js";

function withStorage() {
  const values = new Map();
  globalThis.localStorage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}

test("cria caso atribuído e mantém histórico de transferência, status e resolução", () => {
  withStorage();
  const initial = seedState();
  const created = createContact(initial, { subject: "Novo pedido", senderName: "Ana", channel: "email", ownerEmployeeId: "employee-renan", ownerName: "Renan Martins", actorEmployeeId: "employee-renan" });
  const item = created.contacts.find((contact) => contact.subject === "Novo pedido");
  assert.equal(item.priority, "medium");
  assert.equal(item.status, "new");
  const transferred = updateContact(created, item.id, { ownerEmployeeId: "employee-marina", ownerName: "Marina Alves", status: "resolved", resolutionOutcome: "Retorno enviado", actorEmployeeId: "employee-renan" });
  const updated = transferred.contacts.find((contact) => contact.id === item.id);
  assert.equal(updated.ownerName, "Marina Alves");
  assert.equal(updated.status, "resolved");
  assert.equal(updated.resolutionOutcome, "Retorno enviado");
  assert.ok(updated.history.some((event) => event.type === "transfer"));
  assert.ok(updated.history.some((event) => event.type === "status"));
  assert.ok(updated.history.some((event) => event.type === "resolution"));
  assert.ok(transferred.notifications.some((notification) => notification.contactId === item.id && notification.recipientEmployeeId === "employee-marina"));
});

test("salva nota interna e vincula task criada ao caso", () => {
  withStorage();
  const initial = seedState();
  const contact = initial.contacts[0];
  const noted = addContactNote(initial, contact.id, "Cobrar retorno às 16h", { actorEmployeeId: "employee-renan", author: "Renan Martins" });
  assert.equal(noted.contacts.find((item) => item.id === contact.id).notes.at(-1).text, "Cobrar retorno às 16h");
  const linkedTask = noted.tasks.length;
  const next = createTask(noted, { title: "Acompanhar contato", contactId: contact.id, assigneeIds: ["employee-renan"], assigneeName: ["Renan Martins"] });
  const updatedContact = next.contacts.find((item) => item.id === contact.id);
  assert.equal(next.tasks.length, linkedTask + 1);
  assert.ok(updatedContact.linkedTaskIds.includes(next.tasks.at(-1).id));
  assert.equal(next.tasks.at(-1).contactId, contact.id);
});

test("notifica todos os responsáveis quando o caso é compartilhado", () => {
  withStorage();
  const initial = seedState();
  const created = createContact(initial, {
    subject: "Pedido compartilhado",
    senderName: "Bruno",
    channel: "whatsapp",
    assignmentMode: "people",
    assigneeIds: ["employee-renan", "employee-marina"],
    assigneeName: ["Renan Martins", "Marina Alves"],
    ownerEmployeeId: "employee-renan",
    ownerName: "Renan Martins",
    actorEmployeeId: "employee-renan",
  });
  const item = created.contacts.find((contact) => contact.subject === "Pedido compartilhado");
  assert.deepEqual(item.assigneeIds, ["employee-renan", "employee-marina"]);
  assert.ok(created.notifications.some((notification) => notification.contactId === item.id && notification.recipientEmployeeId === "employee-marina"));
});
