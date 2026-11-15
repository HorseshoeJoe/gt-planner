import { describe, it, expect } from 'vitest';
import { DEFAULT_WEIGHTS, FACTORS, normaliseWeights, WeightError } from '../src/services/recommendation/weights.js';

const sum = (w) => FACTORS.reduce((s, f) => s + w[f], 0);

describe('weights', () => {
  it('defaults sum to 1', () => {
    expect(sum(DEFAULT_WEIGHTS)).toBeCloseTo(1, 10);
  });

  it('returns the defaults when nothing is supplied', () => {
    expect(normaliseWeights()).toEqual(expect.objectContaining(DEFAULT_WEIGHTS));
    expect(normaliseWeights({})).toEqual(expect.objectContaining(DEFAULT_WEIGHTS));
  });

  it('normalises relative values so they sum to 1', () => {
    const w = normaliseWeights({ popularity: 10, cost: 10, duration: 0, detour: 0 });
    expect(w).toEqual({ popularity: 0.5, cost: 0.5, duration: 0, detour: 0 });
  });

  it('accepts numeric strings, as query parameters arrive', () => {
    const w = normaliseWeights({ popularity: '1', cost: '1', duration: '1', detour: '1' });
    FACTORS.forEach((f) => expect(w[f]).toBeCloseTo(0.25, 10));
  });

  it('lets a member favour one factor over the others', () => {
    const w = normaliseWeights({ cost: 10 });
    expect(w.cost).toBeGreaterThan(w.popularity);
    expect(sum(w)).toBeCloseTo(1, 10);
  });

  it('rejects negative, non-numeric and all-zero weights', () => {
    expect(() => normaliseWeights({ cost: -1 })).toThrow(WeightError);
    expect(() => normaliseWeights({ cost: 'lots' })).toThrow(WeightError);
    expect(() => normaliseWeights({ popularity: 0, cost: 0, duration: 0, detour: 0 })).toThrow(/at least one/i);
  });
});
