import mongoose from "mongoose";

const treatmentPlanSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    goals: { type: String, required: true, trim: true },
    interventions: [{ type: String, trim: true }],
    frequency: { type: String, trim: true },
    duration: { type: String, trim: true },
    status: {
      type: String,
      enum: ["planned", "active", "completed", "on-hold"],
      default: "planned"
    }
  },
  { timestamps: true }
);

treatmentPlanSchema.index({ patient: 1, startDate: -1 });
treatmentPlanSchema.index({ status: 1, startDate: -1 });

export const TreatmentPlan = mongoose.model("TreatmentPlan", treatmentPlanSchema);
