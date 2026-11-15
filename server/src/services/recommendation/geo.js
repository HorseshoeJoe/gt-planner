/**
 * Geography helpers for the recommendation engine.
 *
 * Live routing APIs are out of scope (proposal section 2), so travel time is
 * estimated from straight-line distance with a simple, documented model.
 */

const EARTH_RADIUS_KM = 6371.0088;

/** Walking pace used for short hops. */
export const WALK_MIN_PER_KM = 12;
/** Urban transit: fixed wait/transfer overhead plus ~20 km/h door to door. */
export const TRANSIT_OVERHEAD_MIN = 5;
export const TRANSIT_MIN_PER_KM = 3;

const toRad = (deg) => (deg * Math.PI) / 180;

/** True when the object carries a usable latitude/longitude pair. */
export function hasCoordinates(point) {
  if (!point) return false;
  const { latitude, longitude } = point;
  if (latitude === null || latitude === undefined || latitude === '') return false;
  if (longitude === null || longitude === undefined || longitude === '') return false;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/** Great-circle distance in kilometres between two {latitude, longitude} points. */
export function haversineKm(a, b) {
  const lat1 = toRad(Number(a.latitude));
  const lat2 = toRad(Number(b.latitude));
  const dLat = lat2 - lat1;
  const dLng = toRad(Number(b.longitude) - Number(a.longitude));
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Estimated minutes to travel `km` kilometres: whichever is quicker of walking
 * or taking transit. The result is non-decreasing in distance and subadditive
 * (f(a) + f(b) >= f(a + b)), so a detour through a third point can never come
 * out as negative extra time.
 */
export function travelMinutes(km) {
  if (!(km > 0)) return 0;
  return Math.min(km * WALK_MIN_PER_KM, TRANSIT_OVERHEAD_MIN + km * TRANSIT_MIN_PER_KM);
}

/** Estimated minutes between two points. */
export function travelMinutesBetween(a, b) {
  return travelMinutes(haversineKm(a, b));
}

/**
 * Extra minutes needed to visit `poi` while going from `from` to `to`.
 * With no `to` (end of the day) the extra cost is simply getting to the POI.
 */
export function detourMinutes(from, poi, to = null) {
  if (!to) return travelMinutesBetween(from, poi);
  return travelMinutesBetween(from, poi) + travelMinutesBetween(poi, to) - travelMinutesBetween(from, to);
}
