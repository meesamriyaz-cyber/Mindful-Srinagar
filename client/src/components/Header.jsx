import { CalendarCheck, LockKeyhole, Menu, Phone, X } from "lucide-react";
import React, { useState } from "react";

const publicNavItems = [
  { label: "Services", href: "#services" },
  { label: "Care Process", href: "#operations" },
  { label: "Referrals", href: "#referrals" },
  { label: "Contact", href: "#contact" }
];

export function Header({ staffMode = false }) {
  const [open, setOpen] = useState(false);
  const navItems = staffMode ? [{ label: "Public website", href: "#home" }] : publicNavItems;

  return (
    <header className="site-header">
      <a className="brand" href="#home" aria-label="Mindful Centre home">
        <span className="brand-mark">M</span>
        <span>
          <strong>Mindful</strong>
          <small>Rehabilitation Research & Trainings</small>
        </span>
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
