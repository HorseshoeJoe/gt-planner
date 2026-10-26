import { describe, it, expect } from 'vitest';
import {
  popularityFactor, costFactor, durationFactor, detourFactor, calculateScore,
  MAX_DETOUR_MINUTES, IDEAL_UTILISATION,
} from '../src/services/recommendation/scoring.js';
import { DEFAULT_WEIGHTS, normaliseWeights } from '../src/services/recommendation/weights.js';

const poi = (over = {}) => ({ popularity: 4.5, costTier: 0, avgVisitMinutes: 60, ...over });

describe('scoring factors', () => {
  it('popularity maps the 1-5 rating onto 0..1', () => {
    expect(popularityFactor({ popularity: 1 })).toBe(0);
    expect(popularityFactor({ popularity: 3 })).toBe(0.5);
    expect(popularityFactor({ popularity: 5 })).toBe(1);
    expect(popularityFactor({ popularity: 9 })).toBe(1);   // clamped
    expect(popularityFactor({})).toBe(0);                  // missing
  });

  it('cost rewards cheaper stops and treats unknown tiers as mid-priced', () => {
    expect(costFactor({ costTier: 0 })).toBeGreaterThan(costFactor({ costTier: 1 }));
    expect(costFactor({ costTier: 1 })).toBeGreaterThan(costFactor({ costTier: 2 }));
    expect(costFactor({ costTier: 2 })).toBeGreaterThan(costFactor({ costTier: 3 }));
    expect(costFactor({})).toBe(costFactor({ costTier: 2 }));
  });

  it('detour is 1 with none, 0 at the maximum, and linear between', () => {
    expect(detourFactor(0)).toBe(1);
    expect(detourFactor(MAX_DETOUR_MINUTES / 2)).toBe(0.5);
    expect(detourFactor(MAX_DETOUR_MINUTES)).toBe(0);
    expect(detourFactor(500)).toBe(0);
    expect(detourFactor(-5)).toBe(1);
    expect(detourFactor(NaN)).toBe(0);
  });

  describe('duration fit', () => {
    it('peaks when the stop uses the ideal share of the free time', () => {
      const ideal = durationFactor(poi({ avgVisitMinutes: 75 }), 100, 0);
      expect(ideal.utilisation).toBeCloseTo(IDEAL_UTILISATION, 10);
      expect(ideal.factor).toBeCloseTo(1, 10);
      expect(ideal.fits).toBe(true);
    });

    it('scores a stop that wastes the gap, or only just squeezes in, lower than an ideal one', () => {
      const ideal = durationFactor(poi({ avgVisitMinutes: 75 }), 100).factor;
      expect(durationFactor(poi({ avgVisitMinutes: 20 }), 100).factor).toBeLessThan(ideal);
      expect(durationFactor(poi({ avgVisitMinutes: 100 }), 100).factor).toBeLessThan(ideal);
    });

    it('counts the detour as time needed', () => {
      expect(durationFactor(poi({ avgVisitMinutes: 90 }), 100, 5).fits).toBe(true);
      expect(durationFactor(poi({ avgVisitMinutes: 90 }), 100, 15).fits).toBe(false);
    });

    it('does not fit when there is no free time or the visit is too long', () => {
      expect(durationFactor(poi({ avgVisitMinutes: 120 }), 60)).toMatchObject({ factor: 0, fits: false });
      expect(durationFactor(poi(), 0)).toMatchObject({ factor: 0, fits: false });
      expect(durationFactor(poi(), undefined)).toMatchObject({ fits: false });
      expect(durationFactor({}, 100)).toMatchObject({ fits: false });
    });
  });
});

describe('calculateScore', () => {
  const ctx = { detourMinutes: 6, availableMinutes: 90 };

  it('returns a 0-100 score, the four factors and whether the stop fits', () => {
    const r = calculateScore(poi(), ctx);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(Object.keys(r.factors).sort()).toEqual(['cost', 'detour', 'duration', 'popularity']);
    expect(r.fits).toBe(true);
  });

  it('gives a perfect stop a perfect score', () => {
    const perfect = poi({ popularity: 5, costTier: 0, avgVisitMinutes: 75 });
    expect(calculateScore(perfect, { detourMinutes: 0, availableMinutes: 100 }).score).toBe(100);
  });

  it('is the weighted sum of the factors', () => {
    const r = calculateScore(poi(), ctx, DEFAULT_WEIGHTS);
    const expected = 100 * (
      DEFAULT_WEIGHTS.popularity * r.factors.popularity +
      DEFAULT_WEIGHTS.cost * r.factors.cost +
      DEFAULT_WEIGHTS.duration * r.factors.duration +
      DEFAULT_WEIGHTS.detour * r.factors.detour
    );
    expect(r.score).toBeCloseTo(expected, 1);
  });

  it('ranks a more popular stop higher, all else equal', () => {
    expect(calculateScore(poi({ popularity: 4.8 }), ctx).score)
      .toBeGreaterThan(calculateScore(poi({ popularity: 3.5 }), ctx).score);
  });

  it('ranks a cheaper stop higher, all else equal', () => {
    expect(calculateScore(poi({ costTier: 0 }), ctx).score)
      .toBeGreaterThan(calculateScore(poi({ costTier: 3 }), ctx).score);
  });

  it('ranks a smaller detour higher, all else equal', () => {
    expect(calculateScore(poi(), { ...ctx, detourMinutes: 2 }).score)
      .toBeGreaterThan(calculateScore(poi(), { ...ctx, detourMinutes: 30 }).score);
  });

  it('changing the weights changes which stop wins', () => {
    const famousButPricey = poi({ popularity: 5, costTier: 3 });
    const modestButFree = poi({ popularity: 3, costTier: 0 });
    const loveFame = normaliseWeights({ popularity: 10, cost: 0, duration: 0, detour: 0 });
    const loveFree = normaliseWeights({ popularity: 0, cost: 10, duration: 0, detour: 0 });

    expect(calculateScore(famousButPricey, ctx, loveFame).score)
      .toBeGreaterThan(calculateScore(modestButFree, ctx, loveFame).score);
    expect(calculateScore(modestButFree, ctx, loveFree).score)
      .toBeGreaterThan(calculateScore(famousButPricey, ctx, loveFree).score);
  });

  it('flags a stop that does not fit', () => {
    expect(calculateScore(poi({ avgVisitMinutes: 300 }), ctx).fits).toBe(false);
  });

  it('survives missing context', () => {
    expect(() => calculateScore(poi(), undefined)).not.toThrow();
    expect(calculateScore(poi(), undefined).fits).toBe(false);
  });
});
