import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ClipboardCheck,
  IndianRupee,
  LogOut,
  Search,
  ShieldCheck,
  TrendingUp,
  UsersRound
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { useDashboard } from "../hooks/useDashboard.js";
import { clearSession, getStoredSession, loginStaff, storeSession } from "../lib/api.js";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function formatTime(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatPatient(appointment) {
  return appointment.patient?.fullName || "Patient";
}

function formatPractitioner(appointment) {
  return appointment.practitioner?.name || appointment.service;
}

function StatCard({ label, value, trend, icon: Icon }) {
  return (
    <article className="stat-card">
      <div className="stat-topline">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <small>{trend}</small>
    </article>
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

function DirectorView({ data }) {
  const metrics = data.metrics;
  const serviceDemand = data.analytics?.serviceDemand || [];
  const referralMix = Object.entries(data.analytics?.referralMix || {});
  const patientStatus = Object.entries(data.analytics?.patientStatus || {});
  const maxDemand = Math.max(...serviceDemand.map((item) => item.count), 1);

  return (
    <div className="director-view">
      <article className="action-panel">
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
            <span>Referral conversion</span>
            <strong>{metrics.conversionRate || 0}%</strong>
          </div>
        </div>
        <div className="insight-list">
          <p>Focus collections on partial and draft invoices before month close.</p>
          <p>Protect high-demand services with staffing and room availability.</p>
          <p>Track hospital and school referral sources weekly for growth partnerships.</p>
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
                <span>{item.service}</span>
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
          {patientStatus.map(([status, count]) => (
            <span key={status}>{status}: <strong>{count}</strong></span>
          ))}
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

export function Dashboard() {
  const [session, setSession] = useState(getStoredSession);
  const { data, loading, error } = useDashboard(session.token);
  const isDirector = ["director", "admin"].includes(session.user?.role);

  const stats = useMemo(() => {
    const metrics = data?.metrics || {};
    return [
      {
        label: "Active patients",
        value: metrics.activePatients ?? "--",
        trend: `${metrics.newPatientsThisMonth ?? 0} new this month`,
        icon: UsersRound
      },
      {
        label: "Appointments today",
        value: metrics.appointmentsToday ?? "--",
        trend: `${metrics.completedAppointmentsThisMonth ?? 0} completed this month`,
        icon: CalendarClock
      },
      {
        label: "Open referrals",
        value: metrics.referrals ?? "--",
        trend: `${metrics.conversionRate ?? 0}% conversion`,
        icon: TrendingUp
      },
      {
        label: "Collections",
        value: INR.format(metrics.revenueThisMonth || 0),
        trend: `${INR.format(metrics.outstanding || 0)} outstanding`,
        icon: IndianRupee
      }
    ];
  }, [data]);

  function handleLogout() {
    clearSession();
    setSession({ token: null, user: null });
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
          {["Overview", "Patients", "Referrals", "Appointments", "Billing", "Inventory", "Reports"].map((item) => (
            <button className={item === "Overview" ? "side-link active" : "side-link"} type="button" key={item}>
              {item}
            </button>
          ))}
        </aside>
        <div className="console">
          <div className="console-header">
            <div>
              <p className="eyebrow">{isDirector ? "Director command centre" : "Operations dashboard"}</p>
              <h2>{isDirector ? "Whole-centre performance and business view" : "Today's centre command view"}</h2>
              <p className="console-user">Signed in as {session.user?.name} ({session.user?.role})</p>
            </div>
            <div className="console-tools">
              <label className="search-box">
                <Search size={18} />
                <input placeholder="Search patient, MRN, referral source" />
              </label>
              <button className="icon-button" type="button" onClick={handleLogout} aria-label="Sign out">
                <LogOut size={18} />
              </button>
            </div>
          </div>

          {loading && <p className="empty-state">Loading live centre data...</p>}
          {error && <p className="form-status error-status">{error}</p>}

          {data && (
            <>
              <div className="stats-grid">
                {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
              </div>

              {isDirector && <DirectorView data={data} />}

              <div className="console-grid">
                <article className="table-panel">
                  <div className="panel-title">
                    <CalendarClock size={21} />
                    <h3>Appointments</h3>
                  </div>
                  <div className="appointment-list">
                    {data.todaysAppointments.length ? data.todaysAppointments.map((appointment) => (
                      <div className="appointment-row" key={appointment._id}>
                        <time>{formatTime(appointment.startsAt)}</time>
                        <div>
                          <strong>{formatPatient(appointment)}</strong>
                          <span>{appointment.service} - {formatPractitioner(appointment)}</span>
                        </div>
                        <mark>{appointment.status}</mark>
                      </div>
                    )) : <p className="empty-state">No appointments scheduled today.</p>}
                  </div>
                </article>

                <article className="action-panel">
                  <div className="panel-title">
                    <ClipboardCheck size={21} />
                    <h3>Priority work</h3>
                  </div>
                  <ul>
                    {data.openTasks.length ? data.openTasks.map((task) => (
                      <li key={task._id}>{task.title}</li>
                    )) : <li>No open tasks.</li>}
                  </ul>
                  <div className="warning">
                    <AlertTriangle size={20} />
                    {data.lowStock.length
                      ? `${data.lowStock.length} inventory item(s) need reorder.`
                      : "No low-stock alerts right now."}
                  </div>
                </article>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
