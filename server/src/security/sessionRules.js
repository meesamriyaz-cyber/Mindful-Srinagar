export const APPOINTMENT_TYPES = ["assessment", "treatment", "review", "other"];

export function requiresApprovedTreatmentPlan(appointmentType) {
  return appointmentType !== "assessment";
}

export function validateAppointmentType(value) {
  if (value == null || value === "") return null;
  return APPOINTMENT_TYPES.includes(value) ? null : "Select a valid appointment type";
}

export function validateSessionNoteLink({
  noteType = "session",
  appointment,
  patient,
  appointmentStatus,
  alreadyHasSessionNote = false,
  practitionerMatches = true
}) {
  if (noteType === "session" && !appointment) return "A session progress note must be linked to its appointment";
  if (!appointment) return null;
  if (String(appointment.patient || "") !== String(patient || "")) return "The selected appointment does not belong to this patient";
  if (!["checked-in", "completed"].includes(appointmentStatus)) return "Progress notes can only be linked to a checked-in or completed appointment";
  if (noteType === "session" && alreadyHasSessionNote) return "A session progress note already exists for this appointment";
  if (!practitionerMatches) return "You can only write notes for appointments assigned to you";
  return null;
}

export function validateAppointmentCompletion({ hasSessionNote }) {
  return hasSessionNote ? null : "Complete and save the session progress note before completing this appointment";
}
