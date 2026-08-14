import mongoose from "mongoose";

const medicationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  dosage: { type: String, required: true, trim: true },
  frequency: { type: String, required: true, trim: true },
  duration: { type: String, trim: true },
  instructions: { type: String, trim: true }
});

const prescriptionSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    prescribedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    prescribedAt: { type: Date, required: true, default: Date.now },
    medications: [medicationSchema],
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active"
    }
  },
  { timestamps: true }
);

prescriptionSchema.index({ patient: 1, prescribedAt: -1 });
prescriptionSchema.index({ status: 1, prescribedAt: -1 });

export const Prescription = mongoose.model("Prescription", prescriptionSchema);
