import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { Users, Trips, hydrateTrip, membershipOf } from '../db/index.js';

/** Verifies the Bearer token and attaches req.user. */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ message: 'Authentication required.' });

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = Users.findById(payload.sub);
    if (!user) return res.status(401).json({ message: 'Account no longer exists.' });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: 'Session expired. Please sign in again.' });
  }
}

/**
 * Loads the trip in :tripId and confirms the caller is a joined member.
 * Pending (invited but not yet accepted) members cannot read trip content.
 */
export function requireTripMember(req, res, next) {
  const trip = Trips.findById(req.params.tripId);
  if (!trip) return res.status(404).json({ message: 'Trip not found.' });

  const membership = membershipOf(trip, req.user._id);
  if (!membership || membership.status !== 'joined') {
    return res.status(403).json({ message: 'You are not a member of this trip.' });
  }

  req.trip = trip;                      // raw record, for writes
  req.tripView = hydrateTrip(trip);     // expanded record, for responses
  req.membership = membership;
  return next();
}

/** Trip creator only - used for removing members and deleting the trip. */
export function requireTripAdmin(req, res, next) {
  if (req.membership?.role !== 'admin') {
    return res.status(403).json({ message: 'Only the trip creator can perform this action.' });
  }
  return next();
}
