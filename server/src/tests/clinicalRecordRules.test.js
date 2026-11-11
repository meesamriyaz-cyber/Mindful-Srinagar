import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionClinicalStatus, validateAmendmentInput } from "../security/clinicalRecordRules.js";

test("assessment lifecycle permits draft completion and makes completed terminal", () => {
  assert.equal(canTransitionClinicalStatus("assessment", "draft", "completed"), true);
  assert.equal(canTransitionClinicalStatus("assessment", "completed", "draft"), false);
  assert.equal(canTransitionClinicalStatus("assessment", "completed", "completed"), true);
});

test("treatment plan lifecycle supports planned, active, on-hold and completion", () => {
  assert.equal(canTransitionClinicalStatus("treatment-plan", "planned", "active"), true);
  assert.equal(canTransitionClinicalStatus("treatment-plan", "active", "on-hold"), true);
  assert.equal(canTransitionClinicalStatus("treatment-plan", "on-hold", "active"), true);
  assert.equal(canTransitionClinicalStatus("treatment-plan", "completed", "active"), false);
  assert.equal(canTransitionClinicalStatus("treatment-plan", "planned", "cancelled"), false);
});

test("prescription lifecycle allows cancellation or completion but no reactivation", () => {
  assert.equal(canTransitionClinicalStatus("prescription", "active", "cancelled"), true);
  assert.equal(canTransitionClinicalStatus("prescription", "active", "completed"), true);
  assert.equal(canTransitionClinicalStatus("prescription", "cancelled", "active"), false);
});

test("amendment input requires a meaningful reason and at least one allowed field", () => {
  const allowedFields = ["findings", "recommendations"];
  assert.match(validateAmendmentInput({ reason: "fix", changes: { findings: "Updated" }, allowedFields }), /reason/i);
  assert.match(validateAmendmentInput({ reason: "Correct transcription error", changes: {}, allowedFields }), /at least one/i);
  assert.match(validateAmendmentInput({ reason: "Correct transcription error", changes: { status: "draft" }, allowedFields }), /unsupported/i);
  assert.equal(validateAmendmentInput({ reason: "Correct transcription error", changes: { findings: "Updated" }, allowedFields }), null);
});

test("amendment input rejects arrays and malformed change payloads", () => {
  assert.match(validateAmendmentInput({ reason: "Correct transcription error", changes: [], allowedFields: ["findings"] }), /JSON object/i);
});
