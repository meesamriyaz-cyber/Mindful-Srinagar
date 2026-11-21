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
  WalletCards,
  Images,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useMemo, useState } from "react";
import { useDashboard } from "../hooks/useDashboard.js";
import { clearSession, getStoredSession, listRecords, loginStaff, storeSession, updateRecord, createRecord, listReferralOwners, logReferralFollowUp, listTaskAssignees, createInvoice, API_BASE_URL, requestStaffPasswordReset, completeStaffPasswordReset } from "../lib/api.js";
import { ClinicalBoard } from "./ClinicalBoard.jsx";
import { MediaLibrary } from "./MediaLibrary.jsx";
import { ContentStudio } from "./ContentStudio.jsx";
import { PatientJourney } from "./PatientJourney.jsx";
import { PractitionerBoard } from "./PractitionerBoard.jsx";
import { PractitionerDashboard } from "./PractitionerDashboard.jsx";
import { StaffBoard } from "./StaffBoard.jsx";
import { ChipInput } from "./ChipInput.jsx";
import { useAccessibleDialog } from "../hooks/useAccessibleDialog.js";
import { serviceCharges, services } from "../data/centreData.js";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card.jsx";
import { Badge } from "./ui/badge.jsx";
import "./director-dashboard.css";
import "./dashboard-ux.css";

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
  { id: "reports", label: "Reports", resource: null, icon: BarChart3, section: "System" },
  { id: "media-library", label: "Media Library", resource: null, icon: Images, section: "System", roles: ["director", "admin"] },
  { id: "content-studio", label: "Content Studio", resource: null, icon: FileText, section: "System", roles: ["director", "admin"] }
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
  reports: "Understand service activity, referral movement and daily operating patterns.",
  "media-library": "Manage centre photographs and videos, metadata and consent review.",
  "content-studio": "Create and publish centre stories, news, events and photo galleries."
};
function getVisibleViewItems(role) {
  const allowed = {
    reception: ["overview","patients","referrals","appointments","billing","tasks","reports"],
    coordinator: ["patients","referrals","appointments","inventory","tasks"],
    doctor: ["overview","patients","appointments","assessments","treatment-plans","progress-notes","prescriptions","tasks"],
    therapist: ["overview","patients","appointments","assessments","treatment-plans","progress-notes","tasks"],
    accounts: ["billing","tasks"]
  };
  if (role === "director") return viewItems;
  if (role === "admin") return viewItems.filter((item) => item.id !== "reports");
  return viewItems.filter((item) => (item.roles ? item.roles.includes(role) : (allowed[role] || []).includes(item.id)));
}

function toValidDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(value) {
  const date = toValidDate(value);
  if (!date) return "--";
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDate(value) {
  const date = toValidDate(value);
  if (!date) return "Not set";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatDateTime(value) {
  const date = toValidDate(value);
  if (!date) return "Not scheduled";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
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

function LoginPanel({ onLogin, initialNotice = "" }) {
  const initialResetToken = new URLSearchParams(window.location.search).get("resetToken") || "";
  const [mode, setMode] = useState(initialResetToken ? "reset" : "login");
  const [form, setForm] = useState({ email: "", password: "" });
  const [resetPassword, setResetPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken] = useState(initialResetToken);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(initialNotice);
  const [loading, setLoading] = useState(false);

  function changeMode(nextMode) {
    setError("");
    setNotice("");
    if (nextMode === "login" && new URLSearchParams(window.location.search).has("resetToken")) {
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    }
    setMode(nextMode);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setNotice("");
    setLoading(true);
    try {
      if (mode === "forgot") {
        const result = await requestStaffPasswordReset(form.email);
        setNotice(result.message);
      } else if (mode === "reset") {
        if (resetPassword !== confirmPassword) throw new Error("Passwords do not match.");
        const result = await completeStaffPasswordReset(resetToken, resetPassword);
        setNotice(result.message);
        setMode("login");
        setForm((current) => ({ ...current, password: "" }));
        setResetPassword("");
        setConfirmPassword("");
        window.history.replaceState({}, "", window.location.pathname + "#staff");
      } else {
        const session = await loginStaff(form);
        storeSession(session);
        onLogin(session);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const heading = mode === "forgot" ? "Reset your staff password." : mode === "reset" ? "Choose a new password." : "Sign in to view centre operations.";

  return (
    <section className="dashboard-section staff-login-section" id="dashboard">
      <div className="staff-login">
        <div>
          <p className="eyebrow">Staff console</p>
          <h2>{heading}</h2>
          <p>
            {mode === "forgot"
              ? "Enter the personal email address you use to sign in. If an active account exists, we will send a secure reset link."
              : mode === "reset"
                ? "Choose a strong password of at least 12 characters. The reset link can only be used once and expires after 30 minutes."
                : "The public website stays focused. Patient, referral, billing and director analytics open only after staff authentication."}
          </p>
        </div>
        <form className="contact-form login-form" onSubmit={handleSubmit}>
          {mode !== "reset" && (
            <label>
              Staff email
              <input
                type="email"
                placeholder="name@example.com"
                autoComplete="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </label>
          )}
          {mode === "login" && (
            <label>
              Password
              <input
                type="password"
                placeholder="Password"
                autoComplete="current-password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
              />
            </label>
          )}
          {mode === "reset" && (
            <>
              <label>
                New password
                <input type="password" minLength={12} maxLength={128} autoComplete="new-password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} required />
              </label>
              <label>
                Confirm new password
                <input type="password" minLength={12} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
              </label>
            </>
          )}
          {error && <p className="form-status error-status" role="alert" aria-live="assertive">{error}</p>}
          {notice && <p className="form-status success-status" role="status" aria-live="polite">{notice}</p>}
          {loading && (
            <div className="login-wait-toast" role="status" aria-live="polite">
              <span className="login-wait-spinner" aria-hidden="true" />
              <span><strong>{mode === "login" ? "Connecting securely…" : "Please wait…"}</strong><small>{mode === "login" ? "The server may be waking up. Please wait while we sign you in." : "We are securely processing your request."}</small></span>
            </div>
          )}
          <button className="primary-button full" type="submit" disabled={loading || (mode === "reset" && !resetToken)}>
            <ShieldCheck size={18} />
            {loading ? "Please wait..." : mode === "forgot" ? "Send reset link" : mode === "reset" ? "Set new password" : "Sign in"}
          </button>
          {mode === "login" && (
            <button className="secondary-button full" type="button" onClick={() => changeMode("forgot")}>Forgot password?</button>
          )}
          {mode !== "login" && (
            <button className="secondary-button full" type="button" onClick={() => changeMode("login")}>Back to sign in</button>
          )}
          {mode === "reset" && !resetToken && <p className="form-status error-status" role="alert">This reset link is missing. Request a new password reset email.</p>}
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
  const referralMix = Object.entries(data.analytics?.referralMix || {}).sort((a, b) => Number(b[1]) - Number(a[1]));
  const patientStatus = Object.entries(data.analytics?.patientStatus || {}).sort((a, b) => Number(b[1]) - Number(a[1]));
  const maxDemand = Math.max(...serviceDemand.map((item) => Number(item.count) || 0), 1);
  const maxReferral = Math.max(...referralMix.map(([, count]) => Number(count) || 0), 1);
  const billed = Number(metrics.billedThisMonth || 0);
  const collected = Number(metrics.revenueThisMonth || 0);
  const outstanding = Number(metrics.outstanding || 0);
  const collectionRate = billed > 0 ? Math.min(Math.max(Math.round((collected / billed) * 100), 0), 100) : 0;
  const insights = data.businessInsights || [];

  return (
    <section className="director-command-centre" aria-label="Director performance overview">
      <header className="director-command-heading">
        <div>
          <p className="director-command-eyebrow">EXECUTIVE COMMAND CENTRE</p>
          <h3>Centre performance</h3>
          <p>A clear view of financial health, care activity and where demand is coming from.</p>
        </div>
        <Badge variant="success" className="director-live-badge"><span className="director-live-dot" /> Current month</Badge>
      </header>

      <Card className="director-finance-card">
        <CardHeader className="director-finance-header">
          <div className="director-card-heading">
            <span className="director-icon-tile"><IndianRupee size={20} /></span>
            <div>
              <p>FINANCIAL PERFORMANCE</p>
              <CardTitle>Revenue & collections</CardTitle>
              <CardDescription>Monthly billing, receipts and outstanding balances</CardDescription>
            </div>
          </div>
          <Badge variant="secondary">Monthly view</Badge>
        </CardHeader>
        <CardContent>
          <div className="director-finance-metrics">
            <div className="director-finance-metric">
              <span>Amount billed</span>
              <strong>{INR.format(billed)}</strong>
              <small>Invoices generated this month</small>
            </div>
            <div className="director-finance-metric is-positive">
              <span>Collected</span>
              <strong>{INR.format(collected)}</strong>
              <small>Payments received</small>
            </div>
            <div className="director-finance-metric is-attention">
              <span>Outstanding</span>
              <strong>{INR.format(outstanding)}</strong>
              <small>Balance yet to be collected</small>
            </div>
            <div className="director-finance-metric">
              <span>Referral conversion</span>
              <strong>{Number(metrics.conversionRate || 0)}<i>%</i></strong>
              <small>Enquiries converted to patients</small>
            </div>
          </div>
          <div className="director-collection-progress">
            <div className="director-progress-copy">
              <div><strong>Collection progress</strong><span>Collected against total billed</span></div>
              <strong>{collectionRate}%</strong>
            </div>
            <div className="director-progress-track" role="progressbar" aria-label="Collection against billed amount" aria-valuemin={0} aria-valuemax={100} aria-valuenow={collectionRate}>
              <span style={{ width: `${collectionRate}%` }} />
            </div>
          </div>
          {insights.length > 0 && (
            <div className="director-insight-strip">
              <div className="director-insight-title"><TrendingUp size={17} /><strong>Business signals</strong></div>
              <div className="director-insight-items">
                {insights.slice(0, 3).map((insight) => <p key={insight}>{insight}</p>)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="director-analytics-grid">
        <Card className="director-analytics-card director-demand-card">
          <CardHeader>
            <div className="director-card-heading">
              <span className="director-icon-tile is-teal"><BarChart3 size={19} /></span>
              <div><p>SERVICE PORTFOLIO</p><CardTitle>Appointment demand</CardTitle><CardDescription>Services by recorded appointment volume</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent>
            {serviceDemand.length ? (
              <div className="director-demand-list">
                {serviceDemand.map((item) => {
                  const count = Number(item.count) || 0;
                  const width = Math.max(0, Math.min((count / maxDemand) * 100, 100));
                  return <div className="director-demand-row" key={item.service}>
                    <div className="director-demand-label"><span>{item.service || "Unspecified"}</span><strong>{count}</strong></div>
                    <div className="director-demand-track"><span style={{ width: `${width}%` }} /></div>
                  </div>;
                })}
              </div>
            ) : <div className="director-empty-state"><BarChart3 size={22} /><strong>No service demand yet</strong><span>Appointment activity will appear here as it is recorded.</span></div>}
          </CardContent>
        </Card>

        <Card className="director-analytics-card director-patient-card">
          <CardHeader>
            <div className="director-card-heading">
              <span className="director-icon-tile is-lilac"><UsersRound size={19} /></span>
              <div><p>CARE ACTIVITY</p><CardTitle>Patient mix</CardTitle><CardDescription>Current patient records by status</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent>
            {patientStatus.length ? (
              <div className="director-patient-status-list">
                {patientStatus.map(([status, count]) => (
                  <div className="director-patient-status" key={status}>
                    <span className="director-status-marker" />
                    <span>{status.replaceAll("-", " ")}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            ) : <div className="director-empty-state"><UsersRound size={22} /><strong>No patient records yet</strong><span>Patient status distribution will appear here.</span></div>}
          </CardContent>
        </Card>

        <Card className="director-analytics-card director-referral-card">
          <CardHeader>
            <div className="director-card-heading">
              <span className="director-icon-tile is-amber"><ClipboardCheck size={19} /></span>
              <div><p>ACQUISITION CHANNELS</p><CardTitle>Referral sources</CardTitle><CardDescription>Where incoming enquiries originate</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent>
            {referralMix.length ? (
              <div className="director-referral-list">
                {referralMix.map(([source, count]) => {
                  const width = Math.max(0, Math.min((Number(count || 0) / maxReferral) * 100, 100));
                  return <div className="director-referral-row" key={source}>
                    <div><span>{source.replaceAll("-", " ")}</span><strong>{count}</strong></div>
                    <div className="director-referral-track"><span style={{ width: `${width}%` }} /></div>
                  </div>;
                })}
              </div>
            ) : <div className="director-empty-state"><ClipboardCheck size={22} /><strong>No referral activity yet</strong><span>Referral sources will appear as enquiries are received.</span></div>}
          </CardContent>
        </Card>
      </div>
    </section>
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
        <h3>Needs attention</h3>
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
            <span>{task.department} · {task.priority} priority</span>
          </li>
        ))}
        {!urgentReferrals.length && !openTasks.length && <li><strong>No urgent work</strong><span>There are no urgent referrals or open tasks in this summary.</span></li>}
      </ul>
      {lowStock.length > 0 && (
        <div className="warning">
          <AlertTriangle size={20} />
          {lowStock.length} inventory item(s) need reorder.
        </div>
      )}
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

function OverviewWorkspace({ data, isDirector, role, onNavigate }) {
  const visibleViews = new Set(getVisibleViewItems(role).map((item) => item.id));
  const priorities = [
    ...(data.urgentReferrals || []).slice(0, 3).map((item) => ({
      id: item._id,
      title: item.patientName || "Urgent referral",
      detail: `Urgent referral · ${item.sourceType || "Source not recorded"}`,
      destination: "referrals",
      tone: "urgent"
    })),
    ...(data.openTasks || []).slice(0, 4).map((item) => ({
      id: item._id,
      title: item.title || "Open task",
      detail: `${item.department || "Unassigned"} · ${item.priority || "Normal"} priority`,
      destination: "tasks",
      tone: item.priority === "high" ? "urgent" : "task"
    })),
    ...(data.lowStock || []).slice(0, 2).map((item) => ({
      id: item._id,
      title: item.name || "Inventory item",
      detail: `Low stock · ${item.quantity ?? "--"} ${item.unit || "available"}`,
      destination: "inventory",
      tone: "warning"
    }))
  ].filter((item) => visibleViews.has(item.destination));
  const quickActions = [
    { label: "Appointments", description: "Manage today's schedule", destination: "appointments", icon: CalendarClock },
    { label: "Patients", description: "Open patient records", destination: "patients", icon: UsersRound },
    { label: "Referrals", description: "Review incoming referrals", destination: "referrals", icon: TrendingUp },
    { label: "Tasks", description: "Manage follow-up work", destination: "tasks", icon: ListChecks },
    { label: "Billing", description: "Invoices and payments", destination: "billing", icon: WalletCards },
    { label: "Inventory", description: "Stock and reorder levels", destination: "inventory", icon: PackageOpen }
  ].filter((action) => visibleViews.has(action.destination));
  const appointments = data.todaysAppointments || [];
  const checkedIn = appointments.filter((item) => item.status === "checked-in").length;
  const completed = appointments.filter((item) => item.status === "completed").length;
  const remaining = appointments.filter((item) => !["completed", "cancelled", "no-show"].includes(item.status)).length;

  return (
    <div className="operational-home">
      <section className="operational-home-intro">
        <div>
          <p className="operational-eyebrow">DAILY OPERATIONS</p>
          <h2>Today's work, at a glance</h2>
          <p>Start with the items that need attention, then move through the day's schedule.</p>
        </div>
        <div className="operational-date">
          <CalendarClock size={17} />
          <span>{new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short" }).format(new Date())}</span>
        </div>
      </section>

      <section className="operational-action-grid" aria-label="Daily priorities and schedule">
        <article className="operational-action-card">
          <header className="operational-card-heading">
            <div><ClipboardCheck size={19} /><h3>Priority queue</h3></div>
            <span className={priorities.length ? "operational-count is-attention" : "operational-count"}>{priorities.length}</span>
          </header>
          {priorities.length ? (
            <ul className="operational-priority-list">
              {priorities.map((item) => (
                <li key={item.id} className={`operational-priority-item tone-${item.tone}`}>
                  <div><strong>{item.title}</strong><span>{item.detail}</span></div>
                  <button type="button" onClick={() => onNavigate(item.destination)} aria-label={`Open ${item.destination} workspace}>Open <span aria-hidden="true">→</span></button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="operational-empty"><CheckCircle2 size={20} /><div><strong>You're clear for now</strong><span>No urgent referrals, open tasks or low-stock alerts in this summary.</span></div></div>
          )}
        </article>

        <article className="operational-action-card operational-schedule-card">
          <header className="operational-card-heading">
            <div><CalendarClock size={19} /><h3>Today's schedule</h3></div>
            <button type="button" className="operational-link-button" onClick={() => onNavigate("appointments")}>View schedule <span aria-hidden="true">→</span></button>
          </header>
          <div className="operational-schedule-summary">
            <div><strong>{appointments.length}</strong><span>Appointments</span></div>
            <div><strong>{checkedIn}</strong><span>Checked in</span></div>
            <div><strong>{completed}</strong><span>Completed</span></div>
            <div><strong>{remaining}</strong><span>Remaining</span></div>
          </div>
          <AppointmentList appointments={appointments.slice(0, 5)} />
          {appointments.length > 5 && <button className="operational-more-button" type="button" onClick={() => onNavigate("appointments")}>View all {appointments.length} appointments</button>}
        </article>
      </section>

      <section className="operational-quick-actions" aria-label="Quick access workspaces">
        <header className="operational-card-heading"><div><Plus size={19} /><h3>Quick access</h3></div><span>Jump into common work</span></header>
        <div className="operational-quick-action-grid">
          {quickActions.map(({ label, description, destination, icon: Icon }) => (
            <button type="button" className="operational-quick-action" key={destination} onClick={() => onNavigate(destination)}>
              <span className="operational-quick-icon"><Icon size={18} /></span><span><strong>{label}</strong><small>{description}</small></span><span className="operational-quick-arrow" aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      </section>

      <section className="operational-centre-pulse">
        <header className="operational-card-heading"><div><BarChart3 size={19} /><h3>Centre pulse</h3></div><span>Supporting context</span></header>
        <div className="stats-grid management-stats-grid">
          <StatCard label="Active patients" value={data.metrics.activePatients ?? "--"} trend={`${data.metrics.newPatientsThisMonth ?? 0} new this month`} icon={UsersRound} />
          <StatCard label="Appointments today" value={data.metrics.appointmentsToday ?? "--"} trend={`${data.metrics.checkedInToday ?? 0} checked in · ${data.metrics.noShowsToday ?? 0} no-show`} icon={CalendarClock} />
          <StatCard label="Open referrals" value={data.metrics.referrals ?? "--"} trend={`${data.metrics.urgentReferrals ?? 0} urgent · ${data.metrics.conversionRate ?? 0}% conversion`} icon={TrendingUp} tone={data.metrics.urgentReferrals ? "risk" : ""} />
          {isDirector ? (
            <StatCard label="Collections" value={INR.format(data.metrics.revenueThisMonth || 0)} trend={`${INR.format(data.metrics.outstanding || 0)} outstanding`} icon={IndianRupee} tone={data.metrics.outstanding ? "risk" : ""} />
          ) : (
            <StatCard label="Pending tasks" value={(data.openTasks || []).length} trend={`${data.metrics.overdueTasks || 0} overdue`} icon={ListChecks} tone={data.metrics.overdueTasks ? "risk" : ""} />
          )}
        </div>
        <div className="operational-risk-strip">
          <span><AlertTriangle size={16} /><strong>Operational risks</strong></span>
          <span>{data.metrics.lowStockCount || 0} low-stock items</span>
          <span>{data.metrics.overdueTasks || 0} overdue tasks</span>
          {isDirector && <span>{data.metrics.unpaidInvoiceCount || 0} invoices pending</span>}
        </div>
      </section>
      {isDirector && <DirectorView data={data} />}
      {isDirector && <CashWatch data={data} />}
    </div>
  );
}

function describeRecord(viewId, record) {
  const excerpt = (value, limit = 90) => {
    const text = String(value || "").trim();
    if (!text) return "Not provided";
    return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
  };
  const displayDate = (value) => {
    const date = toValidDate(value);
    return date
      ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date)
      : "Date not recorded";
  };

  if (viewId === "patients") {
    return {
      title: record.fullName,
      meta: `MRN: ${record.mrn || "Not assigned"} · Phone: ${record.phone || "Not provided"}`,
      detail: `Guardian: ${record.guardianName || "Not listed"} · Services: ${(record.services || []).join(", ") || excerpt(record.primaryConcern, 100)}`,
      status: record.status
    };
  }

  if (viewId === "referrals") {
    const open = ["new", "contacted", "scheduled"].includes(record.status);
    const followUpDate = toValidDate(record.followUpDate);
    const overdue = open && followUpDate && followUpDate.getTime() < Date.now();
    const ownerName = record.assignedTo?.name || "Unassigned";
    const dueLabel = record.followUpDate ? formatDateTime(record.followUpDate) : "No follow-up due";
    return {
      title: record.patientName,
      meta: `Source: ${record.sourceName || record.sourceType || "Not recorded"} · Phone: ${record.phone || "Not provided"}`,
      detail: `Concern: ${excerpt(record.concern, 100)} · Preferred contact: ${record.preferredContact || "Phone"} · Owner: ${ownerName} · Follow-up: ${dueLabel}`,
      status: overdue ? "overdue" : record.urgency === "urgent" ? "urgent" : record.status
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

  if (viewId === "tasks") {
    const dueDate = toValidDate(record.dueDate);
    const overdue = record.status !== "done" && dueDate && dueDate.getTime() < Date.now();
    return {
      title: record.title,
      meta: `Patient: ${record.patient?.fullName || "General task"} · Department: ${record.department || "Unassigned"}`,
      detail: `Assigned to: ${record.assignedTo?.name || "Unassigned"} · Due: ${dueDate ? displayDate(dueDate) : "No deadline"} · Priority: ${record.priority || "medium"}`,
      status: record.status === "done" ? "completed" : overdue ? "overdue" : "todo"
    };
  }

  return {
    title: record.title,
    meta: `Department: ${record.department || "Unassigned"} · Due: ${formatDate(record.dueDate)}`,
    detail: `Priority: ${record.priority} · Patient: ${record.patient?.fullName || "General task"}`,
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
    if (["new", "contacted", "scheduled"].includes(record.status)) {
      actions.push({ label: "Convert to Patient", action: "convert" });
    }
    return actions;
  }

  if (viewId === "appointments") {
    const actions = [];
    if (record.status === "scheduled") actions.push({ label: "Check in", updates: { status: "checked-in" } });
    if (record.status === "checked-in") actions.push({ label: "Complete", updates: { status: "completed" } });
    if (record.status === "completed" && ["director", "admin", "accounts", "reception"].includes(userRole)) {
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
  const metrics = data?.metrics || {};
  const serviceMix = Object.entries(data?.analytics?.serviceMix || {})
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 8);
  const referralStatus = Object.entries(data?.analytics?.referralStatus || {})
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  const appointmentStatus = Object.entries(data?.analytics?.appointmentStatusToday || {})
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  const referralSources = Object.entries(data?.analytics?.referralMix || {})
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 6);
  const billed = Number(metrics.billedThisMonth || 0);
  const collected = Number(metrics.revenueThisMonth || 0);
  const outstanding = Number(metrics.outstanding || 0);
  const collectionRate = billed > 0 ? Math.min(Math.max(Math.round((collected / billed) * 100), 0), 100) : 0;
  const maxService = Math.max(...serviceMix.map(([, count]) => Number(count) || 0), 1);
  const maxReferral = Math.max(...referralStatus.map(([, count]) => Number(count) || 0), 1);
  const maxAppointments = Math.max(...appointmentStatus.map(([, count]) => Number(count) || 0), 1);
  const maxSources = Math.max(...referralSources.map(([, count]) => Number(count) || 0), 1);
  const operationalRisks = [
    { label: "Low-stock items", count: Number(metrics.lowStockCount || 0), note: "At or below reorder level", icon: PackageOpen, tone: "warning" },
    { label: "Overdue tasks", count: Number(metrics.overdueTasks || 0), note: "Past their due date", icon: ListChecks, tone: "danger" },
    { label: "Urgent referrals", count: Number(metrics.urgentReferrals || 0), note: "Awaiting timely follow-up", icon: AlertTriangle, tone: "danger" },
    { label: "Unpaid invoices", count: Number(metrics.unpaidInvoiceCount || 0), note: "Draft or partial invoices", icon: WalletCards, tone: "warning" }
  ];
  const insights = data?.businessInsights || [];

  return (
    <section className="admin-report-workspace" aria-label="Administrative reports">
      <header className="admin-report-heading">
        <div>
          <p className="admin-report-eyebrow">MANAGEMENT INTELLIGENCE</p>
          <h3>Administrative overview</h3>
          <p>Month-to-date performance and current operational priorities, using recorded centre activity.</p>
        </div>
        <span className="admin-report-period">Month to date</span>
      </header>

      <div className="admin-report-kpis">
        <article className="admin-report-kpi">
          <span>Active patients</span>
          <strong>{Number(metrics.activePatients || 0).toLocaleString("en-IN")}</strong>
          <small>{Number(metrics.newPatientsThisMonth || 0)} new this month</small>
        </article>
        <article className="admin-report-kpi">
          <span>Appointments today</span>
          <strong>{Number(metrics.appointmentsToday || 0).toLocaleString("en-IN")}</strong>
          <small>{Number(metrics.completedAppointmentsToday || 0)} completed today</small>
        </article>
        <article className="admin-report-kpi is-positive">
          <span>Collected this month</span>
          <strong>{INR.format(collected)}</strong>
          <small>{collectionRate}% of this month’s billed amount</small>
        </article>
        <article className="admin-report-kpi is-attention">
          <span>Outstanding balance</span>
          <strong>{INR.format(outstanding)}</strong>
          <small>{Number(metrics.unpaidInvoiceCount || 0)} invoices pending</small>
        </article>
      </div>

      <div className="admin-report-primary-grid">
        <article className="admin-report-card admin-report-finance">
          <div className="admin-report-card-heading">
            <span className="admin-report-icon"><IndianRupee size={18} /></span>
            <div><h4>Financial performance</h4><p>Billing and collections for the current month</p></div>
          </div>
          <div className="admin-report-finance-values">
            <div><span>Total billed</span><strong>{INR.format(billed)}</strong></div>
            <div><span>Received</span><strong className="is-positive-text">{INR.format(collected)}</strong></div>
            <div><span>Outstanding</span><strong className="is-warning-text">{INR.format(outstanding)}</strong></div>
          </div>
          <div className="admin-report-progress-copy"><span>Collection against billed</span><strong>{collectionRate}%</strong></div>
          <div className="admin-report-progress" role="progressbar" aria-label="Collection against billed amount" aria-valuemin={0} aria-valuemax={100} aria-valuenow={collectionRate}>
            <span style={{ width: `${collectionRate}%` }} />
          </div>
          {!billed && <p className="admin-report-footnote">Collection progress will appear after invoices are recorded this month.</p>}
        </article>

        <article className="admin-report-card admin-report-risk-card">
          <div className="admin-report-card-heading">
            <span className="admin-report-icon is-amber"><ShieldCheck size={18} /></span>
            <div><h4>Operational watchlist</h4><p>Items that may need management attention</p></div>
          </div>
          <div className="admin-report-risk-list">
            {operationalRisks.map((item) => {
              const Icon = item.icon;
              return (
                <div className="admin-report-risk-row" key={item.label}>
                  <span className={`admin-report-risk-icon ${item.tone}`}><Icon size={16} /></span>
                  <span className="admin-report-risk-copy"><strong>{item.label}</strong><small>{item.note}</small></span>
                  <strong className={item.count > 0 ? item.tone : "is-clear"}>{item.count}</strong>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      <div className="admin-report-secondary-grid">
        <article className="admin-report-card">
          <div className="admin-report-card-heading">
            <span className="admin-report-icon is-teal"><TrendingUp size={18} /></span>
            <div><h4>Referral journey</h4><p>Referrals grouped by current status</p></div>
          </div>
          {referralStatus.length ? (
            <div className="admin-report-bars">
              {referralStatus.map(([status, count]) => (
                <div className="admin-report-bar-row" key={status}>
                  <div><span>{status.replaceAll("-", " ")}</span><strong>{count}</strong></div>
                  <div className="admin-report-bar-track"><span style={{ width: `${Math.min((Number(count || 0) / maxReferral) * 100, 100)}%` }} /></div>
                </div>
              ))}
            </div>
          ) : <p className="admin-report-empty">Referral activity will appear here as enquiries are received.</p>}
        </article>

        <article className="admin-report-card">
          <div className="admin-report-card-heading">
            <span className="admin-report-icon is-violet"><CalendarClock size={18} /></span>
            <div><h4>Today’s appointments</h4><p>Appointment outcomes recorded today</p></div>
          </div>
          {appointmentStatus.length ? (
            <div className="admin-report-bars">
              {appointmentStatus.map(([status, count]) => (
                <div className="admin-report-bar-row" key={status}>
                  <div><span>{status.replaceAll("-", " ")}</span><strong>{count}</strong></div>
                  <div className="admin-report-bar-track is-violet"><span style={{ width: `${Math.min((Number(count || 0) / maxAppointments) * 100, 100)}%` }} /></div>
                </div>
              ))}
            </div>
          ) : <p className="admin-report-empty">No appointment outcomes have been recorded today.</p>}
        </article>

        <article className="admin-report-card">
          <div className="admin-report-card-heading">
            <span className="admin-report-icon is-teal"><BarChart3 size={18} /></span>
            <div><h4>Service mix</h4><p>Services recorded across current patient records</p></div>
          </div>
          {serviceMix.length ? (
            <div className="admin-report-bars">
              {serviceMix.map(([service, count]) => (
                <div className="admin-report-bar-row" key={service}>
                  <div><span>{service}</span><strong>{count}</strong></div>
                  <div className="admin-report-bar-track"><span style={{ width: `${Math.min((Number(count || 0) / maxService) * 100, 100)}%` }} /></div>
                </div>
              ))}
            </div>
          ) : <p className="admin-report-empty">Service distribution will appear as patient records are added.</p>}
        </article>

        <article className="admin-report-card">
          <div className="admin-report-card-heading">
            <span className="admin-report-icon is-amber"><UsersRound size={18} /></span>
            <div><h4>Referral sources</h4><p>Sources of enquiries received this month</p></div>
          </div>
          {referralSources.length ? (
            <div className="admin-report-bars">
              {referralSources.map(([source, count]) => (
                <div className="admin-report-bar-row" key={source}>
                  <div><span>{source.replaceAll("-", " ")}</span><strong>{count}</strong></div>
                  <div className="admin-report-bar-track is-amber"><span style={{ width: `${Math.min((Number(count || 0) / maxSources) * 100, 100)}%` }} /></div>
                </div>
              ))}
            </div>
          ) : <p className="admin-report-empty">Referral source data will appear as enquiries are recorded.</p>}
        </article>
      </div>

      <article className="admin-report-card admin-report-insights">
        <div className="admin-report-card-heading">
          <span className="admin-report-icon"><FileText size={18} /></span>
          <div><h4>Management signals</h4><p>System-generated observations from existing operational data</p></div>
        </div>
        {insights.length ? (
          <ul>{insights.map((insight) => <li key={insight}>{insight}</li>)}</ul>
        ) : <p className="admin-report-empty">Management insights will appear as centre activity is recorded.</p>}
      </article>
    </section>
  );
}
function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function ReferralNotesEditor({ record, onSave, saving, token, owners, onFollowUpLogged }) {
  const [notes, setNotes] = useState(record.notes || "");
  const [ownerId, setOwnerId] = useState(record.assignedTo?._id || record.assignedTo || "");
  const [followUpDate, setFollowUpDate] = useState(toDateTimeLocal(record.followUpDate));
  const [method, setMethod] = useState("phone");
  const [outcome, setOutcome] = useState("reached");
  const [followUpNote, setFollowUpNote] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [logging, setLogging] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setNotes(record.notes || "");
    setOwnerId(record.assignedTo?._id || record.assignedTo || "");
    setFollowUpDate(toDateTimeLocal(record.followUpDate));
  }, [record._id, record.notes, record.assignedTo, record.followUpDate]);

  async function submitFollowUp(event) {
    event.preventDefault();
    setLogging(true);
    setError("");
    try {
      await logReferralFollowUp(record._id, {
        contactMethod: method,
        outcome,
        note: followUpNote,
        ...(nextFollowUpAt ? { nextFollowUpAt: new Date(nextFollowUpAt).toISOString() } : {})
      }, { token });
      setFollowUpNote("");
      setNextFollowUpAt("");
      onFollowUpLogged();
    } catch (err) {
      setError(err.message || "Unable to save follow-up");
    } finally {
      setLogging(false);
    }
  }

  const history = [...(record.followUpHistory || [])].reverse();
  return (
    <div className="referral-notes-editor">
      <div className="form-row">
        <label>
          Referral owner
          <select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
            <option value="">Unassigned</option>
            {owners.map((owner) => <option key={owner._id} value={owner._id}>{owner.name} · {owner.role}</option>)}
          </select>
        </label>
        <label>
          Follow-up due
          <input type="datetime-local" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} />
        </label>
      </div>
      <button
        className="secondary-button compact-button"
        type="button"
        disabled={saving || (ownerId === (record.assignedTo?._id || record.assignedTo || "") && followUpDate === toDateTimeLocal(record.followUpDate))}
        onClick={() => onSave({
          assignedTo: ownerId || null,
          followUpDate: followUpDate ? new Date(followUpDate).toISOString() : null
        })}
      >
        {saving ? "Saving..." : "Save owner and deadline"}
      </button>
      <label>
        Staff context notes
        <textarea
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Internal context for the next staff member..."
        />
      </label>
      <button
        className="secondary-button compact-button"
        type="button"
        disabled={saving || notes.trim() === (record.notes || "").trim()}
        onClick={() => onSave({ notes })}
      >
        {saving ? "Saving..." : "Save internal notes"}
      </button>
      <form className="clinical-form" onSubmit={submitFollowUp}>
        <strong>Log contact attempt</strong>
        <div className="form-row">
          <label>Method
            <select value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="phone">Phone</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="in-person">In person</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>Outcome
            <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
              <option value="reached">Reached</option>
              <option value="no-answer">No answer</option>
              <option value="left-message">Left message</option>
              <option value="callback-requested">Callback requested</option>
              <option value="appointment-booked">Appointment booked</option>
              <option value="not-interested">Not interested</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
        <label>Contact summary
          <textarea rows={2} minLength={3} maxLength={1000} value={followUpNote} onChange={(event) => setFollowUpNote(event.target.value)} required placeholder="Who was contacted, what was discussed and the agreed next step..." />
        </label>
        <label>Next follow-up (if needed)
          <input type="datetime-local" value={nextFollowUpAt} onChange={(event) => setNextFollowUpAt(event.target.value)} required={!["appointment-booked", "not-interested"].includes(outcome)} />
        </label>
        {error && <p className="form-status error-status" role="alert" aria-live="assertive">{error}</p>}
        <button className="secondary-button compact-button" type="submit" disabled={logging}>{logging ? "Saving..." : "Add follow-up to history"}</button>
      </form>
      {history.length > 0 && (
        <div className="referral-follow-up-history">
          <strong>Contact history</strong>
          {history.map((entry) => (
            <div className="history-entry" key={entry._id}>
              <strong>{entry.outcome.replaceAll("-", " ")} · {entry.contactMethod}</strong>
              <span>{formatDateTime(entry.createdAt)} · {entry.loggedBy?.name || "Staff"}</span>
              <p>{entry.note}</p>
              {entry.nextFollowUpAt && <span>Next follow-up: {formatDateTime(entry.nextFollowUpAt)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResourceBoard({ activeView, data, state, onRecordAction, actionId, actionError, userRole, token, onRefreshRecords, onCreateAppointment }) {
  const [referralOwners, setReferralOwners] = useState([]);
  const [taskPatients, setTaskPatients] = useState([]);
  const [taskAssignees, setTaskAssignees] = useState([]);
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskError, setTaskError] = useState("");
  const [taskForm, setTaskForm] = useState({ title: "", patient: "", department: "clinical", priority: "medium", dueDate: "", assignedTo: "" });
  useEffect(() => {
    if (activeView !== "referrals" || !token) { setReferralOwners([]); return undefined; }
    let active = true;
    listReferralOwners({ token }).then((items) => { if (active) setReferralOwners(items || []); })
      .catch(() => { if (active) setReferralOwners([]); });
    return () => { active = false; };
  }, [activeView, token]);

  useEffect(() => {
    if (activeView !== "tasks" || !token) { setTaskPatients([]); return undefined; }
    let active = true;
    listRecords("patients", { token, limit: 100 }).then((items) => {
      if (active) setTaskPatients(items || []);
    }).catch(() => {
      if (active) setTaskPatients([]);
    });
    return () => { active = false; };
  }, [activeView, token]);

  useEffect(() => {
    if (activeView !== "tasks" || !token) { setTaskAssignees([]); return undefined; }
    let active = true;
    listTaskAssignees({ token }).then((items) => {
      if (active) setTaskAssignees(items || []);
    }).catch(() => {
      if (active) setTaskAssignees([]);
    });
    return () => { active = false; };
  }, [activeView, token]);

  async function submitTask(event) {
    event.preventDefault();
    setTaskSaving(true);
    setTaskError("");
    try {
      await createRecord("tasks", {
        title: taskForm.title.trim(),
        ...(taskForm.patient ? { patient: taskForm.patient } : {}),
        department: taskForm.department,
        priority: taskForm.priority,
        ...(taskForm.assignedTo ? { assignedTo: taskForm.assignedTo } : {}),
        ...(taskForm.dueDate ? { dueDate: new Date(taskForm.dueDate).toISOString() } : {}),
        status: "todo"
      }, { token });
      setTaskForm({ title: "", patient: "", department: "clinical", priority: "medium", dueDate: "", assignedTo: "" });
      setShowTaskCreate(false);
      onRefreshRecords?.();
    } catch (error) {
      setTaskError(error.message || "Unable to create task");
    } finally {
      setTaskSaving(false);
    }
  }

  const config = getViewConfig(activeView);
  const Icon = config.icon;

  if (activeView === "reports") {
    return userRole === "director" ? <ReportsView data={data} /> : <p className="form-status error-status" role="alert">You do not have permission to view executive reports.</p>;
  }

  const records = state.records || [];
  const taskBoardRecords = activeView === "tasks"
    ? [...records].sort((a, b) => {
        const isDoneA = a.status === "done";
        const isDoneB = b.status === "done";
        if (isDoneA !== isDoneB) return isDoneA ? 1 : -1;
        if (isDoneA) return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
        const dueA = toValidDate(a.dueDate);
        const dueB = toValidDate(b.dueDate);
        const overdueA = dueA && dueA.getTime() < Date.now();
        const overdueB = dueB && dueB.getTime() < Date.now();
        if (overdueA !== overdueB) return overdueA ? -1 : 1;
        const priorityRank = { high: 0, medium: 1, low: 2 };
        const priorityDiff = (priorityRank[a.priority || "medium"] ?? 1) - (priorityRank[b.priority || "medium"] ?? 1);
        if (priorityDiff) return priorityDiff;
        if (dueA && dueB) return dueA - dueB;
        if (dueA) return -1;
        if (dueB) return 1;
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      })
    : records;

  return (
    <article className={`table-panel resource-panel resource-panel-${activeView}`}>
      <div className="panel-title resource-title management-resource-heading">
        <Icon size={21} />
        <div>
          <h3>{config.label}</h3>
          <p className="resource-description">{viewDescriptions[activeView]}</p>
          <span className="resource-count" aria-live="polite">{records.length} {records.length === 1 ? "record" : "records"} loaded</span>
        </div>
        {activeView === "tasks" && ["director","admin","reception","coordinator"].includes(userRole) && (
          <button className="primary-button compact-button task-create-toggle" type="button" aria-expanded={showTaskCreate} onClick={() => setShowTaskCreate((value) => !value)}>{showTaskCreate ? <X size={15} /> : <Plus size={15} />} {showTaskCreate ? "Close form" : "New task"}</button>
        )}
        {activeView === "appointments" && ["director","admin","reception","coordinator"].includes(userRole) && (
          <button className="primary-button compact-button" type="button" onClick={onCreateAppointment}><Plus size={15} /> New appointment</button>
        )}
      </div>
      {state.loading && <p className="empty-state">Loading {config.label.toLowerCase()}...</p>}
      {state.error && <p className="form-status error-status" role="alert" aria-live="assertive">{state.error}</p>}
      {activeView === "tasks" && showTaskCreate && (
        <form className="clinical-form task-create-form" onSubmit={submitTask}>
          <div className="task-create-form-heading"><div><h4>New operational task</h4><p>Define the work, responsibility and deadline.</p></div></div>
          <div className="task-form-section"><span className="task-form-section-label">Task details</span>
          <label>Task title
            <input value={taskForm.title} maxLength={180} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} required placeholder="Describe the action that needs to be completed" />
          </label>
          <div className="form-row">
            <label>Related patient (optional)
              <select value={taskForm.patient} onChange={(event) => setTaskForm({ ...taskForm, patient: event.target.value })}>
                <option value="">General task — not patient-specific</option>
                {taskPatients.map((patient) => <option key={patient._id} value={patient._id}>{patient.fullName} · {patient.mrn}</option>)}
              </select>
            </label>
            <label>Department
              <select value={taskForm.department} onChange={(event) => setTaskForm({ ...taskForm, department: event.target.value })}>
                <option value="clinical">Clinical</option><option value="front-desk">Front desk</option><option value="accounts">Accounts</option><option value="outreach">Outreach</option><option value="operations">Operations</option>
              </select>
            </label>
          </div>
          </div>
          <div className="task-form-section"><span className="task-form-section-label">Ownership & urgency</span>
          <div className="form-row">
            <label>Assigned staff member
              <select value={taskForm.assignedTo} onChange={(event) => setTaskForm({ ...taskForm, assignedTo: event.target.value })} required>
                <option value="">Select responsible staff...</option>
                {taskAssignees.map((staff) => <option key={staff._id} value={staff._id}>{staff.name} · {staff.role}</option>)}
              </select>
            </label>
            <label>Priority
              <select value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value })}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </label>
            <label>Due date
              <input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} />
            </label>
          </div>
          </div>
          {taskError && <p className="form-status error-status" role="alert" aria-live="assertive">{taskError}</p>}
          <div className="modal-actions">
            <button className="primary-button" type="submit" disabled={taskSaving}>{taskSaving ? "Creating..." : "Create task"}</button>
            <button className="secondary-button" type="button" onClick={() => { setShowTaskCreate(false); setTaskError(""); setTaskForm({ title: "", patient: "", department: "clinical", priority: "medium", dueDate: "", assignedTo: "" }); }}>Cancel</button>
          </div>
        </form>
      )}
      {actionError && <p className="form-status error-status" role="alert" aria-live="assertive">{actionError}</p>}
      {!state.loading && !state.error && (
        <AnimatePresence mode="popLayout">
          {records.length ? (
            <div className={`record-grid management-record-grid management-record-grid-${activeView}`}>
              {taskBoardRecords.map((record, index) => {
                const summary = describeRecord(activeView, record);
                const actions = recordActions(activeView, record, userRole);
                return (
                  <React.Fragment key={record._id}>
                    {activeView === "tasks" && (index === 0 || (taskBoardRecords[index - 1]?.status === "done") !== (record.status === "done")) && (
                      <div className="task-board-group-heading">
                        <div><strong>{record.status === "done" ? "Completed tasks" : "Outstanding tasks"}</strong><span>{taskBoardRecords.filter((task) => (task.status === "done") === (record.status === "done")).length} tasks</span></div>
                      </div>
                    )}
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
                    {activeView === "tasks" && (
                      <div className="task-card-indicators" aria-label="Task priority">
                        <span className={`task-priority task-priority-${record.priority || "medium"}`}>{(record.priority || "medium").toUpperCase()} PRIORITY</span>
                        {record.status === "done" && <span className="task-completed-indicator">COMPLETED</span>}
                      </div>
                    )}
                    {activeView === "referrals" && (
                      <ReferralNotesEditor
                        record={record}
                        saving={actionId === record._id}
                        token={token}
                        owners={referralOwners}
                        onFollowUpLogged={onRefreshRecords}
                        onSave={(updates) => onRecordAction(config.resource, record._id, updates, { action: "save-notes" })}
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
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            activeView === "tasks" ? (
              <div className="task-board-empty-state">
                <ListChecks size={24} />
                <strong>No tasks yet</strong>
                <p>Operational tasks will appear here once created.</p>
                {["director", "admin", "reception", "coordinator"].includes(userRole) && (
                  <button className="primary-button compact-button" type="button" onClick={() => setShowTaskCreate(true)}>
                    <Plus size={15} /> Create first task
                  </button>
                )}
              </div>
            ) : (
              <p className="empty-state">No records match the current filters.</p>
            )
          )}
        </AnimatePresence>
      )}
    </article>
  );
}

export function Dashboard() {
  const [session, setSession] = useState(getStoredSession);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const mobileNavigationSidebarRef = React.useRef(null);
  const mobileNavigationCloseRef = React.useRef(null);
  const [authNotice, setAuthNotice] = useState("");
  const consoleHeaderRef = React.useRef(null);
  const [navigationScrollRequest, setNavigationScrollRequest] = useState(0);
  const [activeView, setActiveView] = useState(() => {
    const role = getStoredSession().user?.role;
    if (["doctor","therapist"].includes(role)) return "overview";
    if (role === "coordinator") return "patients";
    if (role === "accounts") return "billing";
    return "overview";
  });
  useEffect(() => {
    const media = window.matchMedia("(max-width: 820px)");
    const updateViewport = () => {
      setIsMobileViewport(media.matches);
      if (!media.matches) setMobileNavigationOpen(false);
    };
    updateViewport();
    media.addEventListener?.("change", updateViewport);
    return () => media.removeEventListener?.("change", updateViewport);
  }, []);

  useEffect(() => {
    const handleNavigationToggle = () => setMobileNavigationOpen((open) => !open);
    window.addEventListener("mindful:staff-navigation-toggle", handleNavigationToggle);
    return () => window.removeEventListener("mindful:staff-navigation-toggle", handleNavigationToggle);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("mindful:staff-navigation-state", { detail: { open: mobileNavigationOpen } }));
  }, [mobileNavigationOpen]);

  useEffect(() => {
    if (!mobileNavigationOpen || !isMobileViewport) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => mobileNavigationCloseRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.querySelector('.staff-mobile-nav-trigger')?.focus();
    };
  }, [mobileNavigationOpen, isMobileViewport]);

  useEffect(() => {
    if (!mobileNavigationOpen || !isMobileViewport) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileNavigationOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = mobileNavigationSidebarRef.current?.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const items = Array.from(focusable || []).filter((item) => item.getClientRects().length > 0);
      if (!items.length) {
        event.preventDefault();
        mobileNavigationSidebarRef.current?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileNavigationOpen, isMobileViewport]);

  useEffect(() => {
    const handleUnauthorized = (event) => {
      clearSession();
      setSession({ token: null, user: null });
      setAuthNotice(event.detail?.message || "Your staff session is no longer valid. Please sign in again.");
    };
    window.addEventListener("mindful:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("mindful:unauthorized", handleUnauthorized);
  }, []);
  useEffect(() => {
    if (navigationScrollRequest === 0 || typeof window === "undefined") return undefined;
    if (!window.matchMedia("(max-width: 820px)").matches) return undefined;

    const frame = window.requestAnimationFrame(() => {
      consoleHeaderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeView, navigationScrollRequest]);
  const [query, setQuery] = useState("");
  const [resourceRefresh, setResourceRefresh] = useState(0);
  const [actionId, setActionId] = useState("");
  const [actionError, setActionError] = useState("");
  const [operationModal, setOperationModal] = useState(null);
  const [operationHistory, setOperationHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [operationForm, setOperationForm] = useState({ amount: "", method: "cash", reference: "", type: "receipt", quantity: "", reason: "" });
  const [journeyPatientId, setJourneyPatientId] = useState(null);
  const [journeyPatientData, setJourneyPatientData] = useState(null);
  const [journeyInitialCreateStep, setJourneyInitialCreateStep] = useState(null);
  const [journeyInitialAppointmentId, setJourneyInitialAppointmentId] = useState(null);
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
  const [appointmentForm, setAppointmentForm] = useState({ patient: "", practitioner: "", service: "", appointmentType: "assessment", startsAt: "", durationMinutes: 45, room: "" });
  const [convertReferral, setConvertReferral] = useState(null);
  const [convertForm, setConvertForm] = useState({});
  const [convertSaving, setConvertSaving] = useState(false);
  const convertDialogRef = useAccessibleDialog(Boolean(convertReferral), () => setConvertReferral(null));
  const appointmentDialogRef = useAccessibleDialog(showAppointmentForm, () => setShowAppointmentForm(false));
  const operationDialogRef = useAccessibleDialog(Boolean(operationModal), () => setOperationModal(null));
  const historyDialogRef = useAccessibleDialog(Boolean(operationHistory), () => setOperationHistory(null));
  const billingDialogRef = useAccessibleDialog(showBilling, () => setShowBilling(false));

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
  const isDirector = session.user?.role === "director";
  const isPractitioner = ["doctor", "therapist"].includes(session.user?.role);
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
    const amountOrQuantity = Number(isPayment ? operationForm.amount : operationForm.quantity);
    if (!Number.isFinite(amountOrQuantity) || (isPayment ? amountOrQuantity <= 0 : operationForm.type === "adjustment" ? amountOrQuantity < 0 : amountOrQuantity <= 0)) {
      setActionError(isPayment ? "Enter a valid payment amount." : "Enter a valid stock quantity.");
      return;
    }
    if (!isPayment && !operationForm.reason.trim()) {
      setActionError("A reason is required for every stock movement.");
      return;
    }
    const payload = isPayment
      ? { amount: amountOrQuantity, method: operationForm.method, reference: operationForm.reference.trim() }
      : { type: operationForm.type, quantity: amountOrQuantity, reason: operationForm.reason.trim(), reference: operationForm.reference.trim() };
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
    if (new URLSearchParams(window.location.search).has("resetToken")) {
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    }
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
          appointment: appointment._id,
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
          guardianName: referral.guardianName || "",
          guardianRelationship: referral.guardianRelationship || "",
          age: referral.patientAge == null ? "" : String(referral.patientAge),
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
      setAppointmentForm({ patient: "", practitioner: "", service: "", appointmentType: "assessment", startsAt: "", durationMinutes: 45, room: "" });
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
          guardianRelationship: convertForm.guardianRelationship || undefined,
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
    return <LoginPanel initialNotice={authNotice} onLogin={(nextSession) => {
      setAuthNotice("");
      setSession(nextSession);
      setActiveView(["doctor","therapist"].includes(nextSession.user?.role) ? "overview" : nextSession.user?.role === "coordinator" ? "patients" : nextSession.user?.role === "accounts" ? "billing" : "overview");
    }} />;
  }

  return (
    <section className="dashboard-section" id="dashboard">
      <div className={`dashboard-shell dashboard-role-${session.user?.role || "staff"} premium-staff-navigation${isDirector || session.user?.role === "admin" ? " premium-director-navigation" : ""}${sidebarCollapsed ? " premium-sidebar-collapsed" : ""}${isPractitioner ? " premium-clinical-navigation" : ""}${mobileNavigationOpen ? " premium-mobile-navigation-open" : ""}`}>
        {mobileNavigationOpen && <button className="premium-sidebar-backdrop" type="button" aria-label="Close navigation" onClick={() => setMobileNavigationOpen(false)} />}
        <aside
          ref={mobileNavigationSidebarRef}
          className="sidebar"
          id="staff-workspace-navigation"
          aria-label="Staff workspace navigation"
          aria-hidden={isMobileViewport && !mobileNavigationOpen ? "true" : undefined}
          role={mobileNavigationOpen && isMobileViewport ? "dialog" : undefined}
          aria-modal={mobileNavigationOpen && isMobileViewport ? "true" : undefined}
          tabIndex={mobileNavigationOpen && isMobileViewport ? -1 : undefined}
        >
          <div className="sidebar-brand">
            <div className="brand compact">
              <span className="brand-mark">M</span>
              <span>
                <strong>Mindful</strong>
                <small>{isDirector ? "Director console" : isPractitioner ? "Clinical workspace" : "Staff console"}</small>
              </span>
            </div>
            <div className="sidebar-context">
              <span className="sidebar-context-label">{isPractitioner ? "MY PRACTICE" : "WORKSPACE"}</span>
              <strong>{isPractitioner ? "Clinical care" : "Centre operations"}</strong>
              <span>{isPractitioner ? "Patients • Sessions • Notes" : "Care • Coordination • Outcomes"}</span>
            </div>
            <button className="premium-sidebar-collapse" type="button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={sidebarCollapsed}>
              {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <button ref={mobileNavigationCloseRef} className="premium-sidebar-mobile-close" type="button" onClick={() => setMobileNavigationOpen(false)} aria-label="Close navigation"><X size={19} /></button>
          </div>
          <nav className="sidebar-navigation" aria-label="Workspace navigation">
            {Object.entries(
              visibleViewItems.reduce((acc, item) => {
                const section = item.section || "Other";
                if (!acc[section]) acc[section] = [];
                acc[section].push(item);
                return acc;
              }, {})
            ).map(([section, items]) => (
              <div className={`sidebar-section${items.length === 1 ? " sidebar-section-single" : ""}`} key={section} role="group" aria-label={section}>
                <div className="sidebar-section-title" aria-hidden="true">{section}</div>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      className={item.id === activeView ? "side-link active" : "side-link"}
                      type="button"
                      key={item.id}
                      aria-label={item.label}
                      title={item.label}
                      aria-current={item.id === activeView ? "page" : undefined}
                      onClick={() => {
                        setActiveView(item.id);
                        setMobileNavigationOpen(false);
                        setQuery("");
                        setActionError("");
                        setNavigationScrollRequest((request) => request + 1);
                      }}
                    >
                      <Icon size={17} aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="sidebar-footer">
            <span className="sidebar-footer-indicator" />
            <span>Mindful Centre · Srinagar</span>
          </div>
        </aside>
        <div className="console">
          <div ref={consoleHeaderRef} className="console-header management-console-header">
            <div className="premium-console-title">
              <div>
              <p className="eyebrow">{isDirector ? "Director command centre" : isPractitioner ? "Clinical workspace" : "Operations dashboard"}</p>
              <h2>{activeView === "overview" ? (["doctor","therapist"].includes(session.user?.role) ? "My clinical activity" : "Whole-centre operating view") : activeConfig.label}</h2>
              <p className="console-user">Signed in as {session.user?.name} ({session.user?.role})</p>
              </div>
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
          {error && <p className="form-status error-status" role="alert" aria-live="assertive">{error}</p>}

          {(!canViewOverview || data) && (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                className="workspace-view management-workspace-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
              {activeView === "media-library" && ["director", "admin"].includes(session.user?.role) ? (
                <MediaLibrary token={session.token} />
              ) : activeView === "content-studio" && ["director", "admin"].includes(session.user?.role) ? (
                <ContentStudio token={session.token} />
              ) : activeView === "staff" ? (
                <StaffBoard token={session.token} currentRole={session.user?.role} currentUserId={session.user?.id} onChanged={() => setResourceRefresh((value) => value + 1)} />
              ) : activeView === "practitioners" ? (
                <PractitionerBoard
                  token={session.token}
                  staffAccounts={staffAccounts}
                  onChanged={() => setResourceRefresh((value) => value + 1)}
                />
              ) : activeView === "overview" ? (
                ["doctor", "therapist"].includes(session.user?.role)
                  ? <PractitionerDashboard token={session.token} onNavigate={setActiveView} onOpenPatient={(patient, action, appointmentId) => { const patientId = typeof patient === "object" ? patient?._id : patient; const supplied = typeof patient === "object" ? patient : null; const resolved = supplied?.fullName ? supplied : patientsList.find((p) => p._id === patientId) || supplied; setJourneyPatientData(resolved); setJourneyInitialCreateStep(action || null); setJourneyInitialAppointmentId(appointmentId || null); setJourneyPatientId(patientId); }} />
                  : <OverviewWorkspace data={data} isDirector={isDirector} role={session.user?.role} onNavigate={(view) => { setActiveView(view); setMobileNavigationOpen(false); setNavigationScrollRequest((value) => value + 1); }} />
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
                  token={session.token}
                  onRefreshRecords={() => { setResourceRefresh((value) => value + 1); refresh(); }}
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
          patient={journeyPatientData || resourceState.records.find(r => r._id === journeyPatientId) || { _id: journeyPatientId }}
          token={session.token}
          userRole={session.user?.role}
          initialStep={journeyInitialCreateStep || undefined}
          initialCreateStep={journeyInitialCreateStep || undefined}
          initialAppointmentId={journeyInitialAppointmentId || undefined}
          onClose={() => { setJourneyPatientId(null); setJourneyPatientData(null); setJourneyInitialCreateStep(null); setJourneyInitialAppointmentId(null); }}
          onRefresh={() => { setResourceRefresh((value) => value + 1); refresh(); }}
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
            ref={convertDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="convert-referral-title"
            tabIndex={-1}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="convert-referral-title">Convert Enquiry to Patient</h3>
              <button className="icon-button" type="button" aria-label="Close convert enquiry dialog" onClick={() => setConvertReferral(null)}>✕</button>
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
              <div className="form-row">
                <label>
                  Guardian Name
                  <input type="text" value={convertForm.guardianName || ""} onChange={(e) => setConvertForm({ ...convertForm, guardianName: e.target.value })} />
                </label>
                <label>
                  Guardian Relationship
                  <input type="text" value={convertForm.guardianRelationship || ""} onChange={(e) => setConvertForm({ ...convertForm, guardianRelationship: e.target.value })} placeholder="Parent, uncle, spouse..." />
                </label>
              </div>
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
          <motion.div className="modal modal-appointment" ref={appointmentDialogRef} role="dialog" aria-modal="true" aria-labelledby="appointment-dialog-title" tabIndex={-1} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="appointment-dialog-title">Schedule appointment</h3>
              <button className="icon-button" type="button" aria-label="Close appointment dialog" onClick={() => setShowAppointmentForm(false)}>✕</button>
            </div>
            <form className="clinical-form" onSubmit={handleAppointmentSubmit}>
              {appointmentError && <p className="form-status error-status" role="alert" aria-live="assertive">{appointmentError}</p>}
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
              <div className="form-row">
                <label>Appointment purpose
                  <select value={appointmentForm.appointmentType} onChange={(e) => setAppointmentForm({ ...appointmentForm, appointmentType: e.target.value })} required>
                    <option value="assessment">Initial assessment</option>
                    <option value="treatment">Treatment session</option>
                    <option value="review">Clinical review</option>
                    <option value="other">Other clinical visit</option>
                  </select>
                </label>
                <label>Service
                  <input required maxLength={120} value={appointmentForm.service} onChange={(e) => setAppointmentForm({ ...appointmentForm, service: e.target.value })} placeholder="Speech Therapy, Occupational Therapy..." />
                </label>
              </div>
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
          <motion.div className="modal modal-operation" ref={operationDialogRef} role="dialog" aria-modal="true" aria-labelledby="operation-dialog-title" tabIndex={-1} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 id="operation-dialog-title">{operationModal.type === "payment" ? "Record invoice payment" : "Record stock movement"}</h3>
              <button className="icon-button" type="button" onClick={() => setOperationModal(null)} aria-label="Close">✕</button>
            </div>
            {actionError && <p className="form-status error-status" role="alert" aria-live="assertive">{actionError}</p>}
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
                    <input type="number" min={operationForm.type === "adjustment" ? "0" : "0.01"} step="0.01" required value={operationForm.quantity} onChange={(event) => setOperationForm({ ...operationForm, quantity: event.target.value })} />
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
          <motion.div className="modal" ref={historyDialogRef} role="dialog" aria-modal="true" aria-labelledby="operation-history-title" tabIndex={-1} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 18 }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 id="operation-history-title">{operationHistory.type === "payment" ? "Payment history" : "Stock movement history"}</h3>
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
            ref={billingDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-billing-title"
            tabIndex={-1}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 id="dashboard-billing-title">Generate Invoice</h3>
              <button className="icon-button" type="button" aria-label="Close invoice dialog" onClick={() => setShowBilling(false)}>✕</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              setBillingSaving(true);
              setBillingError("");
              try {
                const patientId = billingRecord?.patient?._id || billingRecord?.patient;
                const items = billingItems
                  .filter((item) => item.description.trim() && Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0
                    && Number.isFinite(Number(item.rate)) && Number(item.rate) >= 0)
                  .map((item) => ({
                    ...(item.appointment ? { appointment: item.appointment } : {}),
                    description: item.description.trim(),
                    quantity: Number(item.quantity),
                    rate: Number(item.rate)
                  }));
                if (!patientId) throw new Error("The appointment is not linked to a patient.");
                if (!items.length) throw new Error("Add at least one valid invoice item.");
                await createInvoice({ patient: patientId, items, status: "draft" }, { token: session.token });
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
                <button className="secondary-button" type="button" onClick={() => setShowBilling(false)}>Cancel</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </section>
  );
}
