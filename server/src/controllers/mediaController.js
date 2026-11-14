import mongoose from "mongoose";
import { MediaAsset } from "../models/MediaAsset.js";
import { Gallery } from "../models/Gallery.js";
import { Publication } from "../models/Publication.js";
import { createMediaUploadSignature, removeCloudinaryMedia, verifyUploadedMedia } from "../services/mediaService.js";
import { normalizeMediaMetadata, validateMediaMetadata } from "../security/mediaRules.js";

const allowedMetadataFields = ["title", "caption", "description", "altText", "category", "tags", "identifiablePeople", "consentStatus", "consentScope", "consentNotes", "consentVerifiedAt"];

function sendValidationError(res, errors) {
  return res.status(400).json({ message: errors[0], errors });
}

export async function createUploadSignature(req, res, next) {
  try {
    return res.json(createMediaUploadSignature(req.body?.resourceType));
  } catch (error) {
    return next(error);
  }
}

export async function registerMediaAsset(req, res, next) {
  try {
    const payload = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const unexpected = Object.keys(payload).find((key) => !["publicId", "resourceType", ...allowedMetadataFields].includes(key));
    if (unexpected) return res.status(400).json({ message: "Unsupported field: " + unexpected });
    const errors = validateMediaMetadata(payload);
    if (errors.length) return sendValidationError(res, errors);
    if (typeof payload.publicId !== "string" || !["image", "video"].includes(payload.resourceType)) return res.status(400).json({ message: "A Cloudinary public ID and resource type are required" });
    const verified = await verifyUploadedMedia(payload.publicId, payload.resourceType);
    const metadata = normalizeMediaMetadata(payload);
    if (metadata.identifiablePeople === true && !metadata.consentStatus) metadata.consentStatus = "pending";
    if (metadata.consentStatus === "verified") metadata.consentVerifiedBy = req.user._id;
    if (metadata.consentStatus !== "verified") metadata.consentVerifiedBy = null;
    if (metadata.consentStatus === "withdrawn") metadata.consentWithdrawnBy = req.user._id;
    const asset = await MediaAsset.create({ ...verified, ...metadata, uploadedBy: req.user._id });
    return res.status(201).json(asset);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "This Cloudinary asset has already been registered" });
    return next(error);
  }
}

export async function listMediaAssets(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 24, 1), 100);
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const filter = {};
    filter.status = req.query.status === "archived" ? "archived" : "ready";
    if (["image", "video"].includes(req.query.resourceType)) filter.resourceType = req.query.resourceType;
    if (typeof req.query.category === "string" && req.query.category.trim()) filter.category = req.query.category.trim();
    if (typeof req.query.q === "string" && req.query.q.trim()) {
      const safeQuery = req.query.q.trim().slice(0, 80).replace(/[^a-z0-9 -]/gi, "");
      if (safeQuery) filter.$or = [{ title: new RegExp(safeQuery, "i") }, { caption: new RegExp(safeQuery, "i") }, { tags: new RegExp(safeQuery, "i") }];
    }
    const [items, total] = await Promise.all([
      MediaAsset.find(filter).populate("uploadedBy", "name role").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      MediaAsset.countDocuments(filter)
    ]);
    return res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) {
    return next(error);
  }
}

export async function updateMediaAsset(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "A valid media ID is required" });
    const payload = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const unexpected = Object.keys(payload).find((key) => !allowedMetadataFields.includes(key));
    if (unexpected) return res.status(400).json({ message: "Unsupported field: " + unexpected });
    const errors = validateMediaMetadata(payload);
    if (errors.length) return sendValidationError(res, errors);
    const asset = await MediaAsset.findById(req.params.id);
    if (!asset) return res.status(404).json({ message: "Media asset not found" });
    const metadata = normalizeMediaMetadata(payload);
    if (metadata.consentStatus === "verified") metadata.consentVerifiedBy = req.user._id;
    if (metadata.consentStatus && metadata.consentStatus !== "verified") metadata.consentVerifiedBy = null;
    if (metadata.consentStatus === "withdrawn") metadata.consentWithdrawnBy = req.user._id;
    if (metadata.consentStatus && metadata.consentStatus !== "withdrawn") metadata.consentWithdrawnBy = null;
    Object.assign(asset, metadata);
    await asset.save();
    return res.json(asset);
  } catch (error) {
    return next(error);
  }
}

export async function deleteMediaAsset(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "A valid media ID is required" });
    const asset = await MediaAsset.findById(req.params.id);
    if (!asset) return res.status(404).json({ message: "Media asset not found" });
    const [galleryUse, publicationUse] = await Promise.all([
      Gallery.exists({ $or: [{ coverMedia: asset._id }, { mediaItems: asset._id }] }),
      Publication.exists({ $or: [{ coverMedia: asset._id }, { mediaItems: asset._id }] })
    ]);
    if (galleryUse || publicationUse) return res.status(409).json({ message: "This media asset is in use by a gallery or publication. Remove those references before deleting it." });
    await removeCloudinaryMedia(asset.publicId, asset.resourceType);
    await asset.deleteOne();
    return res.json({ message: "Media asset deleted" });
  } catch (error) {
    return next(error);
  }
}
