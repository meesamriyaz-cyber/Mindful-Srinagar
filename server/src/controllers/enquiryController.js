import { z } from "zod";
import { Referral } from "../models/Referral.js";

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
