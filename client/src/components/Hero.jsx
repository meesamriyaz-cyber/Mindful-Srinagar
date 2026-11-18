import { ArrowRight, MapPin, Megaphone, ShieldCheck, X } from "lucide-react";
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { CelebrationConfetti } from "./CelebrationConfetti.jsx";
import { API_BASE_URL } from "../lib/api.js";

const ThreeOperationsScene = lazy(() => import("./ThreeOperationsScene.jsx").then((module) => ({ default: module.ThreeOperationsScene })));

const careServices = [
  { slug: "psychology", title: "Psychology", description: "Mental health support" },
  { slug: "special-education", title: "Special Education", description: "Individual learning support" },
  { slug: "occupational-therapy", title: "Occupational Therapy", description: "Everyday skills and function" },
  { slug: "diagnostics", title: "Diagnostics", description: "Comprehensive assessments" },
  { slug: "audiology", title: "Audiology", description: "Hearing assessment and support" },
  { slug: "speech-therapy", title: "Speech Therapy", description: "Communication and language" },
  { slug: "physical-therapy", title: "Physical Therapy", description: "Movement and mobility" },
  { slug: "rehabilitation", title: "Rehabilitation", description: "Coordinated rehabilitation" },
  { slug: "vocational-training", title: "Vocational Training", description: "Skills for independence" }
];

function canShowAnnouncementToast(announcement) {
  try {
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const version = announcement.version || `${announcement.title}-${announcement.message}`;
    const storageKey = `mindful-announcement-${version}`;
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    const count = saved.date === dateKey ? Number(saved.count || 0) : 0;
    const limit = announcement.dailyFrequency === "twice" ? 2 : 1;
    if (count >= limit) return false;
    window.localStorage.setItem(storageKey, JSON.stringify({ date: dateKey, count: count + 1 }));
    return true;
  } catch {
    // If browser storage is unavailable, show the announcement rather than
    // silently suppressing an important centre update.
    return true;
  }
}

async function playAnnouncementChime() {
  let context;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    context = new AudioContextClass();
    if (context.state === "suspended") await context.resume();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
    gain.connect(context.destination);
    [660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, context.currentTime + index * 0.11);
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.11);
      oscillator.stop(context.currentTime + index * 0.11 + 0.22);
    });
    window.setTimeout(() => context?.close().catch(() => {}), 650);
  } catch {
    // Sound is an enhancement only; announcement display must never depend on it.
    if (context && context.state !== "closed") context.close().catch(() => {});
  }
}

export function Hero() {
  const [serviceImages, setServiceImages] = useState({});
  const [announcement, setAnnouncement] = useState(null);
  const [announcementVisible, setAnnouncementVisible] = useState(false);
  const soundedAnnouncementRef = useRef("");
  const userInteractedRef = useRef(false);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/public/announcement`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Announcement unavailable")))
      .then((data) => {
        if (!active) return;
        const item = data.announcement || null;
        setAnnouncement(item);
        setAnnouncementVisible(Boolean(item) && (item.displayMode !== "toast" || canShowAnnouncementToast(item)));
      })
      .catch(() => { if (active) setAnnouncement(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const tryPlayAnnouncementSound = () => {
      userInteractedRef.current = true;
      if (!announcement || !announcementVisible || announcement.soundEnabled === false) return;
      const version = String(announcement.version || announcement.title || "announcement");
      if (soundedAnnouncementRef.current === version) return;
      // Mark it only when attempting playback from a real user gesture, so a
      // browser autoplay rejection cannot permanently silence this announcement.
      soundedAnnouncementRef.current = version;
      void playAnnouncementChime();
    };

    // Browsers commonly block audio on page load. Wait for the visitor's first
    // tap/click/key press, then play while the browser has user activation.
    window.addEventListener("pointerdown", tryPlayAnnouncementSound);
    window.addEventListener("keydown", tryPlayAnnouncementSound);
    if (userInteractedRef.current) tryPlayAnnouncementSound();

    return () => {
      window.removeEventListener("pointerdown", tryPlayAnnouncementSound);
      window.removeEventListener("keydown", tryPlayAnnouncementSound);
    };
  }, [announcement, announcementVisible]);

  useEffect(() => {
    if (!announcement || announcement.displayMode !== "toast" || !announcementVisible) return undefined;
    const timer = window.setTimeout(() => setAnnouncementVisible(false), Math.max(10, Number(announcement.toastDuration) || 15) * 1000);
    return () => window.clearTimeout(timer);
  }, [announcement, announcementVisible]);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/public/media/care-services`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Care images unavailable")))
      .then((data) => { if (active) setServiceImages(data.services || {}); })
      .catch(() => { if (active) setServiceImages({}); });
    return () => { active = false; };
  }, []);

  return (
    <section className="hero" id="home">
      <CelebrationConfetti />
      {announcement && announcementVisible && (
        <aside className={`hero-announcement hero-announcement-${announcement.style || "notice"} ${announcement.displayMode === "toast" ? "hero-announcement-toast" : ""}`} aria-label="Important announcement" role="status">
          <span className="hero-announcement-icon"><Megaphone size={18} /></span>
          <div className="hero-announcement-copy">
            {announcement.eyebrow && <span className="hero-announcement-eyebrow">{announcement.eyebrow}</span>}
            {announcement.title && <strong>{announcement.title}</strong>}
            {announcement.message && <p>{announcement.message}</p>}
          </div>
          {announcement.actionLabel && announcement.actionUrl && (
            <a className="hero-announcement-action" href={announcement.actionUrl}
              target={/^https?:\/\//i.test(announcement.actionUrl) ? "_blank" : undefined}
              rel={/^https?:\/\//i.test(announcement.actionUrl) ? "noreferrer" : undefined}>
              {announcement.actionLabel}<ArrowRight size={15} />
            </a>
          )}
          {announcement.displayMode === "toast" && <button type="button" className="hero-announcement-dismiss" onClick={() => setAnnouncementVisible(false)} aria-label="Dismiss announcement"><X size={17}/></button>}
        </aside>
      )}
      <div className="hero-copy">
        <div className="hero-identity" aria-label="Mindful Centre for Rehabilitation Research and Training Foundation for Persons with Disabilities">
          <p className="hero-identity-name">Mindful</p>
          <p className="hero-identity-description">
            <span className="hero-identity-line">Centre for Rehabilitation Research &amp; Training Foundation</span>
            <span className="hero-identity-line">For <strong>Persons with Disabilities</strong>, <span className="hero-identity-location">Srinagar</span></span>
          </p>
        </div>
        <p className="hero-lede">
          One coordinated team for assessment, therapy, learning support and life skills for children, adolescents and
          adults with disabilities.
        </p>
        <div className="hero-actions">
          <a className="primary-button large" href="#contact">
            Book an assessment
            <ArrowRight size={19} />
          </a>
          <a className="secondary-button large" href="#operations">
            See our care process
          </a>
        </div>
        <div className="trust-row">
          <span>
            <ShieldCheck size={18} />
            Licensed rehab and clinical professionals
          </span>
          <span>
            <MapPin size={18} />
            Owaisabad Gousia Colony Bemina, Srinagar
          </span>
        </div>
        <div className="hero-location-map">
          <a
            className="hero-location-map-preview"
            href="https://www.google.com/maps/search/?api=1&query=Mindful%20Centre%2C%20Owaisabad%20Gousia%20Colony%2C%20Bemina%2C%20Srinagar%2C%20Jammu%20and%20Kashmir%20190018"
            target="_blank"
            rel="noreferrer"
            aria-label="Open Mindful Centre location in Google Maps in a new tab"
          >
            <iframe
              title="Map preview of Mindful Centre in Bemina, Srinagar"
              src="https://maps.google.com/maps?q=Mindful%20Centre%2C%20Owaisabad%20Gousia%20Colony%2C%20Bemina%2C%20Srinagar%2C%20Jammu%20and%20Kashmir%20190018&t=&z=14&ie=UTF8&iwloc=&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              tabIndex="-1"
            />
          </a>
          <a
            className="hero-location-map-link"
            href="https://www.google.com/maps/search/?api=1&query=Mindful%20Centre%2C%20Owaisabad%20Gousia%20Colony%2C%20Bemina%2C%20Srinagar%2C%20Jammu%20and%20Kashmir%20190018"
            target="_blank"
            rel="noreferrer"
          >
            View larger map <ArrowRight size={13} />
          </a>
        </div>
      </div>
      <div className="hero-visual hero-care-visual" aria-label="Mindful multidisciplinary care network">
        <div className="hero-network-stage">
        <Suspense fallback={<div className="three-scene three-scene-loading" aria-label="Loading care network" />}>
          <ThreeOperationsScene services={careServices.map((service) => ({
            ...service,
            image: serviceImages[service.slug]?.secureUrl || ""
          }))} />
        </Suspense>
        </div>
        <div className="hero-metrics">
          <span><strong>9</strong> care services</span>
          <span><strong>1</strong> coordinated plan</span>
          <span><strong>Srinagar</strong> multidisciplinary team</span>
        </div>
      </div>
    </section>
  );
}
