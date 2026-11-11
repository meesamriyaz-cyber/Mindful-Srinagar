import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  ClipboardCheck,
  FileText,
  HeartPulse,
  IndianRupee,
  Plus,
  Save,
  UserRoundPlus,
  X
} from "lucide-react";
import {
  listAssessments,
  listTreatmentPlans,
  listProgressNotes,
  listPrescriptions,
  listRecords,
  createAssessment,
  createTreatmentPlan,
  createProgressNote,
  createPrescription,
  API_BASE_URL,
  listClinicalAmendments
} from "../lib/api.js";

const STEP_ICONS = {
  referral: UserRoundPlus,
  appointments: CalendarClock,
  assessments: ClipboardCheck,
  "treatment-plans": FileText,
  "progress-notes": ClipboardList,
  prescriptions: HeartPulse,
  invoices: IndianRupee
};

const STEP_LABELS = {
  referral: "Enquiry",
  appointments: "Appointments",
  assessments: "Assessment",
  "treatment-plans": "Treatment Plan",
  "progress-notes": "Progress Notes",
  prescriptions: "Prescription",
  invoices: "Billing"
};

const CREATE_FIELDS = {
  assessments: [
    { name: "domains", label: "Domains", type: "text", placeholder: "Speech, Language, Social..." },
    { name: "findings", label: "Findings", type: "textarea" },
    { name: "recommendations", label: "Recommendations", type: "textarea" },
    { name: "status", label: "Status", type: "select", options: ["draft", "completed"] }
  ],
  "treatment-plans": [
    { name: "goals", label: "Goals", type: "textarea" },
    { name: "interventions", label: "Interventions (comma-separated)", type: "text" },
    { name: "frequency", label: "Frequency", type: "text", placeholder: "Weekly" },
    { name: "duration", label: "Duration", type: "text", placeholder: "45 minutes" },
    { name: "status", label: "Status", type: "select", options: ["planned", "active", "completed", "on-hold"] }
  ],
  "progress-notes": [
    { name: "noteType", label: "Note Type", type: "select", options: ["session", "review", "incident"] },
    { name: "subjective", label: "Subjective", type: "textarea" },
    { name: "objective", label: "Objective", type: "textarea" },
    { name: "assessment", label: "Assessment", type: "textarea" },
    { name: "plan", label: "Plan", type: "textarea" }
  ],
  prescriptions: [
    { name: "medications", label: "Medications (JSON array)", type: "textarea", placeholder: '[{"name":"...","dosage":"...","frequency":"...","duration":"...","instructions":"..."}]' },
    { name: "notes", label: "Notes", type: "textarea" },
    { name: "status", label: "Status", type: "select", options: ["active", "completed", "cancelled"] }
  ]
};

const CREATE_FNS = {
  assessments: createAssessment,
  "treatment-plans": createTreatmentPlan,
  "progress-notes": createProgressNote,
  prescriptions: createPrescription
};

export function PatientJourney({ patient, token, userRole, onClose, onDischarge, onRefresh }) {
  const [data, setData] = useState({
    referral: null,
    appointments: [],
    assessments: [],
    treatmentPlans: [],
    progressNotes: [],
    prescriptions: [],
    invoices: []
  });
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(() => ["doctor", "therapist"].includes(userRole) ? "appointments" : "referral");
  const [showDischarge, setShowDischarge] = useState(false);
  const [dischargeForm, setDischargeForm] = useState({ summary: "", reason: "" });
  const [discharging, setDischarging] = useState(false);
  const [dischargeError, setDischargeError] = useState("");
  const [createStep, setCreateStep] = useState(null);
  const [createForm, setCreateForm] = useState({});
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [journeyKey, setJourneyKey] = useState(0);
  const [auditRecordId, setAuditRecordId] = useState(null);
  const [auditHistory, setAuditHistory] = useState([]);
  const [auditError, setAuditError] = useState("");

  useEffect(() => {
    if (!patient || !token) return;
    let active = true;
    setLoading(true);

    async function loadJourney() {
      try {
        const canViewClinical = ["director", "admin", "doctor", "therapist"].includes(userRole);
        const canViewReferral = ["director", "admin", "reception", "coordinator"].includes(userRole);
        const canViewPrescriptions = ["director", "admin", "doctor"].includes(userRole);
        const canViewBilling = ["director", "admin", "accounts", "reception"].includes(userRole);
        const [referral, appointments, assessments, treatmentPlans, progressNotes, prescriptions, invoices] = await Promise.all([
          canViewReferral && patient.referral ? fetch(`${API_BASE_URL}/referrals/${patient.referral}`, {
            headers: { Authorization: `Bearer ${token}` }
          }).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
          listRecords("appointments", { token, patientId: patient._id, limit: 20 }),
          canViewClinical ? listAssessments({ token, patientId: patient._id, limit: 20 }) : Promise.resolve([]),
          canViewClinical ? listTreatmentPlans({ token, patientId: patient._id, limit: 20 }) : Promise.resolve([]),
          canViewClinical ? listProgressNotes({ token, patientId: patient._id, limit: 20 }) : Promise.resolve([]),
          canViewPrescriptions ? listPrescriptions({ token, patientId: patient._id, limit: 20 }) : Promise.resolve([]),
          canViewBilling ? listRecords("invoices", { token, patientId: patient._id, limit: 20 }) : Promise.resolve([])
        ]);
        if (active) {
          setData({
            referral,
            appointments: appointments || [],
            assessments: assessments || [],
            treatmentPlans: treatmentPlans || [],
            progressNotes: progressNotes || [],
            prescriptions: prescriptions || [],
            invoices: invoices || []
          });
          setLoading(false);
        }
      } catch {
        if (active) setLoading(false);
      }
    }

    loadJourney();
    return () => { active = false; };
  }, [patient, token, journeyKey, userRole]);

  const canViewClinical = ["director", "admin", "doctor", "therapist"].includes(userRole);
  const canViewReferral = ["director", "admin", "reception", "coordinator"].includes(userRole);
  const canViewPrescriptions = ["director", "admin", "doctor"].includes(userRole);
  const canViewBilling = ["director", "admin", "accounts", "reception"].includes(userRole);
  const canDischarge = ["director", "admin", "reception", "coordinator"].includes(userRole);
  const steps = [...(canViewReferral ? ["referral"] : []), "appointments", ...(canViewClinical ? ["assessments", "treatment-plans", "progress-notes"] : []), ...(canViewPrescriptions ? ["prescriptions"] : []), ...(canViewBilling ? ["invoices"] : [])];
  const activeRecords = data[activeStep] || [];
  const isDischarged = patient?.status === "discharged";
  const canCreate = ["assessments", "treatment-plans", "progress-notes", "prescriptions"].includes(activeStep);

  function formatDate(val) {
    if (!val) return "--";
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(val));
  }

  function formatDateTime(val) {
    if (!val) return "--";
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    }).format(new Date(val));
  }

  function parseValue(type, value) {
    if (type === "textarea" && value && value.startsWith("[") && value.endsWith("]")) {
      try { return JSON.parse(value); } catch { return value; }
    }
    return value;
  }

  function openCreate() {
    setCreateForm({ patient: patient._id });
    setCreateError("");
    setCreateStep(activeStep);
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    setCreateSaving(true);
    setCreateError("");
    try {
      const fields = CREATE_FIELDS[createStep] || [];
      const payload = { patient: patient._id };
      fields.forEach(f => {
        let val = parseValue(f.type, createForm[f.name] || "");
        if (f.name === "interventions" && typeof val === "string") {
          val = val.split(",").map(s => s.trim()).filter(Boolean);
        }
        payload[f.name] = val;
      });
      const createFn = CREATE_FNS[createStep];
      if (createFn) {
        await createFn(payload, { token });
      }
      setCreateStep(null);
      setCreateForm({});
      setJourneyKey(k => k + 1);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreateSaving(false);
    }
  }

  function describeRecord(record) {
    if (activeStep === "referral") {
      return (
        <div>
          <p><strong>Source:</strong> {record?.sourceName} ({record?.sourceType})</p>
          <p><strong>Contact:</strong> {record?.phone} {record?.email && <span>/ {record?.email}</span>}</p>
          <p><strong>Urgency:</strong> {record?.urgency}</p>
          <p><strong>Concern:</strong> {record?.concern}</p>
          <p><strong>Preferred contact:</strong> {record?.preferredContact}</p>
        </div>
      );
    }
    if (activeStep === "appointments") {
      return (
        <div>
          <p><strong>Service:</strong> {record?.service}</p>
          <p><strong>Practitioner:</strong> {record?.practitioner?.name || "Not assigned"}</p>
          <p><strong>Room:</strong> {record?.room || "Not set"}</p>
          <p><strong>Status:</strong> {record?.status}</p>
        </div>
      );
    }
    if (activeStep === "assessments") {
      return (
        <div>
          <p><strong>Domains:</strong> {(record?.domains || []).join(", ")}</p>
          <p><strong>Findings:</strong> {record?.findings}</p>
          <p><strong>Recommendations:</strong> {record?.recommendations}</p>
        </div>
      );
    }
    if (activeStep === "treatment-plans") {
      return (
        <div>
          <p><strong>Goals:</strong> {record?.goals}</p>
          <p><strong>Interventions:</strong> {(record?.interventions || []).join(", ")}</p>
          <p><strong>Frequency:</strong> {record?.frequency} | <strong>Duration:</strong> {record?.duration}</p>
        </div>
      );
    }
    if (activeStep === "progress-notes") {
      return (
        <div>
          <p><strong>Subjective:</strong> {record?.subjective}</p>
          <p><strong>Objective:</strong> {record?.objective}</p>
          <p><strong>Assessment:</strong> {record?.assessment}</p>
          <p><strong>Plan:</strong> {record?.plan}</p>
        </div>
      );
    }
    if (activeStep === "prescriptions") {
      return (
        <div>
          <p><strong>Medications:</strong></p>
          <ul>{(record?.medications || []).map((m, i) => (
            <li key={i}>{m.name} - {m.dosage} ({m.frequency}) for {m.duration}</li>
          ))}</ul>
          <p><strong>Notes:</strong> {record?.notes}</p>
        </div>
      );
    }
    if (activeStep === "invoices") {
      const subtotal = (record?.items || []).reduce((sum, item) => sum + (item.quantity || 0) * (item.rate || 0), 0);
      const total = Math.max(subtotal - (record?.discount || 0), 0);
      const due = Math.max(total - (record?.paidAmount || 0), 0);
      return (
        <div>
          <p><strong>Invoice No:</strong> {record?.invoiceNo}</p>
          <p><strong>Total:</strong> ₹{total.toLocaleString("en-IN")} | <strong>Paid:</strong> ₹{(record?.paidAmount || 0).toLocaleString("en-IN")} | <strong>Due:</strong> ₹{due.toLocaleString("en-IN")}</p>
          <p><strong>Status:</strong> {record?.status}</p>
        </div>
      );
    }
    return <p>{JSON.stringify(record)}</p>;
  }

  async function handleDischarge(e) {
    e.preventDefault();
    setDischarging(true);
    setDischargeError("");
    try {
      await onDischarge({
        dischargeDate: new Date(),
        dischargeSummary: dischargeForm.summary,
        dischargeReason: dischargeForm.reason,
        status: "discharged"
      });
      setShowDischarge(false);
    } catch (err) {
      setDischargeError(err.message || "Unable to discharge patient");
    } finally {
      setDischarging(false);
    }
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
          <div>
            <h3>Patient Journey & History</h3>
            <small>{patient?.fullName} (MRN: {patient?.mrn})</small>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {isDischarged && (
          <div className="journey-discharged-banner">
            <strong>Discharged</strong>
            <span>{patient.dischargeDate ? formatDate(patient.dischargeDate) : ""}</span>
            {patient.dischargeSummary && <p>{patient.dischargeSummary}</p>}
          </div>
        )}

        <div className="journey-steps">
          {steps.map((step) => {
            const Icon = STEP_ICONS[step];
            const selected = activeStep === step;
            const count = Array.isArray(data[step]) ? data[step].length : (data[step] ? 1 : 0);
            return (
              <button
                key={step}
                className={`journey-step ${selected ? "is-active" : ""}`}
                type="button"
                onClick={() => { setActiveStep(step); setCreateStep(null); }}
              >
                <Icon size={18} />
                <span>{STEP_LABELS[step]}</span>
                <small>{count}</small>
                {canCreate && activeStep === step && (
                  <button
                    className="journey-new-btn"
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openCreate(); }}
                    title={`New ${STEP_LABELS[step]}`}
                  >
                    <Plus size={14} />
                  </button>
                )}
              </button>
            );
          })}
        </div>

        <div className="journey-content">
          {createStep ? (
            <form onSubmit={handleCreateSubmit} className="journey-create-form">
              <h4>New {STEP_LABELS[createStep]}</h4>
              {createError && <p className="form-status error-status">{createError}</p>}
              {(CREATE_FIELDS[createStep] || []).map((field) => (
                <label key={field.name}>
                  {field.label}
                  {field.type === "textarea" ? (
                    <textarea
                      rows={4}
                      value={createForm[field.name] || ""}
                      onChange={(e) => setCreateForm({ ...createForm, [field.name]: e.target.value })}
                      placeholder={field.placeholder}
                      required
                    />
                  ) : field.type === "select" ? (
                    <select
                      value={createForm[field.name] || ""}
                      onChange={(e) => setCreateForm({ ...createForm, [field.name]: e.target.value })}
                      required
                    >
                      <option value="">Select...</option>
                      {field.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={createForm[field.name] || ""}
                      onChange={(e) => setCreateForm({ ...createForm, [field.name]: e.target.value })}
                      placeholder={field.placeholder}
                      required
                    />
                  )}
                </label>
              ))}
              <div className="modal-actions">
                <button className="primary-button" type="submit" disabled={createSaving}>
                  <Save size={16} /> {createSaving ? "Saving..." : "Create"}
                </button>
                <button className="secondary-button" type="button" onClick={() => setCreateStep(null)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : loading ? (
            <p className="empty-state">Loading journey...</p>
          ) : activeStep === "referral" && !data.referral ? (
            <p className="empty-state">No enquiry record linked to this patient.</p>
          ) : activeRecords.length === 0 ? (
            <p className="empty-state">No {STEP_LABELS[activeStep].toLowerCase()} recorded yet.</p>
          ) : (
            <div className="journey-list">
              {(activeStep === "referral" ? [data.referral] : activeRecords).map((record, idx) => (
                <div key={record?._id || idx} className="journey-card">
                  <div className="journey-card-header">
                    <strong>{STEP_LABELS[activeStep]} Record</strong>
                    <span>{formatDateTime(record?.createdAt)}</span>
                    {record?.status && <mark className={["completed", "active", "paid", "converted", "ready"].includes(record.status) ? "good" : ""}>{record.status}</mark>}
                  </div>
                  <div className="journey-card-body">
                    {describeRecord(record)}
                    {["assessments", "treatment-plans", "progress-notes", "prescriptions"].includes(activeStep) && (
                      <button className="secondary-button" type="button" onClick={async () => {
                        try {
                          setAuditError("");
                          const history = await listClinicalAmendments(activeStep, record._id, { token });
                          setAuditHistory(history || []);
                          setAuditRecordId(record._id);
                        } catch (error) { setAuditError(error.message); }
                      }}>View amendment history</button>
                    )}
                    {auditRecordId === record._id && (
                      <div className="journey-audit-history">
                        <strong>Amendment history</strong>
                        {auditHistory.length ? auditHistory.map(item => (
                          <div key={item._id}>
                            <p>{item.reason}</p>
                            <small>{item.amendedBy?.name || "Authorised staff"} · {formatDateTime(item.createdAt)} · {item.changedFields.join(", ")}</small>
                            <pre>{JSON.stringify({ before: item.before, after: item.after }, null, 2)}</pre>
                          </div>
                        )) : <p>No amendments recorded.</p>}
                      </div>
                    )}
                    {auditError && <p className="form-status error-status">{auditError}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!isDischarged && !createStep && canDischarge && (
          <div className="journey-footer">
            <button className="primary-button" type="button" onClick={() => setShowDischarge(true)}>
              Discharge Patient
            </button>
          </div>
        )}

        <AnimatePresence>
          {showDischarge && (
            <motion.div
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDischarge(false)}
            >
              <motion.div
                className="modal"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h3>Discharge {patient?.fullName}</h3>
                  <button className="icon-button" type="button" onClick={() => setShowDischarge(false)}>
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleDischarge} className="clinical-form">
                  {dischargeError && <p className="form-status error-status">{dischargeError}</p>}
                  <label>
                    Discharge Summary
                    <textarea
                      rows={4}
                      value={dischargeForm.summary}
                      onChange={(e) => setDischargeForm({ ...dischargeForm, summary: e.target.value })}
                      placeholder="Final outcome, improvements, recommendations..."
                      required
                    />
                  </label>
                  <label>
                    Reason for Discharge
                    <input
                      type="text"
                      value={dischargeForm.reason}
                      onChange={(e) => setDischargeForm({ ...dischargeForm, reason: e.target.value })}
                      placeholder="Goals met, transferred, etc."
                      required
                    />
                  </label>
                  <div className="modal-actions">
                    <button className="primary-button" type="submit" disabled={discharging}>
                      Confirm Discharge
                    </button>
                    <button className="secondary-button" type="button" onClick={() => setShowDischarge(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
