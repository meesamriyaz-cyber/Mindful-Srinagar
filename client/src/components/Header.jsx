import { CalendarCheck, LockKeyhole, Menu, Phone, X } from "lucide-react";
import React, { useEffect, useState } from "react";

const publicNavItems = [
  { label: "Services", href: "#services" },
  { label: "Care Process", href: "#operations" },
  { label: "Referrals", href: "#referrals" },
  { label: "Contact", href: "#contact" }
];

export function Header({ staffMode = false }) {
  const [open, setOpen] = useState(false);
  const [heroVisible, setHeroVisible] = useState(!staffMode);

  useEffect(() => {
    if (staffMode) {
      setHeroVisible(false);
      return undefined;
    }

    const hero = document.getElementById("home");
    if (!hero || typeof IntersectionObserver === "undefined") {
      setHeroVisible(false);
      return undefined;
    }

    document.documentElement.classList.add("homepage-motion-enabled");

    // Show the emblem only while some of the hero remains visible below
    // the site header. A narrow root-margin band can still intersect the
    // hero after Services has entered, so use the actual section geometry.
    const updateHeroVisibility = () => {
      const heroRect = hero.getBoundingClientRect();
      const headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
      const visibleBelowHeader = heroRect.bottom > headerBottom + 2 && heroRect.top < window.innerHeight;
      setHeroVisible(visibleBelowHeader);
    };

    const observer = new IntersectionObserver(updateHeroVisibility, { threshold: 0 });
    observer.observe(hero);

    // Reveal each homepage section gently as it enters the viewport.
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("is-section-visible", entry.isIntersecting);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -5% 0px" }
    );
    ["home", "services", "operations", "referrals", "contact"].forEach((id) => {
      const section = document.getElementById(id);
      if (section) sectionObserver.observe(section);
    });

    window.addEventListener("scroll", updateHeroVisibility, { passive: true });
    window.addEventListener("resize", updateHeroVisibility);
    updateHeroVisibility();
    return () => {
      observer.disconnect();
      sectionObserver.disconnect();
      window.removeEventListener("scroll", updateHeroVisibility);
      window.removeEventListener("resize", updateHeroVisibility);
    };
  }, [staffMode]);

  const navItems = staffMode ? [{ label: "Public website", href: "#home" }] : publicNavItems;

  return (
    <header className={staffMode ? "site-header" : `site-header site-header-home${heroVisible ? " is-hero-visible" : ""}`}>
      <a className={heroVisible && !staffMode ? "brand brand-home-logo" : "brand"} href="#home" aria-label="Mindful Centre home">
        {heroVisible && !staffMode ? (
          <img className="brand-logo-image" src="/mindful-logo.svg" alt="Mindful Centre emblem" />
        ) : (
          <>
            <span className="brand-mark">M</span>
            <span>
              <strong>Mindful</strong>
              <small>Centre for Rehabilitation Research &amp; Training Foundation</small>
              <span className="brand-location">For Persons with Disabilities, Srinagar</span>
            </span>
          </>
        )}
      </a>

      <button
        className="icon-button menu-button"
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
        aria-expanded={open}
        aria-controls="primary-navigation"
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      <nav className={open ? "nav nav-open" : "nav"} aria-label="Primary navigation" id="primary-navigation">
        {navItems.map((item) => (
          <a key={item.href} href={item.href} onClick={() => setOpen(false)}>
            {item.label}
          </a>
        ))}
        {!staffMode && (
          <a className="nav-staff-link" href="#staff" onClick={() => setOpen(false)}>
            <LockKeyhole size={15} />
            Staff console
          </a>
        )}
      </nav>

      <div className="header-actions">
        {staffMode ? (
          <a className="secondary-button" href="#home">Back to public site</a>
        ) : (
          <>
            <a className="icon-button" href="tel:+919906897822" aria-label="Call centre">
              <Phone size={20} />
            </a>
            <a className="primary-button" href="#contact">
              <CalendarCheck size={18} />
              Book assessment
            </a>
          </>
        )}
      </div>
    </header>
  );
}
