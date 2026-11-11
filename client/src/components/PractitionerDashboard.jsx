import React, { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, ClipboardCheck, FileText, ListChecks, UsersRound } from "lucide-react";
import { apiRequest } from "../lib/api.js";

function Metric({ label, value, icon: Icon }) {
  return (
    <article className="stat-card">
      <div className="stat-topline"><span>{label}</span><Icon size={18} /></div>
      <strong>{value ?? 0}</strong>
      <small>My activity</small>
    </article>
  );
}

function timeLabel(value) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function PractitionerDashboard({ token }) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));
    apiRequest("/dashboard/practitioner", { token })
      .then((data) => { if (active) setState({ data, loading: false, error: "" }); })
      .catch((error) => { if (active) setState({ data: null, loading: false, error: error.message }); });
    return () => { active = false; };
  }, [token]);

  if (state.loading) return <p className="empty-state">Loading your clinical activity...</p>;
  if (state.error) return <article className="action-panel"><h3>Practitioner dashboard unavailable</h3><p className="form-status error-status">{state.error}</p><p>Ask an administrator to verify that your staff account is linked to an active practitioner profile.</p></article>;

  const { practitioner, metrics, todaysAppointments, upcomingAppointments, recentNotes, assignedTasks } = state.data;
  return (
    <div className="director-view">
      <article className="action-panel director-panel">
        <div className="panel-title"><UsersRound size={21} /><h3>My clinical workspace</h3></div>
        <p><strong>{practitioner.name}</strong> · {practitioner.discipline || (practitioner.status === "active" ? "Practitioner" : "Clinical staff")}</p>
        <p>Your appointments, clinical workload and activity are limited to your linked practitioner and staff account.</p>
      </article>
      <div className="stats-grid">
        <Metric label="Patients under my care" value={metrics.patientsUnderCare} icon={UsersRound} />
        <Metric label="Appointments today" value={metrics.appointmentsToday} icon={CalendarClock} />
        <Metric label="Upcoming appointments" value={metrics.upcomingAppointments} icon={CalendarClock} />
        <Metric label="Completed sessions this month" value={metrics.completedSessionsThisMonth} icon={CheckCircle2} />
        <Metric label="Pending assessments" value={metrics.pendingAssessments} icon={ClipboardCheck} />
        <Metric label="Active treatment plans" value={metrics.activeTreatmentPlans} icon={FileText} />
        {practitioner.discipline && <Metric label="Open assigned tasks" value={metrics.openTasks} icon={ListChecks} />}
      </div>
      <div className="console-grid">
        <article className="table-panel">
          <div className="panel-title"><CalendarClock size={21} /><h3>Today's appointments</h3></div>
          <div className="appointment-list">
            {todaysAppointments.length ? todaysAppointments.map((item) => (
              <div className="appointment-row" key={item._id}>
                <time>{new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(new Date(item.startsAt))}</time>
                <div><strong>{item.patient?.fullName || "Patient"}</strong><span>{item.service} · {item.durationMinutes} min</span></div>
                <mark>{item.status}</mark>
              </div>
            )) : <p className="empty-state">No appointments scheduled for today.</p>}
          </div>
        </article>
        <article className="table-panel">
          <div className="panel-title"><CalendarClock size={21} /><h3>Coming up</h3></div>
          <div className="compact-record-list">
            {upcomingAppointments.length ? upcomingAppointments.map((item) => (
              <div className="compact-record" key={item._id}><div><strong>{item.patient?.fullName || "Patient"}</strong><span>{timeLabel(item.startsAt)} · {item.service}</span></div><mark>{item.status}</mark></div>
            )) : <p className="empty-state">No upcoming appointments currently scheduled.</p>}
          </div>
        </article>
      </div>
      <div className="console-grid">
        <article className="table-panel">
          <div className="panel-title"><FileText size={21} /><h3>Recent progress notes</h3></div>
          <div className="compact-record-list">
            {recentNotes.length ? recentNotes.map((note) => (
              <div className="compact-record" key={note._id}><div><strong>{note.patient?.fullName || "Patient"} · {note.noteType}</strong><span>{timeLabel(note.notedAt)} · {(note.assessment || note.plan || note.subjective || "").slice(0, 90)}</span></div></div>
            )) : <p className="empty-state">No progress notes authored yet.</p>}
          </div>
        </article>
        <article className="table-panel">
          <div className="panel-title"><ListChecks size={21} /><h3>My open tasks</h3></div>
          <div className="compact-record-list">
            {assignedTasks.length ? assignedTasks.map((task) => (
              <div className="compact-record" key={task._id}><div><strong>{task.title}</strong><span>{task.department} · {task.dueDate ? timeLabel(task.dueDate) : "No due date"}</span></div><mark>{task.priority}</mark></div>
            )) : <p className="empty-state">No open tasks assigned to you.</p>}
          </div>
        </article>
      </div>
    </div>
  );
}
