import { CalendarCheck, LayoutDashboard, Menu, Phone, X } from "lucide-react";
import React, { useState } from "react";

const navItems = ["Services", "Operations", "Referrals", "Dashboard", "Contact"];

export function Header() {
  const [open, setOpen] = useState(false);

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
          <a key={item} href={`#${item.toLowerCase()}`} onClick={() => setOpen(false)}>
            {item}
          </a>
        ))}
      </nav>

      <div className="header-actions">
        <a className="icon-button" href="tel:+919906897822" aria-label="Call centre">
          <Phone size={20} />
        </a>
        <a className="primary-button" href="#dashboard">
          <LayoutDashboard size={18} />
          Staff Console
        </a>
        <a className="secondary-button" href="#contact">
          <CalendarCheck size={18} />
          Book Visit
        </a>
      </div>
    </header>
  );
}
