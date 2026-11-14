
import React, { useLayoutEffect, useRef, useState } from "react";
import Confetti from "react-confetti";
import { celebrationConfig, CELEBRATION_STORAGE_KEY } from "../config/celebration.js";

export function CelebrationConfetti() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  const runCounted = useRef(false);

  useLayoutEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useLayoutEffect(() => {
    if (!celebrationConfig.enabled || celebrationConfig.maxRuns <= 0) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    try {
      if (!runCounted.current) {
        const completedRuns = Number(
          window.localStorage.getItem(CELEBRATION_STORAGE_KEY) || 0
        );

        if (
          !Number.isFinite(completedRuns) ||
          completedRuns >= celebrationConfig.maxRuns
        ) return;

        window.localStorage.setItem(
          CELEBRATION_STORAGE_KEY,
          String(completedRuns + 1)
        );

        runCounted.current = true;
      }

      setFading(false);
      setVisible(true);

      const fadeTimer = window.setTimeout(
        () => setFading(true),
        Math.max(
          0,
          celebrationConfig.durationMs - celebrationConfig.fadeOutMs
        )
      );

      const removeTimer = window.setTimeout(
        () => setVisible(false),
        celebrationConfig.durationMs
      );

      return () => {
        window.clearTimeout(fadeTimer);
        window.clearTimeout(removeTimer);
      };
    } catch {
      return;
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`mindful-confetti${fading ? " is-fading" : ""}`}
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
