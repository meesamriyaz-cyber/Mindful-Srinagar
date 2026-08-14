import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    practitioner: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
    service: { type: String, required: true, trim: true },
    startsAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 45 },
    room: { type: String, trim: true },
    status: {
      type: String,
      enum: ["scheduled", "checked-in", "completed", "cancelled", "no-show"],
      default: "scheduled"
    },
    clinicalNotes: { type: String, trim: true }
  },
  { timestamps: true }
);

appointmentSchema.index({ startsAt: 1, status: 1 });
appointmentSchema.index({ patient: 1, startsAt: -1 });
appointmentSchema.index({ practitioner: 1, startsAt: 1 });

export const Appointment = mongoose.model("Appointment", appointmentSchema);
