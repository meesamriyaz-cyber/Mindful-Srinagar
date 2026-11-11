import mongoose from "mongoose";

const progressNoteSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    notedAt: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ["completed"], default: "completed", immutable: true },
    noteType: {
      type: String,
      enum: ["session", "review", "incident"],
      default: "session"
    },
    subjective: { type: String, trim: true },
    objective: { type: String, trim: true },
    assessment: { type: String, trim: true },
    plan: { type: String, trim: true, maxlength: 5000 }
  },
  { timestamps: true }
);

progressNoteSchema.pre("validate", function validateNoteContent(next) {
  const hasContent = [this.subjective, this.objective, this.assessment, this.plan].some((value) => String(value || "").trim());
  if (!hasContent) this.invalidate("subjective", "At least one progress note section must contain information");
  next();
});

progressNoteSchema.index({ patient: 1, notedAt: -1 });
progressNoteSchema.index({ appointment: 1, notedAt: -1 });

export const ProgressNote = mongoose.model("ProgressNote", progressNoteSchema);
