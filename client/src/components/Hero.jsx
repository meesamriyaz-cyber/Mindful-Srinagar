import { ArrowRight, MapPin, ShieldCheck } from "lucide-react";
import React, { lazy, Suspense } from "react";
import { useDeferredMount } from "../hooks/useDeferredMount.js";

const ThreeOperationsScene = lazy(() =>
  import("./ThreeOperationsScene.jsx").then((module) => ({ default: module.ThreeOperationsScene }))
);

export function Hero() {
  const showScene = useDeferredMount({ delay: 450 });

  return (
    <section className="hero" id="home">
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
      <div className="hero-visual" aria-label="Centre operations summary">
        <div className={showScene ? "hero-visual-fallback is-hidden" : "hero-visual-fallback"}>
          <span>Psychology</span>
          <span>Speech therapy</span>
          <span>Physical therapy</span>
          <span>Special education</span>
        </div>
        {showScene && (
          <Suspense fallback={<div className="three-scene three-scene-fallback" />}>
            <ThreeOperationsScene />
          </Suspense>
        )}
        <div className="hero-metrics">
          <span><strong>9</strong> care services</span>
          <span><strong>1</strong> coordinated plan</span>
          <span><strong>Srinagar</strong> multidisciplinary team</span>
        </div>
      </div>
    </section>
  );
}
