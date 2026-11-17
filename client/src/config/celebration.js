// Homepage welcome celebration settings.
export const celebrationConfig = {
  enabled: true,
  maxRuns: 1,
  durationMs: 5500,
  fadeOutMs: 1500,

  // Physics-based react-confetti settings.
  numberOfPieces: 1000,
  gravity: 0.18,
  recycle: false,
  tweenDuration: 1200,

  colors: [
    "#173F59",
    "#247F83",
    "#D8A744",
    "#8C78A8",
    "#FFFFFF"
  ]
};

export const CELEBRATION_STORAGE_KEY =
  "mindful-homepage-celebration-runs";