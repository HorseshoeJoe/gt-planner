import { DEFAULT_WEIGHTS, FACTORS } from './weights.js';

/**
 * calculateScore() - the weighted scoring formula behind Smart Attraction
 * Suggestions (proposal section 3.1, Timeline week 6).
 *
 *   score = 100 * ( wP*popularity + wC*cost + wD*duration + wT*detour )
 *
 * Every factor is first mapped onto 0..1 where 1 is "best for the group", so
 * the weights can be compared and adjusted directly.
 */

/** Detours of this many minutes or more score zero on the detour factor. */
export const MAX_DETOUR_MINUTES = 60;

/** Share of the free time a stop should ideally use up (see durationFactor). */
export const IDEAL_UTILISATION = 0.75;

/** Cheaper is better. Tiers come from the POI dataset: 0 free ... 3 expensive. */
export const COST_TIER_SCORE = Object.freeze({ 0: 1, 1: 0.75, 2: 0.4, 3: 0.1 });

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/** Dataset popularity is a 1-5 rating; map it linearly onto 0..1. */
export function popularityFactor(poi) {
  const rating = Number(poi?.popularity);
  if (!Number.isFinite(rating)) return 0;
  return clamp01((rating - 1) / 4);
}

/** Entry cost on 0..1 (1 = free). Unknown tiers are treated as mid-priced. */
export function costFactor(poi) {
  const tier = poi?.costTier;
  return tier in COST_TIER_SCORE ? COST_TIER_SCORE[tier] : COST_TIER_SCORE[2];
}

/**
 * How well the stop fits the time the group has free.
 *
 * Time needed = typical visit + the extra travel. If that exceeds the free
 * time the stop does not fit (factor 0, fits = false). Otherwise the factor
 * peaks when the stop uses about 75% of the free time and falls off linearly
 * either side, so a 20-minute stop in a 4-hour gap scores low (wasted gap) and
 * a stop that just squeezes in scores below one that fits comfortably.
 */
export function durationFactor(poi, availableMinutes, detourMinutes = 0) {
  const needed = Number(poi?.avgVisitMinutes) + detourMinutes;
  if (!Number.isFinite(needed) || !(availableMinutes > 0)) return { factor: 0, fits: false, utilisation: null };
  if (needed > availableMinutes) return { factor: 0, fits: false, utilisation: needed / availableMinutes };

  const utilisation = needed / availableMinutes;
  const factor = clamp01(1 - Math.abs(utilisation - IDEAL_UTILISATION) / IDEAL_UTILISATION);
  return { factor, fits: true, utilisation };
}

/** Less extra travel is better: linear from 1 (none) to 0 (MAX_DETOUR_MINUTES+). */
export function detourFactor(detourMinutes) {
  if (!Number.isFinite(detourMinutes)) return 0;
  return clamp01(1 - Math.max(0, detourMinutes) / MAX_DETOUR_MINUTES);
}

/**
 * Scores one candidate POI for one gap in the itinerary.
 *
 * @param {object} poi      a POI record from the dataset
 * @param {object} context  { detourMinutes, availableMinutes }
 * @param {object} weights  normalised weights (defaults to DEFAULT_WEIGHTS)
 * @returns {{score:number, factors:object, fits:boolean}} score is 0..100
 */
export function calculateScore(poi, context, weights = DEFAULT_WEIGHTS) {
  const { detourMinutes = 0, availableMinutes } = context || {};

  const duration = durationFactor(poi, availableMinutes, detourMinutes);
  const factors = {
    popularity: popularityFactor(poi),
    cost: costFactor(poi),
    duration: duration.factor,
    detour: detourFactor(detourMinutes),
  };

  const weighted = FACTORS.reduce((sum, f) => sum + (weights[f] ?? 0) * factors[f], 0);
  return { score: Math.round(weighted * 1000) / 10, factors, fits: duration.fits };
}
