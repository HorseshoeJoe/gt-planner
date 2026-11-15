import { poisForDestination } from '../../db/pois.js';
import { fetchPOIsForDestination } from '../poiService.js';
import { normaliseName } from './engine.js';
import { hasCoordinates } from './geo.js';

/**
 * Builds the candidate pool for a trip's destination.
 *
 *   1. the curated dataset (src/data/pois/), when one exists for the destination
 *   2. points of interest from the OpenStreetMap / Overpass enrichment service
 *
 * Overpass results are converted into the same shape as the curated data and
 * only added when they are not already in the pool (matched by name), so the
 * richer curated records always win. If Overpass is unreachable the curated
 * pool is used on its own; for a destination with no curated dataset the pool
 * is whatever Overpass returns.
 */

/** Overpass price estimates are small currency amounts; map them onto the 0-3 cost tiers. */
export function costTierFromAmount(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value <= 20) return 1;
  if (value <= 60) return 2;
  return 3;
}

/** Converts a record from poiService.js into the engine's POI shape. */
export function adaptOverpassPoi(raw) {
  const popularityScore = Number(raw.popularityScore);
  const duration = Number(raw.estimatedDurationMinutes);
  return {
    id: String(raw.osmId),
    osmId: String(raw.osmId),
    name: raw.name,
    category: raw.category || 'attraction',
    latitude: raw.latitude,
    longitude: raw.longitude,
    website: raw.website ?? null,
    popularity: 1 + 4 * Math.min(1, Math.max(0, Number.isFinite(popularityScore) ? popularityScore : 0.5)),
    costTier: costTierFromAmount(raw.estimatedCost),
    entryFee: Number(raw.estimatedCost) || 0,
    avgVisitMinutes: Number.isFinite(duration) && duration > 0 ? duration : 60,
    source: 'overpass',
  };
}

/** How long a request waits for Overpass before using the curated data alone. */
export const OVERPASS_TIMEOUT_MS = 4000;

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Overpass enrichment timed out.')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

/**
 * @param {string} destination
 * @param {{fetchOverpass?: Function, timeoutMs?: number}} [options] inject a fetcher / timeout for tests
 * @returns {Promise<{pois: object[], sources: {curated: number, overpass: number}}>}
 */
export async function loadPoiPool(
  destination,
  { fetchOverpass = fetchPOIsForDestination, timeoutMs = OVERPASS_TIMEOUT_MS } = {},
) {
  const curated = poisForDestination(destination).map((poi) => ({ ...poi, source: 'curated' }));
  const known = new Set(curated.map((poi) => normaliseName(poi.name)));

  let extra = [];
  try {
    extra = (await withTimeout(Promise.resolve(fetchOverpass(destination)), timeoutMs)) || [];
  } catch {
    extra = []; // enrichment is optional; never fail or stall a request because of it
  }

  const seen = new Set();
  const overpass = [];
  for (const raw of extra) {
    if (!raw?.name || raw.osmId === undefined || !hasCoordinates(raw)) continue;
    const key = normaliseName(raw.name);
    if (known.has(key) || seen.has(key)) continue;
    seen.add(key);
    overpass.push(adaptOverpassPoi(raw));
  }

  return { pois: [...curated, ...overpass], sources: { curated: curated.length, overpass: overpass.length } };
}
