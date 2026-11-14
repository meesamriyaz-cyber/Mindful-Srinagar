import mongoose from "mongoose";

const mediaAssetSchema = new mongoose.Schema({
  assetId: { type: String, required: true, unique: true, trim: true },
  publicId: { type: String, required: true, unique: true, trim: true },
  resourceType: { type: String, enum: ["image", "video"], required: true },
  secureUrl: { type: String, required: true },
  format: { type: String, required: true, lowercase: true },
  width: { type: Number, min: 1 },
  height: { type: Number, min: 1 },
  duration: { type: Number, min: 0 },
  bytes: { type: Number, required: true, min: 1 },
  title: { type: String, trim: true, maxlength: 120, default: "" },
  caption: { type: String, trim: true, maxlength: 500, default: "" },
  description: { type: String, trim: true, maxlength: 1200, default: "" },
  altText: { type: String, trim: true, maxlength: 250, default: "" },
  category: { type: String, trim: true, default: "other" },
  tags: { type: [String], default: [] },
  identifiablePeople: { type: Boolean, default: false },
  consentStatus: { type: String, enum: ["not-required", "pending", "verified", "withdrawn"], default: "not-required" },
  consentVerifiedAt: { type: Date, default: null },
  consentWithdrawnAt: { type: Date, default: null },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["ready", "archived"], default: "ready" }
}, { timestamps: true });

mediaAssetSchema.index({ resourceType: 1, createdAt: -1 });
mediaAssetSchema.index({ category: 1, createdAt: -1 });
mediaAssetSchema.index({ tags: 1 });

export const MediaAsset = mongoose.model("MediaAsset", mediaAssetSchema);
