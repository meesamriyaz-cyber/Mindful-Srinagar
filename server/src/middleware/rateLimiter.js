const buckets = new Map();
let requestsSinceCleanup = 0;
export function createRateLimiter({ windowMs, max, message }) {
  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.startedAt >= windowMs) {
      bucket = { startedAt: now, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    requestsSinceCleanup += 1;
    if (requestsSinceCleanup >= 500) {
      for (const [entryKey, entry] of buckets) {
        if (now - entry.startedAt >= windowMs) buckets.delete(entryKey);
      }
      requestsSinceCleanup = 0;
    }
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil((bucket.startedAt + windowMs) / 1000)));
    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.startedAt + windowMs - now) / 1000)));
      return res.status(429).json({ message });
    }
    return next();
  };
}
