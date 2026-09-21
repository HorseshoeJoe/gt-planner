import bcrypt from 'bcryptjs';
import { collection, loadData, generateId } from './store.js';

loadData();

export { generateId };

export const Users = collection('users');
export const Trips = collection('trips');
export const Itineraries = collection('itineraries');
export const Attractions = collection('attractions');
export const Restaurants = collection('restaurants');
export const Transportation = collection('transportation');
export const BudgetItems = collection('budgetItems');
export const Invitations = collection('invitations');

/* ------------------------------------------------------------------ */
/* User helpers                                                        */
/* ------------------------------------------------------------------ */

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(user, plain) {
  if (!user?.passwordHash) return false;
  return bcrypt.compare(plain, user.passwordHash);
}

/** Strips the password hash. Never send a raw user record to the client. */
export function publicUser(user) {
  if (!user) return null;
  return {
    _id: user._id,
    userId: user._id,
    username: user.username,
    email: user.email,
    displayName: user.displayName || user.username,
  };
}

export function findUserByIdentifier(identifier) {
  const value = String(identifier || '').trim().toLowerCase();
  if (!value) return null;
  return Users.findOne((u) => u.username.toLowerCase() === value || u.email.toLowerCase() === value);
}

/* ------------------------------------------------------------------ */
/* Trip helpers                                                        */
/* ------------------------------------------------------------------ */

export function membershipOf(trip, userId) {
  return trip?.members?.find((m) => String(m.userId) === String(userId)) || null;
}

export function joinedMemberIds(trip) {
  return (trip?.members || []).filter((m) => m.status === 'joined').map((m) => String(m.userId));
}

/**
 * Expands stored ids into the nested objects the frontend expects, mirroring
 * what `populate()` would do in Mongoose.
 */
export function hydrateTrip(trip) {
  if (!trip) return null;
  return {
    ...trip,
    members: (trip.members || []).map((m) => ({
      ...m,
      user: publicUser(Users.findById(m.userId)),
    })),
    lastActivityBy: trip.lastActivityBy ? publicUser(Users.findById(trip.lastActivityBy)) : null,
  };
}
