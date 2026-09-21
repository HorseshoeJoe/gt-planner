import { useEffect, useRef } from 'react';

/**
 * Phase 2 enhancement - near-live collaboration.
 *
 * Stakeholder Meeting 2, Q5: members should see each other's changes "without
 * having to refresh the page". Full WebSocket sync was out of scope for the
 * prototype, so the workspace re-fetches on an interval and pauses while the
 * tab is hidden to avoid pointless background requests.
 */
export default function usePolling(callback, intervalMs = 20000, enabled = true) {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (!enabled) return undefined;

    const tick = () => {
      if (document.visibilityState === 'visible') saved.current();
    };

    const timer = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [intervalMs, enabled]);
}
