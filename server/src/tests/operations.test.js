import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionTask, validateTaskPayload } from "../security/taskRules.js";
import { taskScope } from "../security/taskAccess.js";
import { Task } from "../models/Task.js";
import { InventoryItem } from "../models/InventoryItem.js";
import { InventoryMovement } from "../models/InventoryMovement.js";
import { Invoice } from "../models/Invoice.js";
import { permit } from "../middleware/auth.js";
import { makeCrudController } from "../controllers/crudController.js";

test("task lifecycle allows forward progress and controlled reopening only before completion", () => {
  assert.equal(canTransitionTask("todo", "in-progress"), true);
  assert.equal(canTransitionTask("in-progress", "done"), true);
  assert.equal(canTransitionTask("in-progress", "todo"), true);
  assert.equal(canTransitionTask("done", "todo"), false);
  assert.equal(canTransitionTask("done", "done"), true);
});

test("task payload validation rejects blank titles, invalid dates and unsupported values", () => {
  assert.match(validateTaskPayload({ title: " " }), /title/);
  assert.match(validateTaskPayload({ dueDate: "not-a-date" }), /due date/);
  assert.match(validateTaskPayload({ priority: "critical" }), /priority/);
  assert.match(validateTaskPayload({ department: "unknown" }), /department/);
  assert.equal(validateTaskPayload({ title: "Call family", priority: "high", status: "todo" }), null);
});

test("task schema enforces bounded title and supported lifecycle values", async () => {
  const task = new Task({ title: "x".repeat(181), status: "archived" });
  await assert.rejects(task.validate(), (error) => Boolean(error.errors?.title && error.errors?.status));
});

test("inventory schema prevents negative stock and reorder thresholds", async () => {
  const item = new InventoryItem({ name: "Gloves", category: "Clinical", quantity: -1, reorderLevel: -2 });
  await assert.rejects(item.validate(), (error) => Boolean(error.errors?.quantity && error.errors?.reorderLevel));
});

test("inventory movement requires a reason, actor, and non-negative resulting stock", async () => {
  const movement = new InventoryMovement({
    item: "64b000000000000000000001",
    type: "issue",
    quantity: 2,
    previousQuantity: 1,
    newQuantity: -1,
    performedBy: "64b000000000000000000002"
  });
  await assert.rejects(movement.validate(), (error) => Boolean(error.errors?.newQuantity && error.errors?.reason));
});

test("invoice ledger schema records payment method and receiving staff", async () => {
  const invoice = new Invoice({
    patient: "64b000000000000000000001",
    invoiceNo: "B3-LEDGER-TEST",
    items: [{ description: "Assessment", quantity: 1, rate: 1000 }],
    paidAmount: 250,
    status: "partial",
    payments: [{
      amount: 250,
      method: "upi",
      receivedBy: "64b000000000000000000002",
      receivedAt: new Date()
    }]
  });
  await invoice.validate();
  assert.equal(invoice.payments.length, 1);
  assert.equal(invoice.payments[0].method, "upi");
});

test("invoice ledger rejects payment entries with invalid methods", async () => {
  const invoice = new Invoice({
    patient: "64b000000000000000000001",
    invoiceNo: "B3-LEDGER-BAD",
    items: [{ description: "Assessment", quantity: 1, rate: 1000 }],
    paidAmount: 100,
    status: "partial",
    payments: [{
      amount: 100,
      method: "crypto",
      receivedBy: "64b000000000000000000002"
    }]
  });
  await assert.rejects(invoice.validate(), (error) => Boolean(error.errors?.["payments.0.method"]));
});

test("task access scopes non-manager roles to their own assignments", () => {
  const userId = "64b000000000000000000003";
  assert.deepEqual(taskScope({ user: { role: "doctor", _id: userId } }), { assignedTo: userId });
  assert.deepEqual(taskScope({ user: { role: "accounts", _id: userId } }), { assignedTo: userId });
  assert.deepEqual(taskScope({ user: { role: "director", _id: userId } }), {});
  assert.deepEqual(taskScope({ user: { role: "coordinator", _id: userId } }), {});
});

test("invoice schema rejects a payment ledger that does not reconcile with paidAmount", async () => {
  const invoice = new Invoice({
    patient: "64b000000000000000000001",
    invoiceNo: "B3-LEDGER-MISMATCH",
    items: [{ description: "Assessment", quantity: 1, rate: 1000 }],
    paidAmount: 300,
    status: "partial",
    payments: [{
      amount: 250,
      method: "upi",
      receivedBy: "64b000000000000000000002",
      receivedAt: new Date()
    }]
  });
  await assert.rejects(invoice.validate(), (error) => Boolean(error.errors?.payments));
});

test("invoice schema accepts a reconciled multi-method payment ledger", async () => {
  const invoice = new Invoice({
    patient: "64b000000000000000000001",
    invoiceNo: "B3-LEDGER-MIXED",
    items: [{ description: "Assessment", quantity: 1, rate: 1000 }],
    paidAmount: 300,
    paymentMode: "mixed",
    status: "partial",
    payments: [
      { amount: 200, method: "cash", receivedBy: "64b000000000000000000002" },
      { amount: 100, method: "upi", receivedBy: "64b000000000000000000002" }
    ]
  });
  await invoice.validate();
  assert.equal(invoice.payments.reduce((sum, payment) => sum + payment.amount, 0), 300);
});

test("legacy invoice without payment entries treats its historic paidAmount as opening balance", async () => {
  const invoice = new Invoice({
    patient: "64b000000000000000000001",
    invoiceNo: "B3-LEGACY-OPENING",
    items: [{ description: "Assessment", quantity: 1, rate: 1000 }],
    paidAmount: 250,
    status: "partial"
  });
  await invoice.validate();
  assert.equal(invoice.openingPaidAmount, undefined);
  assert.equal(invoice.payments.length, 0);
});

test("invoice schema reconciles legacy opening balance with newly recorded payments", async () => {
  const invoice = new Invoice({
    patient: "64b000000000000000000001",
    invoiceNo: "B3-LEGACY-APPEND",
    items: [{ description: "Assessment", quantity: 1, rate: 1000 }],
    paidAmount: 350,
    openingPaidAmount: 250,
    status: "partial",
    payments: [{ amount: 100, method: "upi", receivedBy: "64b000000000000000000002" }]
  });
  await invoice.validate();
  assert.equal(invoice.openingPaidAmount + invoice.payments[0].amount, invoice.paidAmount);
});

test("invoice schema rejects opening balance and ledger totals that do not reconcile", async () => {
  const invoice = new Invoice({
    patient: "64b000000000000000000001",
    invoiceNo: "B3-LEGACY-MISMATCH",
    items: [{ description: "Assessment", quantity: 1, rate: 1000 }],
    paidAmount: 360,
    openingPaidAmount: 250,
    status: "partial",
    payments: [{ amount: 100, method: "upi", receivedBy: "64b000000000000000000002" }]
  });
  await assert.rejects(invoice.validate(), (error) => Boolean(error.errors?.payments));
});

test("task endpoint permission middleware rejects non-manager create roles and permits assigned-task staff updates", () => {
  const invoke = (role, allowed) => {
    let nextCalled = false;
    let responseStatus = null;
    const req = { user: { role } };
    const res = { status(code) { responseStatus = code; return this; }, json() { return this; } };
    permit(...allowed)(req, res, () => { nextCalled = true; });
    return { nextCalled, responseStatus };
  };
  assert.deepEqual(invoke("doctor", ["director", "admin", "coordinator", "reception"]), { nextCalled: false, responseStatus: 403 });
  assert.deepEqual(invoke("accounts", ["director", "admin", "coordinator", "reception"]), { nextCalled: false, responseStatus: 403 });
  assert.deepEqual(invoke("coordinator", ["director", "admin", "coordinator", "reception"]), { nextCalled: true, responseStatus: null });
  assert.deepEqual(invoke("doctor", ["director", "admin", "coordinator", "reception", "doctor", "therapist", "accounts"]), { nextCalled: true, responseStatus: null });
});

test("task CRUD record and update handlers enforce the assigned-user scope", async () => {
  const userId = "64b000000000000000000003";
  const taskId = "64b000000000000000000004";
  const captured = [];
  const record = { _id: taskId, assignedTo: userId, status: "todo" };
  const Model = {
    findOne(filter) {
      captured.push({ operation: "get", filter });
      return Promise.resolve(record);
    },
    findOneAndUpdate(filter, update) {
      captured.push({ operation: "update", filter, update });
      return Promise.resolve(record);
    }
  };
  const controller = makeCrudController(Model, [], {
    updateFields: ["status"],
    recordScope: taskScope,
    updateScope: taskScope
  });
  const req = { params: { id: taskId }, user: { _id: userId, role: "doctor" }, body: { status: "done", title: "attempted escalation" } };
  const response = { status() { return this; }, json(value) { this.value = value; return this; } };
  await controller.get(req, response, (error) => { throw error; });
  await controller.update(req, response, (error) => { throw error; });
  assert.deepEqual(captured[0].filter, { _id: taskId, assignedTo: userId });
  assert.deepEqual(captured[1].filter, { _id: taskId, assignedTo: userId });
  assert.deepEqual(captured[1].update, { $set: { status: "done" } });
});
