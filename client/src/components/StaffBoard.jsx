import React, { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api.js";
import { Badge } from "./ui/badge.jsx";
import { Button } from "./ui/button.jsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.jsx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog.jsx";
import { Input } from "./ui/input.jsx";
import { Label } from "./ui/label.jsx";
import { Activity, BriefcaseBusiness, CheckCircle2, CircleUserRound, Plus, Search, ShieldCheck, UsersRound, XCircle } from "lucide-react";
import "./staff-console.css";

const ROLES = [
  ["reception", "Reception"],
  ["coordinator", "Coordinator"],
  ["doctor", "Doctor"],
  ["therapist", "Therapist"],
  ["accounts", "Accounts"],
  ["admin", "Administrator"],
  ["director", "Director"]
];

const EMPTY_FORM = { name: "", email: "", role: "reception", password: "", confirmPassword: "" };

export function StaffBoard({ token, currentRole, onChanged }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState(EMPTY_FORM);
  const availableRoles = currentRole === "director" ? ROLES : ROLES.filter(([role]) => !["director", "admin"].includes(role));
  const activeCount = staff.filter((person) => person.isActive).length;
  const inactiveCount = staff.length - activeCount;
  const practitionerCount = staff.filter((person) => ["doctor", "therapist"].includes(person.role)).length;

  const visibleStaff = useMemo(() => {
    const term = search.trim().toLowerCase();
    return staff.filter((person) => {
      const matchesSearch = !term || [person.name, person.email, person.role]
        .some((value) => String(value || "").toLowerCase().includes(term));
      const matchesRole = roleFilter === "all" || person.role === roleFilter;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? person.isActive : !person.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [staff, search, roleFilter, statusFilter]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/staff", { token });
      setStaff(data || []);
    } catch (err) {
      setError(err.message || "Unable to load staff accounts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 12) {
      setError("Password must contain at least 12 characters.");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/auth/staff", {
        token,
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          role: form.role,
          password: form.password
        })
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message || "Unable to create staff account.");
    } finally {
      setSaving(false);
    }
  }

  const resetFilters = () => {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
  };

  return (
    <section className="staff-management-workspace">
      <header className="staff-workspace-heading">
        <div>
          <p className="staff-workspace-eyebrow">TEAM & ACCESS</p>
          <h2>People behind the care</h2>
          <p>Manage staff identities, access roles and account availability.</p>
        </div>
        <Button onClick={() => { setError(""); setShowForm(true); }}>
          <Plus /> Add staff account
        </Button>
      </header>

      {error && !showForm && <div className="staff-alert" role="alert">{error}</div>}

      <div className="staff-board-summary" aria-label="Staff account summary">
        <Card className="staff-summary-card">
          <CardContent>
            <span>Total accounts</span>
            <div className="staff-summary-value"><UsersRound /><strong>{staff.length}</strong></div>
            <small>All staff logins</small>
          </CardContent>
        </Card>
        <Card className="staff-summary-card is-active">
          <CardContent>
            <span>Active accounts</span>
            <div className="staff-summary-value"><CheckCircle2 /><strong>{activeCount}</strong></div>
            <small>Access enabled</small>
          </CardContent>
        </Card>
        <Card className="staff-summary-card is-inactive">
          <CardContent>
            <span>Inactive accounts</span>
            <div className="staff-summary-value"><XCircle /><strong>{inactiveCount}</strong></div>
            <small>Access disabled</small>
          </CardContent>
        </Card>
        <Card className="staff-summary-card is-clinical">
          <CardContent>
            <span>Clinical staff</span>
            <div className="staff-summary-value"><BriefcaseBusiness /><strong>{practitionerCount}</strong></div>
            <small>Doctors and therapists</small>
          </CardContent>
        </Card>
      </div>

      <Card className="staff-management-board">
        <CardHeader className="staff-board-card-header">
          <div>
            <CardTitle>Staff directory</CardTitle>
            <CardDescription>Search team members and review their account access.</CardDescription>
          </div>
          <Badge variant="secondary">{staff.length} {staff.length === 1 ? "member" : "members"}</Badge>
        </CardHeader>
        <CardContent>
          <div className="staff-board-toolbar">
            <div className="staff-search-field">
              <Label htmlFor="staff-search">Search staff</Label>
              <div className="staff-search-input-wrap">
                <Search aria-hidden="true" />
                <Input id="staff-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email or role" />
              </div>
            </div>
            <div className="staff-filter-control">
              <Label htmlFor="staff-role-filter">Role</Label>
              <select id="staff-role-filter" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="all">All roles</option>
                {ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="staff-filter-control">
              <Label htmlFor="staff-status-filter">Account status</Label>
              <select id="staff-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="staff-results-line" aria-live="polite">
            <span>{loading ? "Loading staff accounts..." : `Showing ${visibleStaff.length} of ${staff.length} accounts`}</span>
            {(search || roleFilter !== "all" || statusFilter !== "all") && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>Clear filters</Button>
            )}
          </div>

          {loading ? (
            <div className="staff-directory-state"><Activity className="animate-pulse" /><p>Loading staff accounts…</p></div>
          ) : visibleStaff.length ? (
            <div className="staff-directory-grid">
              {visibleStaff.map((person) => (
                <article className="staff-directory-person" key={person._id}>
                  <div className="staff-person-top">
                    <div className="staff-person-avatar"><CircleUserRound /></div>
                    <div className="staff-person-identity">
                      <h3>{person.name}</h3>
                      <p>{person.email}</p>
                    </div>
                    <Badge variant={person.isActive ? "success" : "destructive"}>{person.isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                  <div className="staff-person-meta">
                    <div><span>ACCESS ROLE</span><strong><ShieldCheck /> {ROLES.find(([role]) => role === person.role)?.[1] || person.role}</strong></div>
                    <div><span>ACCOUNT CREATED</span><strong>{person.createdAt ? new Date(person.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</strong></div>
                  </div>
                  {["doctor", "therapist"].includes(person.role) && (
                    <p className="staff-practitioner-note">Practitioner profile must be linked before clinical appointment activity appears.</p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="staff-directory-state">
              <UsersRound />
              <strong>{staff.length ? "No matching staff accounts" : "No staff accounts yet"}</strong>
              <p>{staff.length ? "Try changing your search or filters." : "Create the first staff login to give your team secure access."}</p>
              {staff.length > 0 && <Button variant="outline" size="sm" onClick={resetFilters}>Clear filters</Button>}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={(open) => { if (!saving) setShowForm(open); }}>
        <DialogContent className="staff-create-dialog">
          <DialogHeader>
            <DialogTitle>Create staff account</DialogTitle>
            <DialogDescription>Add a team member and assign the appropriate access role. Role permissions remain governed by the existing staff access rules.</DialogDescription>
          </DialogHeader>
          {error && <div className="staff-alert" role="alert">{error}</div>}
          <form id="staff-create-form" className="staff-create-form" onSubmit={submit}>
            <div className="staff-form-grid">
              <div className="staff-form-field">
                <Label htmlFor="staff-name">Full name</Label>
                <Input id="staff-name" required minLength={2} maxLength={90} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
              <div className="staff-form-field">
                <Label htmlFor="staff-email">Staff email</Label>
                <Input id="staff-email" required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </div>
              <div className="staff-form-field staff-form-role">
                <Label htmlFor="staff-role">Access role</Label>
                <select id="staff-role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                  {availableRoles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <p>{currentRole === "director" ? "Director access can assign all available roles." : "Administrator and Director roles are reserved for Director-level account creation."}</p>
              </div>
              <div className="staff-form-field">
                <Label htmlFor="staff-password">Initial password</Label>
                <Input id="staff-password" required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                <p>Use at least 12 characters.</p>
              </div>
              <div className="staff-form-field">
                <Label htmlFor="staff-confirm-password">Confirm password</Label>
                <Input id="staff-confirm-password" required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} />
              </div>
            </div>
            <div className="staff-security-note"><ShieldCheck /><p>Share the login email and initial password securely with the staff member. Never send credentials in a public or group channel.</p></div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" form="staff-create-form" disabled={saving}>{saving ? "Creating account…" : "Create account"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
