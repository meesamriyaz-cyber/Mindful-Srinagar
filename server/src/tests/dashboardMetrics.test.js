import test from "node:test";
import assert from "node:assert/strict";
import { sumPaymentAggregation, filterDocumentationPendingAppointments, filterBillingPendingAppointments } from "../controllers/dashboardMetrics.js";

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
