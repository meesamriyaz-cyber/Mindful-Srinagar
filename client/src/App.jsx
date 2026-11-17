import React, { lazy, Suspense, useEffect, useState } from "react";
import { Contact } from "./components/Contact.jsx";
import { Header } from "./components/Header.jsx";
import { Hero } from "./components/Hero.jsx";
import { Operations } from "./components/Operations.jsx";
import { PublicContent } from "./components/PublicContent.jsx";
import { ReferralTracker } from "./components/ReferralTracker.jsx";
import { Services } from "./components/Services.jsx";

const Dashboard = lazy(() => import("./components/Dashboard.jsx").then((module) => ({ default: module.Dashboard })));

export default function App() {
  const [staffMode, setStaffMode] = useState(() => window.location.hash === "#staff");

  useEffect(() => {
    const handleHashChange = () => {
      const nextStaffMode = window.location.hash === "#staff";
      // Preserve a reset token on the initial email-link load, but never
      // carry it into a later navigation back to the staff console.
      if (nextStaffMode && new URLSearchParams(window.location.search).has("resetToken")) {
        window.history.replaceState({}, "", window.location.pathname + window.location.hash);
      }
      setStaffMode(nextStaffMode);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  if (staffMode) {
    return (
      <>
        <Header staffMode />
        <main>
          <Suspense fallback={<section className="dashboard-section"><p className="empty-state">Loading staff console...</p></section>}>
            <Dashboard />
          </Suspense>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main>
        <Hero />
        <Services />
        <PublicContent />
        <Operations />
        <ReferralTracker />
        <Contact />
      </main>
    </>
  );
}
