import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    mrn: { type: String, required: true, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    guardianName: { type: String, trim: true },
    age: { type: Number, min: 0 },
    gender: { type: String, enum: ["female", "male", "other", "prefer-not-to-say"] },
    phone: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    primaryConcern: { type: String, required: true, trim: true },
    services: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ["new", "assessment", "active", "on-hold", "discharged"],
      default: "new"
    },
    referral: { type: mongoose.Schema.Types.ObjectId, ref: "Referral" },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

patientSchema.index({ status: 1, createdAt: -1 });
patientSchema.index({ fullName: "text", guardianName: "text", phone: "text" });

export const Patient = mongoose.model("Patient", patientSchema);
