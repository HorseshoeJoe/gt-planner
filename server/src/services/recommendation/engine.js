import { poisForDestination } from '../../db/pois.js';
import { dateRange } from '../../utils/helpers.js';
import { toMinutes } from '../../utils/timeConflicts.js';
import { hasCoordinates, detourMinutes as calcDetour } from './geo.js';
import { calculateScore, MAX_DETOUR_MINUTES } from './scoring.js';
import { DEFAULT_WEIGHTS } from './weights.js';

/**
 * RecommendationEngine - Smart Attraction Suggestions (Timeline weeks 6-7).
 *
 * Reads a trip's confirmed itinerary, finds the gaps between attractions the
 * group has already scheduled on the same day, and ranks nearby points of
 * interest that would fit into those gaps.
 *
 * The engine is a pure service: it is given plain data (trip, attractions,
 * itinerary activities) and a POI provider, and returns suggestions. It never
 * touches the database or Express, so it can be unit tested directly and the
 * POI source can later be swapped for the Overpass-enriched dataset.
 */

/** Free time assumed when a gap cannot be measured from scheduled activities. */
export const DEFAULT_GAP_MINUTES = 180;
/** Latest time the engine plans a day to run until (21:00). */
export const DAY_END_MINUTES = 21 * 60;
export const DEFAULT_LIMIT_PER_DAY = 5;

const NO_ANCHOR_NOTE = 'Add an attraction with a location to this day to get suggestions.';
const NO_FREE_TIME_NOTE = 'There is no free time left between this day\'s attractions.';
const NOTHING_FITS_NOTE = 'Nothing nearby fits the free time on this day.';

/** "Senso-ji Temple" and "senso ji temple!" should count as the same place. */
export function normaliseName(value) {
  return String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
}

/**
 * Orders suggestions best first: score, then smaller detour, then higher
 * popularity, then name (so the order is fully deterministic).
 */
export function rankSuggestions(suggestions, limit = Infinity) {
  return [...suggestions]
    .sort((a, b) =>
      b.score - a.score ||
      a.detourMinutes - b.detourMinutes ||
      b.poi.popularity - a.poi.popularity ||
      a.poi.name.localeCompare(b.poi.name))
    .slice(0, limit);
}

/** Human-readable reason shown next to a suggestion (proposal section 3.1). */
export function describeReason(detour, gap) {
  const minutes = Math.round(detour);
  const amount = minutes <= 1 ? 'Right on your route' : `${minutes} minutes off your route`;
  if (gap.type === 'between') return `${amount} between ${gap.from.name} and ${gap.to.name}`;
  return minutes <= 1 ? `Right next to ${gap.from.name}` : `${minutes} minutes from ${gap.from.name}`;
}

/**
 * Finds the scheduled attractions for one day, in visiting order, and the gaps
 * between them. An attraction is matched to its itinerary activity by name so
 * its time slot is known; unmatched attractions fall back to a default gap.
 *
 * @returns {{anchors: object[], gaps: object[]}}
 */
export function buildDayGaps(dayAttractions, dayActivities = []) {
  const slotFor = (attraction) => {
    const activity = dayActivities.find((a) => normaliseName(a.title) === normaliseName(attraction.name));
    const start = toMinutes(activity?.startTime);
    if (start === null) return null;
    return { start, end: toMinutes(activity.endTime) ?? start };
  };

  const anchors = dayAttractions
    .filter(hasCoordinates)
    .map((attraction) => ({ ...attraction, slot: slotFor(attraction) }))
    .sort((a, b) => {
      if (a.slot && b.slot) return a.slot.start - b.slot.start;
      if (a.slot) return -1;
      if (b.slot) return 1;
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });

  const gaps = [];
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const from = anchors[i];
    const to = anchors[i + 1];
    const measured = from.slot && to.slot;
    gaps.push({
      type: 'between',
      from,
      to,
      availableMinutes: measured ? to.slot.start - from.slot.end : DEFAULT_GAP_MINUTES,
    });
  }

  const last = anchors[anchors.length - 1];
  if (last) {
    gaps.push({
      type: 'after',
      from: last,
      to: null,
      availableMinutes: last.slot ? Math.max(0, DAY_END_MINUTES - last.slot.end) : DEFAULT_GAP_MINUTES,
    });
  }

  return { anchors, gaps: gaps.filter((g) => g.availableMinutes > 0) };
}

const round1 = (n) => Math.round(n * 10) / 10;
const round3 = (n) => Math.round(n * 1000) / 1000;

export class RecommendationEngine {
  /** @param {{poiProvider?: (destination: string) => object[]}} options */
  constructor({ poiProvider = poisForDestination } = {}) {
    this.poiProvider = poiProvider;
  }

  /**
   * generateSuggestions() - ranked suggestions for every day of a trip.
   *
   * @param {object} input
   * @param {{destination:string, startDate:string, endDate:string}} input.trip
   * @param {object[]} input.attractions     the trip's attractions
   * @param {Object<string, object[]>} [input.activitiesByDate] itinerary activities keyed by date
   * @param {object} [input.weights]         normalised weights (default weights if omitted)
   * @param {string[]} [input.dismissedPoiIds] POIs the group has dismissed
   * @param {number} [input.limitPerDay]
   */
  generateSuggestions({
    trip,
    attractions = [],
    activitiesByDate = {},
    weights = DEFAULT_WEIGHTS,
    dismissedPoiIds = [],
    limitPerDay = DEFAULT_LIMIT_PER_DAY,
  }) {
    const startedAt = process.hrtime.bigint();
    const pool = this.poiProvider(trip.destination).filter(hasCoordinates);

    // Anything the group already planned (as an attraction or an activity), or
    // has dismissed, is never suggested.
    const dismissed = new Set(dismissedPoiIds);
    const plannedIds = new Set(attractions.map((a) => a.poiId).filter(Boolean));
    const plannedNames = new Set([
      ...attractions.map((a) => normaliseName(a.name)),
      ...Object.values(activitiesByDate).flat().map((a) => normaliseName(a.title)),
    ]);
    const candidates = pool.filter(
      (poi) => !dismissed.has(poi.id) && !plannedIds.has(poi.id) && !plannedNames.has(normaliseName(poi.name))
    );

    let evaluated = 0;
    const days = dateRange(trip.startDate, trip.endDate).map((date) => {
      const dayAttractions = attractions.filter((a) => a.visitDate === date);
      const { anchors, gaps } = buildDayGaps(dayAttractions, activitiesByDate[date] || []);

      if (anchors.length === 0) return { date, suggestions: [], note: NO_ANCHOR_NOTE };

      // Each POI is suggested once per day, in the gap where it scores best.
      const best = new Map();
      for (const poi of candidates) {
        for (const gap of gaps) {
          evaluated += 1;
          const detour = calcDetour(gap.from, poi, gap.to);
          if (detour > MAX_DETOUR_MINUTES) continue;

          const result = calculateScore(poi, { detourMinutes: detour, availableMinutes: gap.availableMinutes }, weights);
          if (!result.fits) continue;
          if (best.has(poi.id) && best.get(poi.id).score >= result.score) continue;

          best.set(poi.id, {
            poi,
            score: round1(result.score),
            factors: Object.fromEntries(Object.entries(result.factors).map(([k, v]) => [k, round3(v)])),
            detourMinutes: Math.round(detour),
            availableMinutes: gap.availableMinutes,
            gap: {
              type: gap.type,
              from: { _id: gap.from._id, name: gap.from.name },
              to: gap.to ? { _id: gap.to._id, name: gap.to.name } : null,
            },
            reason: describeReason(detour, gap),
          });
        }
      }

      const suggestions = rankSuggestions([...best.values()], limitPerDay);
      if (suggestions.length > 0) return { date, suggestions };
      return { date, suggestions, note: gaps.length === 0 ? NO_FREE_TIME_NOTE : NOTHING_FITS_NOTE };
    });

    return {
      destination: trip.destination,
      weights,
      days,
      meta: {
        poolSize: pool.length,
        candidates: candidates.length,
        evaluated,
        elapsedMs: Number(process.hrtime.bigint() - startedAt) / 1e6,
      },
    };
  }
}

export default RecommendationEngine;
