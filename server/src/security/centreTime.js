const INDIA_OFFSET_MINUTES = 330;
const MINUTES_TO_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTES_TO_MS;

// Returns the current centre-local calendar day as UTC instants.
export function getCentreDayBounds(now = new Date()) {
  const centreDate = new Date(now.getTime() + INDIA_OFFSET_MINUTES * MINUTES_TO_MS);
  const year = centreDate.getUTCFullYear();
  const month = centreDate.getUTCMonth();
  const day = centreDate.getUTCDate();
  return {
    start: new Date(Date.UTC(year, month, day) - INDIA_OFFSET_MINUTES * MINUTES_TO_MS),
    end: new Date(Date.UTC(year, month, day + 1) - INDIA_OFFSET_MINUTES * MINUTES_TO_MS),
    monthStart: new Date(Date.UTC(year, month, 1) - INDIA_OFFSET_MINUTES * MINUTES_TO_MS)
  };
}
