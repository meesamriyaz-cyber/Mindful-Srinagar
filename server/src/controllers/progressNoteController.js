import mongoose from "mongoose";
import { ProgressNote } from "../models/ProgressNote.js";
import { Appointment } from "../models/Appointment.js";
import { Doctor } from "../models/Doctor.js";
import { makeClinicalRecordController } from "./clinicalRecordController.js";
import { validateSessionNoteLink } from "../security/sessionRules.js";

const validateRelations = async (payload, req) => {
  let appointment = null;
  if (payload.appointment) {
    if (!mongoose.isValidObjectId(payload.appointment)) {
      const error = new Error("Select a valid appointment");
      error.statusCode = 400;
      throw error;
    }
    appointment = await Appointment.findById(payload.appointment).select("patient practitioner status");
  }
  const alreadyHasSessionNote = Boolean(
    req.method === "POST" &&
    payload.noteType === "session" &&
    payload.appointment &&
    await ProgressNote.exists({ appointment: payload.appointment, noteType: "session" })
  );
  let practitionerMatches = true;
  if (appointment && ["doctor", "therapist"].includes(req.user.role)) {
    const practitioner = await Doctor.findOne({ user: req.user._id }).select("_id").lean();
    practitionerMatches = Boolean(practitioner && String(practitioner._id) === String(appointment.practitioner));
  }
  const errorMessage = validateSessionNoteLink({
    noteType: payload.noteType || "session",
    appointment: appointment ? { patient: appointment.patient } : null,
    patient: payload.patient,
    appointmentStatus: appointment?.status,
    alreadyHasSessionNote,
    practitionerMatches
  });
  if (errorMessage) {
    const error = new Error(errorMessage);
    error.statusCode = errorMessage.includes("assigned to you") ? 403 : 409;
    throw error;
  }
};

const controller = makeClinicalRecordController({
  Model: ProgressNote, recordType: "progress-note", ownerField: "author",
  createFields: ["patient","appointment","notedAt","noteType","subjective","objective","assessment","plan"],
  updateFields: ["appointment","notedAt","noteType","subjective","objective","assessment","plan"],
  populate: [["patient","fullName mrn"],["appointment","startsAt durationMinutes service status practitioner"],["appointment.practitioner","name discipline"],["author","name email"]],
  sortField: "notedAt", searchFields: ["subjective","objective","assessment","plan"], validateRelations
});
export const listProgressNotes = controller.list;
export const createProgressNote = controller.create;
export const getProgressNote = controller.get;
export const updateProgressNote = controller.update;
export const listProgressNoteAmendments = controller.amendments;
export const amendProgressNote = controller.amend;
