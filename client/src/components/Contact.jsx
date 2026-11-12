import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Clock3, Mail, MapPin, MessageCircle, Phone, Send, UserRound } from "lucide-react";
import React, { useState } from "react";
import { createEnquiry } from "../lib/api.js";

const initialFeedback = { type: "", message: "" };

export function Contact() {
  const [feedback, setFeedback] = useState(initialFeedback);
  const [submitting, setSubmitting] = useState(false);
  const [preferredContact, setPreferredContact] = useState("whatsapp");

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const patientName = formData.get("patientName")?.toString().trim();
    const ageValue = formData.get("age")?.toString().trim();
    const patientAge = ageValue ? Number(ageValue) : undefined;
    const guardianName = formData.get("guardianName")?.toString().trim();
    const guardianRelationship = formData.get("guardianRelationship")?.toString().trim();
    const contactName = formData.get("contactName")?.toString().trim();
    const contactRelationship = formData.get("contactRelationship")?.toString();
    const phone = formData.get("phone")?.toString().trim();
    const source = formData.get("source")?.toString();
    const concern = formData.get("concern")?.toString().trim();
    const selectedContact = formData.get("preferredContact")?.toString();
    const urgency = formData.get("urgency")?.toString();
    const email = formData.get("email")?.toString().trim();
    const privacyConsent = formData.get("privacyConsent") === "on";

    if (!patientName || !contactName || !contactRelationship || !phone || !source || !concern ||
        !privacyConsent || (selectedContact === "email" && !email)) {
      setFeedback({ type: "error", message: "Please complete the required enquiry details and acknowledge the privacy notice." });
      return;
    }

    setSubmitting(true);
    setFeedback(initialFeedback);

    try {
      const response = await createEnquiry({
        patientName,
        ...(patientAge !== undefined ? { patientAge } : {}),
        ...(guardianName ? { guardianName } : {}),
        ...(guardianRelationship ? { guardianRelationship } : {}),
        contactName,
        contactRelationship,
        phone,
        source,
        concern,
        preferredContact: selectedContact,
        urgency,
        privacyConsent,
        ...(email ? { email } : {})
      });
      setFeedback({
        type: "success",
        message: response.message || "Thank you. The Mindful team will follow up with the next step."
      });
      form.reset();
      setPreferredContact("whatsapp");
    } catch (error) {
      setFeedback({
        type: "error",
        message: error.message || "We could not send the enquiry. Please call the centre directly."
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="section contact-section" id="contact">
      <div className="contact-copy">
        <p className="eyebrow">Contact</p>
        <h2>Tell us what support is needed.</h2>
        <p>
          Share a few details and the team will guide you to the right assessment or service.
        </p>
        <div className="booking-promises">
          <span><Clock3 size={16} /> Follow-up by 5 PM next weekday</span>
          <span><MessageCircle size={16} /> WhatsApp or phone follow-up</span>
          <span><CheckCircle2 size={16} /> Clear next step</span>
        </div>
      </div>
      <motion.form
        className="contact-form booking-form"
        aria-label="Assessment request form"
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.35 }}
      >
        <div className="booking-form-header">
          <span className="booking-icon"><UserRound size={19} /></span>
          <div>
            <strong>Assessment request</strong>
            <small>Patient details and the correct contact person help us avoid registration errors.</small>
          </div>
        </div>
        <div className="form-row">
          <label>
            Patient's full name
            <input name="patientName" placeholder="Person who needs support" maxLength={90} required />
          </label>
          <label>
            Patient's age (optional)
            <input name="age" type="number" min="0" max="120" placeholder="Age" />
          </label>
        </div>
        <div className="form-row">
          <label>
            Parent / guardian name (if applicable)
            <input name="guardianName" placeholder="Guardian's full name" maxLength={90} />
          </label>
          <label>
            Relationship to patient
            <input name="guardianRelationship" placeholder="Parent, uncle, spouse..." maxLength={80} />
          </label>
        </div>
        <div className="form-row">
          <label>
            Person we should contact
            <input name="contactName" placeholder="Your full name" maxLength={90} required />
          </label>
          <label>
            Your relationship to the patient
            <select name="contactRelationship" defaultValue="self" required>
              <option value="self">Patient (self)</option>
              <option value="mother">Mother</option>
              <option value="father">Father</option>
              <option value="guardian">Legal guardian</option>
              <option value="relative">Other family member</option>
              <option value="caregiver">Caregiver</option>
              <option value="referrer">Professional referrer</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            Phone / WhatsApp
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+91 99000 00000"
              pattern="\+?[0-9\s()\-]{7,32}"
              required
            />
          </label>
          <label>
            How did you hear about us?
            <select name="source" defaultValue="" required>
              <option value="" disabled>Choose source</option>
              <option value="hospital">Hospital</option>
              <option value="doctor">Doctor</option>
              <option value="school">School</option>
              <option value="ngo">NGO</option>
              <option value="walk-in">Walk-in / family</option>
              <option value="online">Website enquiry</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            Urgency
            <select name="urgency" defaultValue="routine">
              <option value="routine">Routine assessment</option>
              <option value="soon">Need guidance soon</option>
              <option value="urgent">Urgent follow-up requested</option>
            </select>
          </label>
          <label>
            Preferred contact
            <select
              name="preferredContact"
              value={preferredContact}
              onChange={(event) => setPreferredContact(event.target.value)}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="phone">Phone call</option>
              <option value="email">Email</option>
            </select>
          </label>
        </div>
        <label>
          Email {preferredContact === "email" ? "(required)" : "(optional)"}
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            required={preferredContact === "email"}
          />
        </label>
        <label>
          Primary concern
          <textarea
            name="concern"
            placeholder="Briefly describe the concern, age/context, current diagnosis or referral note."
            maxLength={1600}
            required
          />
        </label>
        <label className="privacy-consent">
          <input name="privacyConsent" type="checkbox" required />
          <span>
            I agree that Mindful may use these details to respond to this enquiry and coordinate the requested assessment. I understand I can contact the centre to ask about or correct the information provided.
          </span>
        </label>
        <button className="primary-button full" type="submit" disabled={submitting}>
          <Send size={18} />
          {submitting ? "Sending..." : "Request assessment guidance"}
        </button>
        <AnimatePresence>
          {feedback.message && (
            <motion.div
              className={`form-status ${feedback.type === "error" ? "error-status" : "success-status"}`}
              aria-live="polite"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              {feedback.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
              <span>{feedback.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.form>
      <div className="contact-strip">
        <a href="tel:+919906897822"><Phone size={18} /> (+91) 9906897822</a>
        <a href="mailto:mrcsgr2025@gmail.com"><Mail size={18} /> mrcsgr2025@gmail.com</a>
        <span><MapPin size={18} /> Owaisabad Gousia Colony Bemina Srinagar-UT J&K-190018</span>
      </div>
    </section>
  );
}
