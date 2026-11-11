import { Prescription } from "../models/Prescription.js";
import { makeClinicalRecordController } from "./clinicalRecordController.js";
const validateRelations = async (payload) => {
  if (!Array.isArray(payload.medications) || payload.medications.length < 1 || payload.medications.length > 30) {
    const error = new Error("A prescription must contain 1 to 30 medications");
    error.statusCode = 400;
    throw error;
  }
  for (const medication of payload.medications) {
    for (const field of ["name", "dosage", "frequency"]) {
      if (typeof medication?.[field] !== "string" || !medication[field].trim() || medication[field].trim().length > 120) {
        const error = new Error("Each medication needs a valid name, dosage and frequency");
        error.statusCode = 400;
        throw error;
      }
    }
  }
};
const controller = makeClinicalRecordController({
  Model: Prescription, recordType: "prescription", ownerField: "prescribedBy",
  createFields: ["patient","prescribedAt","medications","notes","status"],
  updateFields: ["prescribedAt","medications","notes","status"],
  populate: [["patient","fullName mrn"],["prescribedBy","name email"]],
  sortField: "prescribedAt", searchFields: ["medications.name","notes"], validateRelations
});
export const listPrescriptions = controller.list;
export const createPrescription = controller.create;
export const getPrescription = controller.get;
export const updatePrescription = controller.update;
export const listPrescriptionAmendments = controller.amendments;
export const amendPrescription = controller.amend;
