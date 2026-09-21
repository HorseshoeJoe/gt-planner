import crypto from 'crypto';
import { Trips } from '../db/index.js';

/** Human-friendly, unambiguous invite code (no 0/O/1/I). */
export function generateInviteCode(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/** Wraps async route handlers so rejected promises reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Phase 2 enhancement - "last updated" stamp requested in Stakeholder Meeting 2.
 * Every mutation records who changed what and when, so any member opening the
 * trip can see at a glance whether they are looking at the latest version.
 */
export function touchTrip(tripId, userId, label) {
  Trips.update(tripId, {
    lastActivityAt: new Date().toISOString(),
    lastActivityBy: String(userId),
    lastActivityLabel: label,
  });
}

/** Consistent 400 responses for simple field validation. */
export function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  return missing.length ? `Missing required field(s): ${missing.join(', ')}` : null;
}

/** List of "YYYY-MM-DD" strings covering a trip, used by the itinerary builder. */
export function dateRange(startDate, endDate) {
  const days = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return days;

  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  let guard = 0;
  while (cursor <= last && guard < 400) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return days;
}

/** Normalises a date input to "YYYY-MM-DD" for storage. */
export function toDateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}
