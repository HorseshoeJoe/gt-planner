/**
 * Fetches POIs (Points of Interest) for a given destination.
 * Scopes the query to tourism, attractions, and museums.
 */
export async function fetchPOIsForDestination(destination) {
    const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&limit=1`;

    const geoRes = await fetch(geoUrl, {
        headers: { 'User-Agent': 'GroupTravelPlanner-CPAN324/1.0' }
    });
    const geoData = await geoRes.json();

    if (!geoData || geoData.length === 0) {
        throw new Error('Could not geocode destination');
    }

    const { boundingbox } = geoData[0];

    const [south, north, west, east] = boundingbox;

    const overpassQuery = `
    [out:json][timeout:15];
    (
      node["tourism"~"attraction|museum|viewpoint"](${south},${west},${north},${east});
      way["tourism"~"attraction|museum|viewpoint"](${south},${west},${north},${east});
    );
    out center 100;
  `;

    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const overpassRes = await fetch(overpassUrl, {
        method: 'POST',
        body: `data=${encodeURIComponent(overpassQuery)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const overpassData = await overpassRes.json();

    return overpassData.elements.map((el) => {
        const tags = el.tags || {};
        return {
            osmId: el.id,
            name: tags.name || 'Unknown Attraction',
            latitude: el.lat || (el.center && el.center.lat),
            longitude: el.lon || (el.center && el.center.lon),
            estimatedCost: tags.fee === 'yes' ? 15 : 0,
            estimatedDurationMinutes: 60,
            popularityScore: tags.wikidata ? 0.9 : 0.5,
            category: tags.tourism,
            website: tags.website || null
        };
    }).filter(poi => poi.latitude && poi.longitude);
}