import { createUploadSignature, destroyCloudinaryAsset, fetchCloudinaryAsset, mediaStoragePolicy } from "../config/cloudinary.js";
import { validateMediaResource } from "../security/mediaRules.js";

export function createMediaUploadSignature(resourceType, options) {
  return createUploadSignature(resourceType, options);
}

export async function verifyUploadedMedia(publicId, resourceType, options = {}) {
  if (typeof publicId !== "string" || !publicId.trim() || publicId.length > 240 || publicId.includes("\\\\") || publicId.split("/").includes("..")) {
    const error = new Error("A valid asset from the Mindful media upload folder is required");
    error.statusCode = 400;
    throw error;
  }
  const resource = await fetchCloudinaryAsset(publicId, resourceType, options);
  if (!resource) {
    const error = new Error("The uploaded Cloudinary asset could not be verified");
    error.statusCode = 400;
    throw error;
  }
  const validationError = validateMediaResource(resource, resourceType, options.env || process.env);
  if (validationError) {
    if (Number(resource.bytes) > 0) {
      try { await destroyCloudinaryAsset(publicId, resourceType, options); } catch { /* Preserve the validation error; cleanup can be retried from Cloudinary. */ }
    }
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }
  return {
    assetId: resource.asset_id,
    publicId: resource.public_id,
    resourceType: resource.resource_type,
    secureUrl: resource.secure_url,
    format: resource.format,
    width: resource.width,
    height: resource.height,
    duration: resource.duration,
    bytes: Number(resource.bytes)
  };
}

export async function removeCloudinaryMedia(publicId, resourceType) {
  return destroyCloudinaryAsset(publicId, resourceType);
}
