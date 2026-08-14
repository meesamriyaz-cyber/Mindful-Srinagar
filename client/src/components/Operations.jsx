import { ArrowRight, CalendarCheck, ClipboardList, FileText, HeartPulse, PackageCheck, UsersRound } from "lucide-react";
import { motion } from "framer-motion";
import React, { useState } from "react";
import { departments } from "../data/centreData.js";

const icons = [UsersRound, HeartPulse, ClipboardList, CalendarCheck, PackageCheck, FileText];

const outcomes = ["Clear assessment path", "Coordinated therapy plan", "Family guidance", "Progress reviews"];

export function Operations() {
  const [activeStep, setActiveStep] = useState(0);
  const activeDepartment = departments[activeStep];

  return (
    <section className="section operations-section" id="operations">
      <div className="care-process-header">
        <div className="section-heading">
          <p className="eyebrow">Care process</p>
          <h2>Know what happens after you contact Mindful.</h2>
          <p>
            A simple pathway helps families and referral partners move from concern to assessment, therapy and progress
            review without confusion.
          </p>
        </div>
        <div className="care-outcomes">
          {outcomes.map((outcome) => (
            <span key={outcome}>{outcome}</span>
          ))}
        </div>
      </div>
      <div className="care-timeline">
        <div className="care-step-list" role="tablist" aria-label="Care process steps">
          {departments.map((department, index) => {
            const Icon = icons[index];
            const selected = activeStep === index;
            return (
              <button
                className={selected ? "care-step-card is-active" : "care-step-card"}
                key={department.name}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="care-step-panel"
                onClick={() => setActiveStep(index)}
              >
                <span className="care-step-number">{String(index + 1).padStart(2, "0")}</span>
                <Icon size={21} />
                <span className="care-step-name">{department.name}</span>
                <span className="care-step-owner">{department.owner}</span>
                {index < departments.length - 1 && <ArrowRight className="care-step-arrow" size={16} />}
              </button>
            );
          })}
        </div>
        <motion.article
          className="care-detail"
          id="care-step-panel"
          key={activeDepartment.name}
          role="tabpanel"
          aria-live="polite"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <span className="care-detail-kicker">Step {String(activeStep + 1).padStart(2, "0")} - {activeDepartment.owner}</span>
          <h3>{activeDepartment.name}</h3>
          <p>{activeDepartment.metric}</p>
          <a className="secondary-button" href="#contact">
            Start with an enquiry
            <CalendarCheck size={17} />
          </a>
        </motion.article>
      </div>
    </section>
  );
}
