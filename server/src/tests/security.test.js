import test from "node:test";
import assert from "node:assert/strict";
import { escapeRegex, parseLimit, sanitizePayload } from "../utils/query.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
import { permit } from "../middleware/auth.js";
import { Invoice } from "../models/Invoice.js";
import { calculateOutstandingBalance } from "../utils/invoiceBalance.js";

test("payload sanitizer permits allowlisted fields only", () => {
  assert.deepEqual(sanitizePayload({ fullName: "Sample", phone: "1234567" }, ["fullName", "phone"]), {
    fullName: "Sample", phone: "1234567"
  });
});
test("payload sanitizer rejects mass assignment and malformed bodies", () => {
  assert.throws(() => sanitizePayload({ role: "director", isActive: true }, ["name"]), /Unsupported field/);
  assert.throws(() => sanitizePayload(["invalid"], ["name"]), /JSON object/);
});
test("query helpers escape regex and clamp limits", () => {
  assert.equal(escapeRegex("a+b?"), "a\\+b\\?");
  assert.equal(parseLimit("999"), 100);
  assert.equal(parseLimit("-2"), 1);
  assert.equal(parseLimit("invalid"), 50);
});
test("rate limiter rejects requests above the configured threshold", () => {
  const limiter = createRateLimiter({ windowMs: 60000, max: 1, message: "slow down" });
  const response = () => ({
    statusCode: 200, body: null,
    setHeader() { return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  });
  let passed = 0;
  limiter({ ip: "security-test-ip" }, response(), () => { passed += 1; });
  const second = response();
  limiter({ ip: "security-test-ip" }, second, () => { passed += 1; });
  assert.equal(passed, 1);
  assert.equal(second.statusCode, 429);
  assert.equal(second.body.message, "slow down");
});
test("role middleware rejects unauthorized roles", () => {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  permit("director", "admin")({ user: { role: "reception" } }, res, () => assert.fail("next must not run"));
  assert.equal(res.statusCode, 403);
});
test("invoice validation rejects discount above subtotal", async () => {
  const invoice = new Invoice({
    patient: "64b000000000000000000001", invoiceNo: "TEST-INV-DISCOUNT",
    items: [{ description: "Service", quantity: 2, rate: 500 }], discount: 1200
  });
  await assert.rejects(invoice.validate(), (error) => Boolean(error.errors?.discount));
});
test("invoice validation rejects payment above total", async () => {
  const invoice = new Invoice({
    patient: "64b000000000000000000001", invoiceNo: "TEST-INV-PAYMENT",
    items: [{ description: "Service", quantity: 1, rate: 500 }], paidAmount: 600
  });
  await assert.rejects(invoice.validate(), (error) => Boolean(error.errors?.paidAmount));
});

import { taskScope } from "../security/taskAccess.js";

test("task scope limits non-manager staff to their own assignments", () => {
  assert.deepEqual(taskScope({ user: { role: "therapist", _id: "staff-123" } }), { assignedTo: "staff-123" });
  assert.deepEqual(taskScope({ user: { role: "admin", _id: "admin-123" } }), {});
});

test("discharge balance includes every non-void invoice balance", () => {
  const invoices = [
    { items: [{ quantity: 2, rate: 500 }], discount: 100, paidAmount: 400 },
    { items: [{ quantity: 1, rate: 300 }], discount: 0, paidAmount: 300 },
    { items: [{ quantity: 1, rate: 200 }], discount: 0, paidAmount: 0 }
  ];
  assert.equal(calculateOutstandingBalance(invoices), 700);
});

test("discharge balance never becomes negative when invoices are overpaid", () => {
  assert.equal(calculateOutstandingBalance([
    { items: [{ quantity: 1, rate: 100 }], discount: 0, paidAmount: 150 }
  ]), 0);
});

import { validateAppointmentShape, canTransitionAppointment } from "../security/appointmentRules.js";

test("appointment validation enforces duration increments and required scheduling fields", () => {
  const valid = {
    patient: "64b000000000000000000001",
    practitioner: "64b000000000000000000002",
    service: "Speech Therapy",
    startsAt: new Date(Date.now() + 86400000),
    durationMinutes: 45,
    room: "Room 1"
  };
  assert.equal(validateAppointmentShape(valid), null);
  assert.match(validateAppointmentShape({ ...valid, durationMinutes: 17 }), /15-minute increments/);
  assert.match(validateAppointmentShape({ ...valid, service: " " }), /Service/);
  assert.match(validateAppointmentShape({ ...valid, startsAt: "invalid" }), /valid appointment date/);
});

test("appointment lifecycle permits only forward operational transitions", () => {
  assert.equal(canTransitionAppointment("scheduled", "checked-in"), true);
  assert.equal(canTransitionAppointment("checked-in", "completed"), true);
  assert.equal(canTransitionAppointment("completed", "scheduled"), false);
  assert.equal(canTransitionAppointment("cancelled", "checked-in"), false);
});

import { isWithinPractitionerAvailability } from "../security/appointmentRules.js";

test("practitioner availability checks local centre day and full appointment duration", () => {
  const mondayMorning = new Date("2026-11-09T05:00:00.000Z"); // 10:30 AM Asia/Kolkata
  const availability = [{ day: "Monday", from: "10:00", to: "12:00" }];
  assert.equal(isWithinPractitionerAvailability(mondayMorning, 45, availability), true);
  assert.equal(isWithinPractitionerAvailability(mondayMorning, 120, availability), false);
  assert.equal(isWithinPractitionerAvailability(mondayMorning, 45, [{ day: "Tuesday", from: "10:00", to: "12:00" }]), false);
});

import { canTransitionPatientStatus, validateDischargeDetails } from "../security/patientLifecycle.js";

test("patient lifecycle prevents reactivation after discharge", () => {
  assert.equal(canTransitionPatientStatus("new", "assessment"), true);
  assert.equal(canTransitionPatientStatus("active", "on-hold"), true);
  assert.equal(canTransitionPatientStatus("on-hold", "active"), true);
  assert.equal(canTransitionPatientStatus("discharged", "active"), false);
});

test("patient discharge requires a summary and reason", () => {
  assert.match(validateDischargeDetails({ status: "discharged", dischargeSummary: " " }), /summary/);
  assert.match(validateDischargeDetails({ status: "discharged", dischargeSummary: "Goals met" }), /reason/);
  assert.equal(validateDischargeDetails({ status: "active" }), null);
});
