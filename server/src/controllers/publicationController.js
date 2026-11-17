import mongoose from "mongoose";
import { MediaAsset } from "../models/MediaAsset.js";
import { Publication } from "../models/Publication.js";
import { canExposeMediaAsset, canExposePublication, createPublicationSlug, validateEditorDocument, validatePublicationPayload } from "../security/mediaRules.js";

const publicationFields = ["title", "type", "summary", "body", "category", "tags", "coverMedia", "mediaItems", "eventDate", "venue", "identifiablePeople", "consentStatus", "consentScope", "consentNotes"];

function validationResponse(res, errors) {
  return res.status(400).json({ message: errors[0], errors });
}

async function validateMediaReferences(payload) {
  if (payload.mediaItems !== undefined && (!Array.isArray(payload.mediaItems) || payload.mediaItems.length > 50)) return "Related media must be an array containing no more than 50 assets";
  const ids = [...new Set([payload.coverMedia, ...(Array.isArray(payload.mediaItems) ? payload.mediaItems : [])].filter(Boolean).map(String))];
  if (ids.some((id) => !mongoose.isValidObjectId(id))) return "Cover or related media contains an invalid asset ID";
  if (!ids.length) return null;
  const assets = await MediaAsset.find({ _id: { $in: ids }, status: "ready" }).select("_id identifiablePeople consentStatus consentScope").lean();
  if (assets.length !== ids.length) return "Every publication media reference must point to an available media asset";
  if (assets.some((asset) => asset.identifiablePeople && (asset.consentStatus !== "verified" || !["website", "website-and-social", "all-public"].includes(asset.consentScope)))) return "Media showing identifiable people requires verified website consent before it can be attached to a publication";
  if (assets.some((asset) => asset.consentStatus === "withdrawn")) return "Media with withdrawn consent cannot be attached to a publication";
  return null;
}

function normalizePublicationPayload(payload) {
  const normalized = Object.fromEntries(Object.entries(payload).filter(([key]) => publicationFields.includes(key)));
  if (normalized.body !== undefined) normalized.body = validateEditorDocument(normalized.body).document;
  if (normalized.title !== undefined) normalized.title = normalized.title.trim();
  if (normalized.summary !== undefined) normalized.summary = normalized.summary.trim();
  if (normalized.category !== undefined) normalized.category = normalized.category.trim();
  if (normalized.tags !== undefined) normalized.tags = [...new Set(normalized.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
  if (normalized.venue !== undefined) normalized.venue = normalized.venue.trim();
  if (normalized.eventDate) normalized.eventDate = new Date(normalized.eventDate);
  if (normalized.consentStatus === "verified") normalized.consentVerifiedAt = new Date();
  if (normalized.identifiablePeople === true && !normalized.consentStatus) normalized.consentStatus = "pending";
  if (normalized.consentStatus === "withdrawn") normalized.consentWithdrawnAt = new Date();
  if (normalized.consentStatus && normalized.consentStatus !== "withdrawn") normalized.consentWithdrawnAt = null;
  if (normalized.consentStatus && normalized.consentStatus !== "verified") normalized.consentVerifiedAt = null;
  return normalized;
}

export async function createPublication(req, res, next) {
  try {
    const payload = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const unexpected = Object.keys(payload).find((key) => !publicationFields.includes(key));
    if (unexpected) return res.status(400).json({ message: "Unsupported field: " + unexpected });
    const errors = validatePublicationPayload(payload, { creating: true });
    if (errors.length) return validationResponse(res, errors);
    const referenceError = await validateMediaReferences(payload);
    if (referenceError) return res.status(400).json({ message: referenceError });
    const publication = await Publication.create({
      ...normalizePublicationPayload(payload),
      slug: createPublicationSlug(payload.title),
      createdBy: req.user._id,
      updatedBy: req.user._id,
      ...(payload.consentStatus === "verified" ? { consentVerifiedBy: req.user._id } : {}),
      ...(payload.consentStatus === "withdrawn" ? { consentWithdrawnBy: req.user._id } : {})
    });
    return res.status(201).json(publication);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "A publication with this title already exists. Change the title to create a unique URL." });
    return next(error);
  }
}

export async function listPublications(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const filter = {};
    if (["article", "news", "event"].includes(req.query.type)) filter.type = req.query.type;
    if (["draft", "published", "archived"].includes(req.query.status)) filter.status = req.query.status;
    if (typeof req.query.q === "string" && req.query.q.trim()) {
      const safeQuery = req.query.q.trim().slice(0, 80).replace(/[^a-z0-9 -]/gi, "");
      if (safeQuery) filter.$or = [{ title: new RegExp(safeQuery, "i") }, { summary: new RegExp(safeQuery, "i") }, { tags: new RegExp(safeQuery, "i") }];
    }
    const [items, total] = await Promise.all([
      Publication.find(filter).populate("coverMedia", "title secureUrl resourceType format status identifiablePeople consentStatus consentScope").populate("createdBy updatedBy", "name role").sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Publication.countDocuments(filter)
    ]);
    return res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) {
    return next(error);
  }
}

export async function getPublication(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "A valid publication ID is required" });
    const publication = await Publication.findById(req.params.id)
      .populate("coverMedia", "title secureUrl resourceType format identifiablePeople consentStatus consentScope")
      .populate("mediaItems", "title secureUrl resourceType format identifiablePeople consentStatus consentScope")
      .populate("createdBy updatedBy", "name role");
    if (!publication) return res.status(404).json({ message: "Publication not found" });
    return res.json(publication);
  } catch (error) {
    return next(error);
  }
}

export async function updatePublication(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "A valid publication ID is required" });
    const payload = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const unexpected = Object.keys(payload).find((key) => !publicationFields.includes(key));
    if (unexpected) return res.status(400).json({ message: "Unsupported field: " + unexpected });
    const errors = validatePublicationPayload(payload);
    if (errors.length) return validationResponse(res, errors);
    const publication = await Publication.findById(req.params.id);
    if (!publication) return res.status(404).json({ message: "Publication not found" });
    if (publication.status !== "draft") return res.status(409).json({ message: "Only draft publications can be edited in M1" });
    const referenceError = await validateMediaReferences(payload);
    if (referenceError) return res.status(400).json({ message: referenceError });
    if (payload.title !== undefined) {
      const nextSlug = createPublicationSlug(payload.title);
      const duplicate = await Publication.exists({ _id: { $ne: publication._id }, slug: nextSlug });
      if (duplicate) return res.status(409).json({ message: "A publication with this title already exists. Change the title to create a unique URL." });
      publication.slug = nextSlug;
    }
    const normalized = normalizePublicationPayload(payload);
    if (normalized.consentStatus === "verified") normalized.consentVerifiedBy = req.user._id;
    if (normalized.consentStatus && normalized.consentStatus !== "verified") normalized.consentVerifiedBy = null;
    if (normalized.consentStatus === "withdrawn") normalized.consentWithdrawnBy = req.user._id;
    if (normalized.consentStatus && normalized.consentStatus !== "withdrawn") normalized.consentWithdrawnBy = null;
    Object.assign(publication, normalized, { updatedBy: req.user._id });
    await publication.save();
    return res.json(publication);
  } catch (error) {
    return next(error);
  }
}

function isSafePublicAsset(asset) {
  return canExposeMediaAsset(asset);
}

function toPublicMediaAsset(asset) {
  if (!isSafePublicAsset(asset) || !asset) return null;
  const value = typeof asset.toObject === "function" ? asset.toObject() : asset;
  return {
    _id: value._id,
    title: value.title,
    caption: value.caption,
    altText: value.altText,
    secureUrl: value.secureUrl,
    resourceType: value.resourceType,
    format: value.format
  };
}


export async function listPublicMedia(req, res, next) {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 12, 1), 50);
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const filter = {
      status: "published",
      consentStatus: { $ne: "withdrawn" },
      $or: [
        { identifiablePeople: { $ne: true } },
        { identifiablePeople: true, consentStatus: "verified", consentScope: { $in: ["website", "website-and-social", "all-public"] } }
      ]
    };
    if (["article", "news", "event"].includes(req.query.type)) filter.type = req.query.type;
    if (typeof req.query.category === "string" && req.query.category.trim()) filter.category = req.query.category.trim();
    const [items, total] = await Promise.all([
      Publication.find(filter)
        .select("title slug type status summary category tags coverMedia eventDate venue publishedAt identifiablePeople consentStatus consentScope")
        .populate("coverMedia", "secureUrl resourceType format title status identifiablePeople consentStatus consentScope")
        .sort({ publishedAt: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Publication.countDocuments(filter)
    ]);
    const visible = items.filter(canExposePublication).map((item) => ({
      _id: item._id,
      title: item.title,
      slug: item.slug,
      type: item.type,
      summary: item.summary,
      category: item.category,
      tags: item.tags,
      coverMedia: toPublicMediaAsset(item.coverMedia),
      eventDate: item.eventDate,
      venue: item.venue,
      publishedAt: item.publishedAt
    }));
    return res.json({ items: visible, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error) {
    return next(error);
  }
}

export async function getPublicPublication(req, res, next) {
  try {
    const publication = await Publication.findOne({ slug: req.params.slug, status: "published", consentStatus: { $ne: "withdrawn" } })
      .select("title slug type status summary body category tags coverMedia mediaItems eventDate venue publishedAt identifiablePeople consentStatus consentScope")
      .populate("coverMedia", "secureUrl resourceType format title status identifiablePeople consentStatus consentScope")
      .populate("mediaItems", "secureUrl resourceType format title caption altText status identifiablePeople consentStatus consentScope");
    if (!canExposePublication(publication)) return res.status(404).json({ message: "Publication not found" });
    const value = publication.toObject();
    return res.json({
      _id: value._id,
      title: value.title,
      slug: value.slug,
      type: value.type,
      summary: value.summary,
      body: value.body,
      category: value.category,
      tags: value.tags,
      coverMedia: toPublicMediaAsset(value.coverMedia),
      mediaItems: (value.mediaItems || []).map(toPublicMediaAsset).filter(Boolean),
      eventDate: value.eventDate,
      venue: value.venue,
      publishedAt: value.publishedAt
    });
  } catch (error) {
    return next(error);
  }
}


const CARE_SERVICE_TAG_PREFIX = "care:";

export async function listPublicCareServices(_req, res, next) {
  try {
    const assets = await MediaAsset.find({
      status: "ready",
      resourceType: "image",
      tags: { $regex: "^care:" }
    }).sort({ updatedAt: -1, createdAt: -1 }).lean();

    const services = {};
    for (const asset of assets) {
      if (!canExposeMediaAsset(asset)) continue;
      const serviceSlug = (asset.tags || []).find((tag) => tag.startsWith(CARE_SERVICE_TAG_PREFIX))?.slice(CARE_SERVICE_TAG_PREFIX.length);
      if (!serviceSlug || services[serviceSlug]) continue;
      services[serviceSlug] = {
        _id: asset._id,
        title: asset.title,
        caption: asset.caption,
        altText: asset.altText,
        secureUrl: asset.secureUrl
      };
    }
    return res.json({ services });
  } catch (error) {
    return next(error);
  }
}
