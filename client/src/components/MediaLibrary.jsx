import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, CheckCircle2, ImagePlus, LoaderCircle, RefreshCw, Search, Trash2, UploadCloud, Video, X } from "lucide-react";
import { API_BASE_URL } from "../lib/api.js";

const CATEGORIES = ["centre-activities", "workshops", "awareness", "training", "research", "facilities", "other"];
const CONSENT = ["not-required", "pending", "verified", "withdrawn"];
const formatBytes = (value) => {
  const bytes = Number(value) || 0;
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};
const emptyMeta = { title: "", caption: "", description: "", altText: "", category: "other", tags: "", identifiablePeople: false, consentStatus: "not-required", consentScope: "internal-only", consentNotes: "" };

async function request(path, token, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), Authorization: `Bearer ${token}`, ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Media request failed");
  return data;
}

export function MediaLibrary({ token }) {
  const inputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("ready");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, name: "" });
  const [selected, setSelected] = useState(null);
  const [meta, setMeta] = useState(emptyMeta);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async (nextPage = page) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ page: String(nextPage), limit: "24", status });
      if (query.trim()) params.set("q", query.trim());
      if (type) params.set("resourceType", type);
      if (category) params.set("category", category);
      const data = await request(`/media?${params.toString()}`, token);
      setItems(data.items || []); setTotal(data.total || 0); setPages(data.pages || 1); setPage(data.page || nextPage);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token, page, query, type, category, status]);

  useEffect(() => { load(1); }, [query, type, category, status, load]);
  useEffect(() => { if (selected) setMeta({ title: selected.title || "", caption: selected.caption || "", description: selected.description || "", altText: selected.altText || "", category: selected.category || "other", tags: (selected.tags || []).join(", "), identifiablePeople: Boolean(selected.identifiablePeople), consentStatus: selected.consentStatus || "not-required", consentScope: selected.consentScope || "internal-only", consentNotes: selected.consentNotes || "" }); }, [selected]);
  useEffect(() => { if (!notice) return undefined; const timeout = window.setTimeout(() => setNotice(""), 1000); return () => window.clearTimeout(timeout); }, [notice]);

  const uploadFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setError(""); setNotice("");
    try {
      const grouped = { image: files.filter((file) => file.type.startsWith("image/")), video: files.filter((file) => file.type.startsWith("video/")) };
      if (files.some((file) => !file.type.startsWith("image/") && !file.type.startsWith("video/"))) throw new Error("Only image and video files can be uploaded.");
      const signatures = {};
      for (const resourceType of ["image", "video"]) {
        if (!grouped[resourceType].length) continue;
        signatures[resourceType] = await request("/media/upload-signature", token, { method: "POST", body: JSON.stringify({ resourceType }) });
        const config = signatures[resourceType];
        if (grouped[resourceType].length > config.maxBatchCount) throw new Error(`Select no more than ${config.maxBatchCount} ${resourceType} files per batch.`);
        const oversized = grouped[resourceType].find((file) => file.size > config.maxBytes);
        if (oversized) throw new Error(`${oversized.name} exceeds the ${formatBytes(config.maxBytes)} ${resourceType} size limit.`);
        const allowed = config.allowedFormats.map((format) => format.toLowerCase());
        if (grouped[resourceType].some((file) => !allowed.includes(file.name.split(".").pop().toLowerCase()))) throw new Error(`Supported ${resourceType} formats: ${allowed.join(", ")}.`);
      }
      setUploading(true); setProgress({ current: 0, total: files.length, name: "" });
      let completed = 0;
      for (const resourceType of ["image", "video"]) {
        const config = signatures[resourceType];
        for (const file of grouped[resourceType]) {
          setProgress({ current: completed, total: files.length, name: file.name });
          const body = new FormData();
          body.append("file", file);
          body.append("api_key", config.apiKey);
          body.append("timestamp", String(config.timestamp));
          body.append("folder", config.folder);
          body.append("allowed_formats", config.allowedFormats.join(","));
          body.append("signature", config.signature);
          const cloudResponse = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/${resourceType}/upload`, { method: "POST", body });
          const cloudData = await cloudResponse.json().catch(() => ({}));
          if (!cloudResponse.ok) throw new Error(cloudData.error?.message || `Cloudinary upload failed for ${file.name}`);
          await request("/media", token, { method: "POST", body: JSON.stringify({ publicId: cloudData.public_id, resourceType }) });
          completed += 1;
          setProgress({ current: completed, total: files.length, name: file.name });
        }
      }
      setNotice(`${completed} media file(s) uploaded and registered successfully.`);
      await load(1);
    } catch (err) { setError(err.message); await load(1); }
    finally { setUploading(false); setProgress({ current: 0, total: 0, name: "" }); }
  };

  const openEditor = (asset) => { setSelected(asset); setMeta({ title: asset.title || "", caption: asset.caption || "", description: asset.description || "", altText: asset.altText || "", category: asset.category || "other", tags: (asset.tags || []).join(", "), identifiablePeople: Boolean(asset.identifiablePeople), consentStatus: asset.consentStatus || "not-required", consentScope: asset.consentScope || "internal-only", consentNotes: asset.consentNotes || "" }); };
  const saveMetadata = async (event) => {
    event.preventDefault(); if (!selected) return;
    setSaving(true); setError("");
    try {
      const payload = { ...meta, tags: meta.tags.split(",").map((tag) => tag.trim()).filter(Boolean) };
      delete payload._id; delete payload.publicId; delete payload.secureUrl; delete payload.resourceType; delete payload.format; delete payload.bytes; delete payload.assetId; delete payload.width; delete payload.height; delete payload.duration; delete payload.uploadedBy; delete payload.createdAt; delete payload.updatedAt; delete payload.status;
      await request(`/media/${selected._id}`, token, { method: "PATCH", body: JSON.stringify(payload) });
      setSelected(null); setNotice("Media details saved."); await load(page);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };
  const changeStatus = async (asset, nextStatus) => {
    setBusyId(asset._id); setError("");
    try {
      await request(`/media/${asset._id}`, token, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      setNotice(nextStatus === "archived" ? "Media archived." : "Media restored to the library.");
      await load(page);
    } catch (err) { setError(err.message); }
    finally { setBusyId(""); }
  };
  const deleteAsset = async (asset) => {
    setBusyId(asset._id); setError("");
    try { await request(`/media/${asset._id}`, token, { method: "DELETE" }); setNotice("Media permanently deleted."); await load(page); }
    catch (err) { setError(err.message); }
    finally { setBusyId(""); }
  };

  const imageCount = useMemo(() => items.filter((item) => item.resourceType === "image").length, [items]);
  return (
    <section className="media-library">
      <div className="media-library-toolbar">
        <div><p className="eyebrow">CENTRE CONTENT</p><h3>Media library</h3><p className="resource-description">Manage approved centre photographs and videos. Check consent before using identifiable people in public content.</p></div>
        <button className="primary-button" type="button" disabled={uploading} onClick={() => inputRef.current?.click()}><UploadCloud size={17} /> {uploading ? "Uploading..." : "Upload media"}</button>
        <input ref={inputRef} hidden type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple onChange={uploadFiles} />
      </div>
      <div className="media-library-stats"><span><strong>{total}</strong> {status === "archived" ? "archived assets" : "available assets"}</span><span><strong>{imageCount}</strong> images on this page</span><span><strong>{pages}</strong> pages</span></div>
      {uploading && <div className="media-upload-progress" role="status"><LoaderCircle size={18} className="media-spin" /><div><strong>Uploading {progress.current} of {progress.total}</strong><span>{progress.name || "Preparing upload"}</span><div className="media-progress-track"><i style={{ width: `${progress.total ? progress.current / progress.total * 100 : 0}%` }} /></div></div></div>}
      {error && <p className="form-status error-status" role="alert">{error}</p>}
      {notice && <div className="media-toast" role="status" aria-live="polite"><CheckCircle2 size={17} />{notice}</div>}
      <div className="media-library-filters">
        <label className="search-box"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, caption or tags" /></label>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Media type"><option value="">All media</option><option value="image">Images</option><option value="video">Videos</option></select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category"><option value="">All categories</option>{CATEGORIES.map((value) => <option key={value} value={value}>{value.replaceAll("-", " ")}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Library status"><option value="ready">Available</option><option value="archived">Archived</option></select>
        <button className="icon-button" type="button" onClick={() => load(1)} aria-label="Refresh media"><RefreshCw size={17}/></button>
      </div>
      {loading ? <p className="empty-state">Loading media library...</p> : items.length ? (
        <div className="media-asset-grid">{items.map((asset) => <article className="media-asset-card" key={asset._id}>
          <button className="media-asset-preview" type="button" onClick={() => openEditor(asset)} aria-label={`Edit ${asset.title || asset.format} media details`}>
            {asset.resourceType === "video" ? <><video src={asset.secureUrl} muted preload="metadata" /><span className="media-type-mark"><Video size={16}/></span></> : <img src={asset.secureUrl} alt={asset.altText || asset.title || "Centre media"} loading="lazy" />}
          </button>
          <div className="media-asset-info"><strong>{asset.title || asset.publicId.split("/").pop()}</strong><span>{asset.resourceType} · {asset.format} · {formatBytes(asset.bytes)}</span><span>{asset.category?.replaceAll("-", " ") || "other"} · {asset.consentStatus}</span></div>
          <div className="media-asset-actions"><button className="secondary-button compact-button" type="button" onClick={() => openEditor(asset)}>Edit details</button><button className="icon-button" type="button" disabled={busyId === asset._id} onClick={() => changeStatus(asset, status === "archived" ? "ready" : "archived")} aria-label={status === "archived" ? "Restore media" : "Archive media"}><Archive size={16}/></button><button className="icon-button danger-button" type="button" disabled={busyId === asset._id} onClick={() => deleteAsset(asset)} aria-label="Delete media"><Trash2 size={16}/></button></div>
        </article>)}</div>
      ) : <div className="media-empty"><ImagePlus size={28}/><strong>No media found</strong><span>Upload centre photographs or videos, or adjust the current filters.</span></div>}
      {pages > 1 && <div className="media-pagination"><button className="secondary-button compact-button" type="button" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="secondary-button compact-button" type="button" disabled={page >= pages || loading} onClick={() => load(page + 1)}>Next</button></div>}
      {selected && <div className="modal-overlay" onClick={() => setSelected(null)}><div className="modal media-editor-modal" role="dialog" aria-modal="true" aria-labelledby="media-editor-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header"><h3 id="media-editor-title">Media details</h3><button className="icon-button" type="button" onClick={() => setSelected(null)} aria-label="Close editor"><X size={18}/></button></div>
        <form className="clinical-form" onSubmit={saveMetadata}>
          <div className="media-editor-preview">{selected.resourceType === "video" ? <video src={selected.secureUrl} controls /> : <img src={selected.secureUrl} alt={selected.altText || ""}/>}</div>
          <label>Title<input maxLength={120} value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })}/></label>
          <label>Caption<input maxLength={500} value={meta.caption} onChange={(e) => setMeta({ ...meta, caption: e.target.value })}/></label>
          <label>Description<textarea rows={2} maxLength={1200} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })}/></label>
          <label>Alternative text<input maxLength={250} value={meta.altText} onChange={(e) => setMeta({ ...meta, altText: e.target.value })} placeholder="Describe the image for screen readers"/></label>
          <div className="form-row"><label>Category<select value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })}>{CATEGORIES.map((value) => <option key={value} value={value}>{value.replaceAll("-", " ")}</option>)}</select></label><label>Tags (comma separated)<input value={meta.tags} onChange={(e) => setMeta({ ...meta, tags: e.target.value })} placeholder="therapy, event, centre"/></label></div>
          <label className="media-checkbox"><input type="checkbox" checked={Boolean(meta.identifiablePeople)} onChange={(e) => setMeta({ ...meta, identifiablePeople: e.target.checked })}/> Identifiable people appear in this media</label>
          <div className="form-row"><label>Consent status<select value={meta.consentStatus} onChange={(e) => setMeta({ ...meta, consentStatus: e.target.value })}>{CONSENT.map((value) => <option key={value} value={value}>{value.replaceAll("-", " ")}</option>)}</select></label><label>Consent scope<select value={meta.consentScope} onChange={(e) => setMeta({ ...meta, consentScope: e.target.value })}><option value="internal-only">Internal only</option><option value="website">Website</option><option value="website-and-social">Website and social</option><option value="all-public">All public use</option></select></label></div>
          <label>Consent reference notes <small>Use a non-sensitive reference only. Do not enter patient names or clinical information.</small><textarea rows={2} maxLength={500} value={meta.consentNotes} onChange={(e) => setMeta({ ...meta, consentNotes: e.target.value })}/></label>
          <div className="modal-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : "Save details"}</button><button className="secondary-button" type="button" onClick={() => setSelected(null)}>Cancel</button></div>
        </form>
      </div></div>}
    </section>
  );
}
