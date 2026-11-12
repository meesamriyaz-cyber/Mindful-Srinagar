import test from "node:test";
import assert from "node:assert/strict";
import { ProgressNote } from "../models/ProgressNote.js";
import { Appointment } from "../models/Appointment.js";

const patient = "64b000000000000000000001";
const practitioner = "64b000000000000000000002";
const author = "64b000000000000000000003";
const appointment = "64b000000000000000000004";

test("session progress note requires an appointment reference", async () => {
  const note = new ProgressNote({
    patient, author, noteType: "session", objective: "Practised turn-taking and expressive language."
  });
  await assert.rejects(note.validate(), (error) => Boolean(error.errors?.appointment));
});

test("review and incident notes may be recorded without an appointment", async () => {
  const review = new ProgressNote({
    patient, author, noteType: "review", assessment: "Reviewed the six-week therapy goals."
  });
  await review.validate();
  const incident = new ProgressNote({
    patient, author, noteType: "incident", objective: "No incident occurred during the visit."
  });
  await incident.validate();
});

test("session note accepts appointment linkage and retains clinical sections", async () => {
  const note = new ProgressNote({
    patient, author, appointment, noteType: "session",
    subjective: "Guardian reports improved communication at home.",
    objective: "Completed the planned articulation activities.",
    assessment: "Progress is consistent with current goals.",
    plan: "Continue the same intervention and review in four weeks."
  });
  await note.validate();
  assert.equal(String(note.appointment), appointment);
});

test("appointment model accepts supported visit purposes and rejects unknown purposes", async () => {
  const base = {
    patient, practitioner, service: "Speech Therapy",
    startsAt: new Date("2026-11-20T10:00:00.000Z"),
    durationMinutes: 45
  };
  const assessmentAppointment = new Appointment({ ...base, appointmentType: "assessment" });
  await assessmentAppointment.validate();
  const treatmentAppointment = new Appointment({ ...base, appointmentType: "treatment" });
  await treatmentAppointment.validate();
  const invalid = new Appointment({ ...base, appointmentType: "casual" });
  await assert.rejects(invalid.validate(), (error) => Boolean(error.errors?.appointmentType));
});
