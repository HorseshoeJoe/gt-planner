import express from 'express';
import { Trips } from '../db/index.js'; // Assuming Trips is exported from db/index.js
import { requireAuth, requireTripMember } from '../middleware/auth.js';
import { touchTrip } from '../utils/helpers.js';

const router = express.Router({ mergeParams: true });
router.use(requireAuth, requireTripMember);

const DEFAULT_WEIGHTS = { popularity: 25, cost: 25, duration: 25, detour: 25 };

/** GET /api/trips/:tripId/suggestions/preferences */
router.get('/preferences', (req, res) => {
    const trip = req.trip;
    res.json({
        weights: trip.suggestionWeights || DEFAULT_WEIGHTS,
        dismissedIds: trip.dismissedSuggestionIds || []
    });
});

/** PUT /api/trips/:tripId/suggestions/weights */
router.put('/weights', (req, res) => {
    const { popularity, cost, duration, detour } = req.body;

    // Ensure they add up to 100 (or just save the raw values and let the engine normalize)
    const newWeights = { popularity, cost, duration, detour };

    Trips.update(req.trip._id, { suggestionWeights: newWeights });
    touchTrip(req.trip._id, req.user._id, 'Updated suggestion weights');

    res.json({ weights: newWeights });
});

/** POST /api/trips/:tripId/suggestions/dismiss */
router.post('/dismiss', (req, res) => {
    const { suggestionId } = req.body; // The OSM ID or custom ID of the suggestion

    if (!suggestionId) {
        return res.status(400).json({ message: 'suggestionId is required' });
    }

    const trip = req.trip;
    const dismissed = new Set(trip.dismissedSuggestionIds || []);
    dismissed.add(String(suggestionId));

    Trips.update(req.trip._id, { dismissedSuggestionIds: Array.from(dismissed) });
    touchTrip(req.trip._id, req.user._id, 'Dismissed a suggestion');

    res.json({ dismissedIds: Array.from(dismissed) });
});

export default router;