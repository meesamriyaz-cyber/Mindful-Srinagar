import React, {
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  celebrationConfig,
  CELEBRATION_STORAGE_KEY
} from "../config/celebration.js";

export function CelebrationConfetti() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
<<<<<<< HEAD
  const [activeCount, setActiveCount] = useState(
    celebrationConfig.particleCount
  );

  // Prevent duplicate counter increments under React StrictMode.
=======
  // React StrictMode replays layout effects in development.
>>>>>>> 5c4c84f016caf43b46a84348ebc67d017b41d0ba
  const runCounted = useRef(false);

  const pieces = useMemo(
    () =>
<<<<<<< HEAD
      Array.from(
        { length: celebrationConfig.particleCount },
        (_, index) => ({
          left: `${(index * 37 + 11) % 100}%`,
          delay: `${(index % 7) * 0.035}s`,
          duration: `${3.7 + (index % 7) * 0.22}s`,
          drift: `${((index * 29) % 190) - 95}px`,
          rotation: `${(index * 47) % 540}deg`,
          shape: index % 3
        })
      ),
=======
      Array.from({ length: celebrationConfig.particleCount }, (_, index) => ({
        left: `${(index * 37 + 11) % 100}%`,
        delay: `${(index % 11) * 0.075}s`,
        duration: `${2.35 + (index % 6) * 0.19}s`,
        drift: `${((index * 29) % 150) - 75}px`,
        rotation: `${(index * 47) % 360}deg`,
        shape: index % 3
      })),
>>>>>>> 5c4c84f016caf43b46a84348ebc67d017b41d0ba
    []
  );

  useLayoutEffect(() => {
    if (
      !celebrationConfig.enabled ||
      celebrationConfig.maxRuns <= 0
    ) return undefined;

    if (
      window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      ).matches
    ) return undefined;

    try {
      if (!runCounted.current) {
        const completedRuns = Number(
          window.localStorage.getItem(
            CELEBRATION_STORAGE_KEY
          ) || 0
        );

        if (
          !Number.isFinite(completedRuns) ||
          completedRuns >= celebrationConfig.maxRuns
        ) return undefined;

        window.localStorage.setItem(
          CELEBRATION_STORAGE_KEY,
          String(completedRuns + 1)
        );

        runCounted.current = true;
      }

<<<<<<< HEAD
      const startedAt = Date.now();

      setActiveCount(celebrationConfig.particleCount);
      setFading(false);
      setVisible(true);

      // Gradually reduce the number of falling particles.
      const countTimer = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;

        const remaining = Math.max(
          0,
          1 - elapsed / celebrationConfig.durationMs
        );

        setActiveCount(
          Math.ceil(
            celebrationConfig.particleCount * remaining
          )
        );
      }, 100);

      // Begin the final fade before removing the component.
      const fadeTimer = window.setTimeout(
        () => setFading(true),
        Math.max(
          0,
          celebrationConfig.durationMs -
            celebrationConfig.fadeOutMs
        )
      );

=======
      setFading(false);
      setVisible(true);

      const fadeTimer = window.setTimeout(
        () => setFading(true),
        Math.max(0, celebrationConfig.durationMs - celebrationConfig.fadeOutMs)
      );
>>>>>>> 5c4c84f016caf43b46a84348ebc67d017b41d0ba
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

  return (
    <div
      className={`mindful-confetti${
        fading ? " is-fading" : ""
      }`}
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