import test from "node:test";
import assert from "node:assert/strict";
import { validateInvoiceAppointmentItems, getInvoiceAppointmentIds } from "../security/invoiceSessionRules.js";

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
