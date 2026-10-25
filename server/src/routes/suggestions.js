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
  fetchPOIsForDestination,
} from '../services/poiService.js';

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

/**
 * Haversine distance.
 * Returns distance in kilometres.
 */
function distanceKm(
  lat1,
  lon1,
  lat2,
  lon2,
) {
  const values = [
    lat1,
    lon1,
    lat2,
    lon2,
  ].map(Number);

  if (
    values.some(
      (value) =>
        !Number.isFinite(value),
    )
  ) {
    return null;
  }

  const [
    latitude1,
    longitude1,
    latitude2,
    longitude2,
  ] = values;

  const earthRadiusKm = 6371;

  const toRadians =
    (degrees) =>
      (degrees * Math.PI) / 180;

  const dLat =
    toRadians(
      latitude2 - latitude1,
    );

  const dLon =
    toRadians(
      longitude2 - longitude1,
    );

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(
      toRadians(latitude1),
    ) *
      Math.cos(
        toRadians(latitude2),
      ) *
      Math.sin(dLon / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    );

  return earthRadiusKm * c;
}

/**
 * Shorter detour = better score.
 */
function detourScore(distance) {
  if (
    distance === null ||
    !Number.isFinite(distance)
  ) {
    return 0.5;
  }

  if (distance <= 1) return 1;
  if (distance <= 2) return 0.9;
  if (distance <= 5) return 0.75;
  if (distance <= 10) return 0.5;
  if (distance <= 20) return 0.25;

  return 0.1;
}

/**
 * Lower cost = better score.
 */
function costScore(cost) {
  const value = Number(cost);

  if (!Number.isFinite(value)) {
    return 0.5;
  }

  if (value <= 0) return 1;
  if (value <= 10) return 0.9;
  if (value <= 20) return 0.75;
  if (value <= 40) return 0.5;
  if (value <= 80) return 0.25;

  return 0.1;
}

/**
 * Shorter visit durations are easier
 * to fit into an existing itinerary.
 */
function durationScore(minutes) {
  const value = Number(minutes);

  if (!Number.isFinite(value)) {
    return 0.5;
  }

  if (value <= 60) return 1;
  if (value <= 90) return 0.85;
  if (value <= 120) return 0.7;
  if (value <= 180) return 0.45;

  return 0.2;
}

/**
 * Normalize stored weight values.
 */
function normalizeWeights(weights) {
  const source = {
    ...DEFAULT_WEIGHTS,
    ...(weights || {}),
  };

  const total =
    Number(
      source.popularity || 0,
    ) +
    Number(
      source.cost || 0,
    ) +
    Number(
      source.duration || 0,
    ) +
    Number(
      source.detour || 0,
    );

  if (!total) {
    return {
      popularity: 0.25,
      cost: 0.25,
      duration: 0.25,
      detour: 0.25,
    };
  }

  return {
    popularity:
      Number(
        source.popularity || 0,
      ) / total,

    cost:
      Number(
        source.cost || 0,
      ) / total,

    duration:
      Number(
        source.duration || 0,
      ) / total,

    detour:
      Number(
        source.detour || 0,
      ) / total,
  };
}

/**
 * Find the distance from a POI
 * to the nearest saved attraction.
 */
function nearestDistance(
  poi,
  knownAttractions,
) {
  const distances =
    knownAttractions
      .map((attraction) =>
        distanceKm(
          poi.latitude,
          poi.longitude,
          attraction.latitude,
          attraction.longitude,
        ),
      )
      .filter(
        (value) =>
          Number.isFinite(value),
      );

  if (!distances.length) {
    return null;
  }

  return Math.min(...distances);
}

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

/**
 * GET /api/trips/:tripId/suggestions?date=YYYY-MM-DD
 *
 * Generate and rank Smart Attraction Suggestions.
 */
router.get(
  '/',
  async (req, res, next) => {
    try {
      /*
       * Important:
       * reload the trip directly from the store.
       *
       * req.trip was loaded earlier by middleware,
       * but suggestion preferences/dismissed IDs may
       * have changed after that request.
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

      const date =
        req.query.date;

      if (!date) {
        return res
          .status(400)
          .json({
            message:
              'date query parameter is required',
          });
      }

      const day =
        Itineraries.findOne(
          (item) =>
            item.tripId ===
              trip._id &&
            item.date === date,
        ) || {
          date,
          activities: [],
        };

      const savedAttractions =
        Attractions.find(
          (item) =>
            item.tripId ===
            trip._id,
        );

      /*
       * Always convert dismissed IDs to strings
       * because OSM IDs may be numbers or strings.
       */
      const dismissedIds =
        new Set(
          (
            trip.dismissedSuggestionIds ||
            []
          ).map(String),
        );

      /*
       * Avoid recommending items already saved
       * or already added to the selected day.
       */
      const existingNames =
        new Set(
          [
            ...savedAttractions.map(
              (item) =>
                item.name,
            ),

            ...(
              day.activities ||
              []
            ).map(
              (item) =>
                item.title,
            ),
          ]
            .filter(Boolean)
            .map(
              (value) =>
                String(value)
                  .trim()
                  .toLowerCase(),
            ),
        );

      const pois =
        await fetchPOIsForDestination(
          trip.destination,
        );

      const weights =
        normalizeWeights(
          trip.suggestionWeights,
        );

      const startTime =
        suggestedStartTime(
          day,
        );

      const suggestions =
        pois
          .filter((poi) => {
            const id =
              String(
                poi.osmId,
              );

            const name =
              String(
                poi.name || '',
              )
                .trim()
                .toLowerCase();

            /*
             * This is the key dismissed check.
             */
            if (
              dismissedIds.has(
                id,
              )
            ) {
              return false;
            }

            if (
              existingNames.has(
                name,
              )
            ) {
              return false;
            }

            return true;
          })
          .map((poi) => {
            const distance =
              nearestDistance(
                poi,
                savedAttractions,
              );

            const popularity =
              Number(
                poi.popularityScore ??
                  0.5,
              );

            const cost =
              costScore(
                poi.estimatedCost,
              );

            const duration =
              durationScore(
                poi.estimatedDurationMinutes,
              );

            const detour =
              detourScore(
                distance,
              );

            const score =
              popularity *
                weights.popularity +
              cost *
                weights.cost +
              duration *
                weights.duration +
              detour *
                weights.detour;

            const detourMinutes =
              distance === null
                ? null
                : Math.round(
                    distance *
                      8,
                  );

            return {
              id:
                String(
                  poi.osmId,
                ),

              osmId:
                String(
                  poi.osmId,
                ),

              name:
                poi.name,

              latitude:
                poi.latitude,

              longitude:
                poi.longitude,

              category:
                poi.category,

              website:
                poi.website,

              estimatedCost:
                poi.estimatedCost,

              estimatedDurationMinutes:
                poi.estimatedDurationMinutes,

              popularityScore:
                popularity,

              detourKm:
                distance,

              detourMinutes,

              score,

              startTime,

              reason:
                detourMinutes !==
                null
                  ? `${detourMinutes} min estimated detour from a saved attraction.`
                  : 'Popular attraction that may fit this itinerary day.',
            };
          })
          .sort(
            (a, b) =>
              b.score -
              a.score,
          )
          .slice(
            0,
            10,
          );

      return res.json({
        date,

        weights:
          trip.suggestionWeights ||
          DEFAULT_WEIGHTS,

        suggestions,
      });
    } catch (err) {
      next(err);
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