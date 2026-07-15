import { ClipboardList, FileText, HeartPulse, IndianRupee, PackageCheck, UsersRound } from "lucide-react";
import React from "react";
import { departments } from "../data/centreData.js";

const icons = [UsersRound, HeartPulse, ClipboardList, IndianRupee, PackageCheck, FileText];

export function Operations() {
  return (
    <section className="section operations-section" id="operations">
      <div className="section-heading">
        <p className="eyebrow">Complete centre solution</p>
        <h2>Day-to-day modules for reception, clinicians, referral tracking and management.</h2>
      </div>
      <div className="department-grid">
        {departments.map((department, index) => {
          const Icon = icons[index];
          return (
            <article className="department-card" key={department.name}>
              <Icon size={24} />
              <h3>{department.name}</h3>
              <p>{department.owner}</p>
              <strong>{department.metric}</strong>
            </article>
          );
        })}
      </div>
    </section>
  );
}
