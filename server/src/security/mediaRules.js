import { mediaUploadLimits } from "../config/env.js";

const IMAGE_FORMATS = new Set(["jpg", "jpeg", "png", "webp"]);
const VIDEO_FORMATS = new Set(["mp4", "webm"]);
const CATEGORIES = new Set(["centre-activities", "workshops", "awareness", "training", "research", "facilities", "other"]);
const CONSENT_STATUSES = new Set(["not-required", "pending", "verified", "withdrawn"]);

export function validateMediaResource(resource, resourceType, env = process.env) {
  if (!resource || !["image", "video"].includes(resourceType)) return "A valid Cloudinary media resource is required";
  if (resource.resource_type !== resourceType || resource.type !== "upload") return "Cloudinary resource type does not match the upload request";
  if (typeof resource.public_id !== "string" || !resource.public_id.startsWith("mindful/media/")) return "Media must be uploaded into the approved Mindful media folder";
  if (typeof resource.asset_id !== "string" || !resource.asset_id) return "Cloudinary asset identity is missing";
  if (typeof resource.secure_url !== "string" || !resource.secure_url.startsWith("https://res.cloudinary.com/")) return "Cloudinary did not return a valid secure media URL";
  if (!Number.isSafeInteger(Number(resource.bytes)) || Number(resource.bytes) <= 0) return "Cloudinary returned an invalid file size";
  const limits = mediaUploadLimits(env);
  const maximum = resourceType === "image" ? limits.imageMaxBytes : limits.videoMaxBytes;
  if (Number(resource.bytes) > maximum) return "The uploaded file exceeds the " + (resourceType === "image" ? "image" : "video") + " size limit";
  const format = String(resource.format || "").toLowerCase();
  const allowed = resourceType === "image" ? IMAGE_FORMATS : VIDEO_FORMATS;
  if (!allowed.has(format)) return "This media format is not supported";
  if (resourceType === "image" && (!Number.isFinite(Number(resource.width)) || Number(resource.width) < 1 || !Number.isFinite(Number(resource.height)) || Number(resource.height) < 1)) return "Cloudinary image dimensions are missing";
  if (resourceType === "video" && (!Number.isFinite(Number(resource.duration)) || Number(resource.duration) <= 0)) return "Cloudinary video duration is missing";
  return null;
}

export function validateMediaMetadata(payload = {}) {
  const errors = [];
  const textFields = { title: 120, caption: 500, altText: 250, description: 1200 };
  for (const [field, maximum] of Object.entries(textFields)) {
    if (payload[field] !== undefined && (typeof payload[field] !== "string" || payload[field].trim().length > maximum)) errors.push(field + " must be text of no more than " + maximum + " characters");
  }
  if (payload.category !== undefined && !CATEGORIES.has(payload.category)) errors.push("Select a supported media category");
  if (payload.tags !== undefined && (!Array.isArray(payload.tags) || payload.tags.length > 12 || payload.tags.some((tag) => typeof tag !== "string" || tag.trim().length > 32))) errors.push("Provide no more than 12 valid tags, each up to 32 characters");
  if (payload.identifiablePeople !== undefined && typeof payload.identifiablePeople !== "boolean") errors.push("identifiablePeople must be true or false");
  if (payload.consentStatus !== undefined && !CONSENT_STATUSES.has(payload.consentStatus)) errors.push("Select a valid consent status");
  if (payload.identifiablePeople === true && payload.consentStatus === "not-required") errors.push("Identifiable people require a consent review");
  if (payload.consentStatus === "verified" && !payload.consentVerifiedAt) errors.push("Verified consent must include its verification date");
  if (payload.consentVerifiedAt && !Number.isFinite(new Date(payload.consentVerifiedAt).getTime())) errors.push("Consent verification date is invalid");
  return errors;
}

export function normalizeMediaMetadata(payload = {}) {
  const clean = {};
  for (const field of ["title", "caption", "altText", "description", "category"]) if (payload[field] !== undefined) clean[field] = String(payload[field]).trim();
  if (payload.tags !== undefined) clean.tags = [...new Set(payload.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
  if (payload.identifiablePeople !== undefined) clean.identifiablePeople = payload.identifiablePeople;
  if (payload.consentStatus !== undefined) clean.consentStatus = payload.consentStatus;
  if (payload.consentStatus === "verified") clean.consentVerifiedAt = new Date(payload.consentVerifiedAt);
  if (payload.consentStatus === "withdrawn") clean.consentWithdrawnAt = new Date();
  return clean;
}

export function validateEditorDocument(document, { maxDepth = 12, maxNodes = 1500, maxTextLength = 50000 } = {}) {
  let nodes = 0;
  let textLength = 0;
  const allowedNodes = new Set(["doc", "paragraph", "heading", "text", "bulletList", "orderedList", "listItem", "blockquote", "hardBreak", "horizontalRule"]);
  const allowedMarks = new Set(["bold", "italic", "underline", "strike", "code", "link"]);
  const fail = (message) => ({ error: message });

  function visit(node, depth) {
    if (!node || typeof node !== "object" || Array.isArray(node) || depth > maxDepth) return fail("Article body contains an invalid or deeply nested editor node");
    nodes += 1;
    if (nodes > maxNodes) return fail("Article body contains too many editor nodes");
    if (!allowedNodes.has(node.type)) return fail("Article body contains an unsupported editor node: " + String(node.type || "unknown"));
    const result = { type: node.type };
    if (node.type === "text") {
      if (typeof node.text !== "string") return fail("Text editor nodes must contain text");
      textLength += node.text.length;
      if (textLength > maxTextLength) return fail("Article body exceeds the maximum text length");
      result.text = node.text;
    }
    if (node.type === "heading") {
      const level = Number(node.attrs?.level || 2);
      if (![1, 2, 3].includes(level)) return fail("Article headings may use levels 1 to 3 only");
      result.attrs = { level };
    }
    if (node.type === "orderedList" && node.attrs?.start !== undefined) {
      const start = Number(node.attrs.start);
      if (!Number.isInteger(start) || start < 1 || start > 1000) return fail("Ordered list start must be a positive integer");
      result.attrs = { start };
    }
    if (node.marks !== undefined) {
      if (!Array.isArray(node.marks) || node.marks.length > 8) return fail("Article text marks are invalid");
      result.marks = [];
      for (const mark of node.marks) {
        if (!mark || !allowedMarks.has(mark.type)) return fail("Article contains an unsupported text format");
        if (mark.type === "link") {
          const href = String(mark.attrs?.href || "");
          let parsed;
          try { parsed = new URL(href); } catch { return fail("Article links must use a valid web or email URL"); }
          if (!["https:", "http:", "mailto:"].includes(parsed.protocol)) return fail("Article links may only use HTTP, HTTPS or mailto URLs");
          result.marks.push({ type: "link", attrs: { href: parsed.toString() } });
        } else result.marks.push({ type: mark.type });
      }
    }
    if (node.content !== undefined) {
      if (!Array.isArray(node.content) || node.content.length > maxNodes) return fail("Article node children are invalid");
      result.content = [];
      for (const child of node.content) {
        const checked = visit(child, depth + 1);
        if (checked.error) return checked;
        result.content.push(checked);
      }
    }
    return result;
  }

  if (!document || document.type !== "doc" || !Array.isArray(document.content)) return fail("Article body must be a rich-text editor document");
  const sanitized = visit(document, 0);
  return sanitized.error ? sanitized : { document: sanitized };
}

export function validatePublicationPayload(payload = {}, { creating = false } = {}) {
  const errors = [];
  if (creating && (typeof payload.title !== "string" || payload.title.trim().length < 3 || payload.title.trim().length > 160)) errors.push("Publication title must contain between 3 and 160 characters");
  if (payload.title !== undefined && (typeof payload.title !== "string" || payload.title.trim().length < 3 || payload.title.trim().length > 160)) errors.push("Publication title must contain between 3 and 160 characters");
  if (payload.type !== undefined && !["article", "news", "event"].includes(payload.type)) errors.push("Publication type must be article, news or event");
  if (creating && !["article", "news", "event"].includes(payload.type)) errors.push("Select a publication type");
  if (payload.summary !== undefined && (typeof payload.summary !== "string" || payload.summary.trim().length > 500)) errors.push("Publication summary must be no more than 500 characters");
  if (payload.category !== undefined && (typeof payload.category !== "string" || payload.category.trim().length > 80)) errors.push("Publication category must be no more than 80 characters");
  if (payload.tags !== undefined && (!Array.isArray(payload.tags) || payload.tags.length > 15 || payload.tags.some((tag) => typeof tag !== "string" || tag.trim().length > 32))) errors.push("Provide no more than 15 valid publication tags");
  if (payload.eventDate !== undefined && payload.eventDate !== null && !Number.isFinite(new Date(payload.eventDate).getTime())) errors.push("Enter a valid event date");
  if (payload.venue !== undefined && (typeof payload.venue !== "string" || payload.venue.trim().length > 180)) errors.push("Event venue must be no more than 180 characters");
  if (payload.body !== undefined) {
    const checked = validateEditorDocument(payload.body);
    if (checked.error) errors.push(checked.error);
  }
  if (payload.identifiablePeople !== undefined && typeof payload.identifiablePeople !== "boolean") errors.push("identifiablePeople must be true or false");
  if (payload.consentStatus !== undefined && !CONSENT_STATUSES.has(payload.consentStatus)) errors.push("Select a valid consent status");
  if (payload.identifiablePeople === true && payload.consentStatus === "not-required") errors.push("Identifiable people require a consent review");
  if (payload.consentStatus === "verified" && !payload.consentVerifiedAt) errors.push("Verified consent must include its verification date");
  if (payload.consentVerifiedAt && !Number.isFinite(new Date(payload.consentVerifiedAt).getTime())) errors.push("Consent verification date is invalid");
  return errors;
}

export function createPublicationSlug(title) {
  return String(title || "").normalize("NFKD").toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110) || "publication";
}

export function canExposePublication(publication) {
  return Boolean(publication && publication.status === "published" &&
    !(publication.identifiablePeople && publication.consentStatus !== "verified") &&
    publication.consentStatus !== "withdrawn");
}
