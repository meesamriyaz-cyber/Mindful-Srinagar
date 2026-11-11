import mongoose from "mongoose";

const medicationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  dosage: { type: String, required: true, trim: true, maxlength: 120 },
  frequency: { type: String, required: true, trim: true, maxlength: 120 },
  duration: { type: String, trim: true },
  instructions: { type: String, trim: true }
});

const prescriptionSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    prescribedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    prescribedAt: { type: Date, required: true, default: Date.now },
    medications: { type: [medicationSchema], validate: [(value) => value.length >= 1 && value.length <= 30, "A prescription must contain 1 to 30 medications"] },
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
