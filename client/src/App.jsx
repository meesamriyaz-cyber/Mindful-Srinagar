import React from "react";
import { Contact } from "./components/Contact.jsx";
import { Dashboard } from "./components/Dashboard.jsx";
import { Header } from "./components/Header.jsx";
import { Hero } from "./components/Hero.jsx";
import { Operations } from "./components/Operations.jsx";
import { ReferralTracker } from "./components/ReferralTracker.jsx";
import { Services } from "./components/Services.jsx";

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Services />
        <Operations />
        <ReferralTracker />
        <Dashboard />
        <Contact />
      </main>
      <footer>
        <strong>Mindful Centre for Rehabilitation Research & Trainings</strong>
        <span>Integrated care, referral tracking and centre operations platform.</span>
      </footer>
    </>
  );
}
