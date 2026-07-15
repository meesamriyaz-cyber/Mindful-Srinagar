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
    phone: { type: String, trim: true },
    patientName: { type: String, required: true, trim: true },
    concern: { type: String, required: true, trim: true },
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

export const Referral = mongoose.model("Referral", referralSchema);
