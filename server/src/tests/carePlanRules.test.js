import test from "node:test";
import assert from "node:assert/strict";
import { validateAssessmentCompletion, validateTreatmentPlanAssessment, canActivatePatient } from "../security/carePlanRules.js";

test("assessment completion requires domains, findings and recommendations", () => {
  assert.match(validateAssessmentCompletion({ status: "completed" }), /domain/);
  assert.match(validateAssessmentCompletion({ status: "completed", domains: ["Speech"], findings: "Observed limited articulation." }), /recommendations/);
  assert.equal(validateAssessmentCompletion({
    status: "completed",
    domains: ["Speech", "Language"],
    findings: "Observed limited articulation and reduced expressive vocabulary.",
    recommendations: "Begin speech therapy twice weekly and review progress in six weeks."
  }), null);
  assert.equal(validateAssessmentCompletion({ status: "draft" }), null);
});

test("treatment plan must link to the same patient's completed assessment", () => {
  assert.match(validateTreatmentPlanAssessment({ patient: "p1", status: "planned" }), /completed assessment/);
  assert.match(validateTreatmentPlanAssessment({
    patient: "p1", assessment: { patient: "p2" }, assessmentStatus: "completed", status: "planned"
  }), /different patient/);
  assert.match(validateTreatmentPlanAssessment({
    patient: "p1", assessment: { patient: "p1" }, assessmentStatus: "draft", status: "planned"
  }), /completed assessment/);
  assert.equal(validateTreatmentPlanAssessment({
    patient: "p1", assessment: { patient: "p1" }, assessmentStatus: "completed", status: "planned"
  }), null);
});

test("unapproved plans cannot be active and patient activation needs completed assessment plus approved plan", () => {
  assert.match(validateTreatmentPlanAssessment({
    patient: "p1", assessment: { patient: "p1" }, assessmentStatus: "completed", status: "active"
  }), /approval/);
  assert.equal(validateTreatmentPlanAssessment({
    patient: "p1", assessment: { patient: "p1" }, assessmentStatus: "completed",
    status: "active", approvedBy: "doctor1", approvedAt: new Date()
  }), null);
  assert.equal(canActivatePatient({ hasCompletedAssessment: true, hasApprovedActivePlan: false }), false);
  assert.equal(canActivatePatient({ hasCompletedAssessment: false, hasApprovedActivePlan: true }), false);
  assert.equal(canActivatePatient({ hasCompletedAssessment: true, hasApprovedActivePlan: true }), true);
});
