import test from "node:test";
import assert from "node:assert/strict";
import { sumPaymentAggregation } from "../controllers/dashboardMetrics.js";

test("dashboard monthly collections sum payment ledger aggregation rows", () => {
  assert.equal(sumPaymentAggregation([{ total: 1250.25 }]), 1250.25);
});

test("dashboard monthly collections return zero when no payments match the month", () => {
  assert.equal(sumPaymentAggregation([]), 0);
});

test("dashboard monthly collections safely round to cents", () => {
  assert.equal(sumPaymentAggregation([{ total: 10.105 }, { total: 0.105 }]), 10.21);
});
