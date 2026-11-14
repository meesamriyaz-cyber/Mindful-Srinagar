
import React, { useEffect, useState } from "react";
import Confetti from "react-confetti";
import { celebrationConfig } from "../config/celebration.js";

const STORAGE_KEY = "mindful-homepage-celebration-runs";

export function CelebrationConfetti() {
  const [visible, setVisible] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const resize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    if (!celebrationConfig.enabled) return;

    if (
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
    ) return;

    try {
      const runs = Number(
        localStorage.getItem(STORAGE_KEY) || 0
      );

      if (runs >= celebrationConfig.maxRuns) return;

      localStorage.setItem(
        STORAGE_KEY,
        String(runs + 1)
      );

      setVisible(true);

      const timer = setTimeout(() => {
        setVisible(false);
      }, celebrationConfig.durationMs);

      return () => clearTimeout(timer);
    } catch {
      return;
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999
      }}
      aria-hidden="true"
    >
      <Confetti
        width={dimensions.width}
        height={dimensions.height}
        numberOfPieces={celebrationConfig.numberOfPieces}
        gravity={celebrationConfig.gravity}
        recycle={celebrationConfig.recycle}
        colors={celebrationConfig.colors}
      />
    </div>
  );
}
