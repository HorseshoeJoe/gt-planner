import express from 'express';
import { config } from '../config.js';
import {
  Trips, Itineraries, Attractions, Restaurants, Transportation, BudgetItems, Invitations,
  hydrateTrip, membershipOf, joinedMemberIds, publicUser, findUserByIdentifier, Users, generateId,
} from '../db/index.js';
import { requireAuth, requireTripMember, requireTripAdmin } from '../middleware/auth.js';
import { asyncHandler, generateInviteCode, requireFields, dateRange, toDateOnly } from '../utils/helpers.js';
import { calculateTotals } from '../utils/budget.js';

const router = express.Router();
router.use(requireAuth);

/** GET /api/trips - every trip the signed-in user belongs to or is invited to. */
router.get('/', (req, res) => {
  const trips = Trips.find((t) => t.members?.some((m) => String(m.userId) === String(req.user._id)))
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)))
    .map((trip) => {
      const membership = membershipOf(trip, req.user._id);
      return {
        ...hydrateTrip(trip),
        myRole: membership?.role,
        myStatus: membership?.status,
        memberCounts: {
          joined: trip.members.filter((m) => m.status === 'joined').length,
          pending: trip.members.filter((m) => m.status === 'pending').length,
        },
      };
    });

  res.json(trips);
});

/** POST /api/trips - creator automatically becomes an admin member. */
router.post('/', (req, res) => {
  const missing = requireFields(req.body, ['title', 'destination', 'startDate', 'endDate']);
  if (missing) return res.status(400).json({ message: missing });

  const startDate = toDateOnly(req.body.startDate);
  const endDate = toDateOnly(req.body.endDate);
  if (!startDate || !endDate) return res.status(400).json({ message: 'Enter valid start and end dates.' });
  if (endDate < startDate) return res.status(400).json({ message: 'End date cannot be before the start date.' });

  const now = new Date().toISOString();
  const trip = Trips.insert({
    title: String(req.body.title).trim(),
    destination: String(req.body.destination).trim(),
    startDate,
    endDate,
    description: (req.body.description || '').trim(),
    createdBy: req.user._id,
    inviteCode: generateInviteCode(),
    members: [
      { _id: generateId(), userId: req.user._id, role: 'admin', status: 'joined', invitedAt: now, joinedAt: now },
    ],
    lastActivityAt: now,
    lastActivityBy: req.user._id,
    lastActivityLabel: 'Trip created',
  });

  return res.status(201).json(hydrateTrip(trip));
});

/** POST /api/trips/join - accept an invite using the shareable code. */
router.post('/join', (req, res) => {
  const code = String(req.body.inviteCode || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ message: 'Enter an invite code.' });

  const trip = Trips.findOne((t) => t.inviteCode === code);
  if (!trip) return res.status(404).json({ message: 'No trip matches that invite code.' });

  const existing = membershipOf(trip, req.user._id);
  if (existing && existing.status === 'joined') {
    return res.json({ message: 'You are already a member of this trip.', trip: hydrateTrip(trip) });
  }
  if (!existing && trip.members.length >= config.maxMembersPerTrip) {
    return res.status(409).json({ message: `This trip has reached the ${config.maxMembersPerTrip}-member limit.` });
  }

  const now = new Date().toISOString();
  const updated = Trips.update(trip._id, (draft) => {
    const member = draft.members.find((m) => String(m.userId) === String(req.user._id));
    if (member) {
      member.status = 'joined';
      member.joinedAt = now;
    } else {
      draft.members.push({ _id: generateId(), userId: req.user._id, role: 'member', status: 'joined', invitedAt: now, joinedAt: now });
    }
    draft.lastActivityAt = now;
    draft.lastActivityBy = req.user._id;
    draft.lastActivityLabel = `${req.user.username} joined the trip`;
  });

  const invitation = Invitations.findOne(
    (i) => i.tripId === trip._id && String(i.invitedUserId) === String(req.user._id) && i.status === 'pending'
  );
  if (invitation) Invitations.update(invitation._id, { status: 'accepted', respondedAt: now });

  return res.json({ message: `You joined "${trip.title}".`, trip: hydrateTrip(updated) });
});

/** GET /api/trips/:tripId */
router.get('/:tripId', requireTripMember, (req, res) => {
  res.json({
    ...req.tripView,
    myRole: req.membership.role,
    days: dateRange(req.trip.startDate, req.trip.endDate),
  });
});

/** PUT /api/trips/:tripId - any joined member may edit trip details. */
router.put('/:tripId', requireTripMember, (req, res) => {
  const startDate = req.body.startDate ? toDateOnly(req.body.startDate) : req.trip.startDate;
  const endDate = req.body.endDate ? toDateOnly(req.body.endDate) : req.trip.endDate;
  if (!startDate || !endDate) return res.status(400).json({ message: 'Enter valid start and end dates.' });
  if (endDate < startDate) return res.status(400).json({ message: 'End date cannot be before the start date.' });

  const updated = Trips.update(req.trip._id, (draft) => {
    ['title', 'destination', 'description'].forEach((field) => {
      if (req.body[field] !== undefined) draft[field] = String(req.body[field]).trim();
    });
    draft.startDate = startDate;
    draft.endDate = endDate;
    draft.lastActivityAt = new Date().toISOString();
    draft.lastActivityBy = req.user._id;
    draft.lastActivityLabel = 'Trip details updated';
  });

  return res.json(hydrateTrip(updated));
});

/** DELETE /api/trips/:tripId - admin only; removes all child records. */
router.delete('/:tripId', requireTripMember, requireTripAdmin, (req, res) => {
  const tripId = req.trip._id;
  [Itineraries, Attractions, Restaurants, Transportation, BudgetItems, Invitations].forEach((coll) =>
    coll.removeWhere((doc) => doc.tripId === tripId)
  );
  Trips.remove(tripId);
  res.json({ message: 'Trip deleted.' });
});

/* ------------------------------------------------------------------ */
/* Membership and invitations                                          */
/* ------------------------------------------------------------------ */

/**
 * GET /api/trips/:tripId/members
 * Phase 2 enhancement - member status indicator (Stakeholder Meeting 2, Q2):
 * returns each member with joined/pending status so the creator can see who
 * still needs to accept.
 */
router.get('/:tripId/members', requireTripMember, (req, res) => {
  const members = req.tripView.members.map((m) => ({
    membershipId: m._id,
    userId: m.user?._id,
    username: m.user?.username,
    displayName: m.user?.displayName,
    email: m.user?.email,
    role: m.role,
    status: m.status,
    invitedAt: m.invitedAt,
    joinedAt: m.joinedAt,
  }));

  res.json({
    inviteCode: req.trip.inviteCode,
    members,
    counts: {
      joined: members.filter((m) => m.status === 'joined').length,
      pending: members.filter((m) => m.status === 'pending').length,
      total: members.length,
    },
    invitations: Invitations.find((i) => i.tripId === req.trip._id),
  });
});

/** POST /api/trips/:tripId/invite - invite a registered user by username or email. */
router.post('/:tripId/invite', requireTripMember, (req, res) => {
  const identifier = String(req.body.identifier || '').trim();
  if (!identifier) return res.status(400).json({ message: 'Enter a username or email address.' });

  const invitee = findUserByIdentifier(identifier);
  if (!invitee) {
    return res.status(404).json({ message: 'No registered user found with that username or email.' });
  }
  if (membershipOf(req.trip, invitee._id)) {
    return res.status(409).json({ message: 'That user is already on this trip.' });
  }
  if (req.trip.members.length >= config.maxMembersPerTrip) {
    return res.status(409).json({ message: `This trip has reached the ${config.maxMembersPerTrip}-member limit.` });
  }

  const now = new Date().toISOString();
  const updated = Trips.update(req.trip._id, (draft) => {
    draft.members.push({ _id: generateId(), userId: invitee._id, role: 'member', status: 'pending', invitedAt: now, joinedAt: null });
    draft.lastActivityAt = now;
    draft.lastActivityBy = req.user._id;
    draft.lastActivityLabel = `Invited ${invitee.username}`;
  });

  Invitations.insert({
    tripId: req.trip._id,
    invitedUserId: invitee._id,
    invitedIdentifier: identifier,
    invitedById: req.user._id,
    inviteCode: req.trip.inviteCode,
    status: 'pending',
    respondedAt: null,
  });

  return res.status(201).json({
    message: `Invitation sent to ${invitee.username}.`,
    trip: hydrateTrip(updated),
  });
});

/** DELETE /api/trips/:tripId/members/:memberId - admin only. */
router.delete('/:tripId/members/:memberId', requireTripMember, requireTripAdmin, (req, res) => {
  const member = req.trip.members.find((m) => m._id === req.params.memberId);
  if (!member) return res.status(404).json({ message: 'Member not found on this trip.' });
  if (String(member.userId) === String(req.trip.createdBy)) {
    return res.status(400).json({ message: 'The trip creator cannot be removed.' });
  }

  Trips.update(req.trip._id, (draft) => {
    draft.members = draft.members.filter((m) => m._id !== req.params.memberId);
    draft.lastActivityAt = new Date().toISOString();
    draft.lastActivityBy = req.user._id;
    draft.lastActivityLabel = 'Member removed';
  });

  return res.json({ message: 'Member removed.' });
});

/** POST /api/trips/:tripId/leave - a non-admin member removes themselves. */
router.post('/:tripId/leave', requireTripMember, (req, res) => {
  if (req.membership.role === 'admin') {
    return res.status(400).json({ message: 'The trip creator cannot leave. Delete the trip instead.' });
  }
  Trips.update(req.trip._id, (draft) => {
    draft.members = draft.members.filter((m) => String(m.userId) !== String(req.user._id));
  });
  return res.json({ message: 'You have left the trip.' });
});

/* ------------------------------------------------------------------ */
/* Full itinerary view (UML: View Full Itinerary «include» Retrieve Trip Data) */
/* ------------------------------------------------------------------ */

/**
 * GET /api/trips/:tripId/full-itinerary
 * Aggregates every section into one chronological payload so the read-only
 * summary page needs a single request (proposal: page loads under 3 seconds).
 */
router.get('/:tripId/full-itinerary', requireTripMember, (req, res) => {
  const tripId = req.trip._id;

  const itineraries = Itineraries.find((i) => i.tripId === tripId);
  const attractions = Attractions.find((a) => a.tripId === tripId);
  const restaurants = Restaurants.find((r) => r.tripId === tripId);
  const transportation = Transportation.find((t) => t.tripId === tripId);
  const budgetItems = BudgetItems.find((b) => b.tripId === tripId).map((item) => ({
    ...item,
    paidBy: publicUser(Users.findById(item.paidBy)),
  }));

  const days = dateRange(req.trip.startDate, req.trip.endDate).map((date) => {
    const day = itineraries.find((i) => i.date === date);
    const activities = [...(day?.activities || [])].sort((a, b) => a.startTime.localeCompare(b.startTime));
    return {
      date,
      notes: day?.notes || '',
      activities,
      attractions: attractions.filter((a) => a.visitDate === date),
      transportation: transportation.filter(
        (t) => t.departureTime && String(t.departureTime).slice(0, 10) === date
      ),
    };
  });

  // Anything whose date falls outside the trip range still has to appear
  // somewhere, otherwise a flight booked the day before departure would vanish
  // from the summary entirely.
  const scheduledAttractionIds = new Set(days.flatMap((d) => d.attractions.map((a) => a._id)));
  const scheduledTransportIds = new Set(days.flatMap((d) => d.transportation.map((t) => t._id)));

  res.json({
    trip: {
      _id: req.trip._id,
      title: req.trip.title,
      destination: req.trip.destination,
      startDate: req.trip.startDate,
      endDate: req.trip.endDate,
      description: req.trip.description,
      lastActivityAt: req.trip.lastActivityAt,
      lastActivityLabel: req.trip.lastActivityLabel,
      members: req.tripView.members,
    },
    days,
    unscheduled: {
      attractions: attractions.filter((a) => !scheduledAttractionIds.has(a._id)),
      restaurants,
      transportation: transportation.filter((t) => !scheduledTransportIds.has(t._id)),
    },
    budget: calculateTotals(budgetItems, joinedMemberIds(req.trip)),
  });
});

export default router;
