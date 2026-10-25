/**
 * POI enrichment service for Smart Attraction Suggestions.
 *
 * Uses:
 * - Nominatim to geocode the destination
 * - Overpass API to retrieve nearby tourism POIs
 *
 * Includes:
 * - Multiple Overpass endpoint fallback
 * - In-memory POI cache
 * - Cached fallback when public APIs are temporarily unavailable
 */

const poiCache = new Map();

async function parseJsonResponse(response, serviceName) {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `${serviceName} request failed (${response.status}): ${text.slice(0, 180)}`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `${serviceName} returned an invalid response.`
    );
  }
}

async function runOverpass(endpoint, query) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'GroupTravelPlanner-CPAN324/1.0',
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  return parseJsonResponse(
    response,
    'Overpass'
  );
}

function cacheKey(destination) {
  return destination
    .trim()
    .toLowerCase();
}

export async function fetchPOIsForDestination(destination) {
  if (!destination?.trim()) {
    throw new Error(
      'Destination is required.'
    );
  }

  const key =
    cacheKey(destination);

  /*
   * Step 1:
   * Geocode the destination.
   */
  const geoUrl =
    'https://nominatim.openstreetmap.org/search' +
    `?q=${encodeURIComponent(destination)}` +
    '&format=json' +
    '&limit=1';

  let geoData;

  try {
    const geoResponse =
      await fetch(geoUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'GroupTravelPlanner-CPAN324/1.0',
        },
      });

    geoData =
      await parseJsonResponse(
        geoResponse,
        'Nominatim'
      );
  } catch (error) {
    /*
     * If geocoding itself temporarily fails but
     * cached POIs already exist, continue using them.
     */
    if (poiCache.has(key)) {
      console.warn(
        `Nominatim unavailable. Using cached POIs for "${destination}".`
      );

      return poiCache.get(key);
    }

    throw error;
  }

  if (
    !Array.isArray(geoData) ||
    geoData.length === 0
  ) {
    if (poiCache.has(key)) {
      console.warn(
        `Could not geocode "${destination}". Using cached POIs.`
      );

      return poiCache.get(key);
    }

    throw new Error(
      `Could not geocode destination "${destination}".`
    );
  }

  const latitude =
    Number(geoData[0].lat);

  const longitude =
    Number(geoData[0].lon);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    if (poiCache.has(key)) {
      console.warn(
        `Invalid destination coordinates. Using cached POIs for "${destination}".`
      );

      return poiCache.get(key);
    }

    throw new Error(
      'Nominatim returned invalid coordinates.'
    );
  }

  /*
   * Step 2:
   * Query a limited radius around the destination.
   */
  const radius = 6000;

  const query = `
    [out:json][timeout:12];
    (
      node["tourism"="attraction"](around:${radius},${latitude},${longitude});
      node["tourism"="museum"](around:${radius},${latitude},${longitude});
      node["tourism"="viewpoint"](around:${radius},${latitude},${longitude});
    );
    out body 80;
  `;

  /*
   * Public Overpass instances can become overloaded.
   * Try several instances before falling back to cache.
   */
  const endpoints = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];

  let result = null;
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      result =
        await runOverpass(
          endpoint,
          query
        );

      if (
        Array.isArray(
          result?.elements
        )
      ) {
        break;
      }
    } catch (error) {
      lastError = error;

      console.warn(
        `Overpass endpoint failed: ${endpoint}`,
        error.message
      );
    }
  }

  /*
   * All Overpass endpoints failed:
   * use last successful dataset if available.
   */
  if (
    !result ||
    !Array.isArray(
      result.elements
    )
  ) {
    if (poiCache.has(key)) {
      console.warn(
        `All Overpass endpoints failed. Using cached POIs for "${destination}".`
      );

      return poiCache.get(key);
    }

    throw (
      lastError ||
      new Error(
        'Unable to retrieve POIs from Overpass.'
      )
    );
  }

  /*
   * Step 3:
   * Normalize OpenStreetMap data.
   */
  const pois = result.elements
    .map((element) => {
      const tags =
        element.tags || {};

      const name =
        tags.name ||
        tags['name:en'] ||
        null;

      if (!name) {
        return null;
      }

      const poiLatitude =
        Number(element.lat);

      const poiLongitude =
        Number(element.lon);

      if (
        !Number.isFinite(
          poiLatitude
        ) ||
        !Number.isFinite(
          poiLongitude
        )
      ) {
        return null;
      }

      return {
        osmId:
          String(element.id),

        name,

        latitude:
          poiLatitude,

        longitude:
          poiLongitude,

        estimatedCost:
          tags.fee === 'yes'
            ? 15
            : 0,

        estimatedDurationMinutes:
          60,

        popularityScore:
          tags.wikidata ||
          tags.wikipedia
            ? 0.9
            : 0.5,

        category:
          tags.tourism ||
          'attraction',

        website:
          tags.website ||
          tags['contact:website'] ||
          null,
      };
    })
    .filter(Boolean)
    .slice(0, 80);

  /*
   * Cache only successful non-empty responses.
   */
  if (pois.length > 0) {
    poiCache.set(
      key,
      pois
    );

    console.log(
      `Cached ${pois.length} POIs for "${destination}".`
    );
  }

  /*
   * If Overpass returned an empty list but we already
   * have cached data, prefer the previous successful set.
   */
  if (
    pois.length === 0 &&
    poiCache.has(key)
  ) {
    console.warn(
      `Overpass returned no usable POIs. Using cached data for "${destination}".`
    );

    return poiCache.get(key);
  }

  return pois;
}

/**
 * Optional helper for tests/debugging.
 */
export function clearPOICache() {
  poiCache.clear();
}