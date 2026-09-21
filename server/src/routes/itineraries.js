import express from 'express';
import { Itineraries, generateId } from '../db/index.js';
import { requireAuth, requireTripMember } from '../middleware/auth.js';
import { asyncHandler, requireFields, touchTrip, dateRange } from '../utils/helpers.js';
import { findConflicts, isValidRange } from '../utils/timeConflicts.js';

const router = express.Router({ mergeParams: true });
router.use(requireAuth, requireTripMember);

/** Finds the stored day, creating it the first time something is added to it. */
function dayFor(tripId, date, create = false) {
  const existing = Itineraries.findOne((i) => i.tripId === tripId && i.date === date);
  if (existing || !create) return existing;
  return Itineraries.insert({ tripId, date, notes: '', activities: [] });
}

const sortByTime = (a, b) => a.startTime.localeCompare(b.startTime);

/** GET /api/trips/:tripId/itinerary - one entry per day of the trip. */
router.get('/', (req, res) => {
  const stored = Itineraries.find((i) => i.tripId === req.trip._id);

  // Return a placeholder for days that have no entries yet so the UI can
  // render the whole trip length without extra client-side date maths.
  const days = dateRange(req.trip.startDate, req.trip.endDate).map((date) => {
    const found = stored.find((d) => d.date === date);
    if (found) return { ...found, activities: [...found.activities].sort(sortByTime) };
    return { _id: null, tripId: req.trip._id, date, notes: '', activities: [] };
  });

  res.json(days);
});

/** PUT /api/trips/:tripId/itinerary/:date/notes - free-text note for a day. */
router.put('/:date/notes', (req, res) => {
  const day = dayFor(req.trip._id, req.params.date, true);
  const updated = Itineraries.update(day._id, { notes: String(req.body.notes || '') });
  touchTrip(req.trip._id, req.user._id, `Notes updated for ${req.params.date}`);
  res.json(updated);
});

/**
 * POST /api/trips/:tripId/itinerary/:date/activities
 *
 * Phase 2 enhancement - time-conflict detection (Stakeholder Meeting 2, Q3).
 * Conflicts are reported as a 409 with the clashing items so the UI can show
 * exactly what overlaps. Sending `force: true` saves anyway, because a group
 * may legitimately split up and do two things at once.
 */
router.post('/:date/activities', (req, res) => {
  const missing = requireFields(req.body, ['title', 'startTime']);
  if (missing) return res.status(400).json({ message: missing });

  const { title, startTime, endTime, category, notes, force } = req.body;
  if (!isValidRange(startTime, endTime)) {
    return res.status(400).json({ message: 'End time must be later than the start time.' });
  }

  const day = dayFor(req.trip._id, req.params.date, true);
  const conflicts = findConflicts({ startTime, endTime }, day.activities);
  if (conflicts.length && !force) {
    return res.status(409).json({
      message: 'This activity overlaps with something already scheduled that day.',
      conflicts: conflicts.map((c) => ({ _id: c._id, title: c.title, startTime: c.startTime, endTime: c.endTime })),
    });
  }

  const updated = Itineraries.update(day._id, (draft) => {
    draft.activities.push({
      _id: generateId(),
      title: String(title).trim(),
      startTime,
      endTime: endTime || null,
      category: category || 'sightseeing',
      notes: notes || '',
      createdBy: req.user._id,
      createdAt: new Date().toISOString(),
    });
    draft.activities.sort(sortByTime);
  });

  touchTrip(req.trip._id, req.user._id, `Added "${title}" to ${req.params.date}`);
  return res.status(201).json(updated);
});

/** PUT .../activities/:activityId */
router.put('/:date/activities/:activityId', (req, res) => {
  const day = dayFor(req.trip._id, req.params.date);
  const activity = day?.activities.find((a) => a._id === req.params.activityId);
  if (!activity) return res.status(404).json({ message: 'Activity not found.' });

  const startTime = req.body.startTime ?? activity.startTime;
  const endTime = req.body.endTime !== undefined ? req.body.endTime : activity.endTime;

  if (!isValidRange(startTime, endTime)) {
    return res.status(400).json({ message: 'End time must be later than the start time.' });
  }

  const conflicts = findConflicts({ startTime, endTime }, day.activities, activity._id);
  if (conflicts.length && !req.body.force) {
    return res.status(409).json({
      message: 'This change overlaps with something already scheduled that day.',
      conflicts: conflicts.map((c) => ({ _id: c._id, title: c.title, startTime: c.startTime, endTime: c.endTime })),
    });
  }

  const updated = Itineraries.update(day._id, (draft) => {
    const target = draft.activities.find((a) => a._id === req.params.activityId);
    ['title', 'category', 'notes'].forEach((f) => {
      if (req.body[f] !== undefined) target[f] = req.body[f];
    });
    target.startTime = startTime;
    target.endTime = endTime || null;
    draft.activities.sort(sortByTime);
  });

  touchTrip(req.trip._id, req.user._id, `Edited "${activity.title}"`);
  return res.json(updated);
});

/** DELETE .../activities/:activityId */
router.delete('/:date/activities/:activityId', (req, res) => {
  const day = dayFor(req.trip._id, req.params.date);
  const activity = day?.activities.find((a) => a._id === req.params.activityId);
  if (!activity) return res.status(404).json({ message: 'Activity not found.' });

  const updated = Itineraries.update(day._id, (draft) => {
    draft.activities = draft.activities.filter((a) => a._id !== req.params.activityId);
  });

  touchTrip(req.trip._id, req.user._id, `Removed "${activity.title}"`);
  return res.json(updated);
});

/**
 * GET /api/trips/:tripId/itinerary/:date/conflicts?startTime=&endTime=
 * Lets the "add activity" form warn the user before they submit.
 */
router.get('/:date/conflicts', (req, res) => {
  const { startTime, endTime, ignoreId } = req.query;
  const day = dayFor(req.trip._id, req.params.date);
  res.json({ conflicts: findConflicts({ startTime, endTime }, day?.activities || [], ignoreId) });
});

export default router;
