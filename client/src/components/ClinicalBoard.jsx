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
  createPrescription,
  updatePrescription
} from "../lib/api.js";
import { ChipInput } from "./ChipInput.jsx";
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
      { name: "goals", label: "Goals", type: "textarea" },
      { name: "interventions", label: "Interventions", type: "chips", suggestions: services },
      { name: "frequency", label: "Frequency", type: "text", placeholder: "Weekly" },
      { name: "duration", label: "Duration", type: "text", placeholder: "45 minutes" },
      { name: "status", label: "Status", type: "select", options: ["active", "completed", "on-hold"] }
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
      detail: `Status: ${record.status || "pending"}`,
      status: record.status
    };
  }
  if (resource === "progress-notes") {
    return {
      title: `Note - ${record.noteType || "General"} (${new Date(record.notedAt).toLocaleDateString("en-IN")})`,
      meta: `Objective: ${(record.objective || "").slice(0, 60)}...`,
      detail: `Assessment: ${(record.assessment || "").slice(0, 60)}...`,
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

  function openCreate() {
    setForm({ patient: patientId || "" });
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(record) {
    const flat = {};
    config.fields.forEach(f => {
      let val = record[f.name];
      if (f.name === "patient") {
        val = typeof val === "object" && val !== null ? val._id : val;
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
        let val = form[f.name] ?? "";
        if (f.type === "chips") {
          val = Array.isArray(val) ? val : [];
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
    const defaultService = serviceCharges.find(s => s.service === record?.service);
    setBillingItems([{
      description: record?.service || "Service",
      quantity: 1,
      rate: defaultService?.rate || 0
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
      const response = await fetch(`${API_BASE_URL}/invoices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          patient: patientId,
          items: billingItems.filter(i => i.description && i.rate),
          status: "draft"
        })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to create invoice");
      }
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
    <article className="table-panel resource-panel">
      <div className="panel-title resource-title">
        <Icon size={21} />
        <div>
          <h3>{config.title}</h3>
          <p className="resource-description">{config.description}</p>
          <span>{records.length} record(s) loaded</span>
        </div>
        <button className="primary-button compact-button" type="button" onClick={openCreate}>
          <Plus size={16} /> New
        </button>
      </div>
      {loading && <p className="empty-state">Loading {config.title.toLowerCase()}...</p>}
      {error && <p className="form-status error-status">{error}</p>}
      {!loading && !error && (
        <AnimatePresence>
          {records.length ? (
            <div className="record-grid">
              {records.map((record) => {
                const summary = describeRecord(activeView, record);
                return (
                  <motion.div
                    className="record-card"
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
                        <span>{summary.meta}</span>
                      </div>
                      <mark className={statusClass(summary.status)}>{summary.status || "open"}</mark>
                    </div>
                    <p>{summary.detail}</p>
                    <div className="record-actions">
                      <button
                        className="secondary-button compact-button"
                        type="button"
                        onClick={() => openEdit(record)}
                      >
                        Update
                      </button>
                      {activeView !== "prescriptions" && ["director", "admin", "accounts"].includes(userRole) && (
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
        {showForm && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowForm(false)}
          >
            <motion.div
              className="modal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>{editingId ? `Update ${config.title}` : `New ${config.title}`}</h3>
                <button className="icon-button" type="button" onClick={() => setShowForm(false)}>
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
                        {field.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === "patient" ? (
                      <select
                        value={form[field.name] || ""}
                        onChange={(e) => setForm({ ...form, [field.name]: e.target.value })}
                        required
                        disabled={!!patientId}
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
            onClick={() => setShowBilling(false)}
          >
            <motion.div
              className="modal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Generate Invoice</h3>
                <button className="icon-button" type="button" onClick={() => setShowBilling(false)}>
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleBillingSubmit} className="clinical-form">
                {billingError && <p className="form-status error-status">{billingError}</p>}
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
