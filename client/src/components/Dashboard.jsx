import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  HeartPulse,
  IndianRupee,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PackageOpen,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  UserRoundPlus,
  Plus,
  X,
  UsersRound,
  Stethoscope,
  WalletCards
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useMemo, useState } from "react";
import { useDashboard } from "../hooks/useDashboard.js";
import { clearSession, getStoredSession, listRecords, loginStaff, storeSession, updateRecord, createRecord, API_BASE_URL } from "../lib/api.js";
import { ClinicalBoard } from "./ClinicalBoard.jsx";
import { PatientJourney } from "./PatientJourney.jsx";
import { PractitionerBoard } from "./PractitionerBoard.jsx";
import { PractitionerDashboard } from "./PractitionerDashboard.jsx";
import { StaffBoard } from "./StaffBoard.jsx";
import { ChipInput } from "./ChipInput.jsx";
import { serviceCharges, services } from "../data/centreData.js";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const viewItems = [
  { id: "overview", label: "Overview", resource: null, icon: LayoutDashboard, section: "General" },
  { id: "patients", label: "Patients", resource: "patients", icon: UsersRound, section: "Clinical" },
  { id: "practitioners", label: "Practitioners", resource: "doctors", icon: Stethoscope, section: "Clinical" },
  { id: "staff", label: "Staff Management", resource: null, icon: ShieldCheck, section: "System" },
  { id: "referrals", label: "Referrals", resource: "referrals", icon: TrendingUp, section: "Clinical" },
  { id: "appointments", label: "Appointments", resource: "appointments", icon: CalendarClock, section: "Clinical" },
  { id: "assessments", label: "Assessments", resource: "assessments", icon: ClipboardCheck, section: "Clinical" },
  { id: "treatment-plans", label: "Treatment Plans", resource: "treatment-plans", icon: FileText, section: "Clinical" },
  { id: "progress-notes", label: "Progress Notes", resource: "progress-notes", icon: ClipboardList, section: "Clinical" },
  { id: "prescriptions", label: "Prescriptions", resource: "prescriptions", icon: HeartPulse, section: "Clinical" },
  { id: "billing", label: "Billing", resource: "invoices", icon: WalletCards, section: "Admin" },
  { id: "inventory", label: "Inventory", resource: "inventory", icon: PackageOpen, section: "Admin" },
  { id: "tasks", label: "Tasks", resource: "tasks", icon: ListChecks, section: "Admin" },
  { id: "reports", label: "Reports", resource: null, icon: BarChart3, section: "System" }
];

function getViewConfig(id) {
  return viewItems.find((item) => item.id === id) || viewItems[0];
}

const viewDescriptions = {
  overview: "A live summary of centre activity, care delivery and operational priorities.",
  patients: "Review patient records, care status and the next step in each patient journey.",
  practitioners: "Manage the practitioners delivering services across the centre.",
  staff: "Maintain staff access, roles and day-to-day team responsibilities.",
  referrals: "Track incoming enquiries from first contact through appointment conversion.",
  appointments: "Coordinate the centre schedule, attendance and practitioner availability.",
  assessments: "Review clinical assessments and the findings recorded for each patient.",
  "treatment-plans": "Monitor agreed goals, therapy frequency and active care plans.",
  "progress-notes": "Review session notes and the documented progress of ongoing care.",
  prescriptions: "Review prescriptions and medication instructions recorded by clinicians.",
  billing: "Track invoices, payments received and outstanding patient balances.",
  inventory: "Monitor stock levels, reorder thresholds and stock movement.",
  tasks: "Coordinate follow-ups and operational work across the centre.",
  reports: "Understand service activity, referral movement and daily operating patterns."
};
function getVisibleViewItems(role) {
  const allowed = {
    reception: ["overview","patients","referrals","appointments","billing","tasks","reports"],
    coordinator: ["patients","referrals","appointments","inventory","tasks"],
    doctor: ["overview","patients","appointments","assessments","treatment-plans","progress-notes","prescriptions","tasks"],
    therapist: ["overview","patients","appointments","assessments","treatment-plans","progress-notes","tasks"],
    accounts: ["billing","tasks"]
  };
  if (["director","admin"].includes(role)) return viewItems;
  return viewItems.filter((item) => (allowed[role] || []).includes(item.id));
}

function formatTime(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatPatient(appointment) {
  return appointment.patient?.fullName || appointment.patientName || "Patient";
}

function formatPractitioner(appointment) {
  return appointment.practitioner?.name || appointment.service || "Practitioner";
}

function invoiceTotal(invoice) {
  const gross = (invoice.items || []).reduce((sum, item) => sum + (item.quantity || 0) * (item.rate || 0), 0);
  return Math.max(gross - (invoice.discount || 0), 0);
}

function statusClass(status = "") {
  if (["urgent", "high", "overdue", "partial", "draft", "no-show", "low stock"].includes(status)) return "risk";
  if (["paid", "completed", "converted", "done", "active", "ready"].includes(status)) return "good";
  return "";
}

function StatCard({ label, value, trend, icon: Icon, tone = "" }) {
  return (
    <motion.article
      className={`stat-card ${tone ? `stat-${tone}` : ""}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="stat-topline">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <small>{trend}</small>
    </motion.article>
  );
}

function LoginPanel({ onLogin }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const session = await loginStaff(form);
      storeSession(session);
      onLogin(session);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="dashboard-section staff-login-section" id="dashboard">
      <div className="staff-login">
        <div>
          <p className="eyebrow">Staff console</p>
          <h2>Sign in to view centre operations.</h2>
          <p>
            The public website stays focused. Patient, referral, billing and director analytics open only after staff
            authentication.
          </p>
        </div>
        <form className="contact-form login-form" onSubmit={handleSubmit}>
          <label>
            Staff email
            <input
              type="email"
              placeholder="name@mindful.local"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              required
            />
          </label>
          {error && <p className="form-status error-status">{error}</p>}
          <button className="primary-button full" type="submit" disabled={loading}>
            <ShieldCheck size={18} />
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </section>
  );
}

function useResourceRecords({ activeView, token, query, refreshSignal }) {
  const config = getViewConfig(activeView);
  const resource = config.resource;
  const [state, setState] = useState({ records: [], loading: false, error: "" });

  useEffect(() => {
    if (!token || !resource) {
      setState({ records: [], loading: false, error: "" });
      return undefined;
    }

    let active = true;
    setState({ records: [], loading: true, error: "" });
    const timeoutId = window.setTimeout(() => {
      listRecords(resource, { token, q: query, limit: 40 })
        .then((records) => {
          if (active) setState({ records, loading: false, error: "" });
        })
        .catch((error) => {
          if (active) setState({ records: [], loading: false, error: error.message });
        });
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [resource, token, query, refreshSignal]);

  return state;
}

function DirectorView({ data }) {
  const metrics = data.metrics || {};
  const serviceDemand = data.analytics?.serviceDemand || [];
  const referralMix = Object.entries(data.analytics?.referralMix || {});
  const patientStatus = Object.entries(data.analytics?.patientStatus || {});
  const maxDemand = Math.max(...serviceDemand.map((item) => item.count), 1);
  const billed = Number(metrics.billedThisMonth || 0);
  const collected = Number(metrics.revenueThisMonth || 0);
  const collectionRate = billed > 0 ? Math.min(Math.round((collected / billed) * 100), 100) : 0;

  return (
    <div className="director-view management-director-view" aria-label="Director performance overview">
      <header className="director-heading management-director-heading">
        <div>
          <p className="director-section-kicker">Executive overview</p>
          <h3>Centre performance</h3>
          <p>Financial health, service demand and patient acquisition in one operating view.</p>
        </div>
        <span className="director-period-label">Current month</span>
      </header>

      <article className="action-panel director-panel management-financial-panel">
        <div className="director-panel-heading">
          <div className="panel-title">
            <TrendingUp size={21} />
            <div>
              <span className="director-panel-kicker">Financial performance</span>
              <h3>Revenue & collections</h3>
            </div>
          </div>
          <span className="director-period-label director-period-label-dark">Monthly</span>
        </div>
        <div className="business-grid">
          <div>
            <span>Monthly billed</span>
            <strong>{INR.format(billed)}</strong>
          </div>
          <div>
            <span>Collections received</span>
            <strong>{INR.format(collected)}</strong>
          </div>
          <div>
            <span>Outstanding balance</span>
            <strong>{INR.format(metrics.outstanding || 0)}</strong>
          </div>
          <div>
            <span>Referral conversion</span>
            <strong>{metrics.conversionRate || 0}%</strong>
          </div>
        </div>
        <div className="director-collection">
          <div className="director-collection-label">
            <span>Collection against billed amount</span>
            <strong>{collectionRate}%</strong>
          </div>
          <div
            className="director-collection-track"
            role="progressbar"
            aria-label="Collection against billed amount"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={collectionRate}
          >
            <span style={{ width: `${collectionRate}%` }} />
          </div>
        </div>
        {(data.businessInsights || []).length > 0 && (
          <div className="insight-list director-insights" aria-label="Business insights">
            {(data.businessInsights || []).map((insight) => (
              <p key={insight}>{insight}</p>
            ))}
          </div>
        )}
      </article>

      <article className="table-panel director-demand-panel management-analytics-panel">
        <div className="panel-title">
          <BarChart3 size={21} />
          <div>
            <span className="director-card-kicker">Service portfolio</span>
            <h3>Appointment demand</h3>
          </div>
        </div>
        <div className="bar-list">
          {serviceDemand.length ? (
            serviceDemand.map((item) => (
              <div className="bar-row" key={item.service}>
                <span>{item.service || "Unspecified"}</span>
                <div><i style={{ width: `${(item.count / maxDemand) * 100}%` }} /></div>
                <b>{item.count}</b>
              </div>
            ))
          ) : (
            <p className="empty-state">No appointment demand recorded this month.</p>
          )}
        </div>
      </article>

      <article className="table-panel director-mix-panel management-analytics-panel">
        <div className="panel-title">
          <UsersRound size={21} />
          <div>
            <span className="director-card-kicker">Care activity</span>
            <h3>Patient mix</h3>
          </div>
        </div>
        <div className="mix-list">
          {patientStatus.length ? patientStatus.map(([status, count]) => (
            <span key={status}>{status}: <strong>{count}</strong></span>
          )) : <p className="empty-state">No patient records yet.</p>}
        </div>
      </article>

      <article className="table-panel director-referral-panel management-analytics-panel">
        <div className="panel-title">
          <ClipboardCheck size={21} />
          <div>
            <span className="director-card-kicker">Acquisition channels</span>
            <h3>Referral sources</h3>
          </div>
        </div>
        <div className="mix-list">
          {referralMix.length ? referralMix.map(([source, count]) => (
            <span key={source}>{source}: <strong>{count}</strong></span>
          )) : <p className="empty-state">No new referrals this month.</p>}
        </div>
      </article>
    </div>
  );
}
function AppointmentList({ appointments = [] }) {
  return (
    <div className="appointment-list management-appointment-list">
      {appointments.length ? appointments.map((appointment) => (
        <div className="appointment-row" key={appointment._id}>
          <time>{formatTime(appointment.startsAt)}</time>
          <div>
            <strong>{formatPatient(appointment)}</strong>
            <span>{appointment.service} - {formatPractitioner(appointment)}</span>
          </div>
          <mark className={statusClass(appointment.status)}>{appointment.status}</mark>
        </div>
      )) : <p className="empty-state">No appointments scheduled today.</p>}
    </div>
  );
}

function PriorityWork({ data }) {
  const openTasks = data.openTasks || [];
  const urgentReferrals = data.urgentReferrals || [];
  const lowStock = data.lowStock || [];

  return (
    <article className="action-panel management-priority-panel">
      <div className="panel-title">
        <ClipboardCheck size={21} />
        <h3>Priority work</h3>
      </div>
      <ul className="priority-list">
        {urgentReferrals.slice(0, 3).map((referral) => (
          <li key={referral._id}>
            <strong>{referral.patientName}</strong>
            <span>Urgent {referral.sourceType} referral</span>
          </li>
        ))}
        {openTasks.slice(0, 4).map((task) => (
          <li key={task._id}>
            <strong>{task.title}</strong>
            <span>{task.department} - {task.priority}</span>
          </li>
        ))}
        {!urgentReferrals.length && !openTasks.length && <li>No open tasks.</li>}
      </ul>
      <div className="warning">
        <AlertTriangle size={20} />
        {lowStock.length
          ? `${lowStock.length} inventory item(s) need reorder.`
          : "No low-stock alerts right now."}
      </div>
    </article>
  );
}

function CashWatch({ data }) {
  const invoices = data.unpaidInvoices || [];

  return (
    <article className="table-panel management-cash-panel">
      <div className="panel-title">
        <IndianRupee size={21} />
        <h3>Cash watch</h3>
      </div>
      <div className="compact-record-list">
        {invoices.length ? invoices.map((invoice) => {
          const total = invoiceTotal(invoice);
          const due = Math.max(total - (invoice.paidAmount || 0), 0);
          return (
            <div className="compact-record" key={invoice._id}>
              <div>
                <strong>{invoice.patient?.fullName || invoice.invoiceNo || "Invoice"}</strong>
                <span>{invoice.status} - due {INR.format(due)}</span>
              </div>
              <mark className={statusClass(invoice.status)}>{invoice.status}</mark>
            </div>
          );
        }) : <p className="empty-state">No draft or partial invoices.</p>}
      </div>
    </article>
  );
}

function OverviewWorkspace({ data, isDirector }) {
  return (
    <>
      <div className="stats-grid management-stats-grid">
        <StatCard
          label="Active patients"
          value={data.metrics.activePatients ?? "--"}
          trend={`${data.metrics.newPatientsThisMonth ?? 0} new this month`}
          icon={UsersRound}
        />
        <StatCard
          label="Appointments today"
          value={data.metrics.appointmentsToday ?? "--"}
          trend={`${data.metrics.checkedInToday ?? 0} checked in, ${data.metrics.noShowsToday ?? 0} no-show`}
          icon={CalendarClock}
        />
        <StatCard
          label="Open referrals"
          value={data.metrics.referrals ?? "--"}
          trend={`${data.metrics.urgentReferrals ?? 0} urgent, ${data.metrics.conversionRate ?? 0}% conversion`}
          icon={TrendingUp}
          tone={data.metrics.urgentReferrals ? "risk" : ""}
        />
        <StatCard
          label="Collections"
          value={INR.format(data.metrics.revenueThisMonth || 0)}
          trend={`${INR.format(data.metrics.outstanding || 0)} outstanding`}
          icon={IndianRupee}
          tone={data.metrics.outstanding ? "risk" : ""}
        />
      </div>

      {isDirector && <DirectorView data={data} />}

      <div className="console-grid management-console-grid">
        <article className="table-panel">
          <div className="panel-title">
            <CalendarClock size={21} />
            <h3>Today's appointments</h3>
          </div>
          <AppointmentList appointments={data.todaysAppointments || []} />
        </article>
        <PriorityWork data={data} />
      </div>

      <div className="console-grid lower-console-grid management-console-grid">
        <CashWatch data={data} />
        <article className="action-panel">
          <div className="panel-title">
            <AlertTriangle size={21} />
            <h3>Operational risks</h3>
          </div>
          <div className="risk-stack">
            <span><strong>{data.metrics.lowStockCount || 0}</strong> low-stock items</span>
            <span><strong>{data.metrics.overdueTasks || 0}</strong> overdue tasks</span>
            <span><strong>{data.metrics.unpaidInvoiceCount || 0}</strong> invoices pending</span>
          </div>
        </article>
      </div>
    </>
  );
}

function describeRecord(viewId, record) {
  const excerpt = (value, limit = 90) => {
    const text = String(value || "").trim();
    if (!text) return "Not provided";
    return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
  };
  const displayDate = (value) => value
    ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value))
    : "Date not recorded";

  if (viewId === "patients") {
    return {
      title: record.fullName,
      meta: `MRN: ${record.mrn || "Not assigned"} · Phone: ${record.phone || "Not provided"}`,
      detail: `Guardian: ${record.guardianName || "Not listed"} · Services: ${(record.services || []).join(", ") || excerpt(record.primaryConcern, 100)}`,
      status: record.status
    };
  }

  if (viewId === "referrals") {
    return {
      title: record.patientName,
      meta: `Source: ${record.sourceName || record.sourceType || "Not recorded"} · Phone: ${record.phone || "Not provided"}`,
      detail: `Concern: ${excerpt(record.concern, 100)} · Preferred contact: ${record.preferredContact || "Phone"}`,
      status: record.urgency === "urgent" ? "urgent" : record.status
    };
  }

  if (viewId === "appointments") {
    return {
      title: formatPatient(record),
      meta: `${formatDateTime(record.startsAt)} · Room: ${record.room || "Not assigned"}`,
      detail: `Service: ${record.service || "Not specified"} · Practitioner: ${formatPractitioner(record)}`,
      status: record.status
    };
  }

  if (viewId === "billing") {
    const total = invoiceTotal(record);
    const due = Math.max(total - (record.paidAmount || 0), 0);
    return {
      title: record.invoiceNo,
      meta: `Patient: ${record.patient?.fullName || "Not linked"} · Total: ${INR.format(total)}`,
      detail: `Paid: ${INR.format(record.paidAmount || 0)} · Outstanding: ${INR.format(due)}`,
      status: record.status
    };
  }

  if (viewId === "inventory") {
    return {
      title: record.name,
      meta: `Category: ${record.category || "Uncategorised"} · Available: ${record.quantity} ${record.unit || "pcs"}`,
      detail: `Reorder threshold: ${record.reorderLevel} · Vendor: ${record.vendor || "Not listed"}`,
      status: record.quantity <= record.reorderLevel ? "low stock" : "ready"
    };
  }

  if (viewId === "assessments") {
    return {
      title: `Assessment - ${(record.domains || []).join(", ") || "General"}`,
      meta: `Recorded findings: ${excerpt(record.findings, 90)}`,
      detail: `Status: ${record.status || "pending"}`,
      status: record.status
    };
  }

  if (viewId === "treatment-plans") {
    return {
      title: `Plan - ${(record.goals || "").slice(0, 50) || "Untitled"}`,
      meta: `Frequency: ${record.frequency || "Not set"} · Duration: ${record.duration || "Not set"}`,
      detail: `Status: ${record.status || "pending"}`,
      status: record.status
    };
  }

  if (viewId === "progress-notes") {
    return {
      title: `Progress note · ${record.noteType || "General"}`,
      meta: `Objective: ${excerpt(record.objective, 80)}`,
      detail: `Assessment: ${excerpt(record.assessment, 80)}`,
      status: "completed"
    };
  }

  if (viewId === "prescriptions") {
    return {
      title: `Rx - ${(record.medications || []).map(m => m.name).join(", ") || "No medications"}`,
      meta: `Prescribed: ${displayDate(record.prescribedAt)}`,
      detail: `Notes: ${excerpt(record.notes, 90)}`,
      status: record.status
    };
  }

  return {
    title: record.title,
    meta: `Department: ${record.department || "Unassigned"} · Due: ${formatDate(record.dueDate)}`,
    detail: `Priority: ${record.priority}`,
    status: record.status === "todo" && record.dueDate && new Date(record.dueDate) < new Date() ? "overdue" : record.status
  };
}

function recordActions(viewId, record, userRole) {
  if (viewId === "patients") {
    const actions = [{ label: "View Journey", action: "journey" }];
    if (record.status !== "discharged" && ["director", "admin", "reception", "coordinator"].includes(userRole)) {
      actions.push({ label: "Discharge", action: "discharge" });
    }
    return actions;
  }

  if (viewId === "referrals") {
    const actions = [];
    if (record.status === "new") actions.push({ label: "Contacted", updates: { status: "contacted" } });
    if (record.status === "contacted") actions.push({ label: "Scheduled", updates: { status: "scheduled" } });
    if (record.status === "scheduled") actions.push({ label: "Converted", updates: { status: "converted" } });
    if (["new", "contacted", "scheduled"].includes(record.status)) {
      actions.push({ label: "Convert to Patient", action: "convert" });
    }
    return actions;
  }

  if (viewId === "appointments") {
    const actions = [];
    if (record.status === "scheduled") actions.push({ label: "Check in", updates: { status: "checked-in" } });
    if (record.status === "checked-in") actions.push({ label: "Complete", updates: { status: "completed" } });
    if (["completed", "checked-in"].includes(record.status) && ["director", "admin", "accounts", "reception"].includes(userRole)) {
      actions.push({ label: "Generate Bill", action: "bill" });
    }
    return actions;
  }

  if (viewId === "billing" && ["director", "admin", "accounts"].includes(userRole)) {
    const actions = [{ label: "Payment history", action: "history" }];
    if (["draft", "partial"].includes(record.status)) actions.unshift({ label: "Record payment", action: "payment" });
    return actions;
  }

  if (viewId === "inventory" && ["director", "admin", "coordinator"].includes(userRole)) {
    return [{ label: "Stock movement", action: "stock" }, { label: "Movement history", action: "history" }];
  }

  if (viewId === "tasks" && record.status !== "done") {
    return [{ label: "Done", updates: { status: "done" } }];
  }

  return [];
}

function ReportsView({ data }) {
  const serviceMix = Object.entries(data?.analytics?.serviceMix || {}).slice(0, 8);
  const referralStatus = Object.entries(data?.analytics?.referralStatus || {});
  const appointmentStatus = Object.entries(data?.analytics?.appointmentStatusToday || {});

  return (
    <div className="reports-grid management-reports-grid">
      <article className="action-panel director-panel">
        <div className="panel-title">
          <FileText size={21} />
          <div><h3>Business diagnosis</h3><p className="resource-description">Signals and recommended actions based on current centre activity.</p></div>
        </div>
        <div className="insight-list">
          {(data?.businessInsights || []).length ? data.businessInsights.map((insight) => <p key={insight}>{insight}</p>) : <p className="empty-state">Business insights will appear as centre activity is recorded.</p>}
        </div>
      </article>
      <article className="table-panel">
        <div className="panel-title">
          <TrendingUp size={21} />
          <div><h3>Referral funnel</h3><p className="resource-description">Track how incoming enquiries progress through the referral journey.</p></div>
        </div>
        <div className="mix-list">
          {referralStatus.length ? referralStatus.map(([status, count]) => (
            <span key={status}>{status}: <strong>{count}</strong></span>
          )) : <p className="empty-state">No monthly referral activity yet.</p>}
        </div>
      </article>
      <article className="table-panel">
        <div className="panel-title">
          <CalendarClock size={21} />
          <div><h3>Today by status</h3><p className="resource-description">A snapshot of today's appointment outcomes.</p></div>
        </div>
        <div className="mix-list">
          {appointmentStatus.length ? appointmentStatus.map(([status, count]) => (
            <span key={status}>{status}: <strong>{count}</strong></span>
          )) : <p className="empty-state">No appointments today.</p>}
        </div>
      </article>
      <article className="table-panel">
        <div className="panel-title">
          <BarChart3 size={21} />
          <div><h3>Service mix</h3><p className="resource-description">Compare the services represented in recorded activity.</p></div>
        </div>
        <div className="mix-list">
          {serviceMix.length ? serviceMix.map(([service, count]) => (
            <span key={service}>{service}: <strong>{count}</strong></span>
          )) : <p className="empty-state">No service mix recorded.</p>}
        </div>
      </article>
    </div>
  );
}

function ReferralNotesEditor({ record, onSave, saving }) {
  const [notes, setNotes] = useState(record.notes || "");
  useEffect(() => setNotes(record.notes || ""), [record._id, record.notes]);
  return (
    <div className="referral-notes-editor">
      <label>
        Staff call / conversation notes
        <textarea
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Record the discussion, needs, agreed next step and follow-up..."
        />
      </label>
      <button
        className="secondary-button compact-button"
        type="button"
        disabled={saving || notes.trim() === (record.notes || "").trim()}
        onClick={() => onSave(notes)}
      >
        {saving ? "Saving notes..." : "Save conversation notes"}
      </button>
    </div>
  );
}

function ResourceBoard({ activeView, data, state, onRecordAction, actionId, actionError, userRole, onCreateAppointment }) {
  const config = getViewConfig(activeView);
  const Icon = config.icon;

  if (activeView === "reports") {
    return <ReportsView data={data} />;
  }

  const records = state.records || [];

  return (
    <article className={`table-panel resource-panel resource-panel-${activeView}`}>
      <div className="panel-title resource-title management-resource-heading">
        <Icon size={21} />
        <div>
          <h3>{config.label}</h3>
          <p className="resource-description">{viewDescriptions[activeView]}</p>
          <span className="resource-count" aria-live="polite">{records.length} {records.length === 1 ? "record" : "records"} loaded</span>
        </div>
        {activeView === "appointments" && ["director","admin","reception","coordinator"].includes(userRole) && (
          <button className="primary-button compact-button" type="button" onClick={onCreateAppointment}><Plus size={15} /> New appointment</button>
        )}
      </div>
      {state.loading && <p className="empty-state">Loading {config.label.toLowerCase()}...</p>}
      {state.error && <p className="form-status error-status">{state.error}</p>}
      {actionError && <p className="form-status error-status">{actionError}</p>}
      {!state.loading && !state.error && (
        <AnimatePresence mode="popLayout">
          {records.length ? (
            <div className={`record-grid management-record-grid management-record-grid-${activeView}`}>
              {records.map((record) => {
                const summary = describeRecord(activeView, record);
                const actions = recordActions(activeView, record, userRole);
                return (
                  <motion.div
                    className={`record-card management-record-card management-record-card-${activeView}`}
                    key={record._id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="record-main management-record-main">
                      <div>
                        <strong>{summary.title || "Untitled record"}</strong>
                        <span className="management-record-meta">{summary.meta}</span>
                      </div>
                      <mark className={statusClass(summary.status)}>{summary.status || "open"}</mark>
                    </div>
                    <p className="management-record-detail">{summary.detail}</p>
                    {activeView === "referrals" && (
                      <ReferralNotesEditor
                        record={record}
                        saving={actionId === record._id}
                        onSave={(notes) => onRecordAction(config.resource, record._id, { notes }, { action: "save-notes" })}
                      />
                    )}
                    {actions.length > 0 && (
                      <div className="record-actions management-record-actions">
                        {actions.map((action) => (
                          <button
                            className="secondary-button compact-button"
                            type="button"
                            key={action.label}
                            disabled={actionId === record._id}
                            onClick={() => onRecordAction(config.resource, record._id, action.updates, action)}
                          >
                            {actionId === record._id ? "Saving..." : action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="empty-state">No records match the current filters.</p>
          )}
        </AnimatePresence>
      )}
    </article>
  );
}

export function Dashboard() {
  const [session, setSession] = useState(getStoredSession);
  const [activeView, setActiveView] = useState(() => {
    const role = getStoredSession().user?.role;
    if (["doctor","therapist"].includes(role)) return "overview";
    if (role === "coordinator") return "patients";
    if (role === "accounts") return "billing";
    return "overview";
  });
  const [query, setQuery] = useState("");
  const [resourceRefresh, setResourceRefresh] = useState(0);
  const [actionId, setActionId] = useState("");
  const [actionError, setActionError] = useState("");
  const [operationModal, setOperationModal] = useState(null);
  const [operationHistory, setOperationHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [operationForm, setOperationForm] = useState({ amount: "", method: "cash", reference: "", type: "receipt", quantity: "", reason: "" });
  const [journeyPatientId, setJourneyPatientId] = useState(null);
  const [showBilling, setShowBilling] = useState(false);
  const [billingRecord, setBillingRecord] = useState(null);
  const [billingItems, setBillingItems] = useState([]);
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [patientsList, setPatientsList] = useState([]);
  const [practitionersList, setPractitionersList] = useState([]);
  const [staffAccounts, setStaffAccounts] = useState([]);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [appointmentSaving, setAppointmentSaving] = useState(false);
  const [appointmentError, setAppointmentError] = useState("");
  const [appointmentForm, setAppointmentForm] = useState({ patient: "", practitioner: "", service: "", startsAt: "", durationMinutes: 45, room: "" });
  const [convertReferral, setConvertReferral] = useState(null);
  const [convertForm, setConvertForm] = useState({});
  const [convertSaving, setConvertSaving] = useState(false);

  useEffect(() => {
    if (!session.token) return;
    let active = true;
    Promise.all([
      listRecords("patients", { token: session.token, limit: 100 }),
      listRecords("doctors", { token: session.token, status: "active", limit: 100 }),
      ["director", "admin"].includes(session.user?.role)
        ? fetch(`${API_BASE_URL}/staff-accounts`, { headers: { Authorization: `Bearer ${session.token}` } }).then(async (response) => {
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body.message || "Unable to load staff accounts");
            return body;
          })
        : Promise.resolve([])
    ]).then(([patients, practitioners, staff]) => {
      if (active) {
        setPatientsList(patients || []);
        setPractitionersList((practitioners || []).filter((item) => item.status !== "inactive"));
        setStaffAccounts(staff || []);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [session.token, resourceRefresh]);
  const canViewOverview = ["director","admin","reception"].includes(session.user?.role);
  const visibleViewItems = getVisibleViewItems(session.user?.role);
  const { data, loading, refreshing, error, updatedAt, refresh } = useDashboard(canViewOverview ? session.token : null);
  const resourceState = useResourceRecords({ activeView, token: session.token, query, refreshSignal: resourceRefresh });
  const isDirector = ["director", "admin"].includes(session.user?.role);
  const activeConfig = getViewConfig(activeView);

  const syncLabel = useMemo(() => {
    if (refreshing) return "Syncing";
    if (error) return "Needs attention";
    if (updatedAt) return `Live ${formatTime(updatedAt)}`;
    return "Waiting";
  }, [error, refreshing, updatedAt]);

  async function handleOperationSubmit(event) {
    event.preventDefault();
    if (!operationModal) return;
    const { type, id } = operationModal;
    const isPayment = type === "payment";
    const payload = isPayment
      ? { amount: Number(operationForm.amount), method: operationForm.method, reference: operationForm.reference }
      : { type: operationForm.type, quantity: Number(operationForm.quantity), reason: operationForm.reason, reference: operationForm.reference };
    setActionId(id);
    setActionError("");
    try {
      const endpoint = isPayment ? "/invoices/" + id + "/payments" : "/inventory/" + id + "/movements";
      const response = await fetch(API_BASE_URL + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.token },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || (isPayment ? "Payment could not be recorded" : "Stock movement could not be recorded"));
      setOperationModal(null);
      setResourceRefresh((value) => value + 1);
      if (isPayment) refresh();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setActionId("");
    }
  }

  function handleLogout() {
    clearSession();
    setSession({ token: null, user: null });
  }

  function handleRefresh() {
    refresh();
    setResourceRefresh((value) => value + 1);
  }

  async function handleRecordAction(resource, id, updates, extra) {
    if (extra?.action === "save-notes") {
      setActionId(id);
      setActionError("");
      try {
        await updateRecord(resource, id, updates, { token: session.token });
        setResourceRefresh((value) => value + 1);
      } catch (err) {
        setActionError(err.message);
      } finally {
        setActionId("");
      }
      return;
    }
    if (extra?.action === "journey") {
      setJourneyPatientId(id);
      return;
    }
    if (extra?.action === "discharge") {
      const patient = resourceState.records.find(r => r._id === id);
      if (patient) {
        setJourneyPatientId(id);
      }
      return;
    }
    if (extra?.action === "history") {
      const record = resourceState.records.find((item) => item._id === id);
      if (resource === "invoices") {
        setOperationHistory({ type: "payment", record, entries: record?.payments || [] });
      } else {
        setOperationHistory({ type: "stock", record, entries: [] });
        setHistoryLoading(true);
        try {
          const response = await fetch(`${API_BASE_URL}/inventory/${id}/movements`, { headers: { Authorization: `Bearer ${session.token}` } });
          const body = await response.json().catch(() => []);
          if (!response.ok) throw new Error(body.message || "Movement history could not be loaded");
          setOperationHistory({ type: "stock", record, entries: Array.isArray(body) ? body : [] });
        } catch (error) {
          setActionError(error.message);
        } finally {
          setHistoryLoading(false);
        }
      }
      return;
    }
    if (extra?.action === "payment" || extra?.action === "stock") {
      setOperationForm({ amount: "", method: "cash", reference: "", type: "receipt", quantity: "", reason: "" });
      setOperationModal({ type: extra.action, id, record: resourceState.records.find((record) => record._id === id) });
      setActionError("");
      return;
    }
    if (extra?.action === "bill") {
      const appointment = resourceState.records.find(r => r._id === id);
      if (appointment) {
        setBillingRecord(appointment);
        const defaultService = serviceCharges.find(s => s.service === appointment.service);
        setBillingItems([{
          description: appointment.service || "Service",
          quantity: 1,
          rate: defaultService?.rate || 0
        }]);
        setBillingError("");
        setShowBilling(true);
      }
      return;
    }
    if (extra?.action === "convert") {
      const referral = resourceState.records.find(r => r._id === id);
      if (referral) {
        setConvertForm({
          fullName: referral.patientName || "",
          phone: referral.phone || "",
          guardianName: "",
          age: "",
          gender: "",
          address: "",
          primaryConcern: referral.concern || "",
          services: []
        });
        setConvertReferral(referral);
      }
      return;
    }
    setActionId(id);
    setActionError("");
    try {
      await updateRecord(resource, id, updates, { token: session.token });
      setResourceRefresh((value) => value + 1);
      refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionId("");
    }
  }

  async function handleAppointmentSubmit(e) {
    e.preventDefault();
    setAppointmentSaving(true);
    setAppointmentError("");
    try {
      await createRecord("appointments", { ...appointmentForm, startsAt: new Date(appointmentForm.startsAt).toISOString(), durationMinutes: Number(appointmentForm.durationMinutes) }, { token: session.token });
      setShowAppointmentForm(false);
      setAppointmentForm({ patient: "", practitioner: "", service: "", startsAt: "", durationMinutes: 45, room: "" });
      setResourceRefresh((value) => value + 1);
      refresh();
    } catch (err) {
      setAppointmentError(err.message);
    } finally {
      setAppointmentSaving(false);
    }
  }

  async function handleConvertSubmit(e) {
    e.preventDefault();
    setConvertSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/referrals/${convertReferral._id}/convert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({
          fullName: convertForm.fullName,
          phone: convertForm.phone,
          guardianName: convertForm.guardianName || undefined,
          age: convertForm.age ? Number(convertForm.age) : undefined,
          gender: convertForm.gender || undefined,
          address: convertForm.address || undefined,
          primaryConcern: convertForm.primaryConcern,
          services: Array.isArray(convertForm.services) ? convertForm.services : (convertForm.services ? convertForm.services.split(",").map(s => s.trim()).filter(Boolean) : [])
        })
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to convert referral");
      }
      setConvertReferral(null);
      setConvertForm({});
      setResourceRefresh((value) => value + 1);
      refresh();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setConvertSaving(false);
    }
  }

  if (!session.token) {
    return <LoginPanel onLogin={(nextSession) => {
      setSession(nextSession);
      setActiveView(["doctor","therapist"].includes(nextSession.user?.role) ? "overview" : nextSession.user?.role === "coordinator" ? "patients" : nextSession.user?.role === "accounts" ? "billing" : "overview");
    }} />;
  }

  return (
    <section className="dashboard-section" id="dashboard">
      <div className={`dashboard-shell dashboard-role-${session.user?.role || "staff"}`}>
        <aside className="sidebar" aria-label="Staff workspace navigation">
          <div className="sidebar-brand">
            <div className="brand compact">
              <span className="brand-mark">M</span>
              <span>
                <strong>Mindful</strong>
                <small>{isDirector ? "Director console" : "Staff console"}</small>
              </span>
            </div>
            <div className="sidebar-context">
              <span className="sidebar-context-label">WORKSPACE</span>
              <strong>Centre operations</strong>
              <span>Care • Coordination • Outcomes</span>
            </div>
          </div>
          {Object.entries(
            visibleViewItems.reduce((acc, item) => {
              const section = item.section || "Other";
              if (!acc[section]) acc[section] = [];
              acc[section].push(item);
              return acc;
            }, {})
          ).map(([section, items]) => (
            <div className="sidebar-section" key={section}>
              <div className="sidebar-section-title">{section}</div>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    className={item.id === activeView ? "side-link active" : "side-link"}
                    type="button"
                    key={item.id}
                    aria-current={item.id === activeView ? "page" : undefined}
                    onClick={() => {
                      setActiveView(item.id);
                      setQuery("");
                      setActionError("");
                    }}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
          <div className="sidebar-footer">
            <span className="sidebar-footer-indicator" />
            <span>Mindful Centre · Srinagar</span>
          </div>
        </aside>
        <div className="console">
          <div className="console-header">
            <div>
              <p className="eyebrow">{isDirector ? "Director command centre" : "Operations dashboard"}</p>
              <h2>{activeView === "overview" ? (["doctor","therapist"].includes(session.user?.role) ? "My clinical activity" : "Whole-centre operating view") : activeConfig.label}</h2>
              <p className="console-user">Signed in as {session.user?.name} ({session.user?.role})</p>
            </div>
            <div className="console-tools">
              <span className={`sync-pill ${error ? "sync-error" : ""} ${refreshing ? "is-syncing" : ""}`}>
                {syncLabel}
              </span>
              <label className="search-box">
                <Search size={18} />
                <input
                  placeholder={activeConfig.resource ? `Search ${activeConfig.label.toLowerCase()}` : "Board search"}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  disabled={!activeConfig.resource}
                />
              </label>
              <button className="icon-button" type="button" onClick={handleRefresh} aria-label="Refresh dashboard">
                <RefreshCw size={18} />
              </button>
              <button className="icon-button" type="button" onClick={handleLogout} aria-label="Sign out">
                <LogOut size={18} />
              </button>
            </div>
          </div>

          {loading && <p className="empty-state">Loading live centre data...</p>}
          {error && <p className="form-status error-status">{error}</p>}

          {(!canViewOverview || data) && (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                className="workspace-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
              {activeView === "staff" ? (
                <StaffBoard token={session.token} currentRole={session.user?.role} onChanged={() => setResourceRefresh((value) => value + 1)} />
              ) : activeView === "practitioners" ? (
                <PractitionerBoard
                  token={session.token}
                  staffAccounts={staffAccounts}
                  onChanged={() => setResourceRefresh((value) => value + 1)}
                />
              ) : activeView === "overview" ? (
                ["doctor", "therapist"].includes(session.user?.role)
                  ? <PractitionerDashboard token={session.token} />
                  : <OverviewWorkspace data={data} isDirector={isDirector} />
              ) : ["assessments", "treatment-plans", "progress-notes", "prescriptions"].includes(activeView) ? (
                <ClinicalBoard
                  activeView={activeView}
                  token={session.token}
                  query={query}
                  refreshSignal={resourceRefresh}
                  patients={patientsList}
                  patientId={journeyPatientId}
                  userRole={session.user?.role}
                  onCreateAppointment={() => { setAppointmentError(""); setShowAppointmentForm(true); }}
                />
              ) : (
                <ResourceBoard
                  activeView={activeView}
                  data={data}
                  state={resourceState}
                  onRecordAction={handleRecordAction}
                  actionId={actionId}
                  actionError={actionError}
                  userRole={session.user?.role}
                  onCreateAppointment={() => { setAppointmentError(""); setShowAppointmentForm(true); }}
                />
              )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {journeyPatientId && (
        <PatientJourney
          patient={resourceState.records.find(r => r._id === journeyPatientId) || { _id: journeyPatientId }}
          token={session.token}
          userRole={session.user?.role}
          onClose={() => setJourneyPatientId(null)}
          onDischarge={async (updates) => {
            await updateRecord("patients", journeyPatientId, updates, { token: session.token });
            setResourceRefresh((v) => v + 1);
            refresh();
          }}
        />
      )}

      {convertReferral && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setConvertReferral(null)}
        >
          <motion.div
            className="modal"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Convert Enquiry to Patient</h3>
              <button className="icon-button" type="button" onClick={() => setConvertReferral(null)}>✕</button>
            </div>
            <form onSubmit={handleConvertSubmit} className="clinical-form">
              <label>
                Full Name
                <input type="text" value={convertForm.fullName || ""} onChange={(e) => setConvertForm({ ...convertForm, fullName: e.target.value })} required />
              </label>
              <label>
                Phone
                <input type="text" value={convertForm.phone || ""} onChange={(e) => setConvertForm({ ...convertForm, phone: e.target.value })} required />
              </label>
              <label>
                Guardian Name
                <input type="text" value={convertForm.guardianName || ""} onChange={(e) => setConvertForm({ ...convertForm, guardianName: e.target.value })} />
              </label>
              <div className="form-row">
                <label>
                  Age
                  <input type="number" min="0" value={convertForm.age || ""} onChange={(e) => setConvertForm({ ...convertForm, age: e.target.value })} />
                </label>
                <label>
                  Gender
                  <select value={convertForm.gender || ""} onChange={(e) => setConvertForm({ ...convertForm, gender: e.target.value })}>
                    <option value="">Select...</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </label>
              </div>
              <label>
                Address
                <input type="text" value={convertForm.address || ""} onChange={(e) => setConvertForm({ ...convertForm, address: e.target.value })} />
              </label>
              <label>
                Primary Concern
                <textarea rows={3} value={convertForm.primaryConcern || ""} onChange={(e) => setConvertForm({ ...convertForm, primaryConcern: e.target.value })} required />
              </label>
              <label>
                Services
                <ChipInput
                  value={Array.isArray(convertForm.services) ? convertForm.services : (typeof convertForm.services === "string" ? convertForm.services.split(",").map(s => s.trim()).filter(Boolean) : [])}
                  onChange={(val) => setConvertForm({ ...convertForm, services: val.join(", ") })}
                  placeholder="Speech Therapy, OT..."
                  suggestions={services}
                />
              </label>
              <div className="modal-actions">
                <button className="primary-button" type="submit" disabled={convertSaving}>
                  {convertSaving ? "Creating..." : "Create Patient"}
                </button>
                <button className="secondary-button" type="button" onClick={() => setConvertReferral(null)}>Cancel</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {showAppointmentForm && (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAppointmentForm(false)}>
          <motion.div className="modal modal-appointment" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Schedule appointment</h3>
              <button className="icon-button" type="button" onClick={() => setShowAppointmentForm(false)}>✕</button>
            </div>
            <form className="clinical-form" onSubmit={handleAppointmentSubmit}>
              {appointmentError && <p className="form-status error-status">{appointmentError}</p>}
              <label>Patient
                <select required value={appointmentForm.patient} onChange={(e) => setAppointmentForm({ ...appointmentForm, patient: e.target.value })}>
                  <option value="">Select patient</option>
                  {patientsList.filter((patient) => !["on-hold","discharged"].includes(patient.status)).map((patient) => <option key={patient._id} value={patient._id}>{patient.fullName} · {patient.mrn}</option>)}
                </select>
              </label>
              <label>Practitioner
                <select required value={appointmentForm.practitioner} onChange={(e) => setAppointmentForm({ ...appointmentForm, practitioner: e.target.value })}>
                  <option value="">Select practitioner</option>
                  {practitionersList.map((person) => <option key={person._id} value={person._id}>{person.name} · {person.discipline}</option>)}
                </select>
              </label>
              <label>Service
                <input required maxLength={120} value={appointmentForm.service} onChange={(e) => setAppointmentForm({ ...appointmentForm, service: e.target.value })} placeholder="Speech Therapy, Occupational Therapy..." />
              </label>
              <div className="form-row">
                <label>Date & time
                  <input required type="datetime-local" min={new Date().toISOString().slice(0,16)} value={appointmentForm.startsAt} onChange={(e) => setAppointmentForm({ ...appointmentForm, startsAt: e.target.value })} />
                </label>
                <label>Duration
                  <select value={appointmentForm.durationMinutes} onChange={(e) => setAppointmentForm({ ...appointmentForm, durationMinutes: Number(e.target.value) })}>
                    {[15,30,45,60,75,90,105,120,135,150,165,180,195,210,225,240].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
                  </select>
                </label>
              </div>
              <label>Room (optional)
                <input maxLength={80} value={appointmentForm.room} onChange={(e) => setAppointmentForm({ ...appointmentForm, room: e.target.value })} placeholder="Room 1" />
              </label>
              <div className="modal-actions">
                <button className="primary-button" type="submit" disabled={appointmentSaving}>{appointmentSaving ? "Scheduling..." : "Schedule appointment"}</button>
                <button className="secondary-button" type="button" onClick={() => setShowAppointmentForm(false)}>Cancel</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {operationModal && (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOperationModal(null)}>
          <motion.div className="modal modal-operation" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{operationModal.type === "payment" ? "Record invoice payment" : "Record stock movement"}</h3>
              <button className="icon-button" type="button" onClick={() => setOperationModal(null)} aria-label="Close">✕</button>
            </div>
            {actionError && <p className="form-status error-status">{actionError}</p>}
            <form className="clinical-form" onSubmit={handleOperationSubmit}>
              {operationModal.type === "payment" ? (
                <>
                  <p>{operationModal.record?.invoiceNo || "Invoice"} · Outstanding ₹{Math.max(invoiceTotal(operationModal.record || {}) - Number(operationModal.record?.paidAmount || 0), 0).toFixed(2)}</p>
                  <label>Amount (₹)
                    <input type="number" min="0.01" step="0.01" max={Math.max(invoiceTotal(operationModal.record || {}) - Number(operationModal.record?.paidAmount || 0), 0)} required value={operationForm.amount} onChange={(event) => setOperationForm({ ...operationForm, amount: event.target.value })} />
                  </label>
                  <label>Payment method
                    <select required value={operationForm.method} onChange={(event) => setOperationForm({ ...operationForm, method: event.target.value })}>
                      <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank">Bank transfer</option>
                    </select>
                  </label>
                  <label>Reference (optional)
                    <input maxLength="120" value={operationForm.reference} onChange={(event) => setOperationForm({ ...operationForm, reference: event.target.value })} />
                  </label>
                </>
              ) : (
                <>
                  <label>Movement type
                    <select required value={operationForm.type} onChange={(event) => setOperationForm({ ...operationForm, type: event.target.value })}>
                      <option value="receipt">Stock receipt</option><option value="issue">Stock issue</option><option value="adjustment">Set stock balance</option>
                    </select>
                  </label>
                  <label>{operationForm.type === "adjustment" ? "New stock quantity" : "Quantity"}
                    <input type="number" min="0.01" step="0.01" required value={operationForm.quantity} onChange={(event) => setOperationForm({ ...operationForm, quantity: event.target.value })} />
                  </label>
                  <label>Reason
                    <textarea rows={3} maxLength="300" required value={operationForm.reason} onChange={(event) => setOperationForm({ ...operationForm, reason: event.target.value })} />
                  </label>
                  <label>Reference (optional)
                    <input maxLength="120" value={operationForm.reference} onChange={(event) => setOperationForm({ ...operationForm, reference: event.target.value })} />
                  </label>
                </>
              )}
              <div className="modal-actions">
                <button className="primary-button" type="submit" disabled={actionId === operationModal.id}>{actionId === operationModal.id ? "Saving..." : operationModal.type === "payment" ? "Record payment" : "Save movement"}</button>
                <button className="secondary-button" type="button" onClick={() => setOperationModal(null)}>Cancel</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      {operationHistory && (
        <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOperationHistory(null)}>
          <motion.div className="modal" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{operationHistory.type === "payment" ? "Payment history" : "Stock movement history"}</h3>
              <button className="icon-button" type="button" onClick={() => setOperationHistory(null)} aria-label="Close">✕</button>
            </div>
            <p>{operationHistory.record?.invoiceNo || operationHistory.record?.name || "Record"}</p>
            {historyLoading ? <p className="empty-state">Loading history...</p> : operationHistory.entries.length ? (
              <div className="insight-list">
                {operationHistory.entries.map((entry, index) => (
                  <div className="history-entry" key={entry._id || index}>
                    {operationHistory.type === "payment" ? (
                      <>
                        <strong>{INR.format(Number(entry.amount || 0))} · {entry.method || "Payment"}</strong>
                        <span>{formatDateTime(entry.receivedAt)} · {entry.receivedBy?.name || "Staff"}</span>
                        {entry.reference && <span>Reference: {entry.reference}</span>}
                        {entry.notes && <span>{entry.notes}</span>}
                      </>
                    ) : (
                      <>
                        <strong>{entry.type} · {entry.quantity} {operationHistory.record?.unit || ""}</strong>
                        <span>{formatDateTime(entry.createdAt)} · {entry.performedBy?.name || "Staff"}</span>
                        <span>Stock: {entry.previousQuantity} → {entry.newQuantity}</span>
                        <span>{entry.reason}</span>
                        {entry.reference && <span>Reference: {entry.reference}</span>}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : <p className="empty-state">No history has been recorded for this item yet.</p>}
          </motion.div>
        </motion.div>
      )}
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
              <button className="icon-button" type="button" onClick={() => setShowBilling(false)}>✕</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setBillingSaving(true);
              setBillingError("");
              try {
                const patientId = billingRecord?.patient?._id || billingRecord?.patient;
                const response = await fetch(`${API_BASE_URL}/invoices`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.token}`
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
                setResourceRefresh((v) => v + 1);
                refresh();
              } catch (err) {
                setBillingError(err.message);
              } finally {
                setBillingSaving(false);
              }
            }} className="clinical-form">
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
                <button className="secondary-button" type="button" onClick={() => setShowBilling(false)}>Cancel</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </section>
  );
}
