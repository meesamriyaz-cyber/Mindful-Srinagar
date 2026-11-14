import test from "node:test";
import assert from "node:assert/strict";
import { createGallerySlug, isGalleryAssetPublic, validateGalleryPayload } from "../controllers/galleryController.js";

test("gallery slugs are normalized and URL-safe", () => {
  assert.equal(createGallerySlug("Mindful Centre — Community Workshop!"), "mindful-centre-community-workshop");
  assert.equal(createGallerySlug("   "), "gallery");
});

test("gallery drafts enforce bounded title, description, date and media count", () => {
  assert.deepEqual(validateGalleryPayload({ title: "Centre Activities" }, true), []);
  assert.match(validateGalleryPayload({ title: "x" }, true)[0], /title/);
  assert.match(validateGalleryPayload({ title: "Valid title", description: "x".repeat(1201) })[0], /description/);
  assert.match(validateGalleryPayload({ eventDate: "not-a-date" })[0], /date/);
  assert.match(validateGalleryPayload({ mediaItems: Array.from({ length: 101 }, (_, index) => String(index)) })[0], /100 media assets/);
});

test("public gallery assets exclude archived, withdrawn and unapproved identifiable media", () => {
  assert.equal(isGalleryAssetPublic({ status: "ready", identifiablePeople: false, consentStatus: "not-required" }), true);
  assert.equal(isGalleryAssetPublic({ status: "archived", identifiablePeople: false, consentStatus: "not-required" }), false);
  assert.equal(isGalleryAssetPublic({ status: "ready", identifiablePeople: true, consentStatus: "pending" }), false);
  assert.equal(isGalleryAssetPublic({ status: "ready", identifiablePeople: true, consentStatus: "verified", consentScope: "internal-only" }), false);
  assert.equal(isGalleryAssetPublic({ status: "ready", identifiablePeople: true, consentStatus: "verified", consentScope: "website" }), true);
  assert.equal(isGalleryAssetPublic({ status: "ready", identifiablePeople: false, consentStatus: "withdrawn" }), false);
});
