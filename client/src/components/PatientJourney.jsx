import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, FileText, ClipboardList, HeartPulse, ClipboardCheck } from "lucide-react";
import { listAssessments, listTreatmentPlans, listProgressNotes, listPrescriptions } from "../lib/api.js";

const STEP_ICONS = {
  assessments: ClipboardCheck,
  "treatment-plans": FileText,
  "progress-notes": ClipboardList,
  prescriptions: HeartPulse
};

const STEP_LABELS = {
  assessments: "Assessment",
  "treatment-plans": "Treatment Plan",
  "progress-notes": "Progress Notes",
  prescriptions: "Prescription"
};

export function PatientJourney({ patientId, token, onClose }) {
  const [data, setData] = useState({ assessments: [], treatmentPlans: [], progressNotes: [], prescriptions: [] });
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState("assessments");

  useEffect(() => {
    if (!patientId || !token) return;
    let active = true;
    setLoading(true);
    Promise.all([
      listAssessments({ token, patientId, limit: 20 }),
      listTreatmentPlans({ token, patientId, limit: 20 }),
      listProgressNotes({ token, patientId, limit: 20 }),
      listPrescriptions({ token, patientId, limit: 20 })
    ]).then(([assessments, treatmentPlans, progressNotes, prescriptions]) => {
      if (active) {
        setData({ assessments, treatmentPlans, progressNotes, prescriptions });
        setLoading(false);
      }
    }).catch(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [patientId, token]);

  const steps = ["assessments", "treatment-plans", "progress-notes", "prescriptions"];
  const activeRecords = data[activeStep] || [];

  function formatDate(val) {
    if (!val) return "--";
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(val));
  }

  function describeNote(record) {
    if (activeStep === "assessments") {
      return (
        <div>
          <p><strong>Domains:</strong> {(record.domains || []).join(", ")}</p>
          <p><strong>Findings:</strong> {record.findings}</p>
          <p><strong>Recommendations:</strong> {record.recommendations}</p>
        </div>
      );
    }
    if (activeStep === "treatment-plans") {
      return (
        <div>
          <p><strong>Goals:</strong> {record.goals}</p>
          <p><strong>Interventions:</strong> {(record.interventions || []).join(", ")}</p>
          <p><strong>Frequency:</strong> {record.frequency} | <strong>Duration:</strong> {record.duration}</p>
        </div>
      );
    }
    if (activeStep === "progress-notes") {
      return (
        <div>
          <p><strong>Subjective:</strong> {record.subjective}</p>
          <p><strong>Objective:</strong> {record.objective}</p>
          <p><strong>Assessment:</strong> {record.assessment}</p>
          <p><strong>Plan:</strong> {record.plan}</p>
        </div>
      );
    }
    if (activeStep === "prescriptions") {
      return (
        <div>
          <p><strong>Medications:</strong></p>
          <ul>{(record.medications || []).map((m, i) => (
            <li key={i}>{m.name} - {m.dosage} ({m.frequency}) for {m.duration}</li>
          ))}</ul>
          <p><strong>Notes:</strong> {record.notes}</p>
        </div>
      );
    }
    return <p>{JSON.stringify(record)}</p>;
  }

  return (
    <motion.div
      className="modal-overlay journey-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="modal journey-modal"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
      >
        <div className="modal-header">
          <h3>Patient Journey & History</h3>
          <button className="icon-button" type="button" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="journey-steps">
          {steps.map((step, idx) => {
            const Icon = STEP_ICONS[step];
            const selected = activeStep === step;
            const count = data[step]?.length || 0;
            return (
              <button
                key={step}
                className={`journey-step ${selected ? "is-active" : ""}`}
                type="button"
                onClick={() => setActiveStep(step)}
              >
                <Icon size={18} />
                <span>{STEP_LABELS[step]}</span>
                <small>{count}</small>
              </button>
            );
          })}
        </div>
        <div className="journey-content">
          {loading ? (
            <p className="empty-state">Loading journey...</p>
          ) : activeRecords.length === 0 ? (
            <p className="empty-state">No {STEP_LABELS[activeStep].toLowerCase()} recorded yet.</p>
          ) : (
            <div className="journey-list">
              {activeRecords.map((record) => (
                <div key={record._id} className="journey-card">
                  <div className="journey-card-header">
                    <strong>{STEP_LABELS[activeStep]} Record</strong>
                    <span>{formatDate(record.assessedAt || record.prescribedAt || record.notedAt)}</span>
                    {record.status && <mark className={record.status === "completed" || record.status === "active" ? "good" : ""}>{record.status}</mark>}
                  </div>
                  <div className="journey-card-body">
                    {describeNote(record)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
