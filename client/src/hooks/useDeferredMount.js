import { useEffect, useState } from "react";

export function useDeferredMount({ delay = 400 } = {}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId;
    let idleId;

    const activate = () => {
      if (!cancelled) setMounted(true);
    };

    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(activate, { timeout: Math.max(delay, 1200) });
    } else {
      timeoutId = window.setTimeout(activate, delay);
    }

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      if (idleId) window.cancelIdleCallback(idleId);
    };
  }, [delay]);

  return mounted;
}
