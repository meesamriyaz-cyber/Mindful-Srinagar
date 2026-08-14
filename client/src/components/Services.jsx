import { CheckCircle2 } from "lucide-react";
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { services } from "../data/centreData.js";

const ServicesSpectrumScene = lazy(() =>
  import("./ServicesSpectrumScene.jsx").then((module) => ({ default: module.ServicesSpectrumScene }))
);

const serviceGroups = [
  {
    title: "Clinical assessment",
    note: "Understand needs clearly before therapy begins.",
    items: ["Psychology & Mental Health Support", "Comprehensive Diagnostic Evaluations", "Audiology & Hearing Assessments"]
  },
  {
    title: "Therapy and rehabilitation",
    note: "Build communication, movement, daily function and confidence.",
    items: ["Occupational Therapy", "Speech-Language Pathology", "Physical Therapy", "Advanced Rehabilitation Programs"]
  },
  {
    title: "Learning and life skills",
    note: "Support independence, dignity and participation beyond the clinic.",
    items: ["Special Education & Individualized Learning Plans", "Tailored Vocational Training & Job Placement"]
  }
];

export function Services() {
  const visualRef = useRef(null);
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    if (!visualRef.current || !("IntersectionObserver" in window)) {
      setSceneReady(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setSceneReady(true);
        observer.disconnect();
      }
    }, { rootMargin: "180px" });

    observer.observe(visualRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="section services-section" id="services">
      <div className="services-intro">
        <div className="section-heading">
          <p className="eyebrow">Our services</p>
          <h2>Multidisciplinary rehabilitation support under one coordinated care plan.</h2>
          <p>
            Assessments, therapy and training are aligned around the person, the family and the practical goal of
            independence, dignity and community participation.
          </p>
        </div>
        <div className="services-visual" ref={visualRef}>
          <div className="services-static-spectrum" aria-hidden={sceneReady}>
            <span>Assess</span>
            <span>Support</span>
            <span>Build independence</span>
          </div>
          {sceneReady && (
            <Suspense fallback={<div className="services-spectrum-scene services-spectrum-fallback" />}>
              <ServicesSpectrumScene />
            </Suspense>
          )}
          <div className="services-visual-copy">
            <strong>{services.length}</strong>
            <span>core services connected through one care pathway</span>
          </div>
        </div>
      </div>

      <div className="service-group-grid">
        {serviceGroups.map((group) => (
          <article className="service-group-card" key={group.title}>
            <h3>{group.title}</h3>
            <p>{group.note}</p>
            <ul>
              {group.items.map((service) => (
                <li key={service}>
                  <CheckCircle2 size={18} />
                  <span>{service}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
