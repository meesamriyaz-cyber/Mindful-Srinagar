import React, { useEffect, useMemo, useState } from "react";
import { celebrationConfig, CELEBRATION_STORAGE_KEY } from "../config/celebration.js";

export function CelebrationConfetti() {
  const [visible, setVisible] = useState(false);

  const pieces = useMemo(
    () =>
      Array.from({ length: celebrationConfig.particleCount }, (_, index) => ({
        left: `${(index * 37 + 11) % 100}%`,
        delay: `${(index % 11) * 0.075}s`,
        duration: `${2.35 + (index % 6) * 0.19}s`,
        drift: `${((index * 29) % 150) - 75}px`,
        rotation: `${(index * 47) % 360}deg`,
        shape: index % 3
      })),
    []
  );

  useEffect(() => {
    if (!celebrationConfig.enabled || celebrationConfig.maxRuns <= 0) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

    try {
      const completedRuns = Number(window.localStorage.getItem(CELEBRATION_STORAGE_KEY) || 0);
      if (!Number.isFinite(completedRuns) || completedRuns >= celebrationConfig.maxRuns) return undefined;
      window.localStorage.setItem(CELEBRATION_STORAGE_KEY, String(completedRuns + 1));
      setVisible(true);
      const timeout = window.setTimeout(() => setVisible(false), celebrationConfig.durationMs);
      return () => window.clearTimeout(timeout);
    } catch {
      // If storage is unavailable, skip the celebration rather than replaying
      // it on every render or disrupting the visitor's experience.
      return undefined;
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="mindful-confetti" aria-hidden="true">
      {pieces.map((piece, index) => (
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
