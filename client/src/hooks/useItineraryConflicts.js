// client/src/hooks/useItineraryConflicts.js
import { useMemo } from 'react';

// Mirrors server/src/utils/timeConflicts.js — keep the two in sync.
function toMinutes(hhmm) {
    if (typeof hhmm !== 'string') return null;
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
}

function overlaps(a, b) {
    const aStart = toMinutes(a.startTime);
    const bStart = toMinutes(b.startTime);
    if (aStart === null || bStart === null) return false;
    const aEnd = toMinutes(a.endTime) ?? aStart;
    const bEnd = toMinutes(b.endTime) ?? bStart;
    if (aEnd === aStart && bEnd === bStart) return aStart === bStart;
    return aStart < bEnd && bStart < aEnd;
}

export function useItineraryConflicts(draft, activities, ignoreId = null) {
    return useMemo(() => {
        if (!draft?.startTime) return [];
        return (activities || [])
            .filter((a) => (ignoreId ? a._id !== ignoreId : true))
            .filter((a) => overlaps(draft, a));
    }, [draft?.startTime, draft?.endTime, activities, ignoreId]);
}