import React, { useEffect, useMemo, useState } from "react";
import { listRecords, createRecord, updateRecord } from "../lib/api.js";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const EMPTY_FORM = {
  name: "", discipline: "", registrationNo: "", phone: "", email: "",
  status: "active", user: "", availability: []
};

function PractitionerForm({ initial, staffAccounts, saving, onCancel, onSave }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    ...(initial || {}),
    user: initial?.user?._id || initial?.user || "",
    availability: Array.isArray(initial?.availability) ? initial.availability : []
  }));
  const [error, setError] = useState("");

  function updateAvailability(day, checked) {
    setForm((current) => ({
      ...current,
      availability: checked
        ? [...current.availability.filter((slot) => slot.day !== day), { day, from: "09:00", to: "17:00" }]
        : current.availability.filter((slot) => slot.day !== day)
    }));
  }

  function updateSlot(day, field, value) {
    setForm((current) => ({
      ...current,
      availability: current.availability.map((slot) => slot.day === day ? { ...slot, [field]: value } : slot)
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (form.availability.some((slot) => !slot.from || !slot.to || slot.from >= slot.to)) {
      setError("Each availability window must have an end time later than its start time.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      discipline: form.discipline.trim(),
      registrationNo: form.registrationNo.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      status: form.status,
      availability: form.availability
    };
    if (form.user) payload.user = form.user;
    try {
      await onSave(payload);
    } catch (saveError) {
      setError(saveError.message || "Unable to save practitioner.");
    }
  }

  return (
    <form className="clinical-form practitioner-form" onSubmit={submit}>
      {error && <p className="form-status error-status">{error}</p>}
      <div className="form-row">
        <label>Practitioner name
          <input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>Discipline / speciality
          <input required maxLength={120} value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })} placeholder="Speech Therapist, Occupational Therapist..." />
        </label>
      </div>
      <div className="form-row">
        <label>Registration number
          <input maxLength={80} value={form.registrationNo || ""} onChange={(e) => setForm({ ...form, registrationNo: e.target.value })} />
        </label>
        <label>Phone
          <input maxLength={30} value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </label>
      </div>
      <div className="form-row">
        <label>Email
          <input type="email" maxLength={160} value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>Linked staff account
          <select value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })}>
            <option value="">No staff account linked</option>
            {staffAccounts.map((staff) => (
              <option key={staff._id} value={staff._id}>
                {staff.name} · {staff.role} · {staff.email}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>Practitioner status
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="active">Active</option>
          <option value="visiting">Visiting</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <fieldset className="availability-editor">
        <legend>Weekly availability</legend>
        <p className="empty-state">Select working days and set the hours used by appointment validation.</p>
        {DAYS.map((day) => {
          const slot = form.availability.find((item) => item.day === day);
          return (
            <div className="availability-row" key={day}>
              <label className="availability-day">
                <input type="checkbox" checked={Boolean(slot)} onChange={(e) => updateAvailability(day, e.target.checked)} />
                {day}
              </label>
              {slot ? (
                <>
                  <input aria-label={day + " start time"} type="time" value={slot.from} onChange={(e) => updateSlot(day, "from", e.target.value)} required />
                  <span>to</span>
                  <input aria-label={day + " end time"} type="time" value={slot.to} onChange={(e) => updateSlot(day, "to", e.target.value)} required />
                </>
              ) : <span className="empty-state">Not available</span>}
            </div>
          );
        })}
      </fieldset>
      <div className="modal-actions">
        <button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : "Save practitioner"}</button>
        <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export function PractitionerBoard({ token, staffAccounts = [], onChanged }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await listRecords("doctors", { token, limit: 100 });
      setRecords(data || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [token]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;
    return records.filter((record) =>
      [record.name, record.discipline, record.phone, record.email, record.registrationNo]
        .some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [records, search]);

  async function save(payload) {
    setSaving(true);
    try {
      if (editing?._id) await updateRecord("doctors", editing._id, payload, { token });
      else await createRecord("doctors", payload, { token });
      setEditing(null);
      await load();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="table-panel resource-panel">
      <div className="panel-title resource-title">
        <div>
          <h3>Practitioners & doctors</h3>
          <p className="resource-description">Manage clinical profiles, staff account links and appointment availability.</p>
        </div>
        {!editing && <button className="primary-button compact-button" type="button" onClick={() => setEditing({})}>+ Add practitioner</button>}
      </div>
      {error && <p className="form-status error-status">{error}</p>}
      {editing && (
        <section className="action-panel">
          <h3>{editing._id ? "Edit practitioner" : "New practitioner"}</h3>
          <PractitionerForm
            key={editing._id || "new"}
            initial={editing._id ? editing : null}
            staffAccounts={staffAccounts}
            saving={saving}
            onCancel={() => setEditing(null)}
            onSave={save}
          />
        </section>
      )}
      <label className="search-box practitioner-search">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search practitioners by name, speciality or contact" />
      </label>
      {loading ? <p className="empty-state">Loading practitioners...</p> : visible.length ? (
        <div className="record-grid">
          {visible.map((record) => {
            const linked = staffAccounts.find((staff) => staff._id === (record.user?._id || record.user));
            return (
              <div className="record-card" key={record._id}>
                <div className="record-main">
                  <div><strong>{record.name}</strong><span>{record.discipline}</span></div>
                  <mark className={record.status === "active" ? "good" : ""}>{record.status}</mark>
                </div>
                <p>{record.phone || "No phone"} · {record.email || "No email"}</p>
                <p>{linked ? `Linked staff: ${linked.name} (${linked.role})` : "No staff login linked"}</p>
                <p>{record.availability?.length ? record.availability.map((slot) => `${slot.day} ${slot.from}–${slot.to}`).join(" · ") : "Availability not configured"}</p>
                <div className="record-actions">
                  <button className="secondary-button compact-button" type="button" onClick={() => setEditing(record)}>Edit practitioner</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : <p className="empty-state">No practitioners found. Add the centre's first practitioner to enable appointment scheduling.</p>}
    </article>
  );
}
