import mongoose from "mongoose";

const referralSchema = new mongoose.Schema(
  {
    sourceType: {
      type: String,
      enum: ["hospital", "doctor", "school", "ngo", "walk-in", "online", "other"],
      required: true
    },
    sourceName: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true },
    contactRelationship: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    patientName: { type: String, required: true, trim: true },
    patientAge: { type: Number, min: 0, max: 120 },
    guardianName: { type: String, trim: true },
    guardianRelationship: { type: String, trim: true, maxlength: 80 },
    concern: { type: String, required: true, trim: true },
    preferredContact: {
      type: String,
      enum: ["whatsapp", "phone", "email"],
      default: "whatsapp"
    },
    urgency: {
      type: String,
      enum: ["routine", "soon", "urgent"],
      default: "routine"
    },
    privacyConsent: { type: Boolean, default: false },
    privacyConsentAt: Date,
    privacyNoticeVersion: { type: String, trim: true },
    status: {
      type: String,
      enum: ["new", "contacted", "scheduled", "converted", "lost"],
      default: "new"
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    followUpDate: Date,
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

referralSchema.index({ status: 1, urgency: 1, createdAt: -1 });
referralSchema.index({ sourceType: 1, createdAt: -1 });
referralSchema.index({ patientName: "text", sourceName: "text", phone: "text" });

export const Referral = mongoose.model("Referral", referralSchema);
