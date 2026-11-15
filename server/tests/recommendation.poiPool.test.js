import { describe, it, expect } from 'vitest';
import { adaptOverpassPoi, costTierFromAmount, loadPoiPool } from '../src/services/recommendation/poiPool.js';

const raw = (over = {}) => ({
  osmId: 987, name: 'Hidden Garden', latitude: 35.70, longitude: 139.78, category: 'garden',
  estimatedCost: 15, estimatedDurationMinutes: 60, popularityScore: 0.9, website: null, ...over,
});

describe('Overpass adapter', () => {
  it('maps price estimates onto the 0-3 cost tiers', () => {
    expect([0, null, undefined, 'x'].map(costTierFromAmount)).toEqual([0, 0, 0, 0]);
    expect([5, 20, 21, 60, 61, 500].map(costTierFromAmount)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('converts a poiService record into the engine shape', () => {
    expect(adaptOverpassPoi(raw())).toMatchObject({
      id: '987', osmId: '987', name: 'Hidden Garden', category: 'garden',
      popularity: 4.6, costTier: 1, avgVisitMinutes: 60, source: 'overpass',
    });
  });

  it('uses sensible defaults for missing fields', () => {
    const poi = adaptOverpassPoi(raw({ popularityScore: undefined, estimatedDurationMinutes: undefined, estimatedCost: undefined, category: undefined }));
    expect(poi).toMatchObject({ popularity: 3, avgVisitMinutes: 60, costTier: 0, category: 'attraction' });
  });
});

describe('loadPoiPool', () => {
  it('uses the curated dataset when Overpass has nothing', async () => {
    const { pois, sources } = await loadPoiPool('Tokyo, Japan', { fetchOverpass: async () => [] });
    expect(sources.curated).toBeGreaterThanOrEqual(100);
    expect(sources.overpass).toBe(0);
    expect(pois.every((p) => p.source === 'curated')).toBe(true);
  });

  it('adds Overpass places that are not already curated', async () => {
    const { pois, sources } = await loadPoiPool('Tokyo', { fetchOverpass: async () => [raw()] });
    expect(sources.overpass).toBe(1);
    expect(pois.find((p) => p.id === '987')?.source).toBe('overpass');
  });

  it('keeps the curated record when Overpass returns the same place', async () => {
    const dup = raw({ osmId: 1, name: 'senso-ji temple' });
    const { pois, sources } = await loadPoiPool('Tokyo', { fetchOverpass: async () => [dup] });
    expect(sources.overpass).toBe(0);
    expect(pois.filter((p) => /senso-?ji/i.test(p.name))).toHaveLength(1);
  });

  it('ignores Overpass records with no name, id or location, and repeats', async () => {
    const bad = [raw({ name: '' }), raw({ osmId: undefined }), raw({ latitude: null }), raw({ osmId: 2 }), raw({ osmId: 3 })];
    const { sources } = await loadPoiPool('Tokyo', { fetchOverpass: async () => bad });
    expect(sources.overpass).toBe(1);
  });

  it('survives Overpass being unavailable', async () => {
    const { pois } = await loadPoiPool('Tokyo', { fetchOverpass: async () => { throw new Error('timeout'); } });
    expect(pois.length).toBeGreaterThanOrEqual(100);
  });

  it('does not wait forever for a slow Overpass', async () => {
    const never = () => new Promise(() => {});
    const started = Date.now();
    const { pois, sources } = await loadPoiPool('Tokyo', { fetchOverpass: never, timeoutMs: 30 });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(sources.overpass).toBe(0);
    expect(pois.length).toBeGreaterThanOrEqual(100);
  });

  it('uses Overpass alone for a destination with no curated dataset', async () => {
    const { pois, sources } = await loadPoiPool('Atlantis', { fetchOverpass: async () => [raw()] });
    expect(sources).toEqual({ curated: 0, overpass: 1 });
    expect(pois).toHaveLength(1);
  });
});
