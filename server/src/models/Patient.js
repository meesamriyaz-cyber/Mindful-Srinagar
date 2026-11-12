import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    mrn: { type: String, unique: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    guardianName: { type: String, trim: true },
    guardianRelationship: { type: String, trim: true, maxlength: 80 },
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
    notes: { type: String, trim: true },
    dischargeDate: Date,
    dischargeSummary: { type: String, trim: true },
    dischargeReason: { type: String, trim: true }
  },
  { timestamps: true }
);

patientSchema.index({ status: 1, createdAt: -1 });
patientSchema.index({ fullName: "text", guardianName: "text", phone: "text" });

patientSchema.pre("save", function autoMrn(next) {
  if (!this.mrn) {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.floor(1000 + Math.random() * 9000);
    this.mrn = `MRN-${stamp}-${rand}`;
  }
  next();
});

export const Patient = mongoose.model("Patient", patientSchema);
