import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    discipline: { type: String, required: true, trim: true },
    registrationNo: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    availability: [{ day: String, from: String, to: String }],
    status: { type: String, enum: ["active", "visiting", "inactive"], default: "active" }
  },
  { timestamps: true }
);

doctorSchema.index({ status: 1, discipline: 1 });
doctorSchema.index({ name: "text", discipline: "text", phone: "text" });

export const Doctor = mongoose.model("Doctor", doctorSchema);
