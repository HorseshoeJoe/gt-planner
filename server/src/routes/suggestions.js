import express from 'express';

import {
  Trips,
  Itineraries,
  Attractions,
} from '../db/index.js';

import {
  requireAuth,
  requireTripMember,
} from '../middleware/auth.js';

import { touchTrip } from '../utils/helpers.js';

import {
  RecommendationEngine,
  normaliseWeights,
} from '../services/recommendation/index.js';

import { loadPoiPool } from '../services/recommendation/poiPool.js';

const router = express.Router({
  mergeParams: true,
});

router.use(
  requireAuth,
  requireTripMember,
);

const DEFAULT_WEIGHTS = {
  popularity: 25,
  cost: 25,
  duration: 25,
  detour: 25,
};

const engine = new RecommendationEngine();

/** How many ranked suggestions are returned for the selected day. */
const SUGGESTIONS_PER_DAY = 10;

/**
 * Produce a simple suggested start time.
 *
 * Prototype behaviour:
 * one hour after the latest activity.
 */
function suggestedStartTime(day) {
  const activities =
    day?.activities || [];

  if (!activities.length) {
    return '10:00';
  }

  const latest =
    [...activities]
      .sort((a, b) =>
        String(
          a.startTime,
        ).localeCompare(
          String(
            b.startTime,
          ),
        ),
      )
      .at(-1);

  const source =
    latest.endTime ||
    latest.startTime ||
    '10:00';

  const match =
    /^([01]\d|2[0-3]):([0-5]\d)$/.exec(
      source,
    );

  if (!match) {
    return '10:00';
  }

  let hour =
    Number(match[1]) + 1;

  const minute =
    Number(match[2]);

  if (hour >= 23) {
    hour = 20;
  }

  return `${String(
    hour,
  ).padStart(
    2,
    '0',
  )}:${String(
    minute,
  ).padStart(
    2,
    '0',
  )}`;
}

/** Whole-number cost shown by the UI: curated POIs list entry fees in yen. */
function describeCost(poi) {
  if (poi.source !== 'curated') return poi.entryFee ?? 0;
  return poi.entryFeeJPY > 0 ? `\u00a5${poi.entryFeeJPY.toLocaleString('en-US')}` : 'Free';
}

/**
 * Converts an engine suggestion into the shape the suggestion panel reads,
 * keeping the engine's own detail (factors, gap, availableMinutes) alongside.
 */
function toApiSuggestion(suggestion, fallbackStartTime) {
  const { poi } = suggestion;
  return {
    id: String(poi.id),
    osmId: String(poi.osmId ?? poi.id),
    poiId: poi.id,
    name: poi.name,
    latitude: poi.latitude,
    longitude: poi.longitude,
    category: poi.category,
    website: poi.website ?? null,
    estimatedCost: describeCost(poi),
    estimatedDurationMinutes: poi.avgVisitMinutes,
    popularityScore: Math.round(((poi.popularity - 1) / 4) * 100) / 100,
    detourMinutes: suggestion.detourMinutes,
    score: suggestion.score,
    factors: suggestion.factors,
    gap: suggestion.gap,
    availableMinutes: suggestion.availableMinutes,
    source: poi.source,
    startTime: suggestion.suggestedStartTime || fallbackStartTime,
    reason: suggestion.reason,
  };
}

/**
 * GET /api/trips/:tripId/suggestions?date=YYYY-MM-DD
 *
 * Smart Attraction Suggestions for one day. The RecommendationEngine finds the
 * free time between the day's scheduled attractions and ranks nearby points of
 * interest by the trip's saved weights (popularity, cost, duration, detour).
 * Dismissed suggestions are left out. Details of the scoring are in
 * docs/SCORING.md.
 */
router.get(
  '/',
  async (req, res, next) => {
    try {
      // Reload the trip: weights and dismissed ids may have changed since the
      // membership middleware loaded req.trip.
      const trip = Trips.findById(req.trip._id);

      if (!trip) {
        return res.status(404).json({ message: 'Trip not found.' });
      }

      const date = req.query.date;

      if (!date) {
        return res.status(400).json({ message: 'date query parameter is required' });
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
        return res.status(400).json({ message: 'date must be in YYYY-MM-DD format.' });
      }

      const day = Itineraries.findOne(
        (item) => item.tripId === trip._id && item.date === date,
      ) || { date, activities: [] };

      let weights;
      try {
        weights = normaliseWeights(trip.suggestionWeights || DEFAULT_WEIGHTS);
      } catch {
        weights = normaliseWeights(DEFAULT_WEIGHTS); // ignore unusable stored weights
      }

      const { pois, sources } = await loadPoiPool(trip.destination);

      const result = engine.generateSuggestions({
        trip: { destination: trip.destination, startDate: date, endDate: date },
        attractions: Attractions.find((item) => item.tripId === trip._id),
        activitiesByDate: { [date]: day.activities || [] },
        weights,
        dismissedPoiIds: (trip.dismissedSuggestionIds || []).map(String),
        limitPerDay: SUGGESTIONS_PER_DAY,
        pois,
        anchorlessFallback: true,
      });

      const [today] = result.days;
      const fallbackStartTime = suggestedStartTime(day);

      return res.json({
        date,
        weights: trip.suggestionWeights || DEFAULT_WEIGHTS,
        suggestions: today.suggestions.map((item) => toApiSuggestion(item, fallbackStartTime)),
        ...(today.note ? { note: today.note } : {}),
        meta: { ...result.meta, sources },
      });
    } catch (err) {
      return next(err);
    }
  },
);

/**
 * GET /api/trips/:tripId/suggestions/preferences
 */
router.get(
  '/preferences',
  (req, res) => {
    /*
     * Read latest trip state here too.
     */
    const trip =
      Trips.findById(
        req.trip._id,
      );

    if (!trip) {
      return res
        .status(404)
        .json({
          message:
            'Trip not found.',
        });
    }

    res.json({
      weights:
        trip.suggestionWeights ||
        DEFAULT_WEIGHTS,

      dismissedIds:
        trip.dismissedSuggestionIds ||
        [],
    });
  },
);

/**
 * PUT /api/trips/:tripId/suggestions/weights
 */
router.put(
  '/weights',
  (req, res) => {
    const {
      popularity,
      cost,
      duration,
      detour,
    } = req.body;

    const values = [
      popularity,
      cost,
      duration,
      detour,
    ].map(Number);

    if (
      values.some(
        (value) =>
          !Number.isFinite(
            value,
          ) ||
          value < 0,
      )
    ) {
      return res
        .status(400)
        .json({
          message:
            'All suggestion weights must be non-negative numbers.',
        });
    }

    const total =
      values.reduce(
        (
          sum,
          value,
        ) =>
          sum + value,
        0,
      );

    if (total <= 0) {
      return res
        .status(400)
        .json({
          message:
            'At least one suggestion weight must be greater than zero.',
        });
    }

    const newWeights = {
      popularity:
        values[0],

      cost:
        values[1],

      duration:
        values[2],

      detour:
        values[3],
    };

    Trips.update(
      req.trip._id,
      {
        suggestionWeights:
          newWeights,
      },
    );

    touchTrip(
      req.trip._id,
      req.user._id,
      'Updated suggestion weights',
    );

    res.json({
      weights:
        newWeights,
    });
  },
);

/**
 * POST /api/trips/:tripId/suggestions/dismiss
 *
 * Persist dismissed suggestion IDs.
 */
router.post(
  '/dismiss',
  (req, res) => {
    const {
      suggestionId,
    } = req.body;

    if (
      suggestionId ===
        undefined ||
      suggestionId ===
        null ||
      String(
        suggestionId,
      ).trim() === ''
    ) {
      return res
        .status(400)
        .json({
          message:
            'suggestionId is required',
        });
    }

    const id =
      String(
        suggestionId,
      );

    /*
     * Atomic update:
     * read the newest trip draft,
     * add the dismissed ID,
     * persist it immediately.
     */
    const updatedTrip =
      Trips.update(
        req.trip._id,
        (draft) => {
          const dismissed =
            new Set(
              (
                draft.dismissedSuggestionIds ||
                []
              ).map(
                String,
              ),
            );

          dismissed.add(
            id,
          );

          draft.dismissedSuggestionIds =
            Array.from(
              dismissed,
            );

          return draft;
        },
      );

    if (!updatedTrip) {
      return res
        .status(404)
        .json({
          message:
            'Trip not found.',
        });
    }

    touchTrip(
      req.trip._id,
      req.user._id,
      'Dismissed a suggestion',
    );

    /*
     * Return the persisted IDs.
     */
    const latestTrip =
      Trips.findById(
        req.trip._id,
      );

    res.json({
      dismissedIds:
        latestTrip
          ?.dismissedSuggestionIds ||
        [],
    });
  },
);

export default router;