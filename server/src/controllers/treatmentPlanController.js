import { TreatmentPlan } from "../models/TreatmentPlan.js";
import { makeClinicalRecordController } from "./clinicalRecordController.js";
const controller = makeClinicalRecordController({
  Model: TreatmentPlan, ownerField: "createdBy",
  createFields: ["patient","startDate","endDate","goals","interventions","frequency","duration","status"],
  updateFields: ["startDate","endDate","goals","interventions","frequency","duration","status"],
  populate: [["patient","fullName mrn"],["createdBy","name email"]],
  sortField: "startDate", searchFields: ["goals","interventions"],
  defaultValues: () => ({ startDate: new Date() })
});
export const listTreatmentPlans = controller.list;
export const createTreatmentPlan = controller.create;
export const getTreatmentPlan = controller.get;
export const updateTreatmentPlan = controller.update;
