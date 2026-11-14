import mongoose from "mongoose";

const gallerySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 140 },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  description: { type: String, trim: true, maxlength: 1200, default: "" },
  category: { type: String, trim: true, maxlength: 80, default: "other" },
  coverMedia: { type: mongoose.Schema.Types.ObjectId, ref: "MediaAsset", default: null },
  mediaItems: [{ type: mongoose.Schema.Types.ObjectId, ref: "MediaAsset" }],
  eventDate: { type: Date, default: null },
  status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  publishedAt: { type: Date, default: null }
}, { timestamps: true });

gallerySchema.index({ status: 1, eventDate: -1, createdAt: -1 });

export const Gallery = mongoose.model("Gallery", gallerySchema);
