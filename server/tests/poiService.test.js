import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchPOIsForDestination, clearPOICache } from '../src/services/poiService.js';

/**
 * Unit tests for the Overpass enrichment service with the network replaced by
 * a scripted fetch(), so they are fast, repeatable and never hit public servers.
 */
const json = (body, ok = true, status = 200) => ({ ok, status, text: async () => JSON.stringify(body) });
const geocode = json([{ lat: '35.6762', lon: '139.6503' }]);
const element = (over = {}) => ({ id: 1, lat: 35.68, lon: 139.76, tags: { name: 'Test Museum', tourism: 'museum' }, ...over });

describe('POI enrichment service (Nominatim + Overpass)', () => {
  let fetchMock;

  beforeEach(() => {
    clearPOICache();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('requires a destination', async () => {
    await expect(fetchPOIsForDestination('  ')).rejects.toThrow(/destination is required/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('geocodes the destination, queries Overpass and normalises the places', async () => {
    fetchMock.mockResolvedValueOnce(geocode).mockResolvedValueOnce(json({ elements: [
      element({ id: 11, tags: { name: 'Famous Temple', tourism: 'attraction', wikidata: 'Q1', fee: 'yes', website: 'https://temple.example' } }),
      element({ id: 12, tags: { name: 'Quiet Viewpoint', tourism: 'viewpoint' } }),
    ] }));

    const pois = await fetchPOIsForDestination('Tokyo');

    expect(fetchMock.mock.calls[0][0]).toContain('nominatim.openstreetmap.org/search?q=Tokyo');
    expect(fetchMock.mock.calls[1][0]).toContain('overpass');
    expect(pois).toEqual([
      expect.objectContaining({ osmId: '11', name: 'Famous Temple', estimatedCost: 15, popularityScore: 0.9, category: 'attraction', website: 'https://temple.example' }),
      expect.objectContaining({ osmId: '12', name: 'Quiet Viewpoint', estimatedCost: 0, popularityScore: 0.5, category: 'viewpoint', website: null }),
    ]);
  });

  it('drops places with no name or no usable coordinates, and caps the list at 80', async () => {
    const many = Array.from({ length: 100 }, (_, i) => element({ id: i + 100, tags: { name: `Place ${i}` } }));
    fetchMock.mockResolvedValueOnce(geocode).mockResolvedValueOnce(json({ elements: [
      element({ id: 1, tags: { tourism: 'museum' } }),            // no name
      element({ id: 2, lat: 'x' }),                                // bad latitude
      element({ id: 3, tags: { 'name:en': 'English Name Only' } }),
      ...many,
    ] }));
    const pois = await fetchPOIsForDestination('Tokyo');
    expect(pois.some((p) => p.osmId === '1' || p.osmId === '2')).toBe(false);
    expect(pois.find((p) => p.osmId === '3')?.name).toBe('English Name Only');
    expect(pois).toHaveLength(80);
  });

  it('tries the next Overpass server when one fails', async () => {
    fetchMock
      .mockResolvedValueOnce(geocode)
      .mockResolvedValueOnce(json({ message: 'busy' }, false, 504))
      .mockResolvedValueOnce(json({ elements: [element()] }));
    const pois = await fetchPOIsForDestination('Tokyo');
    expect(pois).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('serves the last good result when the services are down', async () => {
    fetchMock.mockResolvedValueOnce(geocode).mockResolvedValueOnce(json({ elements: [element()] }));
    const first = await fetchPOIsForDestination('Tokyo');

    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await fetchPOIsForDestination('tokyo ')).toEqual(first);   // cache key ignores case and spaces
  });

  it('fails clearly when there is nothing cached and the services are down', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(fetchPOIsForDestination('Nowhere')).rejects.toThrow(/offline/);
  });

  it('reports a destination that cannot be geocoded', async () => {
    fetchMock.mockResolvedValueOnce(json([]));
    await expect(fetchPOIsForDestination('Qwertyuiop')).rejects.toThrow(/could not geocode/i);
  });

  it('rejects invalid coordinates from the geocoder', async () => {
    fetchMock.mockResolvedValueOnce(json([{ lat: 'abc', lon: 'def' }]));
    await expect(fetchPOIsForDestination('Weird')).rejects.toThrow(/invalid coordinates/i);
  });

  it('reuses cached places when Overpass later returns nothing', async () => {
    fetchMock.mockResolvedValueOnce(geocode).mockResolvedValueOnce(json({ elements: [element()] }));
    const first = await fetchPOIsForDestination('Tokyo');
    fetchMock.mockResolvedValueOnce(geocode).mockResolvedValueOnce(json({ elements: [] }));
    expect(await fetchPOIsForDestination('Tokyo')).toEqual(first);
  });

  it('returns an empty list for a place with no attractions and no cache', async () => {
    fetchMock.mockResolvedValueOnce(geocode).mockResolvedValueOnce(json({ elements: [] }));
    expect(await fetchPOIsForDestination('Emptyville')).toEqual([]);
  });
});
