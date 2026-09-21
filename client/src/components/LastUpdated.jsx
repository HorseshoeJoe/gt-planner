import { useEffect, useState } from 'react';

/** "3 minutes ago" style formatting, refreshed on a timer. */
function relative(dateString) {
  if (!dateString) return 'never';
  const seconds = Math.round((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 90) return 'a minute ago';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(dateString).toLocaleDateString();
}

/**
 * Phase 2 enhancement - "last updated" indicator.
 * Stakeholder Meeting 2, Q5: "at least having a clear 'last updated' timestamp
 * would help everyone know they're looking at the latest version."
 */
export default function LastUpdated({ at, by, label, onRefresh, refreshing }) {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => forceRender((n) => n + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const who = by?.displayName || by?.username;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
      <span aria-live="polite">
        Last updated <strong className="font-semibold text-slate-800">{relative(at)}</strong>
        {who ? ` by ${who}` : ''}
        {label ? ` — ${label}` : ''}
      </span>
      {onRefresh && (
        // Phase 3 (Stakeholder Meeting 3): brought up to the 44px minimum
        // touch target — this was the one control still below it.
        <button
          type="button"
          onClick={onRefresh}
          className="min-h-touch rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          {refreshing ? 'Refreshing…' : 'Refresh now'}
        </button>
      )}
    </div>
  );
}
