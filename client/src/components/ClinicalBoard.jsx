import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck,
  FileText,
  ClipboardList,
  HeartPulse,
  Plus,
  X,
  Save,
  IndianRupee
} from "lucide-react";
import {
  listAssessments,
  createAssessment,
  updateAssessment,
  listTreatmentPlans,
  createTreatmentPlan,
  updateTreatmentPlan,
  listProgressNotes,
  createProgressNote,
  updateProgressNote,
  listPrescriptions,
  listRecords,
  createPrescription,
  updatePrescription,
  approveTreatmentPlan,
  createInvoice,
  amendClinicalRecord
} from "../lib/api.js";
import { ChipInput } from "./ChipInput.jsx";
import { useAccessibleDialog } from "../hooks/useAccessibleDialog.js";
import { services, serviceCharges } from "../data/centreData.js";

const CONFIGS = {
  assessments: {
    icon: ClipboardCheck,
    title: "Assessments",
    description: "Capture structured findings, developmental domains and clinical recommendations.",
    listFn: listAssessments,
    createFn: createAssessment,
    updateFn: updateAssessment,
    fields: [
      { name: "patient", label: "Patient", type: "patient" },
      { name: "assessmentType", label: "Assessment type", type: "select", options: ["initial", "review", "discharge"] },
      { name: "domains", label: "Domains", type: "text", placeholder: "Speech, Language, Social..." },
      { name: "findings", label: "Findings", type: "textarea" },
      { name: "recommendations", label: "Recommendations", type: "textarea" },
      { name: "status", label: "Status", type: "select", options: ["draft", "completed"] }
    ]
  },
  "treatment-plans": {
    icon: FileText,
    title: "Treatment Plans",
    description: "Define therapy goals, interventions, session frequency and care-plan status.",
    listFn: listTreatmentPlans,
    createFn: createTreatmentPlan,
    updateFn: updateTreatmentPlan,
    fields: [
      { name: "patient", label: "Patient", type: "patient" },
      { name: "assessment", label: "Completed assessment", type: "assessment" },
      { name: "goals", label: "Goals", type: "textarea" },
      { name: "interventions", label: "Interventions", type: "chips", suggestions: services },
      { name: "frequency", label: "Frequency", type: "text", placeholder: "Weekly" },
      { name: "duration", label: "Duration", type: "text", placeholder: "45 minutes" },
      { name: "status", label: "Status", type: "select", options: ["planned", "active", "on-hold", "completed", "cancelled"] }
    ]
  },
  "progress-notes": {
    icon: ClipboardList,
    title: "Progress Notes",
    description: "Document session observations, outcomes and the next clinical steps.",
    listFn: listProgressNotes,
    createFn: createProgressNote,
    updateFn: updateProgressNote,
    fields: [
      { name: "patient", label: "Patient", type: "patient" },
      { name: "noteType", label: "Note Type", type: "select", options: ["session", "review", "incident"] },
      { name: "appointment", label: "Session appointment", type: "appointment" },
      { name: "subjective", label: "Subjective", type: "textarea" },
      { name: "objective", label: "Objective", type: "textarea" },
      { name: "assessment", label: "Assessment", type: "textarea" },
      { name: "plan", label: "Plan", type: "textarea" }
    ]
  },
  prescriptions: {
    icon: HeartPulse,
    title: "Prescriptions",
    description: "Maintain medication instructions and prescription status for patient records.",
    listFn: listPrescriptions,
    createFn: createPrescription,
    updateFn: updatePrescription,
    fields: [
      { name: "patient", label: "Patient", type: "patient" },
      { name: "medications", label: "Medications (JSON array)", type: "textarea", placeholder: '[{"name":"...","dosage":"...","frequency":"...","duration":"...","instructions":"..."}]' },
      { name: "notes", label: "Notes", type: "textarea" },
      { name: "status", label: "Status", type: "select", options: ["active", "completed", "cancelled"] }
    ]
  }
};

function statusClass(status = "") {
  if (["completed", "active", "paid", "converted", "ready"].includes(status)) return "good";
  if (["in-progress", "pending", "draft", "on-hold"].includes(status)) return "";
  if (["urgent", "high", "overdue", "partial", "no-show", "low stock", "cancelled"].includes(status)) return "risk";
  return "";
}

function describeRecord(resource, record) {
  if (resource === "assessments") {
    return {
      title: `Assessment - ${(record.domains || []).join(", ") || "General"}`,
      meta: `Findings: ${(record.findings || "").slice(0, 80)}...`,
      detail: `Status: ${record.status || "pending"}`,
      status: record.status
    };
  }
  if (resource === "treatment-plans") {
    return {
      title: `Plan - ${(record.goals || "").slice(0, 50) || "Untitled"}`,
      meta: `Frequency: ${record.frequency || "Not set"} | ${record.duration || ""}`,
      detail: `Assessment: ${record.assessment?.assessedAt ? new Date(record.assessment.assessedAt).toLocaleDateString("en-IN") : "Legacy / not linked"} · Approved: ${record.approvedAt ? new Date(record.approvedAt).toLocaleDateString("en-IN") : "Not yet"}`,
      status: record.status
    };
  }
  if (resource === "progress-notes") {
    return {
      title: `Note - ${record.noteType || "General"} (${new Date(record.notedAt).toLocaleDateString("en-IN")})`,
      meta: `Objective: ${(record.objective || "").slice(0, 60)}...`,
      detail: `Appointment: ${record.appointment?.service || "Not linked"} · ${record.appointment?.startsAt ? new Date(record.appointment.startsAt).toLocaleString("en-IN") : ""} · ${record.appointment?.practitioner?.name || ""}`,
      status: "completed"
    };
  }
  if (resource === "prescriptions") {
    return {
      title: `Rx - ${(record.medications || []).map(m => m.name).join(", ") || "No medications"}`,
      meta: `Prescribed: ${new Date(record.prescribedAt).toLocaleDateString("en-IN")}`,
      detail: `Notes: ${(record.notes || "").slice(0, 80)}...`,
      status: record.status
    };
  }
  return { title: "Record", meta: "", detail: "", status: "" };
}

function parseValue(type, value) {
  if (type === "textarea" && value && value.startsWith("[") && value.endsWith("]")) {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}

export function ClinicalBoard({ activeView, token, query, refreshSignal, patients = [], patientId = null, userRole }) {
  const config = CONFIGS[activeView];
  const Icon = config?.icon;
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [billingRecord, setBillingRecord] = useState(null);
  const [billingItems, setBillingItems] = useState([]);
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [completedAssessments, setCompletedAssessments] = useState([]);
  const [approvingId, setApprovingId] = useState("");
  const [availableAppointments, setAvailableAppointments] = useState([]);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [amendingRecord, setAmendingRecord] = useState(null);
  const [amendmentReason, setAmendmentReason] = useState("");
  const [amendmentValues, setAmendmentValues] = useState({});
  const [amendmentSaving, setAmendmentSaving] = useState(false);
  const editorDialogRef = useAccessibleDialog(showForm, () => setShowForm(false));
  const billingDialogRef = useAccessibleDialog(showBilling, () => setShowBilling(false));

  React.useEffect(() => {
    if (!token || !config) return;
    let active = true;
    setLoading(true);
    setError("");
    const timeoutId = window.setTimeout(async () => {
      try {
        const data = await config.listFn({ token, q: query, limit: 50 });
        if (active) { setRecords(data || []); setLoading(false); }
      } catch (err) {
        if (active) { setError(err.message); setLoading(false); }
      }
    }, 220);
    return () => { active = false; window.clearTimeout(timeoutId); };
  }, [token, config, query, refreshSignal]);

  React.useEffect(() => {
    if (activeView !== "progress-notes" || !token) { setAvailableAppointments([]); return undefined; }
    let active = true;
    listRecords("appointments", { token, limit: 100 }).then((items) => {
      if (active) setAvailableAppointments((items || []).filter((item) => ["checked-in", "completed"].includes(item.status)));
    }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [activeView, token, refreshSignal]);

  React.useEffect(() => {
    if (activeView !== "treatment-plans" || !token) {
      setCompletedAssessments([]);
      return undefined;
    }
    let active = true;
    listAssessments({ token, status: "completed", limit: 100 })
      .then((items) => { if (active) setCompletedAssessments(items || []); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [activeView, token, refreshSignal]);

  async function handleApprove(record) {
    setApprovingId(record._id);
    setError("");
    try {
      const approved = await approveTreatmentPlan(record._id, { token });
      setRecords((current) => current.map((item) => item._id === record._id ? approved : item));
    } catch (err) {
      setError(err.message || "Treatment plan could not be approved");
    } finally {
      setApprovingId("");
    }
  }

  function openCreate() {
    setForm({ patient: patientId || "", ...(activeView === "assessments" ? { assessmentType: "initial" } : {}), ...(activeView === "treatment-plans" ? { status: "planned" } : {}), ...(activeView === "progress-notes" ? { noteType: "session" } : {}) });
    setEditingId(null);
    setShowForm(true);
  }

  function isImmutableRecord(record) {
    return activeView === "progress-notes" || record.status === "completed";
  }

  function openView(record) {
    setViewingRecord(record);
  }

  function openAmend(record) {
    const values = {};
    config.fields
      .filter((field) => !["patient", "status"].includes(field.name) && !(activeView === "treatment-plans" && field.name === "assessment"))
      .forEach((field) => {
        let value = record[field.name];
        if (["appointment", "assessment"].includes(field.name) && value && typeof value === "object") value = value._id;
        if (field.type === "chips" && !Array.isArray(value)) value = [];
        if (field.name === "domains" && Array.isArray(value)) value = value.join(", ");
        values[field.name] = value ?? "";
      });
    setAmendingRecord(record);
    setAmendmentValues(values);
    setAmendmentReason("");
  }

  async function handleAmendmentSubmit(event) {
    event.preventDefault();
    setAmendmentSaving(true);
    setError("");
    try {
      const changes = { ...amendmentValues };
      if (typeof changes.domains === "string") {
        changes.domains = changes.domains.split(",").map((value) => value.trim()).filter(Boolean);
      }
      await amendClinicalRecord(activeView, amendingRecord._id, {
        reason: amendmentReason,
        changes
      }, { token });
      const refreshed = await config.listFn({ token, q: query, limit: 50 });
      setRecords(refreshed || []);
      setAmendingRecord(null);
      setAmendmentReason("");
      setAmendmentValues({});
    } catch (err) {
      setError(err.message || "The clinical amendment could not be saved");
    } finally {
      setAmendmentSaving(false);
    }
  }

  function openEdit(record) {
    const flat = {};
    config.fields.forEach(f => {
      let val = record[f.name];
      if (f.name === "patient") {
        val = typeof val === "object" && val !== null ? val._id : val;
      } else if (f.name === "appointment" && val && typeof val === "object") {
        val = val._id;
      } else if (f.name === "assessment" && val && typeof val === "object") {
        val = val._id;
      } else if (f.type === "chips") {
        val = Array.isArray(val) ? val : (typeof val === "string" ? val.split(",").map(s => s.trim()).filter(Boolean) : []);
      } else if (Array.isArray(val)) val = val.join(", ");
      else if (typeof val === "object" && val !== null) val = JSON.stringify(val, null, 2);
      flat[f.name] = val ?? "";
    });
    setForm(flat);
    setEditingId(record._id);
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {};
      config.fields.forEach(f => {
        // Patient ownership is immutable after creation. Treatment plans also
        // keep their linked assessment immutable, matching the server allowlist.
        if (editingId && (f.name === "patient" || (activeView === "treatment-plans" && f.name === "assessment"))) {
          return;
        }
        let val = form[f.name] ?? "";
        if (f.type === "chips") {
          val = Array.isArray(val) ? val : [];
        } else if (f.name === "domains" && typeof val === "string") {
          val = val.split(",").map((item) => item.trim()).filter(Boolean);
        } else if (f.type === "textarea" && typeof val === "string" && val.startsWith("[") && val.endsWith("]")) {
          try { val = JSON.parse(val); } catch { /* keep as string */ }
        }
        payload[f.name] = val;
      });
      if (editingId) {
        const updated = await config.updateFn(editingId, payload, { token });
        setRecords(prev => prev.map(r => r._id === editingId ? updated : r));
      } else {
        const created = await config.createFn(payload, { token });
        setRecords(prev => [created, ...prev]);
      }
      setShowForm(false);
      setForm({});
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openBilling(record) {
    setBillingRecord(record);
    const linkedAppointment = activeView === "appointments"
      ? record
      : activeView === "progress-notes"
        ? record?.appointment
        : null;
    const service = linkedAppointment?.service || record?.service || "Service";
    const defaultService = serviceCharges.find((item) => item.service === service);
    setBillingItems([{
      description: service,
      quantity: 1,
      rate: defaultService?.rate || 0,
      ...(linkedAppointment?.status === "completed" ? { appointment: linkedAppointment._id } : {})
    }]);
    setBillingError("");
    setShowBilling(true);
  }

  async function handleBillingSubmit(e) {
    e.preventDefault();
    setBillingSaving(true);
    setBillingError("");
    try {
      const patientId = billingRecord?.patient?._id || billingRecord?.patient;
      if (!patientId) throw new Error("This clinical record is not linked to a patient.");
      await createInvoice({
        patient: patientId,
        items: billingItems.filter((item) => item.description?.trim() && Number(item.rate) > 0),
        status: "draft"
      }, { token });
      setShowBilling(false);
      setBillingRecord(null);
      setBillingItems([]);
    } catch (err) {
      setBillingError(err.message);
    } finally {
      setBillingSaving(false);
    }
  }

  if (!config) return null;

  return (
    <article className={`table-panel resource-panel clinical-resource-panel clinical-resource-${activeView}`}>
      <div className="panel-title resource-title clinical-board-heading management-resource-heading">
        <Icon size={21} />
        <div>
          <h3>{config.title}</h3>
          <p className="resource-description">{config.description}</p>
          <span className="resource-count" aria-live="polite">{records.length} {records.length === 1 ? "record" : "records"} loaded</span>
        </div>
        <button className="primary-button compact-button" type="button" onClick={openCreate}>
          <Plus size={16} /> New
        </button>
      </div>
      {loading && <p className="empty-state">Loading {config.title.toLowerCase()}...</p>}
      {error && <p className="form-status error-status" role="alert" aria-live="assertive">{error}</p>}
      {!loading && !error && (
        <AnimatePresence>
          {records.length ? (
            <div className={`record-grid clinical-record-grid clinical-record-grid-${activeView}`}>
              {records.map((record) => {
                const summary = describeRecord(activeView, record);
                return (
                  <motion.div
                    className={`record-card clinical-record-card clinical-record-card-${activeView}`}
                    key={record._id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="record-main">
                      <div>
                        <strong>{summary.title}</strong>
                        <span className="clinical-record-meta">{summary.meta}</span>
                      </div>
                      <mark className={statusClass(summary.status)}>{summary.status || "open"}</mark>
                    </div>
                    <p className="clinical-record-detail">{summary.detail}</p>
                    <div className="record-actions">
                      {isImmutableRecord(record) ? (
                        <>
                          <button className="secondary-button compact-button" type="button" onClick={() => openView(record)}>
                            View
                          </button>
                          {["director", "admin"].includes(userRole) && (
                            <button className="secondary-button compact-button" type="button" onClick={() => openAmend(record)}>
                              Amend
                            </button>
                          )}
                        </>
                      ) : (
                        <button className="secondary-button compact-button" type="button" onClick={() => openEdit(record)}>
                          Update
                        </button>
                      )}
                      {activeView === "treatment-plans" && record.status === "planned" && ["director", "admin", "doctor"].includes(userRole) && (
                        <button className="primary-button compact-button" type="button" disabled={approvingId === record._id} onClick={() => handleApprove(record)}>
                          {approvingId === record._id ? "Approving..." : "Approve & activate"}
                        </button>
                      )}
                      {["director", "admin", "accounts"].includes(userRole) &&
                        activeView !== "prescriptions" &&
                        (activeView !== "appointments" || record.status === "completed") &&
                        (activeView !== "progress-notes" || record.appointment?.status === "completed") && (
                        <button
                          className="primary-button compact-button"
                          type="button"
                          onClick={() => openBilling(record)}
                        >
                          <IndianRupee size={14} /> Bill
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="empty-state">No records found. Create one to get started.</p>
          )}
        </AnimatePresence>
      )}

      <AnimatePresence>
        {viewingRecord && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingRecord(null)}>
            <motion.div className="modal clinical-editor-modal" role="dialog" aria-modal="true" aria-labelledby="clinical-view-title" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3 id="clinical-view-title">View {config.title}</h3>
                <button className="icon-button" type="button" aria-label="Close record view" onClick={() => setViewingRecord(null)}><X size={18} /></button>
              </div>
              <div className="clinical-form">
                {config.fields.filter((field) => field.name !== "patient").map((field) => {
                  const value = viewingRecord[field.name];
                  const display = Array.isArray(value)
                    ? value.map((item) => typeof item === "object" ? item.name || item._id : item).join(", ")
                    : value && typeof value === "object"
                      ? value.fullName || value.name || value._id
                      : value;
                  return <label key={field.name}>{field.label}<div className="form-readonly-value">{display === undefined || display === null || display === "" ? "—" : String(display)}</div></label>;
                })}
                <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setViewingRecord(null)}>Close</button></div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {amendingRecord && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAmendingRecord(null)}>
            <motion.div className="modal clinical-editor-modal" role="dialog" aria-modal="true" aria-labelledby="clinical-amend-title" onClick={(event) => event.stopPropagation()}>
              <div className="modal-header">
                <h3 id="clinical-amend-title">Amend {config.title}</h3>
                <button className="icon-button" type="button" aria-label="Close amendment dialog" onClick={() => setAmendingRecord(null)}><X size={18} /></button>
              </div>
              <form className="clinical-form" onSubmit={handleAmendmentSubmit}>
                <p className="form-status">This correction will be recorded in the clinical audit history with your identity, timestamp and reason.</p>
                {config.fields.filter((field) => !["patient", "status"].includes(field.name) && !(activeView === "treatment-plans" && field.name === "assessment")).map((field) => (
                  <label key={field.name}>
                    {field.label}
                    {field.type === "textarea" ? (
                      <textarea rows={4} value={amendmentValues[field.name] ?? ""} onChange={(event) => setAmendmentValues((current) => ({ ...current, [field.name]: event.target.value }))} />
                    ) : field.type === "select" ? (
                      <select value={amendmentValues[field.name] ?? ""} onChange={(event) => setAmendmentValues((current) => ({ ...current, [field.name]: event.target.value }))}>
                        {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : field.type === "chips" ? (
                      <ChipInput value={Array.isArray(amendmentValues[field.name]) ? amendmentValues[field.name] : []} onChange={(value) => setAmendmentValues((current) => ({ ...current, [field.name]: value }))} suggestions={field.suggestions || []} />
                    ) : field.type === "appointment" ? (
                      <select value={amendmentValues[field.name] ?? ""} onChange={(event) => setAmendmentValues((current) => ({ ...current, [field.name]: event.target.value }))}>
                        <option value="">No appointment</option>
                        {availableAppointments.map((appointment) => <option key={appointment._id} value={appointment._id}>{appointment.service} · {new Date(appointment.startsAt).toLocaleString("en-IN")}</option>)}
                      </select>
                    ) : (
                      <input value={Array.isArray(amendmentValues[field.name]) ? amendmentValues[field.name].join(", ") : amendmentValues[field.name] ?? ""} onChange={(event) => setAmendmentValues((current) => ({ ...current, [field.name]: event.target.value }))} />
                    )}
                  </label>
                ))}
                <label>
                  Reason for amendment (minimum 10 characters)
                  <textarea rows={3} minLength={10} maxLength={1000} required value={amendmentReason} onChange={(event) => setAmendmentReason(event.target.value)} placeholder="Explain why this clinical record needs correction..." />
                </label>
                <div className="modal-actions">
                  <button className="primary-button" type="submit" disabled={amendmentSaving || amendmentReason.trim().length < 10}>{amendmentSaving ? "Saving amendment..." : "Save audited amendment"}</button>
                  <button className="secondary-button" type="button" onClick={() => setAmendingRecord(null)}>Cancel</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showForm && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Close clinical record dialog" onClick={() => setShowForm(false)}
          >
            <motion.div
              className="modal clinical-editor-modal"
              ref={editorDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="clinical-editor-title"
              tabIndex={-1}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3 id="clinical-editor-title">{editingId ? `Update ${config.title}` : `New ${config.title}`}</h3>
                <button className="icon-button" type="button" aria-label="Close clinical record dialog" onClick={() => setShowForm(false)}>
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="clinical-form">
                {config.fields.map((field) => (
                  <label key={field.name}>
                    {field.label}
                    {field.type === "textarea" ? (
                      <textarea
                        rows={4}
                        value={form[field.name] || ""}
                        onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                        placeholder={field.placeholder}
                        required
                      />
                    ) : field.type === "select" ? (
                      <select
                        value={form[field.name] || ""}
                        onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                        required
                      >
                        <option value="">Select...</option>
                        {(activeView === "treatment-plans" && field.name === "status" ? field.options.filter((opt) => !editingId ? opt === "planned" : opt !== "active" || records.find((item) => item._id === editingId)?.approvedAt) : field.options).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === "appointment" ? (
                      <select
                        value={form[field.name] || ""}
                        onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                        required={form.noteType === "session" || !form.noteType}
                      >
                        <option value="">Select checked-in session...</option>
                        {availableAppointments.filter((item) => item.patient?._id === (form.patient || patientId) || item.patient === (form.patient || patientId)).map((item) => (
                          <option key={item._id} value={item._id}>{item.service} · {new Date(item.startsAt).toLocaleString("en-IN")}</option>
                        ))}
                      </select>
                    ) : field.type === "assessment" ? (
                      <select
                        value={form[field.name] || ""}
                        onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                        required
                        disabled={!!editingId}
                      >
                        <option value="">Select completed assessment...</option>
                        {completedAssessments.filter((item) => item.patient?._id === (form.patient || patientId) || item.patient === (form.patient || patientId)).map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.patient?.fullName || "Patient"} · {(item.domains || []).join(", ") || "Assessment"} · {new Date(item.assessedAt).toLocaleDateString("en-IN")}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "patient" ? (
                      <select
                        value={form[field.name] || ""}
                        onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                        required
                        disabled={!!patientId || !!editingId}
                      >
                        <option value="">Select patient...</option>
                        {patients.map(p => (
                          <option key={p._id} value={p._id}>{p.fullName} ({p.mrn || "No MRN"})</option>
                        ))}
                      </select>
                    ) : field.type === "chips" ? (
                      <ChipInput
                        value={Array.isArray(form[field.name]) ? form[field.name] : []}
                        onChange={(val) => setForm({ ...form, [field.name]: val })}
                        placeholder={field.placeholder || "Type and press Enter"}
                        suggestions={field.suggestions || []}
                      />
                    ) : (
                      <input
                        type="text"
                        value={form[field.name] || ""}
                        onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                        placeholder={field.placeholder}
                        required
                      />
                    )}
                  </label>
                ))}
                <div className="modal-actions">
                  <button className="primary-button" type="submit" disabled={saving}>
                    <Save size={16} /> {saving ? "Saving..." : editingId ? "Update" : "Create"}
                  </button>
                  <button className="secondary-button" type="button" onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBilling && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Close invoice dialog" onClick={() => setShowBilling(false)}
          >
            <motion.div
              className="modal clinical-billing-modal"
              ref={billingDialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="clinical-billing-title"
              tabIndex={-1}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3 id="clinical-billing-title">Generate Invoice</h3>
                <button className="icon-button" type="button" aria-label="Close invoice dialog" onClick={() => setShowBilling(false)}>
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleBillingSubmit} className="clinical-form">
                {billingError && <p className="form-status error-status" role="alert" aria-live="assertive">{billingError}</p>}
                <div className="billing-items">
                  {billingItems.map((item, idx) => (
                    <div key={idx} className="billing-item-row">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => setBillingItems(billingItems.map((i, iidx) => iidx === idx ? { ...i, description: e.target.value } : i))}
                        placeholder="Description"
                        required
                      />
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => setBillingItems(billingItems.map((i, iidx) => iidx === idx ? { ...i, quantity: Number(e.target.value) } : i))}
                        required
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rate}
                        onChange={(e) => setBillingItems(billingItems.map((i, iidx) => iidx === idx ? { ...i, rate: Number(e.target.value) } : i))}
                        placeholder="Rate"
                        required
                      />
                      {billingItems.length > 1 && (
                        <button type="button" className="icon-button" onClick={() => setBillingItems(billingItems.filter((_, iidx) => iidx !== idx))}>
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" className="secondary-button compact-button" onClick={() => setBillingItems([...billingItems, { description: "", quantity: 1, rate: 0 }])}>
                  <Plus size={14} /> Add Item
                </button>
                <div className="modal-actions">
                  <button className="primary-button" type="submit" disabled={billingSaving}>
                    {billingSaving ? "Creating..." : "Create Invoice"}
                  </button>
                  <button className="secondary-button" type="button" onClick={() => setShowBilling(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
