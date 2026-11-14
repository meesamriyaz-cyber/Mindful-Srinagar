import React, { useLayoutEffect, useMemo, useState } from "react";
import { celebrationConfig, CELEBRATION_STORAGE_KEY } from "../config/celebration.js";

export function CelebrationConfetti() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

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

  useLayoutEffect(() => {
    if (!celebrationConfig.enabled || celebrationConfig.maxRuns <= 0) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

    try {
      const completedRuns = Number(window.localStorage.getItem(CELEBRATION_STORAGE_KEY) || 0);
      if (!Number.isFinite(completedRuns) || completedRuns >= celebrationConfig.maxRuns) return undefined;

      window.localStorage.setItem(CELEBRATION_STORAGE_KEY, String(completedRuns + 1));
      setVisible(true);

      const fadeTimer = window.setTimeout(
        () => setFading(true),
        Math.max(0, celebrationConfig.durationMs - celebrationConfig.fadeOutMs)
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
