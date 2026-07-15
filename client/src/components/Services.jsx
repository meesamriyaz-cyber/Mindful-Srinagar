import { CheckCircle2 } from "lucide-react";
import React from "react";
import { services } from "../data/centreData.js";

export function Services() {
  return (
    <section className="section services-section" id="services">
      <div className="section-heading">
        <p className="eyebrow">Our services</p>
        <h2>One centre, coordinated plans across therapy and rehabilitation.</h2>
      </div>
      <div className="service-grid">
        {services.map((service) => (
          <article className="service-card" key={service}>
            <CheckCircle2 size={21} />
            <span>{service}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
