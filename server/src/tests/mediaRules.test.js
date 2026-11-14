import test from "node:test";
import assert from "node:assert/strict";
import { createUploadSignature, signCloudinaryParams } from "../config/cloudinary.js";
import { mediaUploadLimits, validateRuntimeEnv } from "../config/env.js";
import {
  canExposePublication,
  createPublicationSlug,
  validateEditorDocument,
  validateMediaMetadata,
  validateMediaResource,
  validatePublicationPayload
} from "../security/mediaRules.js";

const cloudinaryEnv = {
  CLOUDINARY_CLOUD_NAME: "mindful-demo",
  CLOUDINARY_API_KEY: "123456789",
  CLOUDINARY_API_SECRET: "test-secret",
  MEDIA_IMAGE_MAX_BYTES: "10485760",
  MEDIA_VIDEO_MAX_BYTES: "262144000"
};

test("media upload limits use defaults and reject invalid configuration", () => {
  assert.deepEqual(mediaUploadLimits({}), {
    imageMaxBytes: 10 * 1024 * 1024,
    videoMaxBytes: 250 * 1024 * 1024,
    imageBatchLimit: 20,
    videoBatchLimit: 3
  });
  assert.throws(() => mediaUploadLimits({ MEDIA_IMAGE_MAX_BYTES: "NaN" }), /MEDIA_IMAGE_MAX_BYTES/);
  const baseEnv = { MONGO_URI: "mongodb://127.0.0.1:27017/mindful_test", JWT_SECRET: "a".repeat(48) };
  assert.equal(validateRuntimeEnv(baseEnv).valid, true, "Cloudinary must remain optional for non-media server workflows");
  assert.equal(validateRuntimeEnv({ ...baseEnv, MEDIA_VIDEO_MAX_BYTES: "0" }).valid, false);
});

test("Cloudinary signatures are deterministic and do not expose the API secret", () => {
  const signature = createUploadSignature("image", { env: cloudinaryEnv, now: () => 1700000000 });
  assert.equal(signature.timestamp, 1700000000);
  assert.equal(signature.folder, "mindful/media");
  assert.deepEqual(signature.signedParams, { timestamp: 1700000000, folder: "mindful/media", allowed_formats: "jpg,jpeg,png,webp" });
  assert.equal(signature.maxBatchCount, 20);
  assert.deepEqual(signature.allowedFormats, ["jpg", "jpeg", "png", "webp"]);
  assert.equal(signature.maxBytes, 10485760);
  assert.equal(signature.signature, signCloudinaryParams({
    timestamp: 1700000000,
    folder: "mindful/media",
    allowed_formats: "jpg,jpeg,png,webp"
  }, cloudinaryEnv.CLOUDINARY_API_SECRET));
  assert.equal(Object.hasOwn(signature, "apiSecret"), false);
  assert.throws(() => createUploadSignature("raw", { env: cloudinaryEnv }), /supported image or video/);
  assert.throws(() => createUploadSignature("image", { env: {} }), (error) => error.statusCode === 503);
});

test("uploaded media must match the signed resource policy", () => {
  const image = {
    asset_id: "asset-1",
    public_id: "mindful/media/photo-1",
    asset_folder: "mindful/media",
    resource_type: "image",
    type: "upload",
    secure_url: "https://res.cloudinary.com/mindful-demo/image/upload/photo-1.jpg",
    format: "jpg",
    width: 1600,
    height: 900,
    bytes: 900000
  };
  assert.equal(validateMediaResource(image, "image", cloudinaryEnv), null);
  assert.match(validateMediaResource({ ...image, public_id: "other/photo", asset_folder: "other" }, "image", cloudinaryEnv), /approved Mindful media folder/);
  assert.equal(validateMediaResource({ ...image, public_id: "photo-2", asset_folder: "mindful/media" }, "image", cloudinaryEnv), null);
  assert.match(validateMediaResource({ ...image, format: "svg" }, "image", cloudinaryEnv), /format is not supported/);
  assert.match(validateMediaResource({ ...image, bytes: 12000000 }, "image", cloudinaryEnv), /size limit/);
  assert.match(validateMediaResource({ ...image, resource_type: "video" }, "image", cloudinaryEnv), /does not match/);
});

test("media metadata enforces consent review and safe field bounds", () => {
  assert.match(validateMediaMetadata({ identifiablePeople: true, consentStatus: "not-required" })[0], /consent review/);
  assert.deepEqual(validateMediaMetadata({ identifiablePeople: true, consentStatus: "pending" }), []);
  assert.match(validateMediaMetadata({
    identifiablePeople: true,
    consentStatus: "verified",
    consentScope: "website",
    consentVerifiedAt: "2026-11-14T10:00:00Z"
  })[0], /non-sensitive consent reference/);
  assert.match(validateMediaMetadata({ consentStatus: "verified" })[0], /verification date/);
  assert.deepEqual(validateMediaMetadata({ identifiablePeople: true, consentStatus: "verified", consentScope: "website", consentNotes: "Signed consent form recorded by Director", consentVerifiedAt: "2026-11-14T10:00:00Z" }), []);
  assert.match(validateMediaMetadata({ title: "x".repeat(121) })[0], /title/);
});

test("rich-text documents are reduced to a strict safe node and mark allowlist", () => {
  const result = validateEditorDocument({
    type: "doc",
    content: [{
      type: "paragraph",
      content: [
        { type: "text", text: "Mindful", marks: [{ type: "bold" }] },
        { type: "text", text: " website", marks: [{ type: "link", attrs: { href: "https://mindful.example.org" } }] }
      ]
    }]
  });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.document.content[0].content[0].marks, [{ type: "bold" }]);
  assert.match(validateEditorDocument({
    type: "doc",
    content: [{ type: "text", text: "bad", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }]
  }).error, /HTTP, HTTPS or mailto/);
  assert.match(validateEditorDocument({ type: "doc", content: [{ type: "rawHTML" }] }).error, /unsupported editor node/);
});

test("publication payloads require valid types and safe editor documents", () => {
  const valid = {
    title: "Community Awareness Workshop",
    type: "news",
    body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "An update" }] }] }
  };
  assert.deepEqual(validatePublicationPayload(valid, { creating: true }), []);
  assert.match(validatePublicationPayload({ ...valid, body: "<script>alert(1)</script>" }, { creating: true })[0], /rich-text editor document/);
  assert.match(validatePublicationPayload({ ...valid, type: "private" }, { creating: true })[0], /Publication type/);
  assert.match(validatePublicationPayload({
    ...valid,
    identifiablePeople: true,
    consentStatus: "verified",
    consentScope: "internal-only",
    consentNotes: "Consent record",
    consentVerifiedAt: "2026-11-14T10:00:00Z"
  }, { creating: true })[0], /public website use/);
});

test("publication slugs and public visibility respect consent and workflow state", () => {
  assert.equal(createPublicationSlug("Mindful Centre — Community Event!"), "mindful-centre-community-event");
  assert.equal(canExposePublication({ status: "published", identifiablePeople: false, consentStatus: "not-required" }), true);
  assert.equal(canExposePublication({ status: "draft", identifiablePeople: false, consentStatus: "not-required" }), false);
  assert.equal(canExposePublication({ status: "published", identifiablePeople: true, consentStatus: "pending" }), false);
  assert.equal(canExposePublication({ status: "published", identifiablePeople: true, consentStatus: "verified", consentScope: "website" }), true);
  assert.equal(canExposePublication({ status: "published", identifiablePeople: true, consentStatus: "verified", consentScope: "internal-only" }), false);
  assert.equal(canExposePublication({ status: "published", identifiablePeople: false, consentStatus: "withdrawn" }), false);
});
