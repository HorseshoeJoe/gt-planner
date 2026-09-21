/**
 * Phase 2 enhancement - schedule conflict detection.
 *
 * Stakeholder Meeting 2, Q3: "it would be nice if the time fields ... validate
 * that times don't overlap, to catch scheduling conflicts early."
 *
 * Pure functions, so they are unit-testable without a database and are shared
 * by the API (authoritative check) and the React form (instant feedback).
 */

/** "HH:MM" -> minutes since midnight. Returns null for malformed input. */
export function toMinutes(hhmm) {
  if (typeof hhmm !== 'string') return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Two activities overlap when one starts strictly before the other ends.
 * An activity with no end time is treated as a zero-length point in time,
 * so back-to-back items never produce a false positive.
 */
export function overlaps(a, b) {
  const aStart = toMinutes(a.startTime);
  const bStart = toMinutes(b.startTime);
  if (aStart === null || bStart === null) return false;

  const aEnd = toMinutes(a.endTime) ?? aStart;
  const bEnd = toMinutes(b.endTime) ?? bStart;

  if (aEnd === aStart && bEnd === bStart) return aStart === bStart;
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Returns the list of existing activities that clash with `candidate`.
 * `ignoreId` lets an activity be edited without conflicting with itself.
 */
export function findConflicts(candidate, existing = [], ignoreId = null) {
  return existing
    .filter((item) => (ignoreId ? String(item._id ?? item.id) !== String(ignoreId) : true))
    .filter((item) => overlaps(candidate, item));
}

/** Rejects an end time that is earlier than (or equal to) the start time. */
export function isValidRange(startTime, endTime) {
  const start = toMinutes(startTime);
  if (start === null) return false;
  if (!endTime) return true;
  const end = toMinutes(endTime);
  return end !== null && end > start;
}
