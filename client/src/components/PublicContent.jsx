import { ArrowLeft, ArrowRight, CalendarDays, Image as ImageIcon, LoaderCircle, MapPin, Newspaper, Play, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../lib/api.js";

const tabs = [
  { id: "news", label: "News", type: "news", icon: Newspaper },
  { id: "articles", label: "Articles", type: "article", icon: Newspaper },
  { id: "events", label: "Events", type: "event", icon: CalendarDays },
  { id: "gallery", label: "Gallery", type: "gallery", icon: ImageIcon }
];
const PAGE_SIZE = 9;

function formatDate(value, options = {}) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", ...options }).format(date);
}

function MediaPreview({ media, className = "" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [media?.secureUrl]);
  if (!media?.secureUrl || failed) return <div className={`public-content-placeholder ${className}`} role="img" aria-label="Media preview unavailable"><ImageIcon size={28} /><span>Preview unavailable</span></div>;
  if (media.resourceType === "video") {
    return <div className={`public-content-video ${className}`}><video src={media.secureUrl} muted playsInline preload="metadata" aria-label={media.title || "Gallery video"} onError={() => setFailed(true)} /><span><Play size={16} fill="currentColor" /> Video</span></div>;
  }
  return <img className={className} src={media.secureUrl} alt={media.altText || media.title || "Mindful Centre"} loading="lazy" onError={() => setFailed(true)} />;
}

function renderBody(node, key = "root") {
  if (!node) return null;
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map((child, index) => renderBody(child, `${key}-${index}`));
  if (node.type === "text") return node.text || "";
  const children = renderBody(node.content || [], key);
  if (node.type === "heading") {
    const level = Math.min(Math.max(Number(node.attrs?.level) || 2, 2), 4);
    return React.createElement(`h${level}`, { key }, children);
  }
  if (node.type === "paragraph") return <p key={key}>{children}</p>;
  if (node.type === "bulletList" || node.type === "orderedList") {
    const Tag = node.type === "orderedList" ? "ol" : "ul";
    return <Tag key={key}>{children}</Tag>;
  }
  if (node.type === "listItem") return <li key={key}>{children}</li>;
  if (node.type === "hardBreak") return <br key={key} />;
  if (node.type === "doc") return <div key={key} className="public-story-body">{children}</div>;
  return <React.Fragment key={key}>{children}</React.Fragment>;
}

function ContentCard({ item, onOpen, gallery = false }) {
  const media = item.coverMedia || item.mediaItems?.[0];
  return (
    <article className={gallery ? "public-gallery-card" : "public-story-card"}>
      <button type="button" className="public-content-card-media" onClick={() => onOpen(item)} aria-label={`Open ${item.title}`}>
        <MediaPreview media={media} />
        {gallery && <span className="public-gallery-count">{item.mediaItems?.length || 0} items</span>}
      </button>
      <div className="public-content-card-copy">
        <div className="public-content-meta">
          <span>{gallery ? item.category || "Gallery" : item.type}</span>
          <time>{formatDate(item.eventDate || item.publishedAt)}</time>
        </div>
        <h3><button type="button" onClick={() => onOpen(item)}>{item.title}</button></h3>
        <p>{gallery ? item.description : item.summary}</p>
        {!gallery && <button type="button" className="public-read-link" onClick={() => onOpen(item)}>Read more <ArrowRight size={15} /></button>}
        {gallery && <button type="button" className="public-read-link" onClick={() => onOpen(item)}>Explore gallery <ArrowRight size={15} /></button>}
      </div>
    </article>
  );
}

export function PublicContent() {
  const [activeTab, setActiveTab] = useState("news");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const listRequestId = useRef(0);
  const detailRequestId = useRef(0);

  const currentTab = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const loadPage = useCallback(async (nextPage, append = false) => {
    const requestId = ++listRequestId.current;
    if (append) setLoadingMore(true);
    else { setLoading(true); setError(""); }
    try {
      const path = activeTab === "gallery" ? "/public/galleries" : "/public/media";
      const params = activeTab === "gallery" ? { page: nextPage, limit: PAGE_SIZE } : { page: nextPage, limit: PAGE_SIZE, type: currentTab.type };
      const result = await apiRequest(path, { params });
      if (requestId !== listRequestId.current) return;
      const nextItems = Array.isArray(result.items) ? result.items : [];
      setItems((previous) => append ? [...previous, ...nextItems] : nextItems);
      setPage(Number(result.page) || nextPage);
      setPages(Math.max(Number(result.pages) || 1, 1));
    } catch (requestError) {
      if (requestId !== listRequestId.current) return;
      if (!append) setItems([]);
      setError(requestError.message || "Published content could not be loaded.");
    } finally {
      if (requestId === listRequestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [activeTab, currentTab.type]);

  useEffect(() => {
    setSelected(null);
    setDetailError("");
    setItems([]);
    setPage(1);
    setPages(1);
    loadPage(1);
  }, [loadPage]);

  useEffect(() => {
    const onTabRequest = (event) => {
      const requestedTab = event.detail?.tab;
      if (tabs.some((tab) => tab.id === requestedTab)) setActiveTab(requestedTab);
    };
    window.addEventListener("mindful:public-content-tab", onTabRequest);
    return () => window.removeEventListener("mindful:public-content-tab", onTabRequest);
  }, []);

  useEffect(() => {
    if (!selected) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") setSelected(null); };
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("public-content-modal-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("public-content-modal-open");
    };
  }, [selected]);

  async function openItem(item) {
    const requestId = ++detailRequestId.current;
    const galleryRequest = activeTab === "gallery";
    setSelected(item);
    setDetailError("");
    setDetailLoading(true);
    try {
      const path = galleryRequest ? `/public/galleries/${encodeURIComponent(item.slug)}` : `/public/media/${encodeURIComponent(item.slug)}`;
      const detail = await apiRequest(path);
      if (requestId === detailRequestId.current) setSelected(detail);
    } catch (requestError) {
      if (requestId === detailRequestId.current) setDetailError(requestError.message || "This content could not be opened.");
    } finally {
      if (requestId === detailRequestId.current) setDetailLoading(false);
    }
  }

  const isGallery = activeTab === "gallery";

  return (
    <section className="section public-content-section" id="stories">
      <div className="public-content-heading">
        <div className="section-heading">
          <p className="eyebrow">From Mindful</p>
          <h2>Stories, milestones and moments that matter.</h2>
          <p>Updates from our centre, useful perspectives and glimpses of the people and activities that shape our work.</p>
        </div>
        <div className="public-content-heading-note"><span>Care</span><span>Learning</span><span>Community</span></div>
      </div>

      <div className="public-content-tabs" role="tablist" aria-label="Explore Mindful updates">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}><Icon size={17} />{tab.label}</button>;
        })}
      </div>

      {loading ? (
        <div className="public-content-state" role="status"><LoaderCircle className="public-content-spinner" size={24} /><span>Loading {currentTab.label.toLowerCase()}…</span></div>
      ) : error ? (
        <div className="public-content-state public-content-error" role="alert"><strong>Unable to load {currentTab.label.toLowerCase()}</strong><span>{error}</span><button className="secondary-button" type="button" onClick={() => loadPage(1)}>Try again</button></div>
      ) : items.length ? (
        <>
          <div className={isGallery ? "public-gallery-grid" : "public-story-grid"}>
            {items.map((item) => <ContentCard key={item._id} item={item} gallery={isGallery} onOpen={openItem} />)}
          </div>
          {page < pages && <div className="public-content-load-more"><button className="secondary-button" type="button" disabled={loadingMore} onClick={() => loadPage(page + 1, true)}>{loadingMore ? <LoaderCircle className="public-content-spinner" size={17} /> : null}Load more</button></div>}
        </>
      ) : (
        <div className="public-content-state"><ImageIcon size={27} /><strong>No {currentTab.label.toLowerCase()} published yet</strong><span>New updates will appear here when they are ready to share.</span></div>
      )}

      {selected && (
        <div className="public-content-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { detailRequestId.current += 1; setSelected(null); } }}>
          <section className="public-content-dialog" role="dialog" aria-modal="true" aria-label={selected.title}>
            <button type="button" className="public-content-close" onClick={() => { detailRequestId.current += 1; setSelected(null); }} aria-label="Close"><X size={21} /></button>
            {detailLoading ? <div className="public-content-state"><LoaderCircle className="public-content-spinner" size={24} /><span>Opening…</span></div> : detailError ? <div className="public-content-state public-content-error">{detailError}</div> : (
              <>
                <div className="public-detail-hero"><MediaPreview media={selected.coverMedia || selected.mediaItems?.[0]} /></div>
                <div className="public-detail-copy">
                  <div className="public-content-meta"><span>{isGallery ? selected.category || "Gallery" : selected.type}</span><time>{formatDate(selected.eventDate || selected.publishedAt)}</time></div>
                  <h2>{selected.title}</h2>
                  {selected.summary && <p className="public-detail-summary">{selected.summary}</p>}
                  {selected.eventDate && <p className="public-detail-venue"><CalendarDays size={17} />{formatDate(selected.eventDate, { weekday: "long" })}{selected.venue ? <><span aria-hidden="true">·</span><MapPin size={16} />{selected.venue}</> : null}</p>}
                  {isGallery ? <p>{selected.description}</p> : renderBody(selected.body)}
                  {selected.mediaItems?.length > 0 && <div className="public-detail-media-grid">{selected.mediaItems.map((media) => <a key={media._id} href={media.secureUrl} target="_blank" rel="noreferrer" aria-label={media.title || "Open media in a new tab"}><MediaPreview media={media} /></a>)}</div>}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
