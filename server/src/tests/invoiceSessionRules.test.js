import test from "node:test";
import assert from "node:assert/strict";
import { validateInvoiceAppointmentItems, getInvoiceAppointmentIds } from "../security/invoiceSessionRules.js";
import { Invoice } from "../models/Invoice.js";

test("invoice appointment links accept optional valid session references", () => {
  assert.equal(validateInvoiceAppointmentItems([{ description: "Speech session", rate: 1000 }]), null);
  assert.equal(validateInvoiceAppointmentItems([{ description: "Speech session", rate: 1000, appointment: "64b000000000000000000001" }]), null);
});

test("invoice appointment links reject malformed appointment IDs", () => {
  assert.match(validateInvoiceAppointmentItems([{ description: "Session", appointment: "bad-id" }]), /valid appointment/);
});

test("consolidated invoice extracts unique appointment references from its line items", () => {
  assert.deepEqual(getInvoiceAppointmentIds([
    { description: "Session", appointment: "64b000000000000000000001" },
    { description: "Materials", appointment: "64b000000000000000000001" },
    { description: "Review", appointment: "64b000000000000000000002" },
    { description: "General service" }
  ]), ["64b000000000000000000001", "64b000000000000000000002"]);
});

test("invoice schema stores the session appointment on the charge line", async () => {
  const invoice = new Invoice({
    patient: "64b000000000000000000001",
    invoiceNo: "P5-SESSION-LINK",
    items: [{
      description: "Speech therapy session",
      quantity: 1,
      rate: 1000,
      appointment: "64b000000000000000000002"
    }],
    status: "draft"
  });
  await invoice.validate();
  assert.equal(String(invoice.items[0].appointment), "64b000000000000000000002");
});

test("invoice appointment reference index prevents the same session being charged twice", () => {
  const appointmentIndex = Invoice.schema.indexes().find(([fields, options]) =>
    fields["items.appointment"] === 1 && options.unique === true
  );
  assert.ok(appointmentIndex);
  assert.deepEqual(appointmentIndex[1].partialFilterExpression, {
    "items.appointment": { $type: "objectId" }
  });
});
