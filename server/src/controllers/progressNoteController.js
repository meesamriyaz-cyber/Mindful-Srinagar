import { ProgressNote } from "../models/ProgressNote.js";
import { Appointment } from "../models/Appointment.js";
import { Doctor } from "../models/Doctor.js";
import { makeClinicalRecordController } from "./clinicalRecordController.js";
const validateRelations = async (payload, req) => {
  if (!payload.appointment) return;
  const appointment = await Appointment.findById(payload.appointment);
  if (!appointment || String(appointment.patient) !== String(payload.patient)) {
    const error = new Error("The selected appointment does not belong to this patient");
    error.statusCode = 400;
    throw error;
  }
  if (!["checked-in", "completed"].includes(appointment.status)) {
    const error = new Error("Progress notes can only be linked to a checked-in or completed appointment");
    error.statusCode = 409;
    throw error;
  }
  if (["doctor", "therapist"].includes(req.user.role)) {
    const practitioner = await Doctor.findOne({ user: req.user._id }).select("_id").lean();
    if (!practitioner || String(practitioner._id) !== String(appointment.practitioner)) {
      const error = new Error("You can only write notes for appointments assigned to you");
      error.statusCode = 403;
      throw error;
    }
  }
};
const controller = makeClinicalRecordController({
  Model: ProgressNote, ownerField: "author",
  createFields: ["patient","appointment","notedAt","noteType","subjective","objective","assessment","plan"],
  updateFields: ["appointment","notedAt","noteType","subjective","objective","assessment","plan"],
  populate: [["patient","fullName mrn"],["appointment","startsAt service status"],["author","name email"]],
  sortField: "notedAt", searchFields: ["subjective","objective","assessment","plan"], validateRelations
});
export const listProgressNotes = controller.list;
export const createProgressNote = controller.create;
export const getProgressNote = controller.get;
export const updateProgressNote = controller.update;
