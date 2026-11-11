import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionTask, validateTaskPayload } from "../security/taskRules.js";
import { Task } from "../models/Task.js";
import { InventoryItem } from "../models/InventoryItem.js";
import { InventoryMovement } from "../models/InventoryMovement.js";
import { Invoice } from "../models/Invoice.js";

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
