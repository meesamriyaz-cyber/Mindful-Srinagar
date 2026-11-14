
import React, { useLayoutEffect, useRef, useState } from "react";
import Confetti from "react-confetti";
import { createPortal } from "react-dom";
import {
  celebrationConfig,
  CELEBRATION_STORAGE_KEY
} from "../config/celebration.js";

export function CelebrationConfetti() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  const runCounted = useRef(false);

  // Keep the confetti canvas responsive.
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

  // Run the celebration only the configured number of times.
  useLayoutEffect(() => {
    if (!celebrationConfig.enabled || celebrationConfig.maxRuns <= 0) {
      return undefined;
    }

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    try {
      if (!runCounted.current) {
        const completedRuns = Number(
          window.localStorage.getItem(CELEBRATION_STORAGE_KEY) || 0
        );

        if (
          !Number.isFinite(completedRuns) ||
          completedRuns >= celebrationConfig.maxRuns
        ) {
          return undefined;
        }

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
      return undefined;
    }
  }, []);

  if (!visible) return null;

  // Render directly under body so the confetti appears above the navbar.
  return createPortal(
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
        tweenDuration={celebrationConfig.tweenDuration}
        colors={celebrationConfig.colors}
      />
    </div>,
    document.body
  );
}
