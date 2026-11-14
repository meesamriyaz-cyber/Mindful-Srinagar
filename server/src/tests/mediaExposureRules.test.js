import test from "node:test";
import assert from "node:assert/strict";
import { canExposeMediaAsset } from "../security/mediaRules.js";

test("public media exposure excludes archived and withdrawn assets", () => {
  assert.equal(canExposeMediaAsset({ status: "ready", identifiablePeople: false, consentStatus: "not-required" }), true);
  assert.equal(canExposeMediaAsset({ status: "archived", identifiablePeople: false, consentStatus: "not-required" }), false);
  assert.equal(canExposeMediaAsset({ status: "ready", identifiablePeople: false, consentStatus: "withdrawn" }), false);
});

test("public media exposure requires verified website consent for identifiable people", () => {
  assert.equal(canExposeMediaAsset({ status: "ready", identifiablePeople: true, consentStatus: "pending", consentScope: "website" }), false);
  assert.equal(canExposeMediaAsset({ status: "ready", identifiablePeople: true, consentStatus: "verified", consentScope: "internal-only" }), false);
  assert.equal(canExposeMediaAsset({ status: "ready", identifiablePeople: true, consentStatus: "verified", consentScope: "website" }), true);
});
