import React, { lazy, Suspense, useEffect, useState } from "react";
import { Contact } from "./components/Contact.jsx";
import { Header } from "./components/Header.jsx";
import { Hero } from "./components/Hero.jsx";
import { Operations } from "./components/Operations.jsx";
import { ReferralTracker } from "./components/ReferralTracker.jsx";
import { Services } from "./components/Services.jsx";

const Dashboard = lazy(() => import("./components/Dashboard.jsx").then((module) => ({ default: module.Dashboard })));

export default function App() {
  const [staffMode, setStaffMode] = useState(() => window.location.hash === "#staff");

  useEffect(() => {
    const handleHashChange = () => setStaffMode(window.location.hash === "#staff");
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
        <Operations />
        <ReferralTracker />
        <Contact />
      </main>
      <footer>
        <strong>Mindful Centre for Rehabilitation Research & Trainings</strong>
        <span>Integrated rehabilitation care in Srinagar for persons with disabilities.</span>
      </footer>
    </>
  );
}
