import mongoose from "mongoose";
const schema = new mongoose.Schema({
  recordType: { type: String, required: true, enum: ["assessment","treatment-plan","progress-note","prescription"] },
  recordId: { type: mongoose.Schema.Types.ObjectId, required: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  amendedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reason: { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
  changedFields: { type: [String], required: true, validate: v => v.length > 0 },
  before: { type: mongoose.Schema.Types.Mixed, required: true },
  after: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true, strict: true });
schema.index({ recordType: 1, recordId: 1, createdAt: -1 });
schema.index({ patient: 1, createdAt: -1 });
schema.pre(["updateOne","updateMany","findOneAndUpdate","deleteOne","deleteMany","findOneAndDelete"], function rejectMutation() { throw new Error("Clinical amendment history is append-only"); });
export const ClinicalRecordAmendment = mongoose.model("ClinicalRecordAmendment", schema);
