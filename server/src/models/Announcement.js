import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema({
  key: { type: String, default: "hero", unique: true, immutable: true },
  enabled: { type: Boolean, default: false },
  eyebrow: { type: String, trim: true, maxlength: 48, default: "IMPORTANT ANNOUNCEMENT" },
  title: { type: String, trim: true, maxlength: 100, default: "" },
  message: { type: String, trim: true, maxlength: 280, default: "" },
  actionLabel: { type: String, trim: true, maxlength: 40, default: "" },
  actionUrl: { type: String, trim: true, maxlength: 300, default: "" },
  style: { type: String, enum: ["notice", "event", "urgent"], default: "notice" },
  startsAt: { type: Date, default: null },
  endsAt: { type: Date, default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });

export const Announcement = mongoose.model("Announcement", announcementSchema);
