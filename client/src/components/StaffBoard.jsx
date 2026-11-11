import React, { useEffect, useState } from "react";
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

export function StaffBoard({ token, currentRole }) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "reception", password: "", confirmPassword: "" });
  const availableRoles = currentRole === "director" ? ROLES : ROLES.filter(([role]) => !["director", "admin"].includes(role));

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
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="table-panel resource-panel">
      <div className="panel-title resource-title">
        <div>
          <h3>Staff accounts</h3>
          <span>Create staff login credentials and review account access</span>
        </div>
        {!showForm && <button className="primary-button compact-button" type="button" onClick={() => setShowForm(true)}>+ Add staff account</button>}
      </div>
      {error && <p className="form-status error-status">{error}</p>}
      {showForm && (
        <section className="action-panel">
          <h3>Create staff login</h3>
          <form className="clinical-form" onSubmit={submit}>
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
      {loading ? <p className="empty-state">Loading staff accounts...</p> : staff.length ? (
        <div className="record-grid">
          {staff.map((person) => (
            <div className="record-card" key={person._id}>
              <div className="record-main">
                <div><strong>{person.name}</strong><span>{person.email}</span></div>
                <mark className={person.isActive ? "good" : "risk"}>{person.isActive ? "Active" : "Inactive"}</mark>
              </div>
              <p>Role: {ROLES.find(([role]) => role === person.role)?.[1] || person.role}</p>
              <p>Created: {person.createdAt ? new Date(person.createdAt).toLocaleDateString("en-IN") : "—"}</p>
              {["doctor", "therapist"].includes(person.role) && <p>Practitioner profile must be linked before the clinical dashboard can show appointment activity.</p>}
            </div>
          ))}
        </div>
      ) : <p className="empty-state">No staff accounts found.</p>}
    </article>
  );
}
