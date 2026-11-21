import test from "node:test";
import assert from "node:assert/strict";
import { sumPaymentAggregation, filterDocumentationPendingAppointments, filterBillingPendingAppointments, countDocumentationPendingAppointments, countBillingPendingAppointments } from "../controllers/dashboardMetrics.js";

test("dashboard monthly collections sum payment ledger aggregation rows", () => {
  assert.equal(sumPaymentAggregation([{ total: 1250.25 }]), 1250.25);
});

test("dashboard monthly collections return zero when no payments match the month", () => {
  assert.equal(sumPaymentAggregation([]), 0);
});

test("dashboard monthly collections safely round to cents", () => {
  assert.equal(sumPaymentAggregation([{ total: 10.105 }, { total: 0.105 }]), 10.21);
});

test("documentation queue includes checked-in appointments without session notes only", () => {
  const appointments = [
    { _id: "1", status: "checked-in" },
    { _id: "2", status: "checked-in" },
    { _id: "3", status: "completed" },
    { _id: "4", status: "cancelled" },
    { _id: "5", status: "no-show" }
  ];
  assert.deepEqual(filterDocumentationPendingAppointments(appointments, ["2"]), [{ _id: "1", status: "checked-in" }]);
});

test("billing queue includes completed appointments without linked invoices only", () => {
  const appointments = [
    { _id: "1", status: "completed" },
    { _id: "2", status: "completed" },
    { _id: "3", status: "checked-in" },
    { _id: "4", status: "cancelled" }
  ];
  assert.deepEqual(filterBillingPendingAppointments(appointments, ["2"]), [{ _id: "1", status: "completed" }]);
});


test("documentation backlog count is complete beyond the visible worklist limit", () => {
  const appointmentIds = Array.from({ length: 35 }, (_, index) => String(index + 1));
  const documentedIds = appointmentIds.slice(0, 12);
  assert.equal(countDocumentationPendingAppointments(appointmentIds, documentedIds), 23);
});

test("billing backlog count is complete beyond the visible worklist limit", () => {
  const appointmentIds = Array.from({ length: 42 }, (_, index) => String(index + 1));
  const billedIds = appointmentIds.slice(0, 17);
  assert.equal(countBillingPendingAppointments(appointmentIds, billedIds), 25);
});

test("backlog count helpers safely handle object ids and empty inputs", () => {
  assert.equal(countDocumentationPendingAppointments([{ toString: () => "a" }, { toString: () => "b" }], ["a"]), 1);
  assert.equal(countBillingPendingAppointments([], []), 0);
});
