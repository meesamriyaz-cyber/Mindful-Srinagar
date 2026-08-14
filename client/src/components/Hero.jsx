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
        <p className="eyebrow">Mindful Centre for Rehabilitation Research & Trainings, Srinagar</p>
        <h1>Rehabilitation care that helps people participate with confidence.</h1>
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
