import { ProgressNote } from "../models/ProgressNote.js";
import { Appointment } from "../models/Appointment.js";
import { makeClinicalRecordController } from "./clinicalRecordController.js";
const validateRelations = async (payload) => {
  if (!payload.appointment) return;
  const appointment = await Appointment.findById(payload.appointment);
  if (!appointment || String(appointment.patient) !== String(payload.patient)) {
    const error = new Error("The selected appointment does not belong to this patient");
    error.statusCode = 400;
    throw error;
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
