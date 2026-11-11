import { z } from "zod";
import { Referral } from "../models/Referral.js";
import { Patient } from "../models/Patient.js";
import mongoose from "mongoose";

const enquirySchema = z.object({
  name: z.string().trim().min(2, "Please enter the patient or guardian name").max(90),
  phone: z.string()
    .trim()
    .min(7, "Please enter a valid phone or WhatsApp number")
    .max(32)
    .regex(/^\+?[0-9\s()-]+$/, "Please enter a valid phone or WhatsApp number"),
  email: z.string().trim().email("Please enter a valid email address").optional(),
  source: z.enum(["hospital", "doctor", "school", "ngo", "walk-in", "online", "other"]),
  concern: z.string().trim().min(10, "Please share a short note about the primary concern").max(1600),
  preferredContact: z.enum(["whatsapp", "phone", "email"]).default("whatsapp"),
  urgency: z.enum(["routine", "soon", "urgent"]).default("routine")
}).superRefine((data, context) => {
  if (data.preferredContact === "email" && !data.email) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["email"],
      message: "Please enter an email address for email follow-up"
    });
  }
});

const sourceLabels = {
  hospital: "Hospital enquiry",
  doctor: "Doctor referral",
  school: "School referral",
  ngo: "NGO referral",
  "walk-in": "Walk-in enquiry",
  online: "Online enquiry",
  other: "General enquiry"
};

export async function createEnquiry(req, res, next) {
  try {
    const parsed = enquirySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400);
      throw new Error(parsed.error.issues[0]?.message || "Please check the enquiry details");
    }

    const { name, phone, email, source, concern, preferredContact, urgency } = parsed.data;

    const referral = await Referral.create({
      sourceType: source,
      sourceName: sourceLabels[source],
      phone,
      ...(email ? { email } : {}),
      patientName: name,
      concern,
      preferredContact,
      urgency,
      status: "new",
      notes: `Preferred contact: ${preferredContact}. Urgency: ${urgency}.`
    });

    res.status(201).json({
      id: referral._id,
      message: "Thank you. Your enquiry has been received and the Mindful team will follow up."
    });
  } catch (error) {
    next(error);
  }
}


export async function convertReferralToPatient(req, res, next) {
  let claimedReferral;
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "A valid referral ID is required" });
    const referral = await Referral.findById(req.params.id);
    if (!referral) return res.status(404).json({ message: "Referral not found" });
    if (referral.status === "converted" || await Patient.exists({ referral: referral._id })) {
      return res.status(409).json({ message: "This referral has already been converted to a patient" });
    }
    const payload = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const allowed = ["fullName","guardianName","age","gender","phone","address","primaryConcern","services","status"];
    const unexpected = Object.keys(payload).filter((key) => !allowed.includes(key));
    if (unexpected.length) return res.status(400).json({ message: "Unsupported field: " + unexpected[0] });
    const fullName = String(payload.fullName || referral.patientName || "").trim();
    const phone = String(payload.phone || referral.phone || "").trim();
    const primaryConcern = String(payload.primaryConcern || referral.concern || "").trim();
    if (fullName.length < 2 || fullName.length > 120 || phone.length < 7 || phone.length > 32 || primaryConcern.length < 3) {
      return res.status(400).json({ message: "Patient name, valid phone and primary concern are required" });
    }
    const claim = await Referral.findOneAndUpdate(
      { _id: referral._id, status: { $ne: "converted" } },
      { $set: { status: "converted" } },
      { new: true }
    );
    if (!claim) return res.status(409).json({ message: "This referral is already being converted or has been converted" });
    claimedReferral = referral;
    const patient = await Patient.create({
      fullName, phone, primaryConcern,
      guardianName: payload.guardianName,
      age: payload.age === "" || payload.age == null ? undefined : Number(payload.age),
      gender: payload.gender || undefined,
      address: payload.address,
      services: Array.isArray(payload.services) ? payload.services : [],
      status: "assessment",
      referral: referral._id
    });
    return res.status(201).json(patient);
  } catch (error) {
    if (claimedReferral) {
      await Referral.updateOne(
        { _id: claimedReferral._id, status: "converted" },
        { $set: { status: claimedReferral.status } }
      ).catch(() => {});
    }
    return next(error);
  }
}
