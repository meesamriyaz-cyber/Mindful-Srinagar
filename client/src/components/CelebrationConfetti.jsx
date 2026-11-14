import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { celebrationConfig, CELEBRATION_STORAGE_KEY } from "../config/celebration.js";

export function CelebrationConfetti() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [activeCount, setActiveCount] = useState(celebrationConfig.particleCount);
  // React StrictMode replays layout effects in development.
  const runCounted = useRef(false);

  const pieces = useMemo(
    () =>
      Array.from({ length: celebrationConfig.particleCount }, (_, index) => ({
        left: `${(index * 37 + 11) % 100}%`,
        delay: `${(index % 7) * 0.035}s`,
        duration: `${3.7 + (index % 7) * 0.22}s`,
        drift: `${((index * 29) % 190) - 95}px`,
        rotation: `${(index * 47) % 540}deg`,
        shape: index % 3
      })),
    []
  );

  useLayoutEffect(() => {
    if (!celebrationConfig.enabled || celebrationConfig.maxRuns <= 0) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

    try {
      if (!runCounted.current) {
        const completedRuns = Number(window.localStorage.getItem(CELEBRATION_STORAGE_KEY) || 0);
        if (!Number.isFinite(completedRuns) || completedRuns >= celebrationConfig.maxRuns) {
          return undefined;
        }

        window.localStorage.setItem(CELEBRATION_STORAGE_KEY, String(completedRuns + 1));
        runCounted.current = true;
      }

      const startedAt = Date.now();
      const fadeStartsAt = Math.max(0, celebrationConfig.durationMs - celebrationConfig.fadeOutMs);

      setActiveCount(celebrationConfig.particleCount);
      setFading(false);
      setVisible(true);

      // Begin with a full burst, then steadily reduce the number of visible
      // pieces so the shower tapers off instead of stopping all at once.
      const countTimer = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, 1 - elapsed / celebrationConfig.durationMs);
        setActiveCount(Math.ceil(celebrationConfig.particleCount * remaining));
      }, 100);

      const fadeTimer = window.setTimeout(() => setFading(true), fadeStartsAt);
      const removeTimer = window.setTimeout(() => setVisible(false), celebrationConfig.durationMs);

      return () => {
        window.clearInterval(countTimer);
        window.clearTimeout(fadeTimer);
        window.clearTimeout(removeTimer);
      };
    } catch {
      return undefined;
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`mindful-confetti${fading ? " is-fading" : ""}`}
      aria-hidden="true"
    >
      {pieces.slice(0, activeCount).map((piece, index) => (
        <span
          className={`mindful-confetti-piece shape-${piece.shape}`}
          key={index}
          style={{
            left: piece.left,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            "--confetti-drift": piece.drift,
            "--confetti-rotation": piece.rotation
          }}
        />
      ))}
    </div>
  );
}
