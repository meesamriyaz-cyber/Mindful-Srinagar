import mongoose from "mongoose";

const treatmentPlanSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assessment: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    startDate: { type: Date, required: true },
    endDate: { type: Date, validate: { validator(value) { return !value || !this.startDate || value >= this.startDate; }, message: "Treatment plan end date must be on or after its start date" } },
    goals: { type: String, required: true, trim: true, maxlength: 5000 },
    interventions: [{ type: String, trim: true }],
    frequency: { type: String, trim: true },
    duration: { type: String, trim: true },
    status: {
      type: String,
      enum: ["planned", "active", "completed", "on-hold", "cancelled"],
      default: "planned"
    }
  },
  { timestamps: true }
);

treatmentPlanSchema.index({ patient: 1, startDate: -1 });
treatmentPlanSchema.index({ status: 1, startDate: -1 });
treatmentPlanSchema.index({ assessment: 1, patient: 1 });

export const TreatmentPlan = mongoose.model("TreatmentPlan", treatmentPlanSchema);
