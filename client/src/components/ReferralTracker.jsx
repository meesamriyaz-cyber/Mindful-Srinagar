import { Building2, PhoneForwarded } from "lucide-react";
import React from "react";
import { referralPipeline } from "../data/centreData.js";

export function ReferralTracker() {
  const total = referralPipeline.reduce((sum, item) => sum + item.count, 0);

  return (
    <section className="section referral-section" id="referrals">
      <div className="referral-copy">
        <p className="eyebrow">Referral tracking</p>
        <h2>Know exactly which hospital, school, NGO or doctor sent each patient.</h2>
        <p>
          The system keeps referral source, contact person, patient concern, assigned coordinator, follow-up date and
          conversion status in one place.
        </p>
        <div className="callout">
          <Building2 size={22} />
          <span>{total} open referral records across outreach channels</span>
        </div>
      </div>
      <div className="pipeline">
        {referralPipeline.map((item) => (
          <article className="pipeline-row" key={item.source}>
            <div>
              <strong>{item.source}</strong>
              <span>{item.stage}</span>
            </div>
            <div className="pipeline-meter" aria-label={`${item.source} referral volume`}>
              <span style={{ width: `${(item.count / total) * 100}%`, background: item.color }} />
            </div>
            <b>{item.count}</b>
          </article>
        ))}
        <a className="primary-button full" href="#contact">
          <PhoneForwarded size={18} />
          Add referral enquiry
        </a>
      </div>
    </section>
  );
}
