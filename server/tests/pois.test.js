import { describe, it, expect } from 'vitest';
import { poisForDestination, hasPoiDataset, getPoi, normaliseDestination, availableDestinations } from '../src/db/pois.js';

describe('POI dataset', () => {
  it('normalises destination strings', () => {
    expect(normaliseDestination('Tokyo, Japan')).toBe('tokyo');
    expect(normaliseDestination('  TOKYO ')).toBe('tokyo');
    expect(normaliseDestination(undefined)).toBe('');
  });

  it('has at least 100 POIs for every destination on disk', () => {
    const all = availableDestinations();
    expect(all.length).toBeGreaterThan(0);
    all.forEach((d) => expect(d.count).toBeGreaterThanOrEqual(100));
  });

  it('matches a trip destination typed the way users type it', () => {
    expect(hasPoiDataset('Tokyo, Japan')).toBe(true);
    expect(poisForDestination('tokyo').length).toBe(poisForDestination('Tokyo, Japan').length);
  });

  it('returns an empty pool for an unknown destination', () => {
    expect(poisForDestination('Atlantis')).toEqual([]);
    expect(hasPoiDataset('Atlantis')).toBe(false);
  });

  it('gives every POI the fields the scoring engine needs', () => {
    for (const p of poisForDestination('Tokyo')) {
      expect(p.id).toMatch(/^tokyo-/);
      expect(p.name).toBeTruthy();
      expect(p.category).toBeTruthy();
      expect(p.popularity).toBeGreaterThanOrEqual(1);
      expect(p.popularity).toBeLessThanOrEqual(5);
      expect(p.entryFeeJPY).toBeGreaterThanOrEqual(0);
      expect([0, 1, 2, 3]).toContain(p.costTier);
      expect(p.avgVisitMinutes).toBeGreaterThan(0);
    }
  });

  it('keeps every Tokyo POI inside the Greater Tokyo area with unique ids', () => {
    const pois = poisForDestination('Tokyo');
    pois.forEach((p) => {
      expect(p.latitude).toBeGreaterThan(35.5);
      expect(p.latitude).toBeLessThan(35.85);
      expect(p.longitude).toBeGreaterThan(139.1);
      expect(p.longitude).toBeLessThan(139.95);
    });
    expect(new Set(pois.map((p) => p.id)).size).toBe(pois.length);
  });

  it('looks a POI up by id', () => {
    expect(getPoi('tokyo-senso-ji-temple')?.name).toBe('Senso-ji Temple');
    expect(getPoi('nope')).toBeNull();
  });
});
