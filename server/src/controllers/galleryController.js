import mongoose from "mongoose";
import { Gallery } from "../models/Gallery.js";
import { MediaAsset } from "../models/MediaAsset.js";

const fields = ["title", "description", "category", "coverMedia", "mediaItems", "eventDate"];

function validatePayload(payload, creating = false) {
  const errors = [];
  if (creating && (typeof payload.title !== "string" || payload.title.trim().length < 3 || payload.title.trim().length > 140)) errors.push("Gallery title must contain between 3 and 140 characters");
  if (payload.title !== undefined && (typeof payload.title !== "string" || payload.title.trim().length < 3 || payload.title.trim().length > 140)) errors.push("Gallery title must contain between 3 and 140 characters");
  if (payload.description !== undefined && (typeof payload.description !== "string" || payload.description.length > 1200)) errors.push("Gallery description must be no more than 1200 characters");
  if (payload.category !== undefined && (typeof payload.category !== "string" || payload.category.trim().length > 80)) errors.push("Gallery category must be no more than 80 characters");
  if (payload.eventDate !== undefined && payload.eventDate !== null && !Number.isFinite(new Date(payload.eventDate).getTime())) errors.push("Enter a valid event date");
  if (payload.mediaItems !== undefined && (!Array.isArray(payload.mediaItems) || payload.mediaItems.length > 100)) errors.push("A gallery may contain no more than 100 media assets");
  return errors;
}

async function validateReferences(payload) {
  const ids = [...new Set([payload.coverMedia, ...(Array.isArray(payload.mediaItems) ? payload.mediaItems : [])].filter(Boolean).map(String))];
  if (ids.some((id) => !mongoose.isValidObjectId(id))) return "Gallery contains an invalid media reference";
  if (!ids.length) return null;
  const assets = await MediaAsset.find({ _id: { $in: ids }, status: "ready" }).select("_id identifiablePeople consentStatus consentScope").lean();
  if (assets.length !== ids.length) return "Every gallery media reference must point to an available asset";
  if (assets.some((asset) => asset.identifiablePeople && (asset.consentStatus !== "verified" || !["website", "website-and-social", "all-public"].includes(asset.consentScope)))) return "Every identifiable person in a public gallery must have verified website consent";
  if (assets.some((asset) => asset.consentStatus === "withdrawn")) return "Media with withdrawn consent cannot be attached to a gallery";
  return null;
}

function slugify(value) {
  return String(value || "").normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 110) || "gallery";
}

function publicAsset(asset) {
  if (!asset || asset.status === "archived" || asset.consentStatus === "withdrawn") return null;
  if (asset.identifiablePeople && (asset.consentStatus !== "verified" || !["website", "website-and-social", "all-public"].includes(asset.consentScope))) return null;
  return { _id: asset._id, title: asset.title, caption: asset.caption, altText: asset.altText, secureUrl: asset.secureUrl, resourceType: asset.resourceType, format: asset.format };
}

function publicGallery(gallery) {
  const value = typeof gallery.toObject === "function" ? gallery.toObject() : gallery;
  const mediaItems = (value.mediaItems || []).map(publicAsset).filter(Boolean);
  return {
    _id: value._id, title: value.title, slug: value.slug, description: value.description,
    category: value.category, coverMedia: publicAsset(value.coverMedia), mediaItems,
    eventDate: value.eventDate, publishedAt: value.publishedAt
  };
}

export async function createGallery(req, res, next) {
  try {
    const payload = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const unexpected = Object.keys(payload).find((key) => !fields.includes(key));
    if (unexpected) return res.status(400).json({ message: "Unsupported field: " + unexpected });
    const errors = validatePayload(payload, true);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const referenceError = await validateReferences(payload);
    if (referenceError) return res.status(400).json({ message: referenceError });
    const gallery = await Gallery.create({
      ...payload, title: payload.title.trim(), slug: slugify(payload.title),
      description: (payload.description || "").trim(), category: (payload.category || "other").trim(),
      eventDate: payload.eventDate || null, createdBy: req.user._id, updatedBy: req.user._id
    });
    return res.status(201).json(gallery);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A gallery with this title already exists. Choose a different title." });
    return next(error);
  }
}

export async function listGalleries(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const filter = {};
    if (["draft", "published", "archived"].includes(req.query.status)) filter.status = req.query.status;
    if (typeof req.query.q === "string" && req.query.q.trim()) filter.title = new RegExp(req.query.q.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const [items, total] = await Promise.all([
      Gallery.find(filter).populate("coverMedia", "title secureUrl resourceType format").populate("mediaItems", "title secureUrl resourceType format status identifiablePeople consentStatus consentScope").populate("createdBy updatedBy", "name role").sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Gallery.countDocuments(filter)
    ]);
    return res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) { return next(error); }
}

export async function getGallery(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "A valid gallery ID is required" });
    const gallery = await Gallery.findById(req.params.id).populate("coverMedia").populate("mediaItems").populate("createdBy updatedBy", "name role");
    if (!gallery) return res.status(404).json({ message: "Gallery not found" });
    return res.json(gallery);
  } catch (error) { return next(error); }
}

export async function updateGallery(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "A valid gallery ID is required" });
    const payload = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const unexpected = Object.keys(payload).find((key) => !fields.includes(key));
    if (unexpected) return res.status(400).json({ message: "Unsupported field: " + unexpected });
    const errors = validatePayload(payload);
    if (errors.length) return res.status(400).json({ message: errors[0], errors });
    const gallery = await Gallery.findById(req.params.id);
    if (!gallery) return res.status(404).json({ message: "Gallery not found" });
    if (gallery.status !== "draft") return res.status(409).json({ message: "Only draft galleries can be edited. Unpublish the gallery first." });
    const referenceError = await validateReferences(payload);
    if (referenceError) return res.status(400).json({ message: referenceError });
    if (payload.title !== undefined) {
      const slug = slugify(payload.title);
      if (await Gallery.exists({ _id: { $ne: gallery._id }, slug })) return res.status(409).json({ message: "A gallery with this title already exists." });
      gallery.slug = slug;
      gallery.title = payload.title.trim();
    }
    for (const key of ["description", "category"]) if (payload[key] !== undefined) gallery[key] = payload[key].trim();
    for (const key of ["coverMedia", "mediaItems", "eventDate"]) if (payload[key] !== undefined) gallery[key] = payload[key];
    gallery.updatedBy = req.user._id;
    await gallery.save();
    return res.json(gallery);
  } catch (error) { return next(error); }
}

export async function transitionGallery(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "A valid gallery ID is required" });
    const { status } = req.body || {};
    if (!["published", "draft", "archived"].includes(status)) return res.status(400).json({ message: "Choose published, draft or archived status" });
    const gallery = await Gallery.findById(req.params.id);
    if (!gallery) return res.status(404).json({ message: "Gallery not found" });
    if (status === "published") {
      const referenceError = await validateReferences({ coverMedia: gallery.coverMedia, mediaItems: gallery.mediaItems });
      if (referenceError) return res.status(409).json({ message: referenceError });
      if (!gallery.coverMedia && !gallery.mediaItems.length) return res.status(409).json({ message: "Add at least one approved media asset before publishing this gallery" });
    }
    gallery.status = status;
    gallery.updatedBy = req.user._id;
    if (status === "published") { gallery.publishedAt = new Date(); gallery.publishedBy = req.user._id; }
    if (status !== "published") { gallery.publishedAt = null; gallery.publishedBy = null; }
    await gallery.save();
    return res.json(gallery);
  } catch (error) { return next(error); }
}

export async function listPublicGalleries(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 12, 1), 50);
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const filter = { status: "published" };
    if (typeof req.query.category === "string" && req.query.category.trim()) filter.category = req.query.category.trim();
    const [items, total] = await Promise.all([
      Gallery.find(filter).populate("coverMedia").populate("mediaItems").sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Gallery.countDocuments(filter)
    ]);
    return res.json({ items: items.map(publicGallery), total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) { return next(error); }
}

export async function getPublicGallery(req, res, next) {
  try {
    const gallery = await Gallery.findOne({ slug: req.params.slug, status: "published" }).populate("coverMedia").populate("mediaItems");
    if (!gallery) return res.status(404).json({ message: "Gallery not found" });
    return res.json(publicGallery(gallery));
  } catch (error) { return next(error); }
}
