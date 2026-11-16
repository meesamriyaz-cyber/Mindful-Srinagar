import { CalendarCheck, LockKeyhole, Menu, Phone, X } from "lucide-react";
import React, { useEffect, useState } from "react";

const publicNavItems = [
  { label: "Services", href: "#services" },
  { label: "Media", href: "#stories" },
  { label: "Care Process", href: "#operations" },
  { label: "Referrals", href: "#referrals" },
  { label: "Contact", href: "#contact" }
];

export function Header({ staffMode = false }) {
  const [open, setOpen] = useState(false);
  const [heroVisible, setHeroVisible] = useState(!staffMode);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

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

    const updateHeroVisibility = () => {
      const heroRect = hero.getBoundingClientRect();
      const headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
      const visibleBelowHeader = heroRect.bottom > headerBottom + 2 && heroRect.top < window.innerHeight;
      setHeroVisible(visibleBelowHeader);
    };

    const observer = new IntersectionObserver(updateHeroVisibility, { threshold: 0 });
    observer.observe(hero);

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.classList.toggle("is-section-visible", entry.isIntersecting);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -5% 0px" }
    );
    ["home", "services", "stories", "operations", "referrals", "contact"].forEach((id) => {
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
  const closeMenu = () => setOpen(false);

  return (
    <header className={[
      "site-header",
      "premium-site-header",
      staffMode ? "premium-staff-header" : "premium-public-header",
      !staffMode && !heroVisible ? "is-compact" : ""
    ].filter(Boolean).join(" ")}>
      <a
        className={heroVisible && !staffMode ? "brand brand-home-logo" : "brand"}
        href="#home"
        aria-label="Mindful Centre home"
        onClick={closeMenu}
      >
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
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls="primary-navigation"
      >
        {open ? <X size={21} /> : <Menu size={21} />}
      </button>

      <nav
        className={open ? "nav nav-open" : "nav"}
        aria-label="Primary navigation"
        id="primary-navigation"
      >
        {navItems.map((item) => (
          <a key={item.label} href={item.href} onClick={() => {
            closeMenu();
            if (item.tab) window.dispatchEvent(new CustomEvent("mindful:public-content-tab", { detail: { tab: item.tab } }));
          }}>
            {item.label}
          </a>
        ))}
        {!staffMode && (
          <a className="nav-staff-link" href="#staff" onClick={closeMenu}>
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
              <Phone size={19} />
            </a>
            <a className="primary-button" href="#contact">
              <CalendarCheck size={17} />
              Book assessment
            </a>
          </>
        )}
      </div>
    </header>
  );
}
