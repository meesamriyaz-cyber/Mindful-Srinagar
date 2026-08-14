import { ArrowRight, Building2, GraduationCap, HeartHandshake, PhoneForwarded, Stethoscope } from "lucide-react";
import React from "react";

const audiences = [
  { label: "Families", icon: HeartHandshake },
  { label: "Hospitals and doctors", icon: Stethoscope },
  { label: "Schools and NGOs", icon: GraduationCap }
];

export function ReferralTracker() {
  return (
    <section className="section referral-section" id="referrals">
      <div className="referral-copy">
        <p className="eyebrow">Referrals and partnerships</p>
        <h2>One clear referral route for families and care partners.</h2>
        <p>
          Share the concern once. Mindful will help identify the right assessment, service and next step.
        </p>
        <div className="callout">
          <Building2 size={22} />
          <span>Referrals are welcome from hospitals, schools, NGOs, doctors and families.</span>
        </div>
      </div>
      <div className="referral-action">
        <div className="referral-audience">
          {audiences.map((audience) => {
            const Icon = audience.icon;
          return (
            <div className="referral-partner-card" key={audience.label}>
              <Icon size={22} />
              <strong>{audience.label}</strong>
            </div>
          );
          })}
        </div>
        <a className="primary-button" href="#contact">
          <PhoneForwarded size={18} />
          Send a referral enquiry
          <ArrowRight size={17} />
        </a>
      </div>
    </section>
  );
}
