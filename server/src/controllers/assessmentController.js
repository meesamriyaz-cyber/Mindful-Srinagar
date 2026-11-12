import { Assessment } from "../models/Assessment.js";
import { makeClinicalRecordController } from "./clinicalRecordController.js";
import { validateAssessmentCompletion } from "../security/carePlanRules.js";
const controller = makeClinicalRecordController({
  Model: Assessment, recordType: "assessment", ownerField: "assessedBy",
  createFields: ["patient","assessedAt","domains","findings","recommendations","status"],
  updateFields: ["assessedAt","domains","findings","recommendations","status"],
  populate: [["patient","fullName mrn"],["assessedBy","name email"]],
  sortField: "assessedAt", searchFields: ["findings","recommendations"],
  validateRelations: (payload) => {
    const error = validateAssessmentCompletion(payload);
    if (error) { const failure = new Error(error); failure.statusCode = 400; throw failure; }
  }
});
export const listAssessments = controller.list;
export const createAssessment = controller.create;
export const getAssessment = controller.get;
export const updateAssessment = controller.update;
export const listAssessmentAmendments = controller.amendments;
export const amendAssessment = controller.amend;
