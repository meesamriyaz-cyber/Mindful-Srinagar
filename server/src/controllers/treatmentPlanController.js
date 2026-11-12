import mongoose from "mongoose";
import { Assessment } from "../models/Assessment.js";
import { Patient } from "../models/Patient.js";
import { TreatmentPlan } from "../models/TreatmentPlan.js";
import { makeClinicalRecordController } from "./clinicalRecordController.js";
import { validateTreatmentPlanAssessment } from "../security/carePlanRules.js";

const controller = makeClinicalRecordController({
  Model: TreatmentPlan, recordType: "treatment-plan", ownerField: "createdBy",
  createFields: ["patient","assessment","startDate","endDate","goals","interventions","frequency","duration","status"],
  updateFields: ["startDate","endDate","goals","interventions","frequency","duration","status"],
  populate: [["patient","fullName mrn"],["createdBy","name email"],["assessment","assessedAt status domains"]],
  sortField: "startDate", searchFields: ["goals","interventions"],
  defaultValues: () => ({ startDate: new Date(), status: "planned" }),
  validateRelations: async (payload, req) => {
    if (!payload.assessment) {
      if (req.method === "POST") {
        const error = new Error("Select a completed assessment for this treatment plan");
        error.statusCode = 400;
        throw error;
      }
      if (payload.status === "active" && (!payload.approvedBy || !payload.approvedAt)) {
        const error = new Error("A legacy plan without approval history cannot be activated directly");
        error.statusCode = 409;
        throw error;
      }
      return;
    }
    const assessment = await Assessment.findById(payload.assessment).select("patient status");
    const errorMessage = validateTreatmentPlanAssessment({
      patient: payload.patient,
      assessment,
      assessmentStatus: assessment?.status,
      status: payload.status,
      approvedBy: payload.approvedBy,
      approvedAt: payload.approvedAt
    });
    if (errorMessage) {
      const error = new Error(errorMessage);
      error.statusCode = assessment ? 409 : 404;
      throw error;
    }
  }
});

export const listTreatmentPlans = controller.list;
export const createTreatmentPlan = controller.create;
export const getTreatmentPlan = controller.get;
export const updateTreatmentPlan = controller.update;
export const listTreatmentPlanAmendments = controller.amendments;
export const amendTreatmentPlan = controller.amend;

export async function approveTreatmentPlan(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "A valid treatment plan ID is required" });
    const plan = await TreatmentPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ message: "Treatment plan not found" });
    if (plan.status !== "planned") return res.status(409).json({ message: "Only a planned treatment plan can be approved" });
    const [assessment, patient] = await Promise.all([
      Assessment.findById(plan.assessment).select("patient status"),
      Patient.findById(plan.patient).select("status")
    ]);
    if (!assessment || String(assessment.patient) !== String(plan.patient) || assessment.status !== "completed") {
      return res.status(409).json({ message: "Approval requires a completed assessment belonging to this patient" });
    }
    if (!patient || ["on-hold", "discharged"].includes(patient.status)) {
      return res.status(409).json({ message: "A plan cannot be activated while the patient is on hold or discharged" });
    }
    const approvedAt = new Date();
    const updated = await TreatmentPlan.findOneAndUpdate(
      { _id: plan._id, status: "planned", $or: [{ approvedAt: { $exists: false } }, { approvedAt: null }] },
      { $set: { status: "active", approvedBy: req.user._id, approvedAt } },
      { new: true, runValidators: true }
    ).populate("patient", "fullName mrn")
      .populate("assessment", "assessedAt status domains")
      .populate("createdBy", "name email")
      .populate("approvedBy", "name email");
    if (!updated) return res.status(409).json({ message: "This treatment plan was changed or approved by another staff member. Reload and try again." });
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
}
