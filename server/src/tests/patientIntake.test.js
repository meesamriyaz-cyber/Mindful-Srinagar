import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { enquirySchema, PRIVACY_NOTICE_VERSION } from "../controllers/enquiryController.js";
import { Referral } from "../models/Referral.js";
import { Patient } from "../models/Patient.js";

const validEnquiry = {
  patientName: "Aarav Ahmed",
  patientAge: 8,
  guardianName: "Riyaz Ahmed",
  guardianRelationship: "uncle",
  contactName: "Riyaz Ahmed",
  contactRelationship: "guardian",
  phone: "+91 99000 00000",
  source: "online",
  concern: "Speech and communication assessment requested.",
  preferredContact: "whatsapp",
  urgency: "routine",
  privacyConsent: true
};

test("public enquiry requires separate patient and contact identities", () => {
  const parsed = enquirySchema.safeParse(validEnquiry);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.patientName, "Aarav Ahmed");
  assert.equal(parsed.data.contactName, "Riyaz Ahmed");
  assert.equal(parsed.data.contactRelationship, "guardian");
});

test("public enquiry rejects missing or false privacy acknowledgement", () => {
  assert.equal(enquirySchema.safeParse({ ...validEnquiry, privacyConsent: false }).success, false);
  const { privacyConsent, ...withoutConsent } = validEnquiry;
  assert.equal(enquirySchema.safeParse(withoutConsent).success, false);
});

test("public enquiry requires a usable email when email is the preferred contact", () => {
  const parsed = enquirySchema.safeParse({ ...validEnquiry, preferredContact: "email" });
  assert.equal(parsed.success, false);
  assert.equal(parsed.error.issues.some((issue) => issue.path[0] === "email"), true);
  assert.equal(enquirySchema.safeParse({
    ...validEnquiry,
    preferredContact: "email",
    email: "family@example.com"
  }).success, true);
});

test("guardian relationship cannot be recorded without a guardian name", () => {
  const parsed = enquirySchema.safeParse({
    ...validEnquiry,
    guardianName: "",
    guardianRelationship: "uncle"
  });
  assert.equal(parsed.success, false);
  assert.equal(parsed.error.issues.some((issue) => issue.path[0] === "guardianName"), true);
});

test("enquiry validation bounds patient age and concern length", () => {
  assert.equal(enquirySchema.safeParse({ ...validEnquiry, patientAge: 121 }).success, false);
  assert.equal(enquirySchema.safeParse({ ...validEnquiry, patientAge: -1 }).success, false);
  assert.equal(enquirySchema.safeParse({ ...validEnquiry, concern: "short" }).success, false);
});

test("referral schema retains consent evidence and separate guardian/contact identities", async () => {
  const referral = new Referral({
    sourceType: "online",
    sourceName: "Online enquiry",
    patientName: "Aarav Ahmed",
    patientAge: 8,
    guardianName: "Riyaz Ahmed",
    guardianRelationship: "uncle",
    contactPerson: "Riyaz Ahmed",
    contactRelationship: "guardian",
    phone: "+91 99000 00000",
    concern: "Speech and communication assessment requested.",
    privacyConsent: true,
    privacyConsentAt: new Date(),
    privacyNoticeVersion: PRIVACY_NOTICE_VERSION
  });
  await referral.validate();
  assert.equal(referral.patientName, "Aarav Ahmed");
  assert.equal(referral.contactPerson, "Riyaz Ahmed");
  assert.equal(referral.guardianRelationship, "uncle");
  assert.equal(referral.privacyConsent, true);
  assert.equal(referral.privacyNoticeVersion, "2026-11-12-v1");
});

test("patient schema preserves guardian relationship and rejects invalid ages", async () => {
  const patient = new Patient({
    fullName: "Aarav Ahmed",
    guardianName: "Riyaz Ahmed",
    guardianRelationship: "uncle",
    age: 8,
    phone: "+91 99000 00000",
    primaryConcern: "Speech and communication assessment requested."
  });
  await patient.validate();
  assert.equal(patient.guardianRelationship, "uncle");

  const invalid = new Patient({
    fullName: "Aarav Ahmed",
    age: -1,
    phone: "+91 99000 00000",
    primaryConcern: "Speech and communication assessment requested."
  });
  await assert.rejects(invalid.validate(), (error) => Boolean(error.errors?.age));
});
