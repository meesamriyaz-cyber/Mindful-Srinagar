import { Prescription } from "../models/Prescription.js";
import { makeClinicalRecordController } from "./clinicalRecordController.js";
const controller = makeClinicalRecordController({
  Model: Prescription, ownerField: "prescribedBy",
  createFields: ["patient","prescribedAt","medications","notes","status"],
  updateFields: ["prescribedAt","medications","notes","status"],
  populate: [["patient","fullName mrn"],["prescribedBy","name email"]],
  sortField: "prescribedAt", searchFields: ["medications.name","notes"]
});
export const listPrescriptions = controller.list;
export const createPrescription = controller.create;
export const getPrescription = controller.get;
export const updatePrescription = controller.update;
