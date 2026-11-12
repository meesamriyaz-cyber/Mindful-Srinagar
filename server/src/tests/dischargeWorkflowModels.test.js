import test from "node:test";
import assert from "node:assert/strict";
import { Assessment } from "../models/Assessment.js";
import { Patient } from "../models/Patient.js";
import { Task } from "../models/Task.js";

const patientId = "64b000000000000000000001";
const userId = "64b000000000000000000002";

test("assessment schema supports a distinct final discharge assessment", async () => {
  const assessment = new Assessment({
    patient: patientId,
    assessedBy: userId,
    assessmentType: "discharge",
    domains: ["Speech", "Daily living"],
    findings: "The patient achieved the agreed functional communication goals.",
    recommendations: "Continue the home programme and return for review in three months.",
    status: "completed"
  });
  await assessment.validate();
  assert.equal(assessment.assessmentType, "discharge");

  const invalid = new Assessment({ patient: patientId, assessedBy: userId, assessmentType: "exit" });
  await assert.rejects(invalid.validate(), (error) => Boolean(error.errors?.assessmentType));
});

test("tasks can be linked to a patient for discharge readiness tracking", async () => {
  const task = new Task({
    title: "Return family home programme",
    patient: patientId,
    department: "clinical",
    status: "todo"
  });
  await task.validate();
  assert.equal(String(task.patient), patientId);
});

test("patient discharge approval and closure metadata are retained separately", async () => {
  const patient = new Patient({
    fullName: "Aarav Ahmed",
    phone: "+91 99000 00000",
    primaryConcern: "Speech and communication support",
    dischargeSummary: "Patient achieved agreed goals and is ready for discharge.",
    dischargeReason: "Goals met",
    dischargeOutcome: "Functional communication improved.",
    dischargeRecommendations: "Continue home activities and return for review.",
    dischargeApprovedBy: userId,
    dischargeApprovedAt: new Date(),
    dischargeClosedBy: userId,
    dischargeClosedAt: new Date(),
    status: "discharged",
    dischargeDate: new Date()
  });
  await patient.validate();
  assert.equal(String(patient.dischargeApprovedBy), userId);
  assert.equal(String(patient.dischargeClosedBy), userId);
  assert.ok(patient.dischargeApprovedAt);
  assert.ok(patient.dischargeClosedAt);
});
