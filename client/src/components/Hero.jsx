import { ArrowRight, MapPin, ShieldCheck } from "lucide-react";
import React, { useEffect, useState } from "react";
import { CelebrationConfetti } from "./CelebrationConfetti.jsx";
import { API_BASE_URL } from "../lib/api.js";

const careServices = [
  { slug: "psychology", title: "Psychology", description: "Mental health support" },
  { slug: "special-education", title: "Special Education", description: "Individual learning support" },
  { slug: "occupational-therapy", title: "Occupational Therapy", description: "Everyday skills and function" },
  { slug: "diagnostics", title: "Diagnostics", description: "Comprehensive assessments" },
  { slug: "audiology", title: "Audiology", description: "Hearing assessment and support" },
  { slug: "speech-therapy", title: "Speech Therapy", description: "Communication and language" },
  { slug: "physical-therapy", title: "Physical Therapy", description: "Movement and mobility" },
  { slug: "rehabilitation", title: "Rehabilitation", description: "Coordinated rehabilitation" },
  { slug: "vocational-training", title: "Vocational Training", description: "Skills for independence" }
];

export function Hero() {
  const [serviceImages, setServiceImages] = useState({});

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/public/media/care-services`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Care images unavailable")))
      .then((data) => { if (active) setServiceImages(data.services || {}); })
      .catch(() => { if (active) setServiceImages({}); });
    return () => { active = false; };
  }, []);

  return (
    <section className="hero" id="home">
      <CelebrationConfetti />
      <div className="hero-copy">
        <div className="hero-identity" aria-label="Mindful Centre for Rehabilitation Research and Training Foundation for Persons with Disabilities">
          <p className="hero-identity-name">Mindful</p>
          <p className="hero-identity-description">
            <span className="hero-identity-line">Centre for Rehabilitation Research &amp; Training Foundation</span>
            <span className="hero-identity-line">For <strong>Persons with Disabilities</strong>, <span className="hero-identity-location">Srinagar</span></span>
          </p>
        </div>
        <p className="hero-lede">
          One coordinated team for assessment, therapy, learning support and life skills for children, adolescents and
          adults with disabilities.
        </p>
        <div className="hero-actions">
          <a className="primary-button large" href="#contact">
            Book an assessment
            <ArrowRight size={19} />
          </a>
          <a className="secondary-button large" href="#operations">
            See our care process
          </a>
        </div>
        <div className="trust-row">
          <span>
            <ShieldCheck size={18} />
            Licensed rehab and clinical professionals
          </span>
          <span>
            <MapPin size={18} />
            Owaisabad Gousia Colony Bemina, Srinagar
          </span>
        </div>
        <div className="hero-location-map">
          <a
            className="hero-location-map-preview"
            href="https://www.google.com/maps/search/?api=1&query=Mindful%20Centre%2C%20Owaisabad%20Gousia%20Colony%2C%20Bemina%2C%20Srinagar%2C%20Jammu%20and%20Kashmir%20190018"
            target="_blank"
            rel="noreferrer"
            aria-label="Open Mindful Centre location in Google Maps in a new tab"
          >
            <iframe
              title="Map preview of Mindful Centre in Bemina, Srinagar"
              src="https://maps.google.com/maps?q=Mindful%20Centre%2C%20Owaisabad%20Gousia%20Colony%2C%20Bemina%2C%20Srinagar%2C%20Jammu%20and%20Kashmir%20190018&t=&z=14&ie=UTF8&iwloc=&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              tabIndex="-1"
            />
          </a>
          <a
            className="hero-location-map-link"
            href="https://www.google.com/maps/search/?api=1&query=Mindful%20Centre%2C%20Owaisabad%20Gousia%20Colony%2C%20Bemina%2C%20Srinagar%2C%20Jammu%20and%20Kashmir%20190018"
            target="_blank"
            rel="noreferrer"
          >
            View larger map <ArrowRight size={13} />
          </a>
        </div>
      </div>
      <div className="hero-visual hero-care-visual" aria-label="Mindful care services">
        <div className="hero-care-grid">
          {careServices.map((service) => {
            const media = serviceImages[service.slug];
            return (
              <article className={"hero-care-card" + (media?.secureUrl ? " has-image" : " is-placeholder")} key={service.slug}>
                {media?.secureUrl
                  ? <img src={media.secureUrl} alt={media.altText || service.title} loading="lazy" />
                  : <div className={"hero-care-placeholder hero-care-placeholder-" + service.slug} aria-hidden="true"><span>{service.title.split(" ").map((word) => word[0]).join("").slice(0, 2)}</span></div>}
                <div className="hero-care-card-caption">
                  <strong>{service.title}</strong>
                  <span>{service.description}</span>
                </div>
              </article>
            );
          })}
        </div>
        <div className="hero-metrics">
          <span><strong>9</strong> care services</span>
          <span><strong>1</strong> coordinated plan</span>
          <span><strong>Srinagar</strong> multidisciplinary team</span>
        </div>
      </div>
    </section>
  );
}
