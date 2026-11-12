import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccessibleDialog } from "../hooks/useAccessibleDialog.js";
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
  listRecordsPage,
  createAssessment,
  createTreatmentPlan,
  createProgressNote,
  createPrescription,
  API_BASE_URL,
  listClinicalAmendments,
  amendClinicalRecord,
  approveTreatmentPlan,
  approvePatientDischarge,
  closePatientDischarge
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
    { name: "assessmentType", label: "Assessment type", type: "select", options: ["initial", "review", "discharge"] },
    { name: "domains", label: "Domains", type: "text", placeholder: "Speech, Language, Social..." },
    { name: "findings", label: "Findings", type: "textarea" },
    { name: "recommendations", label: "Recommendations", type: "textarea" },
    { name: "status", label: "Status", type: "select", options: ["draft", "completed"] }
  ],
  "treatment-plans": [
    { name: "assessment", label: "Completed assessment", type: "assessment" },
    { name: "goals", label: "Goals", type: "textarea" },
    { name: "interventions", label: "Interventions (comma-separated)", type: "text" },
    { name: "frequency", label: "Frequency", type: "text", placeholder: "Weekly" },
    { name: "duration", label: "Duration", type: "text", placeholder: "45 minutes" },
    { name: "status", label: "Status", type: "select", options: ["planned"] }
  ],
  "progress-notes": [
    { name: "noteType", label: "Note Type", type: "select", options: ["session", "review", "incident"] },
    { name: "appointment", label: "Session appointment", type: "appointment" },
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
  const [pageInfo, setPageInfo] = useState({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [timelineError, setTimelineError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(() => ["doctor", "therapist"].includes(userRole) ? "appointments" : "referral");
  const [showDischarge, setShowDischarge] = useState(false);
  const [dischargeForm, setDischargeForm] = useState({ summary: "", reason: "", outcome: "", recommendations: "" });
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
  const [amendmentReason, setAmendmentReason] = useState("");
  const [amendmentJson, setAmendmentJson] = useState("{}");
  const [amendmentSaving, setAmendmentSaving] = useState(false);
  const [approvingPlanId, setApprovingPlanId] = useState("");
  const [planApprovalError, setPlanApprovalError] = useState("");
  const journeyDialogRef = useAccessibleDialog(true, onClose);
  const dischargeDialogRef = useAccessibleDialog(showDischarge, () => setShowDischarge(false));

  useEffect(() => {
    if (!patient || !token) return;
    let active = true;
    setLoading(true);
    setData({ referral: null, appointments: [], assessments: [], treatmentPlans: [], progressNotes: [], prescriptions: [], invoices: [] });
    setPageInfo({});
    setTimelineError("");

    async function loadJourney() {
      try {
        const canViewClinical = ["director", "admin", "doctor", "therapist"].includes(userRole);

        const canViewReferral = ["director", "admin", "reception", "coordinator"].includes(userRole);
        const canViewPrescriptions = ["director", "admin", "doctor"].includes(userRole);
        const canViewBilling = ["director", "admin", "accounts", "reception"].includes(userRole);
        const [referral, appointmentsPage, assessmentsPage, treatmentPlansPage, progressNotesPage, prescriptionsPage, invoicesPage] = await Promise.all([
          canViewReferral && patient.referral ? fetch(API_BASE_URL + "/referrals/" + patient.referral, {
            headers: { Authorization: "Bearer " + token }
          }).then((response) => response.ok ? response.json() : null).catch(() => null) : Promise.resolve(null),
          listRecordsPage("appointments", { token, patientId: patient._id, limit: 20 }),
          canViewClinical ? listRecordsPage("assessments", { token, patientId: patient._id, limit: 20 }) : Promise.resolve({ records: [], total: 0, hasMore: false, nextOffset: 0 }),
          canViewClinical ? listRecordsPage("treatment-plans", { token, patientId: patient._id, limit: 20 }) : Promise.resolve({ records: [], total: 0, hasMore: false, nextOffset: 0 }),
          canViewClinical ? listRecordsPage("progress-notes", { token, patientId: patient._id, limit: 20 }) : Promise.resolve({ records: [], total: 0, hasMore: false, nextOffset: 0 }),
          canViewPrescriptions ? listRecordsPage("prescriptions", { token, patientId: patient._id, limit: 20 }) : Promise.resolve({ records: [], total: 0, hasMore: false, nextOffset: 0 }),
          canViewBilling ? listRecordsPage("invoices", { token, patientId: patient._id, limit: 20 }) : Promise.resolve({ records: [], total: 0, hasMore: false, nextOffset: 0 })
        ]);
        if (active) {
          setData({
            referral,
            appointments: appointmentsPage.records,
            assessments: assessmentsPage.records,
            treatmentPlans: treatmentPlansPage.records,
            progressNotes: progressNotesPage.records,
            prescriptions: prescriptionsPage.records,
            invoices: invoicesPage.records
          });
          setPageInfo({
            appointments: appointmentsPage,
            assessments: assessmentsPage,
            "treatment-plans": treatmentPlansPage,
            "progress-notes": progressNotesPage,
            prescriptions: prescriptionsPage,
            invoices: invoicesPage
          });
          setTimelineError("");
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
  const canApproveDischarge = ["director", "admin", "doctor"].includes(userRole);
  const canCloseDischarge = ["director", "admin", "reception", "coordinator"].includes(userRole);
  const steps = [...(canViewReferral ? ["referral"] : []), "appointments", ...(canViewClinical ? ["assessments", "treatment-plans", "progress-notes"] : []), ...(canViewPrescriptions ? ["prescriptions"] : []), ...(canViewBilling ? ["invoices"] : [])];
  const activeRecords = data[activeStep] || [];
  const isDischarged = patient?.status === "discharged";
  const canCreate = ["assessments", "treatment-plans", "progress-notes", "prescriptions"].includes(activeStep);
  const canApprovePlans = ["director", "admin", "doctor"].includes(userRole);

  async function loadMoreHistory() {
    const resource = activeStep;
    const current = pageInfo[resource];
    if (!current?.hasMore || loadingMore || resource === "referral") return;
    setLoadingMore(true);
    setTimelineError("");
    try {
      const page = await listRecordsPage(resource, { token, patientId: patient._id, limit: 20, skip: current.nextOffset });
      setData((existing) => ({ ...existing, [resource]: [...(existing[resource] || []), ...page.records] }));
      setPageInfo((existing) => ({ ...existing, [resource]: page }));
    } catch (error) {
      setTimelineError(error.message || "Unable to load more patient history");
    } finally {
      setLoadingMore(false);
    }
  }

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

  async function approvePlan(planId) {
    setApprovingPlanId(planId);
    setPlanApprovalError("");
    try {
      await approveTreatmentPlan(planId, { token });
      setJourneyKey((value) => value + 1);
      onRefresh?.();
    } catch (error) {
      setPlanApprovalError(error.message || "Treatment plan approval failed");
    } finally {
      setApprovingPlanId("");
    }
  }

  function openCreate() {
    setCreateForm({ patient: patient._id, ...(activeStep === "assessments" ? { assessmentType: "initial" } : {}), ...(activeStep === "treatment-plans" ? { status: "planned" } : {}), ...(activeStep === "progress-notes" ? { noteType: "session" } : {}) });
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
        if (f.name === "domains" && typeof val === "string") {
          val = val.split(",").map((item) => item.trim()).filter(Boolean);
        }
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
          <p><strong>Linked assessment:</strong> {record?.assessment?.assessedAt ? formatDate(record.assessment.assessedAt) : "Legacy plan — no assessment link"}</p>
          <p><strong>Approved by:</strong> {record?.approvedBy?.name || "Not approved"} {record?.approvedAt ? `on ${formatDate(record.approvedAt)}` : ""}</p>
          <p><strong>Goals:</strong> {record?.goals}</p>
          <p><strong>Interventions:</strong> {(record?.interventions || []).join(", ")}</p>
          <p><strong>Frequency:</strong> {record?.frequency} | <strong>Duration:</strong> {record?.duration}</p>
        </div>
      );
    }
    if (activeStep === "progress-notes") {
      return (
        <div>
          <p><strong>Appointment:</strong> {record?.appointment?.service || "Not linked"} · {record?.appointment?.startsAt ? formatDateTime(record.appointment.startsAt) : ""}</p>
          <p><strong>Practitioner:</strong> {record?.appointment?.practitioner?.name || record?.author?.name || "Not recorded"}</p>
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
      const linkedSessions = [...new Map((record?.items || []).filter((item) => item.appointment).map((item) => [item.appointment._id || item.appointment, item.appointment])).values()];
      return (
        <div>
          <p><strong>Invoice No:</strong> {record?.invoiceNo}</p>
          <p><strong>Total:</strong> ₹{total.toLocaleString("en-IN")} | <strong>Paid:</strong> ₹{(record?.paidAmount || 0).toLocaleString("en-IN")} | <strong>Due:</strong> ₹{due.toLocaleString("en-IN")}</p>
          <p><strong>Status:</strong> {record?.status}</p>
          <p><strong>Linked sessions:</strong> {linkedSessions.length ? linkedSessions.map((item) => typeof item === "object" ? `${item.service || "Session"} · ${formatDate(item.startsAt)}` : String(item)).join("; ") : "No appointment-linked session items"}</p>
        </div>
      );
    }
    return <p>{JSON.stringify(record)}</p>;
  }

  async function submitClinicalAmendment(record) {
    setAmendmentSaving(true);
    setAuditError("");
    try {
      const changes = JSON.parse(amendmentJson);
      await amendClinicalRecord(activeStep, record._id, { reason: amendmentReason, changes }, { token });
      const history = await listClinicalAmendments(activeStep, record._id, { token });
      setAuditHistory(history || []);
      setAmendmentReason("");
      setAmendmentJson("{}");
      setJourneyKey(value => value + 1);
    } catch (error) {
      setAuditError(error.message || "Unable to save the amendment. Check the JSON payload.");
    } finally {
      setAmendmentSaving(false);
    }
  }

  async function handleDischarge(e) {
    e.preventDefault();
    setDischarging(true);
    setDischargeError("");
    try {
      if (patient.dischargeApprovedAt) await closePatientDischarge(patient._id, { token });
      else await approvePatientDischarge(patient._id, dischargeForm, { token });
      setShowDischarge(false);
      setJourneyKey((value) => value + 1);
      onRefresh?.();
    } catch (err) {
      setDischargeError(err.message || "Unable to process discharge");
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
        className="modal journey-modal management-journey-modal"
        ref={journeyDialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-journey-title"
        tabIndex={-1}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
      >
        <div className="modal-header journey-header">
          <div>
            <h3 id="patient-journey-title">Patient Journey & History</h3>
            <small>{patient?.fullName} (MRN: {patient?.mrn})</small>
          </div>
          <button className="icon-button" type="button" aria-label="Close patient journey" onClick={onClose}>
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

        <div className="journey-steps" role="group" aria-label="Patient journey sections">
          {steps.map((step) => {
            const Icon = STEP_ICONS[step];
            const selected = activeStep === step;
            const count = Array.isArray(data[step]) ? data[step].length : (data[step] ? 1 : 0);
            return (
              <div
                key={step}
                className={`journey-step ${selected ? "is-active" : ""}`}
              >
                <button className="journey-step-select" type="button" aria-pressed={selected} onClick={() => { setActiveStep(step); setCreateStep(null); }}>
                <Icon size={18} />
                <span>{STEP_LABELS[step]}</span>
                <small>{count}</small>
                </button>
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
              </div>
            );
          })}
        </div>

        <div className="journey-content management-journey-content">
          {createStep ? (
            <form onSubmit={handleCreateSubmit} className="journey-create-form management-journey-create-form">
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
                  ) : field.type === "appointment" ? (
                    <select
                      value={createForm[field.name] || ""}
                      onChange={(e) => setCreateForm({ ...createForm, [field.name]: e.target.value })}
                      required={createForm.noteType === "session" || !createForm.noteType}
                    >
                      <option value="">Select checked-in appointment...</option>
                      {data.appointments.filter((item) => ["checked-in", "completed"].includes(item.status)).map((item) => (
                        <option key={item._id} value={item._id}>{item.service} · {formatDateTime(item.startsAt)}</option>
                      ))}
                    </select>
                  ) : field.type === "assessment" ? (
                    <select
                      value={createForm[field.name] || ""}
                      onChange={(e) => setCreateForm({ ...createForm, [field.name]: e.target.value })}
                      required
                    >
                      <option value="">Select completed assessment...</option>
                      {data.assessments.filter((item) => item.status === "completed").map((item) => (
                        <option key={item._id} value={item._id}>{(item.domains || []).join(", ") || "Assessment"} · {formatDate(item.assessedAt)}</option>
                      ))}
                    </select>
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
              {pageInfo[activeStep]?.total > 0 && <p className="history-count">Showing {activeRecords.length} of {pageInfo[activeStep].total} records</p>}
              {timelineError && <p className="form-status error-status">{timelineError}</p>}
              {(activeStep === "referral" ? [data.referral] : activeRecords).map((record, idx) => (
                <div key={record?._id || idx} className="journey-card">
                  <div className="journey-card-header">
                    <strong>{STEP_LABELS[activeStep]} Record</strong>
                    <span>{formatDateTime(record?.createdAt)}</span>
                    {record?.status && <mark className={["completed", "active", "paid", "converted", "ready"].includes(record.status) ? "good" : ""}>{record.status}</mark>}
                  </div>
                  <div className="journey-card-body management-journey-card-body">
                    {describeRecord(record)}
                    {planApprovalError && activeStep === "treatment-plans" && <p className="form-status error-status">{planApprovalError}</p>}
                    {activeStep === "treatment-plans" && record.status === "planned" && canApprovePlans && (
                      <button className="primary-button" type="button" disabled={approvingPlanId === record._id} onClick={() => approvePlan(record._id)}>
                        {approvingPlanId === record._id ? "Approving..." : "Approve and activate plan"}
                      </button>
                    )}
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
                      <div className="journey-audit-history management-audit-history">
                        <strong>Amendment history</strong>
                        {auditHistory.length ? auditHistory.map(item => (
                          <div key={item._id}>
                            <p>{item.reason}</p>
                            <small>{item.amendedBy?.name || "Authorised staff"} · {formatDateTime(item.createdAt)} · {item.changedFields.join(", ")}</small>
                            <pre>{JSON.stringify({ before: item.before, after: item.after }, null, 2)}</pre>
                          </div>
                        )) : <p>No amendments recorded.</p>}
                        {["director", "admin"].includes(userRole) && (record.status === "completed" || activeStep === "progress-notes") && (
                          <form className="clinical-form" onSubmit={event => { event.preventDefault(); submitClinicalAmendment(record); }}>
                            <strong>Authorised amendment</strong>
                            <label>Reason<textarea rows={3} minLength={10} maxLength={1000} required value={amendmentReason} onChange={event => setAmendmentReason(event.target.value)} /></label>
                            <label>Changed fields (JSON)<textarea rows={5} required value={amendmentJson} onChange={event => setAmendmentJson(event.target.value)} /></label>
                            <small>Patient linkage and record status cannot be changed. The original values are retained in the audit history.</small>
                            <button className="primary-button" type="submit" disabled={amendmentSaving}>{amendmentSaving ? "Saving..." : "Record amendment"}</button>
                          </form>
                        )}
                      </div>
                    )}
                    {auditError && <p className="form-status error-status">{auditError}</p>}
                  </div>
                </div>
              ))}
              {pageInfo[activeStep]?.hasMore && (
                <button className="secondary-button load-more-history" type="button" onClick={loadMoreHistory} disabled={loadingMore}>
                  {loadingMore ? "Loading history..." : `Load more ${STEP_LABELS[activeStep].toLowerCase()} history`}
                </button>
              )}
            </div>
          )}
        </div>

        {!isDischarged && !createStep && ((patient.dischargeApprovedAt && canCloseDischarge) || (!patient.dischargeApprovedAt && canApproveDischarge)) && (
          <div className="journey-footer management-journey-footer">
            <button className="primary-button" type="button" onClick={() => setShowDischarge(true)}>
              {patient.dischargeApprovedAt ? "Close approved discharge" : "Prepare discharge"}
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
                className="modal journey-discharge-modal"
                ref={dischargeDialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="patient-discharge-title"
                tabIndex={-1}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h3 id="patient-discharge-title">Discharge {patient?.fullName}</h3>
                  <button className="icon-button" type="button" aria-label="Close discharge dialog" onClick={() => setShowDischarge(false)}>
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleDischarge} className="clinical-form">
                  {dischargeError && <p className="form-status error-status">{dischargeError}</p>}
                  <h4>{patient.dischargeApprovedAt ? "Administrative discharge closure" : "Clinical discharge approval"}</h4>
                  {patient.dischargeApprovedAt ? (
                    <div className="discharge-approval-summary">
                      <p>Clinical approval recorded on {formatDate(patient.dischargeApprovedAt)} by {patient.dischargeApprovedBy?.name || "clinical lead"}.</p>
                      <p><strong>Reason:</strong> {patient.dischargeReason}</p>
                      <p>Readiness checks will be repeated before the patient is closed.</p>
                    </div>
                  ) : (
                    <>
                      <label>Discharge summary
                        <textarea rows={4} minLength={20} maxLength={5000} value={dischargeForm.summary} onChange={(e) => setDischargeForm({ ...dischargeForm, summary: e.target.value })} placeholder="Clinical summary of the completed care episode..." required />
                      </label>
                      <label>Reason for discharge
                        <input type="text" minLength={3} maxLength={500} value={dischargeForm.reason} onChange={(e) => setDischargeForm({ ...dischargeForm, reason: e.target.value })} placeholder="Goals met, transfer, family decision..." required />
                      </label>
                      <label>Final clinical outcome
                        <textarea rows={3} minLength={20} maxLength={2000} value={dischargeForm.outcome} onChange={(e) => setDischargeForm({ ...dischargeForm, outcome: e.target.value })} placeholder="Describe progress against the agreed goals..." required />
                      </label>
                      <label>Post-discharge recommendations
                        <textarea rows={3} minLength={10} maxLength={3000} value={dischargeForm.recommendations} onChange={(e) => setDischargeForm({ ...dischargeForm, recommendations: e.target.value })} placeholder="Home programme, review interval, referrals or follow-up..." required />
                      </label>
                    </>
                  )}
                  <div className="modal-actions">
                    <button className="primary-button" type="submit" disabled={discharging}>
                      {discharging ? "Processing..." : patient.dischargeApprovedAt ? "Close patient record" : "Submit clinical approval"}
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
