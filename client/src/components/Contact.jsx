import { Mail, MapPin, Phone } from "lucide-react";
import React, { useState } from "react";
import { createEnquiry } from "../lib/api.js";

export function Contact() {
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const name = formData.get("name")?.toString().trim();
    const phone = formData.get("phone")?.toString().trim();
    const source = formData.get("source")?.toString();
    const concern = formData.get("concern")?.toString().trim();

    if (!name || !phone || !source || !concern) {
      setStatus("Please complete the required enquiry details.");
      return;
    }

    setSubmitting(true);
    setStatus("");

    try {
      await createEnquiry({ name, phone, source, concern });
      setStatus("Enquiry received. Reception can now follow up from the referral list.");
      form.reset();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="section contact-section" id="contact">
      <div>
        <p className="eyebrow">Contact</p>
        <h2>Book an assessment or send a referral to Mindful.</h2>
        <p>
          Reception can create a patient file, attach the source referral, schedule the first assessment and move the
          case into active care once the plan is approved.
        </p>
      </div>
      <form className="contact-form" onSubmit={handleSubmit}>
        <label>
          Patient or guardian name
          <input name="name" placeholder="Full name" required />
        </label>
        <label>
          Phone
          <input name="phone" placeholder="+91" required />
        </label>
        <label>
          Referral source
          <select name="source" defaultValue="" required>
            <option value="" disabled>Choose source</option>
            <option value="hospital">Hospital</option>
            <option value="doctor">Doctor</option>
            <option value="school">School</option>
            <option value="ngo">NGO</option>
            <option value="walk-in">Walk-in</option>
          </select>
        </label>
        <label>
          Primary concern
          <textarea name="concern" placeholder="Briefly describe the concern" required />
        </label>
        <button className="primary-button full" type="submit" disabled={submitting}>
          {submitting ? "Creating enquiry..." : "Create enquiry"}
        </button>
        {status && <p className="form-status" aria-live="polite">{status}</p>}
      </form>
      <div className="contact-strip">
        <a href="tel:+919906897822"><Phone size={18} /> (+91) 9906897822</a>
        <a href="mailto:mrcsgr2025@gmail.com"><Mail size={18} /> mrcsgr2025@gmail.com</a>
        <span><MapPin size={18} /> Owaisabad Gousia Colony Bemina Srinagar-UT J&K-190018</span>
      </div>
    </section>
  );
}
