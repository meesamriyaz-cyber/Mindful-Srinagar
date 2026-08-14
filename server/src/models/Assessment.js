import mongoose from "mongoose";

const assessmentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    assessedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assessedAt: { type: Date, required: true, default: Date.now },
    domains: [{ type: String, trim: true }],
    findings: { type: String, trim: true },
    recommendations: { type: String, trim: true },
    status: {
      type: String,
      enum: ["draft", "completed"],
      default: "draft"
    }
  },
  { timestamps: true }
);

assessmentSchema.index({ patient: 1, assessedAt: -1 });
assessmentSchema.index({ status: 1, assessedAt: -1 });

export const Assessment = mongoose.model("Assessment", assessmentSchema);
