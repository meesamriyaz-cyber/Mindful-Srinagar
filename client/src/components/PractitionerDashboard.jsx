import React, { useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  ListChecks,
  UsersRound,
  RefreshCw,
  AlertCircle,
  UserRound,
  ChevronDown
} from "lucide-react";
import { apiRequest } from "../lib/api.js";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.jsx";
import { Skeleton } from "./ui/skeleton.jsx";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu.jsx";
import "./staff-console.css";
import "./clinical-workspace.css";
import "./dashboard-ux.css";
import "./practitioner-dashboard.css";

function formatDateTime(value, options = {}) {
  if (!value) return "Time not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-IN", options).format(date);
}

function statusVariant(value) {
  const status = String(value || "").toLowerCase();
  if (["completed", "active", "paid", "approved", "ready"].includes(status)) return "success";
  if (["urgent", "overdue", "cancelled", "no-show", "rejected"].includes(status)) return "destructive";
  if (["pending", "draft", "planned", "in-progress", "on-hold"].includes(status)) return "warning";
  return "secondary";
}

function Metric({ label, value, icon: Icon, description }) {
  return (
    <Card className="practitioner-metric-card">
      <CardContent className="practitioner-metric-content">
        <div className="practitioner-metric-icon" aria-hidden="true"><Icon size={19} /></div>
        <div className="practitioner-metric-copy">
          <span>{label}</span>
          <strong>{value ?? 0}</strong>
          <small>{description || "Your clinical activity"}</small>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionCard({ icon: Icon, title, description, children, className = "" }) {
  return (
    <Card className={`practitioner-section-card ${className}`}>
      <CardHeader className="practitioner-section-header">
        <div className="practitioner-section-icon" aria-hidden="true"><Icon size={18} /></div>
        <div><CardTitle>{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</div>
      </CardHeader>
      <CardContent className="practitioner-section-content">{children}</CardContent>
    </Card>
  );
}

function EmptyState({ children }) {
  return <div className="practitioner-empty-state"><span aria-hidden="true">—</span><p>{children}</p></div>;
}

export function PractitionerDashboard({ token, onNavigate, onOpenPatient }) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: "" }));
    apiRequest("/dashboard/practitioner", { token })
      .then((data) => { if (active) setState({ data, loading: false, error: "" }); })
      .catch((error) => { if (active) setState({ data: null, loading: false, error: error.message || "Unable to load your clinical activity." }); });
    return () => { active = false; };
  }, [token, refreshKey]);

  if (state.loading) {
    return (
      <div className="practitioner-dashboard practitioner-dashboard-loading" aria-label="Loading practitioner dashboard" aria-busy="true">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="practitioner-metrics-grid">{Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}</div>
        <div className="practitioner-sections-grid"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>
      </div>
    );
  }

  if (state.error || !state.data) {
    return (
      <Card className="practitioner-error-card" role="alert">
        <CardContent>
          <div className="practitioner-error-icon"><AlertCircle size={22} /></div>
          <div><CardTitle>Practitioner dashboard unavailable</CardTitle><CardDescription>{state.error || "Your clinical activity could not be loaded."}</CardDescription>
            <p>Ask an administrator to verify that your staff account is linked to an active practitioner profile.</p>
            <Button variant="outline" size="sm" onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw size={15} /> Try again</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const {
    practitioner = {},
    role,
    metrics = {},
    todaysAppointments = [],
    documentationPending = [],
    upcomingAppointments = [],
    recentNotes = [],
    assignedTasks = []
  } = state.data;

  return (
    <div className="practitioner-dashboard">
      <Card className="practitioner-welcome-card practitioner-welcome-compact">
        <CardContent>
          <div className="practitioner-welcome-mark"><UsersRound size={22} /></div>
          <div className="practitioner-welcome-copy">
            <span className="practitioner-eyebrow">PRACTITIONER WORKSPACE</span>
            <h2>Welcome, {practitioner.name || "Practitioner"}</h2>
            <p>{practitioner.discipline || (practitioner.status === "active" ? "Practitioner" : "Clinical staff")} · Your appointments, clinical workload and activity are limited to your linked practitioner and staff account.</p>
          </div>
          <Badge variant={practitioner.status === "active" ? "success" : "secondary"}>{practitioner.status || "Profile linked"}</Badge>
        </CardContent>
      </Card>

      <section className="practitioner-sections-grid practitioner-today-primary" aria-label="Today’s clinical schedule">
        <SectionCard icon={CalendarClock} title="Today's appointments" description={`Your primary clinical schedule · ${metrics.appointmentsToday ?? todaysAppointments.length} appointments`}>
          {metrics.appointmentsToday > todaysAppointments.length && <p className="practitioner-worklist-overflow">Showing {todaysAppointments.length} of {metrics.appointmentsToday} appointments. Review the complete schedule in Appointments.</p>}
          {todaysAppointments.length ? <div className="practitioner-list">
            {todaysAppointments.map((item) => (
              <article className="practitioner-list-row" key={item._id}>
                <div className="practitioner-time-block"><strong>{formatDateTime(item.startsAt, { hour: "2-digit", minute: "2-digit" })}</strong><span>{item.durationMinutes || "—"} min</span></div>
                <div className="practitioner-row-main"><strong>{item.patient?.fullName || "Patient"}</strong><span>{item.service || "Service not specified"}</span></div>
                <Badge variant={statusVariant(item.status)}>{item.status || "scheduled"}</Badge>
                <div className="practitioner-appointment-actions">
                  <Button size="sm" variant="outline" onClick={() => onOpenPatient?.(item.patient || item.patient?._id)} disabled={!item.patient?._id && !item.patient}><UserRound size={14} /> Patient</Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" disabled={!item.patient?._id && !item.patient}>Clinical actions <ChevronDown size={14} /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {["checked-in", "completed"].includes(String(item.status || "").toLowerCase()) && <DropdownMenuItem onSelect={() => onOpenPatient?.(item.patient || item.patient?._id, "progress-notes", item._id)}><FileText size={15} /> New Progress Note</DropdownMenuItem>}
                      <DropdownMenuItem onSelect={() => onOpenPatient?.(item.patient || item.patient?._id, "assessments", item._id)}><ClipboardCheck size={15} /> New Assessment</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </article>
            ))}
          </div> : <EmptyState>No appointments scheduled for today.</EmptyState>}
        </SectionCard>

        <SectionCard icon={CalendarClock} title="Coming up" description={`Your next scheduled appointments · ${metrics.upcomingAppointments ?? upcomingAppointments.length} upcoming`}>
          {metrics.upcomingAppointments > upcomingAppointments.length && <p className="practitioner-worklist-overflow">Showing {upcomingAppointments.length} of {metrics.upcomingAppointments} upcoming appointments. Review the complete schedule in Appointments.</p>}
          {upcomingAppointments.length ? <div className="practitioner-list">
            {upcomingAppointments.map((item) => (
              <article className="practitioner-list-row" key={item._id}>
                <div className="practitioner-time-block"><strong>{formatDateTime(item.startsAt, { day: "2-digit", month: "short" })}</strong><span>{formatDateTime(item.startsAt, { hour: "2-digit", minute: "2-digit" })}</span></div>
                <div className="practitioner-row-main"><strong>{item.patient?.fullName || "Patient"}</strong><span>{item.service || "Service not specified"}</span></div>
                <Badge variant={statusVariant(item.status)}>{item.status || "scheduled"}</Badge>
                <div className="practitioner-appointment-actions">
                  <Button size="sm" variant="outline" onClick={() => onOpenPatient?.(item.patient?._id || item.patient)} disabled={!item.patient?._id && !item.patient}><UserRound size={14} /> Patient</Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" disabled={!item.patient?._id && !item.patient}>Clinical actions <ChevronDown size={14} /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {["checked-in", "completed"].includes(String(item.status || "").toLowerCase()) && <DropdownMenuItem onSelect={() => onOpenPatient?.(item.patient?._id || item.patient, "progress-notes", item._id)}><FileText size={15} /> New Progress Note</DropdownMenuItem>}
                      <DropdownMenuItem onSelect={() => onOpenPatient?.(item.patient?._id || item.patient, "assessments", item._id)}><ClipboardCheck size={15} /> New Assessment</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </article>
            ))}
          </div> : <EmptyState>No upcoming appointments currently scheduled.</EmptyState>}
        </SectionCard>
      </section>

      <section className="practitioner-attention-section" aria-label="Attention required"><div className="practitioner-attention-heading"><h3>Attention required</h3><p>Clinical documentation and follow-up work</p></div><SectionCard icon={FileText} title="Session notes pending" description={`Checked-in sessions awaiting documentation · ${metrics.documentationPending ?? documentationPending.length} pending`}>
        {metrics.documentationPending > documentationPending.length && <p className="practitioner-worklist-overflow">Showing {documentationPending.length} appointments here; {metrics.documentationPending} sessions require documentation in total. Review today's appointments to access the complete list.</p>}
        {documentationPending.length ? <div className="practitioner-list">
          {documentationPending.map((item) => (
            <article className="practitioner-list-row" key={item._id}>
              <div className="practitioner-time-block"><strong>{formatDateTime(item.startsAt, { hour: "2-digit", minute: "2-digit" })}</strong><span>{item.durationMinutes || "—"} min</span></div>
              <div className="practitioner-row-main"><strong>{item.patient?.fullName || "Patient"}</strong><span>{item.service || "Service not specified"}</span></div>
              <Badge variant="warning">Note pending</Badge>
              <Button size="sm" variant="outline" onClick={() => onOpenPatient?.(item.patient, "progress-notes", item._id)} disabled={!item.patient?._id}><FileText size={14} /> Record note</Button>
            </article>
          ))}
        </div> : <EmptyState>All checked-in sessions have documentation recorded.</EmptyState>}
      </SectionCard>

  <SectionCard icon={ListChecks} title="My open tasks" description={`Tasks assigned to your account · ${metrics.openTasks ?? assignedTasks.length} open${metrics.overdueTasks ? ` · ${metrics.overdueTasks} overdue` : ""}${metrics.tasksDueToday ? ` · ${metrics.tasksDueToday} due today` : ""}${metrics.tasksDueSoon ? ` · ${metrics.tasksDueSoon} due in the next 7 days` : ""}`}>
          {metrics.openTasks > assignedTasks.length && <p className="practitioner-worklist-overflow">Showing {assignedTasks.length} of {metrics.openTasks} open tasks. {metrics.overdueTasks || 0} overdue, {metrics.tasksDueToday || 0} due today and {metrics.tasksDueSoon || 0} due in the next 7 days across your complete workload. Review Tasks for the full list.</p>}
          {assignedTasks.length ? <div className="practitioner-list">
            {assignedTasks.map((task) => (
              <article className="practitioner-list-row" key={task._id}>
                <div className="practitioner-row-main"><strong>{task.title}</strong><span>{task.department || "General"} · {task.dueDate ? `Due ${formatDateTime(task.dueDate, { day: "2-digit", month: "short" })}` : "No due date"}</span></div>
                <Badge variant={statusVariant(task.priority)}>{task.priority || "normal"}</Badge>
              </article>
            ))}
          </div> : <EmptyState>No open tasks assigned to you.</EmptyState>}
        </SectionCard>
      </section>

      <section className="practitioner-metrics-grid" aria-label="My clinical activity">
        <Metric label="Patients under my care" value={metrics.patientsUnderCare} icon={UsersRound} description="Linked patient records" />
        <Metric label="Appointments today" value={metrics.appointmentsToday} icon={CalendarClock} description="Today's schedule" />
        <Metric label="Completed sessions" value={metrics.completedSessionsThisMonth} icon={CheckCircle2} description="This month" />
        <Metric label="Pending assessments" value={metrics.pendingAssessments} icon={ClipboardCheck} description="Awaiting completion" />
        {role === "doctor" && <Metric label="Active prescriptions" value={metrics.activePrescriptions} icon={FileText} description="Current prescriptions" />}
      </section>

      <section className="practitioner-sections-grid" aria-label="Recent clinical activity">
        <SectionCard icon={FileText} title="Recent progress notes" description="Notes authored by you">
          {recentNotes.length ? <div className="practitioner-list">
            {recentNotes.map((note) => (
              <article className="practitioner-list-row practitioner-note-row" key={note._id}>
                <div className="practitioner-row-main"><strong>{note.patient?.fullName || "Patient"} <span>· {note.noteType || "Progress note"}</span></strong><span>{formatDateTime(note.notedAt, { day: "2-digit", month: "short", year: "numeric" })}</span><p>{(note.assessment || note.plan || note.subjective || "No note summary available.").slice(0, 120)}</p></div>
              </article>
            ))}
          </div> : <EmptyState>No progress notes authored yet.</EmptyState>}
        </SectionCard>


      </section>
    </div>
  );
}
