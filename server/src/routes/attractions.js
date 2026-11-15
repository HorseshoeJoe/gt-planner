import { Attractions } from '../db/index.js';
import { createCollectionRouter } from './collection.js';

/** Latitude/longitude are optional, but when given must be a valid pair. */
function validateLocation(body) {
  const { latitude: lat, longitude: lng } = body;
  const given = (v) => v !== undefined && v !== null && v !== '';
  if (!given(lat) && !given(lng)) return null;
  if (given(lat) !== given(lng)) return 'Provide both latitude and longitude, or neither.';
  if (!Number.isFinite(Number(lat)) || Number(lat) < -90 || Number(lat) > 90) return 'Latitude must be between -90 and 90.';
  if (!Number.isFinite(Number(lng)) || Number(lng) < -180 || Number(lng) > 180) return 'Longitude must be between -180 and 180.';
  return null;
}

/**
 * Class diagram: Attraction { attractionId, name, description, rating }
 *
 * CPAN 324 additions: latitude/longitude let the suggestion engine measure
 * detours from scheduled stops, and poiId links an attraction that was added
 * from a suggestion back to its entry in the POI dataset.
 */
export default createCollectionRouter({
  store: Attractions,
  label: 'attraction',
  requiredFields: ['name'],
  editableFields: ['name', 'description', 'rating', 'mapLink', 'visitDate', 'latitude', 'longitude', 'poiId'],
  sortBy: 'createdAt',
  validate: validateLocation,
});
