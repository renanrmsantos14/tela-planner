import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLinkedTaskInput,
  canTransitionContactStatus,
  contactPermissions,
  contactStats,
  filterContacts,
  normalizeContact,
  sortContacts,
  validateContact,
} from "../src/contactDomain.js";

const contact = (overrides = {}) => normalizeContact({
  id: "c-1",
  subject: "Retorno do embarque",
  senderName: "Cliente",
  channel: "whatsapp",
  receivedAt: "2026-09-03T10:00:00Z",
  lastMessageAt: "2026-09-03T10:00:00Z",
  priority: "medium",
  status: "new",
  ownerEmployeeId: "e-1",
  ownerName: "Renan",
  ...overrides,
});

test("normaliza defaults e valida o contrato do caso", () => {
  const normalized = normalizeContact({ subject: "  Assunto  ", senderName: "Cliente" });
  assert.equal(normalized.subject, "Assunto");
  assert.equal(normalized.priority, "medium");
  assert.equal(normalized.status, "new");
  assert.equal(validateContact(normalized).allowed, true);
  assert.equal(validateContact({ ...normalized, subject: "" }).allowed, false);
});

test("expõe transições operacionais de status", () => {
  assert.equal(canTransitionContactStatus("new", "in_progress"), true);
  assert.equal(canTransitionContactStatus("waiting", "resolved"), true);
  assert.equal(canTransitionContactStatus("archived", "resolved"), false);
});

test("filtra por mensagem, canal, status, prioridade e responsável", () => {
  const contacts = [contact(), contact({ id: "c-2", channel: "email", status: "waiting", priority: "high", ownerEmployeeId: "e-2", lastMessage: "Anexo da nota fiscal" })];
  assert.equal(filterContacts(contacts, { query: "nota fiscal" }).length, 1);
  assert.equal(filterContacts(contacts, { channel: ["email"], status: ["waiting"], priority: ["high"], owner: ["e-2"] }).length, 1);
  assert.equal(filterContacts([contact({ status: "archived" })]).length, 0);
  assert.equal(filterContacts([contact({ status: "archived" })], { includeArchived: true }).length, 1);
});

test("ordena por prioridade, prazo e mensagem mais recente", () => {
  const contacts = [
    contact({ id: "low", priority: "low", dueDate: "2026-09-03", lastMessageAt: "2026-09-03T12:00:00Z" }),
    contact({ id: "high", priority: "high", dueDate: "2026-09-05", lastMessageAt: "2026-09-03T09:00:00Z" }),
    contact({ id: "medium-late", priority: "medium", dueDate: "2026-09-06", lastMessageAt: "2026-09-03T13:00:00Z" }),
    contact({ id: "medium-early", priority: "medium", dueDate: "2026-09-04", lastMessageAt: "2026-09-03T08:00:00Z" }),
  ];
  assert.deepEqual(sortContacts(contacts).map((item) => item.id), ["high", "medium-early", "medium-late", "low"]);
});

test("calcula indicadores, permissões e task vinculada", () => {
  const contacts = [contact(), contact({ id: "c-2", status: "in_progress" }), contact({ id: "c-3", status: "waiting", dueDate: "2026-09-02" }), contact({ id: "c-4", status: "archived" })];
  assert.deepEqual(contactStats(contacts, "2026-09-03"), { total: 3, new: 1, inProgress: 1, waiting: 1, overdue: 1 });
  assert.equal(contactPermissions(contacts[0], { employeeId: "e-1" }).canTransfer, true);
  assert.equal(contactPermissions(contacts[0], { employeeId: "e-2" }).canEdit, false);
  assert.equal(contactPermissions(contacts[0], { employeeId: "e-2", isManager: true }).canArchive, true);
  assert.deepEqual(buildLinkedTaskInput(contacts[0]), { title: "Retorno do embarque", description: "", priority: "medium", dueDate: "", assignmentMode: "people", teamIds: [], teamNames: [], teamId: "", teamName: "", assigneeIds: ["e-1"], assigneeNames: ["Renan"], assigneeName: ["Renan"], contactId: "c-1", sourceType: "contact", sourceId: "c-1", sourceLabel: "Caso de atendimento" });
});

test("preserva múltiplos responsáveis e permite filtrar qualquer pessoa selecionada", () => {
  const shared = contact({
    assigneeIds: ["e-1", "e-2"],
    assigneeNames: ["Renan", "Marina"],
    assigneeName: ["Renan", "Marina"],
  });
  assert.deepEqual(shared.assigneeIds, ["e-1", "e-2"]);
  assert.equal(filterContacts([shared], { owner: ["e-2"] }).length, 1);
  assert.equal(contactPermissions(shared, { employeeId: "e-2" }).canEdit, true);
  assert.deepEqual(buildLinkedTaskInput(shared).assigneeIds, ["e-1", "e-2"]);
  assert.deepEqual(buildLinkedTaskInput(shared).assigneeName, ["Renan", "Marina"]);
});
