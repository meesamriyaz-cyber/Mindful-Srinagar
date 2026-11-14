import { createHash } from "node:crypto";
import { mediaUploadLimits } from "./env.js";

const IMAGE_FORMATS = ["jpg", "jpeg", "png", "webp"];
const VIDEO_FORMATS = ["mp4", "webm"];
const MEDIA_FOLDER = "mindful/media";

export function getCloudinaryConfig(env = process.env) {
  const cloudName = String(env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(env.CLOUDINARY_API_SECRET || "").trim();
  if (!cloudName || !apiKey || !apiSecret) {
    const error = new Error("Media storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET on the server.");
    error.statusCode = 503;
    throw error;
  }
  if (!/^[a-z0-9-]+$/i.test(cloudName) || !/^[0-9]+$/.test(apiKey)) {
    const error = new Error("Cloudinary configuration is invalid");
    error.statusCode = 503;
    throw error;
  }
  return { cloudName, apiKey, apiSecret };
}

export function signCloudinaryParams(params, apiSecret) {
  const canonical = Object.keys(params).filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .sort().map((key) => key + "=" + (Array.isArray(params[key]) ? params[key].join(",") : String(params[key]))).join("&");
  return createHash("sha1").update(canonical + apiSecret, "utf8").digest("hex");
}

export function createUploadSignature(resourceType, { env = process.env, now = () => Math.floor(Date.now() / 1000) } = {}) {
  if (!["image", "video"].includes(resourceType)) {
    const error = new Error("Select a supported image or video resource type");
    error.statusCode = 400;
    throw error;
  }
  const config = getCloudinaryConfig(env);
  const limits = mediaUploadLimits(env);
  const formats = resourceType === "image" ? IMAGE_FORMATS : VIDEO_FORMATS;
  const params = { timestamp: now(), folder: MEDIA_FOLDER, allowed_formats: formats.join(",") };
  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    resourceType,
    folder: MEDIA_FOLDER,
    timestamp: params.timestamp,
    signature: signCloudinaryParams(params, config.apiSecret),
    allowedFormats: formats,
    maxBytes: resourceType === "image" ? limits.imageMaxBytes : limits.videoMaxBytes
  };
}

async function cloudinaryRequest(path, { method = "GET", body, env = process.env } = {}) {
  const config = getCloudinaryConfig(env);
  const url = "https://api.cloudinary.com/v1_1/" + config.cloudName + "/" + path;
  const headers = { Authorization: "Basic " + Buffer.from(config.apiKey + ":" + config.apiSecret).toString("base64") };
  let requestBody;
  if (body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    requestBody = new URLSearchParams(body);
  }
  const response = await fetch(url, { method, headers, body: requestBody });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || "Cloudinary request failed");
    error.statusCode = response.status === 404 ? 404 : 502;
    throw error;
  }
  return data;
}

export async function fetchCloudinaryAsset(publicId, resourceType, options = {}) {
  const query = new URLSearchParams();
  query.append("public_ids[]", publicId);
  query.set("max_results", "1");
  const data = await cloudinaryRequest("resources/" + resourceType + "/upload?" + query.toString(), options);
  return data.resources?.find((resource) => resource.public_id === publicId) || null;
}

export async function destroyCloudinaryAsset(publicId, resourceType, options = {}) {
  const data = await cloudinaryRequest("resources/" + resourceType + "/upload", {
    ...options,
    method: "POST",
    body: { "public_ids[]": publicId }
  });
  const result = data.deleted?.[publicId];
  if (result !== "deleted" && result !== "not_found") {
    const error = new Error("Cloudinary did not confirm media deletion");
    error.statusCode = 502;
    throw error;
  }
  return result;
}

export const mediaStoragePolicy = Object.freeze({ folder: MEDIA_FOLDER, imageFormats: IMAGE_FORMATS, videoFormats: VIDEO_FORMATS });
