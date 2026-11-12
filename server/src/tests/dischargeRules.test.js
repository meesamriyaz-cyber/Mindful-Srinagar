import test from "node:test";
import assert from "node:assert/strict";
import { validateDischargeApprovalPayload, validateDischargeReadiness, canCloseDischarge } from "../security/dischargeRules.js";

const completePayload = {
  summary: "Patient achieved the agreed communication and functional goals.",
  reason: "Goals met and family is ready for home programme.",
  outcome: "Functional communication improved across home and school settings.",
  recommendations: "Continue home activities and return for review in three months."
};

test("discharge approval requires summary, reason, outcome and recommendations", () => {
  assert.equal(validateDischargeApprovalPayload(completePayload), null);
  assert.match(validateDischargeApprovalPayload({ ...completePayload, summary: "short" }), /discharge summary/);
  assert.match(validateDischargeApprovalPayload({ ...completePayload, outcome: "" }), /outcome summary/);
  assert.match(validateDischargeApprovalPayload({ ...completePayload, recommendations: "ok" }), /recommendations/);
});

test("discharge readiness checks clinical review, appointments, plans, tasks and finance", () => {
  const ready = { hasCompletedDischargeAssessment: true, openAppointments: 0, openTreatmentPlans: 0, openTasks: 0, outstandingBalance: 0 };
  assert.equal(validateDischargeReadiness(ready), null);
  assert.match(validateDischargeReadiness({ ...ready, hasCompletedDischargeAssessment: false }), /discharge assessment/);
  assert.match(validateDischargeReadiness({ ...ready, openAppointments: 1 }), /appointments/);
  assert.match(validateDischargeReadiness({ ...ready, openTreatmentPlans: 1 }), /treatment plans/);
  assert.match(validateDischargeReadiness({ ...ready, openTasks: 1 }), /tasks/);
  assert.match(validateDischargeReadiness({ ...ready, outstandingBalance: 100 }), /outstanding invoices/);
});

test("administrative closure requires clinical approval and an open patient", () => {
  assert.equal(canCloseDischarge({ approvedAt: null, isAlreadyDischarged: false }), false);
  assert.equal(canCloseDischarge({ approvedAt: new Date(), isAlreadyDischarged: true }), false);
  assert.equal(canCloseDischarge({ approvedAt: new Date(), isAlreadyDischarged: false }), true);
});
