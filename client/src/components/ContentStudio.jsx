import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Check, ChevronLeft, ChevronRight, Edit3, Eye, FilePlus2, Images, LoaderCircle, Newspaper, Plus, RefreshCw, Save, Send, X } from "lucide-react";
import { API_BASE_URL } from "../lib/api.js";

const emptyDoc = () => ({ type: "doc", content: [{ type: "paragraph", content: [] }] });
const emptyPublication = () => ({ title: "", type: "news", summary: "", bodyText: "", category: "General", tags: "", coverMedia: "", mediaItems: [], eventDate: "", venue: "", identifiablePeople: false, consentStatus: "not-required", consentScope: "internal-only", consentNotes: "" });
const emptyGallery = () => ({ title: "", description: "", category: "centre-activities", coverMedia: "", mediaItems: [], eventDate: "" });
const categories = ["centre-activities", "workshops", "awareness", "training", "research", "facilities", "other"];
const statusLabels = { draft: "Draft", published: "Published", archived: "Archived" };

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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPublication());
  const [assetPicker, setAssetPicker] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");

  const base = tab === "publications" ? "/publications" : "/galleries";
  const load = useCallback(async (nextPage = page) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(nextPage), limit: "12", status });
      if (query.trim()) params.set("q", query.trim());
      const result = await api(`${base}?${params}`, token);
      setItems(result.items || []); setTotal(result.total || 0); setPages(result.pages || 1); setPage(result.page || nextPage);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [base, token, page, query, status]);

  useEffect(() => { load(1); }, [tab, status, query, load]);
  useEffect(() => {
    api("/media?status=ready&limit=100", token).then((result) => setAssets(result.items || [])).catch((err) => setError(err.message));
  }, [token]);

  const visibleAssets = useMemo(() => assets.filter((asset) => {
    const q = assetSearch.toLowerCase();
    return !q || [asset.title, asset.caption, asset.category, ...(asset.tags || [])].join(" ").toLowerCase().includes(q);
  }), [assets, assetSearch]);

  function beginCreate() {
    setEditing("new");
    setForm(tab === "publications" ? emptyPublication() : emptyGallery());
    setError(""); setNotice("");
  }
  async function beginEdit(item) {
    setError(""); setNotice("");
    try {
      const full = await api(`${base}/${item._id}`, token);
      setEditing(item._id);
      if (tab === "publications") setForm({ ...emptyPublication(), ...full, bodyText: toEditorText(full.body), tags: (full.tags || []).join(", "), coverMedia: full.coverMedia?._id || full.coverMedia || "", mediaItems: (full.mediaItems || []).map((asset) => asset?._id || asset).filter(Boolean), eventDate: dateValue(full.eventDate) });
      else setForm({ ...emptyGallery(), ...full, coverMedia: full.coverMedia?._id || full.coverMedia || "", mediaItems: (full.mediaItems || []).map((asset) => asset?._id || asset).filter(Boolean), eventDate: dateValue(full.eventDate) });
    } catch (err) { setError(err.message); }
  }
  function closeEditor() { setEditing(null); setAssetPicker(false); }

  async function save(event) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const payload = tab === "publications"
        ? { title: form.title, type: form.type, summary: form.summary, body: fromEditorText(form.bodyText), category: form.category, tags: String(form.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean), coverMedia: form.coverMedia || null, mediaItems: form.mediaItems, eventDate: form.eventDate || null, venue: form.venue, identifiablePeople: form.identifiablePeople, consentStatus: form.consentStatus, consentScope: form.consentScope, consentNotes: form.consentNotes }
        : { title: form.title, description: form.description, category: form.category, coverMedia: form.coverMedia || null, mediaItems: form.mediaItems, eventDate: form.eventDate || null };
      const path = editing === "new" ? base : `${base}/${editing}`;
      await api(path, token, { method: editing === "new" ? "POST" : "PATCH", body: JSON.stringify(payload) });
      closeEditor(); setNotice(`${tab === "publications" ? "Publication" : "Gallery"} saved as draft.`); await load(page);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  async function transition(item, nextStatus) {
    const action = nextStatus === "published" ? "publish" : nextStatus === "archived" ? "archive" : "return to draft";
    if (!window.confirm(`Are you sure you want to ${action} “${item.title}”?`)) return;
    setError(""); setNotice("");
    try { await api(`${base}/${item._id}/status`, token, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) }); setNotice(`${item.title} is now ${nextStatus}.`); await load(page); }
    catch (err) { setError(err.message); }
  }

  function toggleAsset(id) {
    const selected = form.mediaItems || [];
    setForm({ ...form, mediaItems: selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id] });
  }

  return (
    <section className="content-studio">
      <div className="content-studio-heading">
        <div><p className="eyebrow">WEBSITE CONTENT</p><h3>Content studio</h3><p>Create and manage approved stories, centre updates, events and photo galleries.</p></div>
        <button className="primary-button" type="button" onClick={beginCreate}><Plus size={17} /> New {tab === "publications" ? "publication" : "gallery"}</button>
      </div>
      <div className="content-studio-tabs" role="tablist" aria-label="Content type">
        <button type="button" role="tab" aria-selected={tab === "publications"} className={tab === "publications" ? "active" : ""} onClick={() => { setTab("publications"); setEditing(null); setStatus("draft"); setPage(1); }}><Newspaper size={16}/> Publications</button>
        <button type="button" role="tab" aria-selected={tab === "galleries"} className={tab === "galleries" ? "active" : ""} onClick={() => { setTab("galleries"); setEditing(null); setStatus("draft"); setPage(1); }}><Images size={16}/> Galleries</button>
      </div>
      {error && <p className="form-status error-status" role="alert">{error}</p>}
      {notice && <p className="form-status success-status" role="status">{notice}</p>}
      {editing !== null ? (
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
          {loading ? <div className="content-empty"><LoaderCircle className="media-spin"/> Loading content...</div> : items.length ? <div className="content-list">{items.map((item) => <article className="content-list-item" key={item._id}><div className="content-list-thumb">{item.coverMedia?.secureUrl ? <img src={item.coverMedia.secureUrl} alt=""/> : <div><FilePlus2 size={22}/></div>}</div><div className="content-list-copy"><div className="content-list-meta"><span>{tab === "publications" ? item.type : item.category}</span><span className={`content-status status-${item.status}`}>{statusLabels[item.status]}</span></div><h4>{item.title}</h4><p>{item.summary || item.description || "No summary added yet."}</p><small>Updated {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("en-IN") : "recently"}</small></div><div className="content-list-actions">{item.status === "draft" && <button type="button" className="icon-button" title="Edit draft" onClick={() => beginEdit(item)}><Edit3 size={17}/></button>}{item.status === "draft" && <button type="button" className="icon-button" title="Publish" onClick={() => transition(item, "published")}><Send size={17}/></button>}{item.status === "published" && <button type="button" className="icon-button" title="Return to draft" onClick={() => transition(item, "draft")}><Eye size={17}/></button>}{item.status !== "archived" && <button type="button" className="icon-button" title="Archive" onClick={() => transition(item, "archived")}><Archive size={17}/></button>}{item.status === "archived" && <button type="button" className="icon-button" title="Restore as draft" onClick={() => transition(item, "draft")}><RefreshCw size={17}/></button>}</div></article>)}</div> : <div className="content-empty"><FilePlus2 size={28}/><strong>No {status} {tab} yet</strong><span>Create your first {tab === "publications" ? "article, news update or event" : "photo gallery"}.</span></div>}
          {pages > 1 && <div className="content-pagination"><button type="button" className="secondary-button" disabled={page <= 1} onClick={() => load(page - 1)}><ChevronLeft size={16}/>Previous</button><span>Page {page} of {pages}</span><button type="button" className="secondary-button" disabled={page >= pages} onClick={() => load(page + 1)}>Next<ChevronRight size={16}/></button></div>}
        </>
      )}
    </section>
  );
}
