import mongoose from "mongoose";

const publicationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  type: { type: String, enum: ["article", "news", "event"], required: true },
  summary: { type: String, trim: true, maxlength: 500, default: "" },
  body: { type: mongoose.Schema.Types.Mixed, default: () => ({ type: "doc", content: [{ type: "paragraph" }] }) },
  category: { type: String, trim: true, maxlength: 80, default: "General" },
  tags: { type: [String], default: [] },
  coverMedia: { type: mongoose.Schema.Types.ObjectId, ref: "MediaAsset", default: null },
  mediaItems: [{ type: mongoose.Schema.Types.ObjectId, ref: "MediaAsset" }],
  eventDate: { type: Date, default: null },
  venue: { type: String, trim: true, maxlength: 180, default: "" },
  identifiablePeople: { type: Boolean, default: false },
  consentStatus: { type: String, enum: ["not-required", "pending", "verified", "withdrawn"], default: "not-required" },
  consentVerifiedAt: { type: Date, default: null },
  consentWithdrawnAt: { type: Date, default: null },
  status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  publishedAt: { type: Date, default: null }
}, { timestamps: true });

publicationSchema.index({ status: 1, type: 1, publishedAt: -1 });
publicationSchema.index({ category: 1, status: 1, publishedAt: -1 });
publicationSchema.index({ tags: 1, status: 1 });

export const Publication = mongoose.model("Publication", publicationSchema);
