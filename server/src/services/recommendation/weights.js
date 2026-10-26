/**
 * Scoring weights for Smart Attraction Suggestions (proposal section 3.1:
 * "members can adjust the relative weighting of the scoring factors").
 *
 * Weights are *relative*: callers may pass any non-negative numbers (for
 * example 0-10 slider values) and they are normalised to sum to 1.
 */

export const FACTORS = ['popularity', 'cost', 'duration', 'detour'];

export const DEFAULT_WEIGHTS = Object.freeze({
  popularity: 0.35,
  cost: 0.2,
  duration: 0.2,
  detour: 0.25,
});

export class WeightError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WeightError';
  }
}

/**
 * Validates and normalises a (possibly partial) weights object.
 * Missing factors keep their default value before normalising.
 * @throws {WeightError} for negative or non-numeric values, or all-zero weights.
 */
export function normaliseWeights(input = {}) {
  const merged = {};
  for (const factor of FACTORS) {
    const raw = input?.[factor];
    if (raw === undefined || raw === null || raw === '') {
      merged[factor] = DEFAULT_WEIGHTS[factor];
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      throw new WeightError(`Weight for "${factor}" must be a number that is zero or greater.`);
    }
    merged[factor] = value;
  }

  const total = FACTORS.reduce((sum, f) => sum + merged[f], 0);
  if (total <= 0) throw new WeightError('At least one weight must be greater than zero.');

  return Object.fromEntries(FACTORS.map((f) => [f, merged[f] / total]));
}
