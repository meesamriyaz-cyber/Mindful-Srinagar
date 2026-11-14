import React, { useEffect, useMemo, useState } from "react";
import { apiRequest } from "../lib/api.js";

const ROLES = [
  ["reception", "Reception"],
  ["coordinator", "Coordinator"],
  ["doctor", "Doctor"],
  ["therapist", "Therapist"],
  ["accounts", "Accounts"],
  ["admin", "Administrator"],
  ["director", "Director"]
];

export function StaffBoard({ token, currentRole, onChanged }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState({ name: "", email: "", role: "reception", password: "", confirmPassword: "" });
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
      setError(err.message);
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
      setForm({ name: "", email: "", role: "reception", password: "", confirmPassword: "" });
      setShowForm(false);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="table-panel resource-panel staff-management-board">
      <div className="panel-title resource-title staff-board-heading staff-management-heading">
        <div>
          <h3>Staff accounts</h3>
          <span className="resource-count">{staff.length} {staff.length === 1 ? "account" : "accounts"} · {activeCount} active</span>
          <p className="resource-description">Create staff login credentials and review account access.</p>
        </div>
        {!showForm && <button className="primary-button compact-button" type="button" onClick={() => setShowForm(true)}>+ Add staff account</button>}
      </div>
      {error && <p className="form-status error-status">{error}</p>}
      {showForm && (
        <section className="action-panel staff-account-editor">
          <h3>Create staff login</h3>
          <form className="clinical-form staff-account-form" onSubmit={submit}>
            <div className="form-row">
              <label>Full name
                <input required minLength={2} maxLength={90} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label>Staff email
                <input required type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
            </div>
            <label>Role
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {availableRoles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <div className="form-row">
              <label>Initial password (minimum 12 characters)
                <input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </label>
              <label>Confirm password
                <input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
              </label>
            </div>
            <p className="empty-state">Share the login email and initial password securely with the staff member. They can sign in using the Staff Console.</p>
            <div className="modal-actions">
              <button className="primary-button" type="submit" disabled={saving}>{saving ? "Creating account..." : "Create staff account"}</button>
              <button className="secondary-button" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </section>
      )}
      <div className="staff-board-summary" aria-label="Staff account summary">
        <div className="staff-summary-card"><span>Total accounts</span><strong>{staff.length}</strong><small>All staff logins</small></div>
        <div className="staff-summary-card is-active"><span>Active accounts</span><strong>{activeCount}</strong><small>Access enabled</small></div>
        <div className="staff-summary-card is-inactive"><span>Inactive accounts</span><strong>{inactiveCount}</strong><small>Access disabled</small></div>
        <div className="staff-summary-card is-clinical"><span>Clinical staff</span><strong>{practitionerCount}</strong><small>Doctors and therapists</small></div>
      </div>
      <div className="staff-board-toolbar">
        <label className="search-box staff-board-search">
          <span className="staff-search-label">Search staff</span>
          <input aria-label="Search staff by name, email or role" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email or role" />
        </label>
        <label className="staff-filter-control">
          <span>Role</span>
          <select aria-label="Filter staff by role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="all">All roles</option>
            {ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="staff-filter-control">
          <span>Account status</span>
          <select aria-label="Filter staff by account status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>
      <div className="staff-results-line" aria-live="polite">
        <span>{loading ? "Loading staff accounts..." : "Showing " + visibleStaff.length + " of " + staff.length + " accounts"}</span>
        {(search || roleFilter !== "all" || statusFilter !== "all") && (
          <button className="staff-filter-reset" type="button" onClick={() => { setSearch(""); setRoleFilter("all"); setStatusFilter("all"); }}>Clear filters</button>
        )}
      </div>
      {loading ? <p className="empty-state">Loading staff accounts...</p> : visibleStaff.length ? (
        <div className="record-grid staff-record-grid staff-management-grid">
          {visibleStaff.map((person) => (
            <div className="record-card staff-record-card" key={person._id}>
              <div className="record-main">
                <div><strong>{person.name}</strong><span>{person.email}</span></div>
                <mark className={person.isActive ? "good" : "risk"}>{person.isActive ? "Active" : "Inactive"}</mark>
              </div>
              <p className="staff-role-line"><span>ACCESS ROLE</span><strong>{ROLES.find(([role]) => role === person.role)?.[1] || person.role}</strong></p>
              <p className="staff-created-line"><span>Created</span><strong>{person.createdAt ? new Date(person.createdAt).toLocaleDateString("en-IN") : "—"}</strong></p>
              {["doctor", "therapist"].includes(person.role) && <p>Practitioner profile must be linked before the clinical dashboard can show appointment activity.</p>}
            </div>
          ))}
        </div>
      ) : staff.length ? (
        <p className="empty-state staff-no-results">No staff accounts match these filters. Try changing the search or filter selection.</p>
      ) : <p className="empty-state">No staff accounts found.</p>}
    </article>
  );
}
