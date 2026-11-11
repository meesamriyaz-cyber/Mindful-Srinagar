import mongoose from "mongoose";

const assessmentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    assessedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assessedAt: { type: Date, required: true, default: Date.now },
    domains: { type: [{ type: String, trim: true, maxlength: 80 }], validate: [(value) => value.length <= 20, "An assessment may contain at most 20 domains"] },
    findings: { type: String, trim: true, maxlength: 5000 },
    recommendations: { type: String, trim: true, maxlength: 5000 },
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
