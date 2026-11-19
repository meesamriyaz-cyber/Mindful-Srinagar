import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Edit3, Eye, FilePlus2, Images, LoaderCircle, Newspaper, Plus, RefreshCw, Save, Send, X, Megaphone } from "lucide-react";
import { API_BASE_URL } from "../lib/api.js";
import { Button } from "./ui/button.jsx";
import { Badge } from "./ui/badge.jsx";
import "./admin-content-workspace.css";

const emptyDoc = () => ({ type: "doc", content: [{ type: "paragraph", content: [] }] });
const emptyPublication = () => ({ title: "", type: "news", summary: "", bodyText: "", category: "General", tags: "", coverMedia: "", mediaItems: [], eventDate: "", venue: "", identifiablePeople: false, consentStatus: "not-required", consentScope: "internal-only", consentNotes: "" });
const emptyGallery = () => ({ title: "", description: "", category: "centre-activities", coverMedia: "", mediaItems: [], eventDate: "" });
const emptyAnnouncement = () => ({ enabled: false, eyebrow: "IMPORTANT ANNOUNCEMENT", title: "", message: "", actionLabel: "", actionUrl: "", style: "notice", displayMode: "persistent", toastDuration: 15, dailyFrequency: "once", soundEnabled: true, startsAt: "", endsAt: "" });
function toLocalDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
const categories = ["centre-activities", "workshops", "awareness", "training", "research", "facilities", "other"];
const statusLabels = { draft: "Draft", published: "Published", archived: "Archived" };
const careServiceDefinitions = [
  { slug: "psychology", title: "Psychology" },
  { slug: "special-education", title: "Special Education" },
  { slug: "occupational-therapy", title: "Occupational Therapy" },
  { slug: "diagnostics", title: "Diagnostics" },
  { slug: "audiology", title: "Audiology" },
  { slug: "speech-therapy", title: "Speech Therapy" },
  { slug: "physical-therapy", title: "Physical Therapy" },
  { slug: "rehabilitation", title: "Rehabilitation" },
  { slug: "vocational-training", title: "Vocational Training" }
];

async function api(path, token, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Content request failed");
  return data;
}

function toEditorText(document) {
  return (document?.content || []).map((node) => {
    if (node.type === "heading") return "#".repeat(node.attrs?.level || 2) + " " + (node.content || []).map((part) => part.text || "").join("");
    return (node.content || []).map((part) => part.text || "").join("");
  }).join("\n\n");
}
function fromEditorText(value) {
  return { type: "doc", content: String(value || "").split(/\n\s*\n/).map((paragraph) => {
    const heading = paragraph.match(/^(#{1,3})\s+(.+)$/);
    return heading
      ? { type: "heading", attrs: { level: heading[1].length }, content: [{ type: "text", text: heading[2] }] }
      : { type: "paragraph", content: paragraph ? [{ type: "text", text: paragraph }] : [] };
  }) };
}
function dateValue(value) { return value ? new Date(value).toISOString().slice(0, 10) : ""; }

export function ContentStudio({ token }) {
  const [tab, setTab] = useState("publications");
  const [items, setItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [status, setStatus] = useState("draft");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [pendingTransition, setPendingTransition] = useState(null);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function showToast(message, kind = "success") {
    setToast({ message, kind, id: Date.now() });
  }
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPublication());
  const [assetPicker, setAssetPicker] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [savingServiceSlug, setSavingServiceSlug] = useState("");
  const [announcementForm, setAnnouncementForm] = useState(emptyAnnouncement());
  const [loadingAnnouncement, setLoadingAnnouncement] = useState(false);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);

  const base = tab === "publications" ? "/publications" : "/galleries";
  const load = useCallback(async (nextPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(nextPage), limit: "12", status });
      if (query.trim()) params.set("q", query.trim());
      const result = await api(`${base}?${params}`, token);
      setItems(result.items || []); setTotal(result.total || 0); setPages(result.pages || 1); setPage(result.page || nextPage);
    } catch (err) { showToast(err.message || "The request could not be completed.", "error"); }
    finally { setLoading(false); }
  }, [base, token, query, status]);

  useEffect(() => { if (tab !== "care-services" && tab !== "announcements") load(1); }, [tab, status, query, load]);
  useEffect(() => {
    if (tab !== "announcements") return;
    let active = true;
    setLoadingAnnouncement(true);
    api("/announcement", token)
      .then((result) => {
        if (!active) return;
        const item = result.announcement || {};
        setAnnouncementForm({ ...emptyAnnouncement(), ...item, startsAt: toLocalDateTime(item.startsAt), endsAt: toLocalDateTime(item.endsAt) });
      })
      .catch((err) => showToast(err.message || "Announcement settings could not be loaded.", "error"))
      .finally(() => { if (active) setLoadingAnnouncement(false); });
    return () => { active = false; };
  }, [tab, token]);
  useEffect(() => {
    api("/media?status=ready&limit=100", token).then((result) => setAssets(result.items || [])).catch((err) => showToast(err.message || "The request could not be completed.", "error"));
  }, [token]);

  const visibleAssets = useMemo(() => assets.filter((asset) => {
    const q = assetSearch.toLowerCase();
    return !q || [asset.title, asset.caption, asset.category, ...(asset.tags || [])].join(" ").toLowerCase().includes(q);
  }), [assets, assetSearch]);

  function beginCreate() {
    setEditing("new");
    setForm(tab === "publications" ? emptyPublication() : emptyGallery());
    
  }
  async function beginEdit(item) {
    
    try {
      const full = await api(`${base}/${item._id}`, token);
      setEditing(item._id);
      if (tab === "publications") setForm({ ...emptyPublication(), ...full, bodyText: toEditorText(full.body), tags: (full.tags || []).join(", "), coverMedia: full.coverMedia?._id || full.coverMedia || "", mediaItems: (full.mediaItems || []).map((asset) => asset?._id || asset).filter(Boolean), eventDate: dateValue(full.eventDate) });
      else setForm({ ...emptyGallery(), ...full, coverMedia: full.coverMedia?._id || full.coverMedia || "", mediaItems: (full.mediaItems || []).map((asset) => asset?._id || asset).filter(Boolean), eventDate: dateValue(full.eventDate) });
    } catch (err) { showToast(err.message || "The request could not be completed.", "error"); }
  }
  function closeEditor() { setEditing(null); setAssetPicker(false); }

  async function save(event) {
    event.preventDefault(); setSaving(true); 
    try {
      const payload = tab === "publications"
        ? { title: form.title, type: form.type, summary: form.summary, body: fromEditorText(form.bodyText), category: form.category, tags: String(form.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean), coverMedia: form.coverMedia || null, mediaItems: form.mediaItems, eventDate: form.eventDate || null, venue: form.venue, identifiablePeople: form.identifiablePeople, consentStatus: form.consentStatus, consentScope: form.consentScope, consentNotes: form.consentNotes }
        : { title: form.title, description: form.description, category: form.category, coverMedia: form.coverMedia || null, mediaItems: form.mediaItems, eventDate: form.eventDate || null };
      const path = editing === "new" ? base : `${base}/${editing}`;
      await api(path, token, { method: editing === "new" ? "POST" : "PATCH", body: JSON.stringify(payload) });
      closeEditor(); showToast(`${tab === "publications" ? "Publication" : "Gallery"} saved as draft.`); await load(page);
    } catch (err) { showToast(err.message || "The request could not be completed.", "error"); }
    finally { setSaving(false); }
  }

  async function transition(item, nextStatus) {
    const action = nextStatus === "published" ? "publish" : nextStatus === "archived" ? "archive" : "return to draft";
    setPendingTransition({ item, nextStatus, action });
  }

  async function confirmTransition() {
    if (!pendingTransition || transitioning) return;
    const { item, nextStatus } = pendingTransition;
    setTransitioning(true);
    try {
      await api(`${base}/${item._id}/status`, token, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      setPendingTransition(null);
      showToast(`${item.title} is now ${nextStatus}.`);
      await load(page);
    } catch (err) {
      setPendingTransition(null);
      showToast(err.message || "The status could not be updated.", "error");
    } finally { setTransitioning(false); }
  }

  async function saveAnnouncement(event) {
    event.preventDefault();
    setSavingAnnouncement(true);
    try {
      // The GET endpoint also returns the database key ("hero") and
      // timestamps. Send only editable fields accepted by the update API.
      const payload = {
        enabled: announcementForm.enabled,
        eyebrow: announcementForm.eyebrow,
        title: announcementForm.title,
        message: announcementForm.message,
        actionLabel: announcementForm.actionLabel,
        actionUrl: announcementForm.actionUrl,
        style: announcementForm.style,
        displayMode: announcementForm.displayMode,
        toastDuration: Number(announcementForm.toastDuration),
        dailyFrequency: announcementForm.dailyFrequency,
        soundEnabled: announcementForm.soundEnabled,
        startsAt: announcementForm.startsAt ? new Date(announcementForm.startsAt).toISOString() : null,
        endsAt: announcementForm.endsAt ? new Date(announcementForm.endsAt).toISOString() : null
      };
      const result = await api("/announcement", token, { method: "PATCH", body: JSON.stringify(payload) });
      const item = result.announcement || payload;
      setAnnouncementForm({ ...emptyAnnouncement(), ...item, startsAt: toLocalDateTime(item.startsAt), endsAt: toLocalDateTime(item.endsAt) });
      showToast(announcementForm.enabled ? "Hero announcement saved and enabled." : "Hero announcement saved. It is currently disabled.");
    } catch (err) {
      showToast(err.message || "The announcement could not be saved.", "error");
    } finally {
      setSavingAnnouncement(false);
    }
  }

  const assignCareServiceImage = async (service, assetId) => {
    if (savingServiceSlug) return;
    const marker = "care:" + service.slug;
    const target = assetId ? assets.find((item) => item._id === assetId) : null;
    if (assetId && !target) return;
    setSavingServiceSlug(service.slug);
    try {
      const currentAssignments = assets.filter((item) => (item.tags || []).includes(marker));
      for (const existing of currentAssignments) {
        const tags = (existing.tags || []).filter((tag) => tag !== marker);
        await api("/media/" + existing._id, token, { method: "PATCH", body: JSON.stringify({ tags }) });
        setAssets((current) => current.map((item) => item._id === existing._id ? { ...item, tags } : item));
      }
      if (target) {
        const tags = [...new Set([...(target.tags || []).filter((tag) => tag !== marker), marker])];
        await api("/media/" + target._id, token, { method: "PATCH", body: JSON.stringify({ tags }) });
        setAssets((current) => current.map((item) => item._id === target._id ? { ...item, tags } : item));
      }
      showToast(target ? service.title + " image assigned to the public Hero." : service.title + " image removed from the public Hero.");
    } catch (err) {
      showToast(err.message || "The care image could not be updated.", "error");
    } finally {
      setSavingServiceSlug("");
    }
  };

  const serviceImageFor = (slug) => assets.filter((asset) => (asset.tags || []).includes("care:" + slug)).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))[0];
  const eligibleCareImages = assets.filter((asset) => asset.resourceType === "image" && asset.status !== "archived" &&
    (!asset.identifiablePeople || (asset.consentStatus === "verified" && ["website", "website-and-social", "all-public"].includes(asset.consentScope))));
  function toggleAsset(id) {
    const selected = form.mediaItems || [];
    setForm({ ...form, mediaItems: selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id] });
  }

  return (
    <section className="content-studio admin-content-workspace">
      <div className="content-studio-heading">
        <div><p className="eyebrow">WEBSITE CONTENT</p><h3>Content studio</h3><p>Create and manage approved stories, centre updates, events and photo galleries.</p></div>
        {tab !== "care-services" && <Button type="button" onClick={beginCreate} className="admin-workspace-primary"><Plus size={17} /> New {tab === "publications" ? "publication" : "gallery"}</Button>}
      </div>
      <div className="content-studio-tabs" role="tablist" aria-label="Content type">
        <button type="button" role="tab" aria-selected={tab === "publications"} className={tab === "publications" ? "active" : ""} onClick={() => { setTab("publications"); setEditing(null); setStatus("draft"); setPage(1); }}><Newspaper size={16}/> Publications</button>
        <button type="button" role="tab" aria-selected={tab === "galleries"} className={tab === "galleries" ? "active" : ""} onClick={() => { setTab("galleries"); setEditing(null); setStatus("draft"); setPage(1); }}><Images size={16}/> Galleries</button>
        <button type="button" role="tab" aria-selected={tab === "care-services"} className={tab === "care-services" ? "active" : ""} onClick={() => { setTab("care-services"); setEditing(null); }}><Images size={16}/> Care services</button>
        <button type="button" role="tab" aria-selected={tab === "announcements"} className={tab === "announcements" ? "active" : ""} onClick={() => { setTab("announcements"); setEditing(null); }}><Megaphone size={16}/> Announcements</button>
      </div>
      {toast && <div className={`content-toast ${toast.kind === "error" ? "is-error" : "is-success"}`} role={toast.kind === "error" ? "alert" : "status"} key={toast.id}>{toast.kind === "error" ? <AlertCircle size={19}/> : <CheckCircle2 size={19}/>}<span>{toast.message}</span><button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={16}/></button></div>}
      {tab === "announcements" ? (
        <div className="hero-announcement-manager">
          <div className="care-service-manager-intro">
            <h4>Hero announcement</h4>
            <p>Publish a timely notice, upcoming event or urgent update in the slim announcement strip above the Hero content. You can schedule it and preview its appearance before enabling it.</p>
          </div>
          {loadingAnnouncement ? <div className="content-empty"><LoaderCircle className="media-spin"/> Loading announcement settings…</div> : (
            <form className="hero-announcement-editor" onSubmit={saveAnnouncement}>
              <label className="content-check hero-announcement-toggle"><input type="checkbox" checked={announcementForm.enabled} onChange={(e) => setAnnouncementForm({ ...announcementForm, enabled: e.target.checked })}/> Show announcement on the public website</label>
              <div className="content-form-grid">
                <label>Small heading / eyebrow<input maxLength="48" value={announcementForm.eyebrow} onChange={(e) => setAnnouncementForm({ ...announcementForm, eyebrow: e.target.value })} placeholder="IMPORTANT ANNOUNCEMENT"/></label>
                <label>Display style<select value={announcementForm.style} onChange={(e) => setAnnouncementForm({ ...announcementForm, style: e.target.value })}><option value="notice">Standard notice</option><option value="event">Event / update</option><option value="urgent">Urgent alert</option></select></label>
              </div>
              <label>Announcement title<input maxLength="100" value={announcementForm.title} onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })} placeholder="e.g. New assessment slots available" required={announcementForm.enabled}/><small>Keep the title concise so it fits comfortably on desktop and mobile.</small></label>
              <label>Message<textarea rows="3" maxLength="280" value={announcementForm.message} onChange={(e) => setAnnouncementForm({ ...announcementForm, message: e.target.value })} placeholder="Add the key information visitors should know…" required={announcementForm.enabled}/><small>{announcementForm.message.length}/280 characters</small></label>
              <div className="content-form-grid">
                <label>Button label (optional)<input maxLength="40" value={announcementForm.actionLabel} onChange={(e) => setAnnouncementForm({ ...announcementForm, actionLabel: e.target.value })} placeholder="Learn more"/></label>
                <label>Button link (optional)<input maxLength="300" value={announcementForm.actionUrl} onChange={(e) => setAnnouncementForm({ ...announcementForm, actionUrl: e.target.value })} placeholder="#contact or https://…"/></label>
              </div>
              <div className="hero-announcement-display-settings">
                <h5>How should visitors see this announcement?</h5>
                <label className="hero-announcement-sound-toggle"><input type="checkbox" checked={announcementForm.soundEnabled} onChange={(e) => setAnnouncementForm({ ...announcementForm, soundEnabled: e.target.checked })}/> Play a short, subtle notification sound when the announcement appears <small>Some browsers only allow sound after the visitor has interacted with the page.</small></label>
              
                <div className="content-form-grid">
                  <label>Display behaviour<select value={announcementForm.displayMode} onChange={(e) => setAnnouncementForm({ ...announcementForm, displayMode: e.target.value })}><option value="persistent">Keep visible in the Hero</option><option value="toast">Show as a temporary toast</option></select><small>Persistent notices remain visible. Toasts appear briefly and dismiss automatically.</small></label>
                  {announcementForm.displayMode === "toast" && <label>Toast duration<select value={announcementForm.toastDuration} onChange={(e) => setAnnouncementForm({ ...announcementForm, toastDuration: Number(e.target.value) })}><option value={10}>10 seconds</option><option value={15}>15 seconds</option><option value={20}>20 seconds</option><option value={30}>30 seconds</option></select></label>}
                </div>
                {announcementForm.displayMode === "toast" && <label>Show frequency<select value={announcementForm.dailyFrequency} onChange={(e) => setAnnouncementForm({ ...announcementForm, dailyFrequency: e.target.value })}><option value="once">At most once per visitor per day</option><option value="twice">At most twice per visitor per day</option></select><small>Frequency is remembered in that visitor's browser. Reloads and repeat visits count towards the daily limit.</small></label>}
              </div>
              <div className="content-form-grid">
                <label>Start showing (optional)<input type="datetime-local" value={announcementForm.startsAt} onChange={(e) => setAnnouncementForm({ ...announcementForm, startsAt: e.target.value })}/></label>
                <label>Stop showing (optional)<input type="datetime-local" value={announcementForm.endsAt} onChange={(e) => setAnnouncementForm({ ...announcementForm, endsAt: e.target.value })}/></label>
              </div>
              <div className={`hero-announcement-preview hero-announcement-${announcementForm.style || "notice"}`}>
                <span className="hero-announcement-icon"><Megaphone size={18}/></span>
                <div className="hero-announcement-copy">
                  {announcementForm.eyebrow && <span className="hero-announcement-eyebrow">{announcementForm.eyebrow}</span>}
                  <strong>{announcementForm.title || "Your announcement title will appear here"}</strong>
                  <p>{announcementForm.message || "Your announcement message will appear here."}</p>
                </div>
                {announcementForm.actionLabel && <span className="hero-announcement-action">{announcementForm.actionLabel} <ChevronRight size={15}/></span>}
              </div>
              <div className="content-editor-actions">
                <button type="button" className="secondary-button" onClick={() => setAnnouncementForm(emptyAnnouncement())}>Clear form</button>
                <button type="submit" className="primary-button" disabled={savingAnnouncement}><Save size={16}/>{savingAnnouncement ? "Saving…" : "Save announcement"}</button>
              </div>
              <p className="hero-announcement-help">When disabled or outside its scheduled dates, the announcement is hidden from the public Hero. Saving does not publish it unless the enable switch is on.</p>
            </form>
          )}
        </div>
      ) : tab === "care-services" ? (
        <div className="care-service-manager">
          <div className="care-service-manager-intro">
            <h4>Hero care service photographs</h4>
            <p>Choose a photograph from the Media Library for each service. Images appear on the public Hero after assignment. Photos showing identifiable people are selectable only when website consent is verified.</p>
          </div>
          <div className="care-service-manager-grid">
            {careServiceDefinitions.map((service) => {
              const assigned = serviceImageFor(service.slug);
              return (
                <article className="care-service-manager-card" key={service.slug}>
                  <div className="care-service-manager-preview">
                    {assigned?.secureUrl ? <img src={assigned.secureUrl} alt={assigned.altText || service.title} /> : <span>Photo not assigned</span>}
                  </div>
                  <label>{service.title}
                    <select value={assigned?._id || ""} disabled={Boolean(savingServiceSlug)} onChange={(event) => assignCareServiceImage(service, event.target.value)}>
                      <option value="">No image assigned</option>
                      {eligibleCareImages.map((asset) => <option key={asset._id} value={asset._id}>{asset.title || asset.caption || asset.publicId}</option>)}
                    </select>
                  </label>
                  {savingServiceSlug === service.slug && <small>Saving image assignment…</small>}
                </article>
              );
            })}
          </div>
          <p className="care-service-manager-note">Upload new photographs and manage consent in the Media Library. Replacing a service image here does not alter the original media asset.</p>
        </div>
      ) : editing !== null ? (
        <form className="content-editor" onSubmit={save}>
          <div className="content-editor-top"><div><p className="eyebrow">{editing === "new" ? "NEW DRAFT" : "EDIT DRAFT"}</p><h4>{editing === "new" ? "Create " : "Update "}{tab === "publications" ? "publication" : "gallery"}</h4></div><button className="icon-button" type="button" onClick={closeEditor} aria-label="Close editor"><X size={18}/></button></div>
          <label>Title<input required minLength="3" maxLength="160" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}/></label>
          {tab === "publications" && <div className="content-form-grid"><label>Type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="news">News</option><option value="article">Article</option><option value="event">Event</option></select></label><label>Category<input maxLength="80" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}/></label></div>}
          {tab === "galleries" && <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((value) => <option key={value} value={value}>{value.replaceAll("-", " ")}</option>)}</select></label>}
          <label>{tab === "publications" ? "Short summary" : "Gallery description"}<textarea rows="3" maxLength={tab === "publications" ? 500 : 1200} value={tab === "publications" ? form.summary : form.description} onChange={(e) => setForm({ ...form, [tab === "publications" ? "summary" : "description"]: e.target.value })}/></label>
          {tab === "publications" && <><label>Article body<textarea rows="10" value={form.bodyText} onChange={(e) => setForm({ ...form, bodyText: e.target.value })} placeholder={"Write paragraphs separated by a blank line.\nUse ## Heading for a section heading."}/><small>Simple rich-text format: separate paragraphs with a blank line; use #, ## or ### at the start of a line for headings.</small></label><label>Tags (comma separated)<input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })}/></label><label>Venue<input maxLength="180" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })}/></label></>}
          <div className="content-form-grid"><label>Event date<input type="date" value={form.eventDate || ""} onChange={(e) => setForm({ ...form, eventDate: e.target.value })}/></label><label>Cover image<select value={form.coverMedia || ""} onChange={(e) => setForm({ ...form, coverMedia: e.target.value })}><option value="">No cover selected</option>{assets.filter((asset) => asset.resourceType === "image").map((asset) => <option key={asset._id} value={asset._id}>{asset.title || asset.publicId}</option>)}</select></label></div>
          <div className="content-selected-media"><div><strong>Related media</strong><span>{(form.mediaItems || []).length} selected</span></div><button type="button" className="secondary-button" onClick={() => setAssetPicker(!assetPicker)}>{assetPicker ? "Close picker" : "Choose media"}</button></div>
          {assetPicker && <div className="content-asset-picker"><input placeholder="Search media" value={assetSearch} onChange={(e) => setAssetSearch(e.target.value)}/><div className="content-asset-grid">{visibleAssets.map((asset) => <label key={asset._id} className={form.mediaItems.includes(asset._id) ? "selected" : ""}><input type="checkbox" checked={form.mediaItems.includes(asset._id)} onChange={() => toggleAsset(asset._id)}/>{asset.resourceType === "video" ? <video src={asset.secureUrl} controls preload="metadata" aria-label={asset.title || "Video preview"}/> : <img src={asset.secureUrl} alt={asset.altText || asset.title || "Media preview"}/>}<span>{asset.title || asset.publicId}</span><small>{asset.identifiablePeople ? `Consent: ${asset.consentStatus}` : asset.resourceType}</small></label>)}</div></div>}
          {tab === "publications" && <fieldset className="content-consent-fields"><legend>Publication consent review</legend><label className="content-check"><input type="checkbox" checked={Boolean(form.identifiablePeople)} onChange={(e) => setForm({ ...form, identifiablePeople: e.target.checked, consentStatus: e.target.checked ? (form.consentStatus === "not-required" ? "pending" : form.consentStatus) : "not-required" })}/> This publication identifies people</label><div className="content-form-grid"><label>Consent status<select value={form.consentStatus} onChange={(e) => setForm({ ...form, consentStatus: e.target.value })}><option value="not-required">Not required</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="withdrawn">Withdrawn</option></select></label><label>Permitted scope<select value={form.consentScope} onChange={(e) => setForm({ ...form, consentScope: e.target.value })}><option value="internal-only">Internal only</option><option value="website">Website</option><option value="website-and-social">Website and social</option><option value="all-public">All public use</option></select></label></div><label>Consent reference (no patient names or clinical details)<input maxLength="500" value={form.consentNotes} onChange={(e) => setForm({ ...form, consentNotes: e.target.value })}/></label></fieldset>}
          <div className="content-editor-actions"><button type="button" className="secondary-button" onClick={closeEditor}>Cancel</button><button type="submit" className="primary-button" disabled={saving}><Save size={16}/>{saving ? "Saving..." : "Save draft"}</button></div>
        </form>
      ) : (
        <>
          <div className="content-list-toolbar"><div className="content-status-filters">{["draft", "published", "archived"].map((value) => <button key={value} type="button" className={status === value ? "active" : ""} onClick={() => { setStatus(value); setPage(1); }}>{statusLabels[value]}</button>)}</div><input aria-label="Search content" placeholder="Search by title" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}/></div>
          <div className="content-list-summary"><span>{total} {tab}</span><span>{statusLabels[status]}</span></div>
          {loading ? <div className="content-empty"><LoaderCircle className="media-spin"/> Loading content...</div> : items.length ? <div className="content-list">{items.map((item) => <article className="content-list-item" key={item._id}><div className="content-list-thumb">{item.coverMedia?.secureUrl ? <img src={item.coverMedia.secureUrl} alt=""/> : <div><FilePlus2 size={22}/></div>}</div><div className="content-list-copy"><div className="content-list-meta"><span>{tab === "publications" ? item.type : item.category}</span><Badge variant={item.status === "published" ? "success" : item.status === "archived" ? "secondary" : "warning"} className={`content-status status-${item.status}`}>{statusLabels[item.status]}</Badge></div><h4>{item.title}</h4><p>{item.summary || item.description || "No summary added yet."}</p><small>Updated {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("en-IN") : "recently"}</small></div><div className="content-list-actions">{item.status === "draft" && <button type="button" className="icon-button" title="Edit draft" onClick={() => beginEdit(item)}><Edit3 size={17}/></button>}{item.status === "draft" && <button type="button" className="icon-button" title="Publish" onClick={() => transition(item, "published")}><Send size={17}/></button>}{item.status === "published" && <button type="button" className="icon-button" title="Return to draft" onClick={() => transition(item, "draft")}><Eye size={17}/></button>}{item.status !== "archived" && <button type="button" className="icon-button" title="Archive" onClick={() => transition(item, "archived")}><Archive size={17}/></button>}{item.status === "archived" && <button type="button" className="icon-button" title="Restore as draft" onClick={() => transition(item, "draft")}><RefreshCw size={17}/></button>}</div></article>)}</div> : <div className="content-empty"><FilePlus2 size={28}/><strong>No {status} {tab} yet</strong><span>Create your first {tab === "publications" ? "article, news update or event" : "photo gallery"}.</span></div>}
          {pages > 1 && <div className="content-pagination"><button type="button" className="secondary-button" disabled={page <= 1} onClick={() => load(page - 1)}><ChevronLeft size={16}/>Previous</button><span>Page {page} of {pages}</span><button type="button" className="secondary-button" disabled={page >= pages} onClick={() => load(page + 1)}>Next<ChevronRight size={16}/></button></div>}
        </>
      )}
      {pendingTransition && <div className="content-confirm-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !transitioning) setPendingTransition(null); }}><section className="content-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="content-confirm-title"><div className="content-confirm-icon"><AlertCircle size={22}/></div><div className="content-confirm-copy"><p className="eyebrow">CONFIRM ACTION</p><h4 id="content-confirm-title">{pendingTransition.action === "publish" ? "Publish this content?" : pendingTransition.action === "archive" ? "Archive this content?" : "Return to draft?"}</h4><p><strong>{pendingTransition.item.title}</strong> will be moved to {pendingTransition.nextStatus}. {pendingTransition.nextStatus === "published" ? "It will become visible on the public website if it meets the publication visibility requirements." : "You can change its status again later."}</p></div><div className="content-confirm-actions"><button type="button" className="secondary-button" disabled={transitioning} onClick={() => setPendingTransition(null)}>Cancel</button><button type="button" className="primary-button" disabled={transitioning} onClick={confirmTransition}>{transitioning ? <LoaderCircle className="media-spin" size={16}/> : <CheckCircle2 size={16}/>} {transitioning ? "Please wait..." : "Confirm"}</button></div></section></div>}
    </section>
  );
}
