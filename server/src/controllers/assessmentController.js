import { Assessment } from "../models/Assessment.js";
import { makeClinicalRecordController } from "./clinicalRecordController.js";
const controller = makeClinicalRecordController({
  Model: Assessment, ownerField: "assessedBy",
  createFields: ["patient","assessedAt","domains","findings","recommendations","status"],
  updateFields: ["assessedAt","domains","findings","recommendations","status"],
  populate: [["patient","fullName mrn"],["assessedBy","name email"]],
  sortField: "assessedAt", searchFields: ["findings","recommendations"]
});
export const listAssessments = controller.list;
export const createAssessment = controller.create;
export const getAssessment = controller.get;
export const updateAssessment = controller.update;
