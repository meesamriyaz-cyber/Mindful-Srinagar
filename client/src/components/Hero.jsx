import { ArrowRight, MapPin, ShieldCheck } from "lucide-react";
import React from "react";

export function Hero() {
  return (
    <section className="hero" id="home">
      <div className="hero-copy">
        <p className="eyebrow">Srinagar multidisciplinary rehabilitation centre</p>
        <h1>Mindful Centre for Rehabilitation Research & Trainings</h1>
        <p className="hero-lede">
          Integrated, therapeutic and rehabilitative care for children, adolescents and adults with developmental,
          communicative and physical challenges.
        </p>
        <div className="hero-actions">
          <a className="primary-button large" href="#contact">
            Start a patient file
            <ArrowRight size={19} />
          </a>
          <a className="secondary-button large" href="#operations">
            View centre workflow
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
      <div className="hero-panel" aria-label="Centre operations summary">
        <div className="panel-topline">
          <span>Today at Mindful</span>
          <strong>Live operations</strong>
        </div>
        <div className="flow-card checked">
          <span>01</span>
          <div>
            <strong>Register or import referral</strong>
            <p>Capture patient profile, guardian, source hospital, concern and documents.</p>
          </div>
        </div>
        <div className="flow-card">
          <span>02</span>
          <div>
            <strong>Schedule multidisciplinary care</strong>
            <p>Assign assessments, therapy rooms, clinicians and reminders.</p>
          </div>
        </div>
        <div className="flow-card">
          <span>03</span>
          <div>
            <strong>Track progress and billing</strong>
            <p>Record session notes, invoices, dues, inventory and management reports.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
