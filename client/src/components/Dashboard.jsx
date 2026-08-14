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
  UsersRound,
  WalletCards
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useMemo, useState } from "react";
import { useDashboard } from "../hooks/useDashboard.js";
import { clearSession, getStoredSession, listRecords, loginStaff, storeSession, updateRecord } from "../lib/api.js";
import { ClinicalBoard } from "./ClinicalBoard.jsx";
import { PatientJourney } from "./PatientJourney.jsx";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const viewItems = [
  { id: "overview", label: "Overview", resource: null, icon: LayoutDashboard },
  { id: "patients", label: "Patients", resource: "patients", icon: UsersRound },
  { id: "referrals", label: "Referrals", resource: "referrals", icon: TrendingUp },
  { id: "appointments", label: "Appointments", resource: "appointments", icon: CalendarClock },
  { id: "assessments", label: "Assessments", resource: "assessments", icon: ClipboardCheck },
  { id: "treatment-plans", label: "Treatment Plans", resource: "treatment-plans", icon: FileText },
  { id: "progress-notes", label: "Progress Notes", resource: "progress-notes", icon: ClipboardList },
  { id: "prescriptions", label: "Prescriptions", resource: "prescriptions", icon: HeartPulse },
  { id: "billing", label: "Billing", resource: "invoices", icon: WalletCards },
  { id: "inventory", label: "Inventory", resource: "inventory", icon: PackageOpen },
  { id: "tasks", label: "Tasks", resource: "tasks", icon: ListChecks },
  { id: "reports", label: "Reports", resource: null, icon: BarChart3 }
];

function getViewConfig(id) {
  return viewItems.find((item) => item.id === id) || viewItems[0];
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

  return (
    <div className="director-view">
      <article className="action-panel director-panel">
        <div className="panel-title">
          <TrendingUp size={21} />
          <h3>Director business view</h3>
        </div>
        <div className="business-grid">
          <div>
            <span>Monthly billed</span>
            <strong>{INR.format(metrics.billedThisMonth || 0)}</strong>
          </div>
          <div>
            <span>Collections</span>
            <strong>{INR.format(metrics.revenueThisMonth || 0)}</strong>
          </div>
          <div>
            <span>Outstanding</span>
            <strong>{INR.format(metrics.outstanding || 0)}</strong>
          </div>
          <div>
            <span>Monthly conversion</span>
            <strong>{metrics.conversionRate || 0}%</strong>
          </div>
        </div>
        <div className="insight-list">
          {(data.businessInsights || []).map((insight) => (
            <p key={insight}>{insight}</p>
          ))}
        </div>
      </article>

      <article className="table-panel">
        <div className="panel-title">
          <BarChart3 size={21} />
          <h3>Service demand</h3>
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

      <article className="table-panel">
        <div className="panel-title">
          <UsersRound size={21} />
          <h3>Patient mix</h3>
        </div>
        <div className="mix-list">
          {patientStatus.length ? patientStatus.map(([status, count]) => (
            <span key={status}>{status}: <strong>{count}</strong></span>
          )) : <p className="empty-state">No patient records yet.</p>}
        </div>
      </article>

      <article className="table-panel">
        <div className="panel-title">
          <ClipboardCheck size={21} />
          <h3>Referral channels</h3>
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
    <div className="appointment-list">
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
    <article className="action-panel">
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
    <article className="table-panel">
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
      <div className="stats-grid">
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

      <div className="console-grid">
        <article className="table-panel">
          <div className="panel-title">
            <CalendarClock size={21} />
            <h3>Today's appointments</h3>
          </div>
          <AppointmentList appointments={data.todaysAppointments || []} />
        </article>
        <PriorityWork data={data} />
      </div>

      <div className="console-grid lower-console-grid">
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
  if (viewId === "patients") {
    return {
      title: record.fullName,
      meta: `${record.mrn || "No MRN"} - ${record.phone || "No phone"}`,
      detail: `${record.guardianName || "Guardian not listed"} - ${(record.services || []).join(", ") || record.primaryConcern}`,
      status: record.status
    };
  }

  if (viewId === "referrals") {
    return {
      title: record.patientName,
      meta: `${record.sourceName || record.sourceType} - ${record.phone || "No phone"}`,
      detail: `${record.concern || "No concern noted"} - preferred ${record.preferredContact || "phone"}`,
      status: record.urgency === "urgent" ? "urgent" : record.status
    };
  }

  if (viewId === "appointments") {
    return {
      title: formatPatient(record),
      meta: `${formatDateTime(record.startsAt)} - ${record.room || "Room not set"}`,
      detail: `${record.service} with ${formatPractitioner(record)}`,
      status: record.status
    };
  }

  if (viewId === "billing") {
    const total = invoiceTotal(record);
    const due = Math.max(total - (record.paidAmount || 0), 0);
    return {
      title: record.invoiceNo,
      meta: `${record.patient?.fullName || "Patient"} - ${INR.format(total)} total`,
      detail: `${INR.format(record.paidAmount || 0)} paid - ${INR.format(due)} due`,
      status: record.status
    };
  }

  if (viewId === "inventory") {
    return {
      title: record.name,
      meta: `${record.category} - ${record.quantity} ${record.unit || "pcs"} available`,
      detail: `Reorder at ${record.reorderLevel}; ${record.vendor || "vendor not listed"}`,
      status: record.quantity <= record.reorderLevel ? "low stock" : "ready"
    };
  }

  if (viewId === "assessments") {
    return {
      title: `Assessment - ${(record.domains || []).join(", ") || "General"}`,
      meta: `Findings: ${(record.findings || "").slice(0, 80)}...`,
      detail: `Status: ${record.status || "pending"}`,
      status: record.status
    };
  }

  if (viewId === "treatment-plans") {
    return {
      title: `Plan - ${(record.goals || "").slice(0, 50) || "Untitled"}`,
      meta: `Frequency: ${record.frequency || "Not set"} | ${record.duration || ""}`,
      detail: `Status: ${record.status || "pending"}`,
      status: record.status
    };
  }

  if (viewId === "progress-notes") {
    return {
      title: `Note - ${record.noteType || "General"} (${new Date(record.notedAt).toLocaleDateString("en-IN")})`,
      meta: `Objective: ${(record.objective || "").slice(0, 60)}...`,
      detail: `Assessment: ${(record.assessment || "").slice(0, 60)}...`,
      status: "completed"
    };
  }

  if (viewId === "prescriptions") {
    return {
      title: `Rx - ${(record.medications || []).map(m => m.name).join(", ") || "No medications"}`,
      meta: `Prescribed: ${new Date(record.prescribedAt).toLocaleDateString("en-IN")}`,
      detail: `Notes: ${(record.notes || "").slice(0, 80)}...`,
      status: record.status
    };
  }

  return {
    title: record.title,
    meta: `${record.department} - due ${formatDate(record.dueDate)}`,
    detail: `Priority: ${record.priority}`,
    status: record.status === "todo" && record.dueDate && new Date(record.dueDate) < new Date() ? "overdue" : record.status
  };
}

function recordActions(viewId, record) {
  if (viewId === "patients") {
    return [{ label: "View Journey", action: "journey" }];
  }

  if (viewId === "referrals") {
    if (record.status === "new") return [{ label: "Contacted", updates: { status: "contacted" } }];
    if (record.status === "contacted") return [{ label: "Scheduled", updates: { status: "scheduled" } }];
    if (record.status === "scheduled") return [{ label: "Converted", updates: { status: "converted" } }];
  }

  if (viewId === "appointments") {
    if (record.status === "scheduled") return [{ label: "Check in", updates: { status: "checked-in" } }];
    if (record.status === "checked-in") return [{ label: "Complete", updates: { status: "completed" } }];
  }

  if (viewId === "billing" && ["draft", "partial"].includes(record.status)) {
    return [{ label: "Mark paid", updates: { status: "paid", paidAmount: invoiceTotal(record) } }];
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
    <div className="reports-grid">
      <article className="action-panel director-panel">
        <div className="panel-title">
          <FileText size={21} />
          <h3>Business diagnosis</h3>
        </div>
        <div className="insight-list">
          {(data?.businessInsights || []).map((insight) => <p key={insight}>{insight}</p>)}
        </div>
      </article>
      <article className="table-panel">
        <div className="panel-title">
          <TrendingUp size={21} />
          <h3>Referral funnel</h3>
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
          <h3>Today by status</h3>
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
          <h3>Service mix</h3>
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

function ResourceBoard({ activeView, data, state, onRecordAction, actionId, actionError }) {
  const config = getViewConfig(activeView);
  const Icon = config.icon;

  if (activeView === "reports") {
    return <ReportsView data={data} />;
  }

  const records = state.records || [];

  return (
    <article className="table-panel resource-panel">
      <div className="panel-title resource-title">
        <Icon size={21} />
        <div>
          <h3>{config.label}</h3>
          <span>{records.length} record(s) loaded</span>
        </div>
      </div>
      {state.loading && <p className="empty-state">Loading {config.label.toLowerCase()}...</p>}
      {state.error && <p className="form-status error-status">{state.error}</p>}
      {actionError && <p className="form-status error-status">{actionError}</p>}
      {!state.loading && !state.error && (
        <AnimatePresence mode="popLayout">
          {records.length ? (
            <div className="record-grid">
              {records.map((record) => {
                const summary = describeRecord(activeView, record);
                const actions = recordActions(activeView, record);
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
                        <strong>{summary.title || "Untitled record"}</strong>
                        <span>{summary.meta}</span>
                      </div>
                      <mark className={statusClass(summary.status)}>{summary.status || "open"}</mark>
                    </div>
                    <p>{summary.detail}</p>
                    {actions.length > 0 && (
                      <div className="record-actions">
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
  const [activeView, setActiveView] = useState("overview");
  const [query, setQuery] = useState("");
  const [resourceRefresh, setResourceRefresh] = useState(0);
  const [actionId, setActionId] = useState("");
  const [actionError, setActionError] = useState("");
  const [journeyPatientId, setJourneyPatientId] = useState(null);
  const { data, loading, refreshing, error, updatedAt, refresh } = useDashboard(session.token);
  const resourceState = useResourceRecords({ activeView, token: session.token, query, refreshSignal: resourceRefresh });
  const isDirector = ["director", "admin"].includes(session.user?.role);
  const activeConfig = getViewConfig(activeView);

  const syncLabel = useMemo(() => {
    if (refreshing) return "Syncing";
    if (error) return "Needs attention";
    if (updatedAt) return `Live ${formatTime(updatedAt)}`;
    return "Waiting";
  }, [error, refreshing, updatedAt]);

  function handleLogout() {
    clearSession();
    setSession({ token: null, user: null });
  }

  function handleRefresh() {
    refresh();
    setResourceRefresh((value) => value + 1);
  }

  async function handleRecordAction(resource, id, updates, extra) {
    if (extra?.action === "journey") {
      setJourneyPatientId(id);
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

  if (!session.token) {
    return <LoginPanel onLogin={setSession} />;
  }

  return (
    <section className="dashboard-section" id="dashboard">
      <div className="dashboard-shell">
        <aside className="sidebar">
          <div className="brand compact">
            <span className="brand-mark">M</span>
            <span>
              <strong>Mindful</strong>
              <small>{isDirector ? "Director console" : "Staff console"}</small>
            </span>
          </div>
          {viewItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={item.id === activeView ? "side-link active" : "side-link"}
                type="button"
                key={item.id}
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
        </aside>
        <div className="console">
          <div className="console-header">
            <div>
              <p className="eyebrow">{isDirector ? "Director command centre" : "Operations dashboard"}</p>
              <h2>{activeView === "overview" ? "Whole-centre operating view" : activeConfig.label}</h2>
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

          {data && (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                className="workspace-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
              {activeView === "overview" ? (
                <OverviewWorkspace data={data} isDirector={isDirector} />
              ) : ["assessments", "treatment-plans", "progress-notes", "prescriptions"].includes(activeView) ? (
                <ClinicalBoard
                  activeView={activeView}
                  token={session.token}
                  query={query}
                  refreshSignal={resourceRefresh}
                />
              ) : (
                <ResourceBoard
                  activeView={activeView}
                  data={data}
                  state={resourceState}
                  onRecordAction={handleRecordAction}
                  actionId={actionId}
                  actionError={actionError}
                />
              )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {journeyPatientId && (
        <PatientJourney
          patientId={journeyPatientId}
          token={session.token}
          onClose={() => setJourneyPatientId(null)}
        />
      )}
    </section>
  );
}
