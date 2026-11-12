import test from "node:test";
import assert from "node:assert/strict";
import { requiresApprovedTreatmentPlan, validateAppointmentType, validateSessionNoteLink, validateAppointmentCompletion } from "../security/sessionRules.js";

test("only initial assessment appointments are exempt from approved treatment-plan requirement", () => {
  assert.equal(requiresApprovedTreatmentPlan("assessment"), false);
  assert.equal(requiresApprovedTreatmentPlan("treatment"), true);
  assert.equal(requiresApprovedTreatmentPlan("review"), true);
  assert.equal(requiresApprovedTreatmentPlan("other"), true);
});

test("appointment type is validated while legacy missing type remains readable", () => {
  assert.equal(validateAppointmentType(undefined), null);
  assert.equal(validateAppointmentType("assessment"), null);
  assert.match(validateAppointmentType("unclassified"), /appointment type/);
});

test("session progress note must link to its own checked-in or completed appointment", () => {
  assert.match(validateSessionNoteLink({ noteType: "session", patient: "p1" }), /must be linked/);
  assert.match(validateSessionNoteLink({
    noteType: "session", patient: "p1", appointment: { patient: "p2" }, appointmentStatus: "checked-in"
  }), /does not belong/);
  assert.match(validateSessionNoteLink({
    noteType: "session", patient: "p1", appointment: { patient: "p1" }, appointmentStatus: "scheduled"
  }), /checked-in or completed/);
  assert.equal(validateSessionNoteLink({
    noteType: "session", patient: "p1", appointment: { patient: "p1" }, appointmentStatus: "checked-in"
  }), null);
});

test("one session note is allowed per appointment and practitioner scope is enforced", () => {
  assert.match(validateSessionNoteLink({
    noteType: "session", patient: "p1", appointment: { patient: "p1" }, appointmentStatus: "completed", alreadyHasSessionNote: true
  }), /already exists/);
  assert.match(validateSessionNoteLink({
    noteType: "session", patient: "p1", appointment: { patient: "p1" }, appointmentStatus: "completed", practitionerMatches: false
  }), /assigned to you/);
  assert.equal(validateSessionNoteLink({ noteType: "review", patient: "p1" }), null);
});

test("appointment completion is blocked until a session note exists", () => {
  assert.match(validateAppointmentCompletion({ hasSessionNote: false }), /progress note/);
  assert.equal(validateAppointmentCompletion({ hasSessionNote: true }), null);
});
