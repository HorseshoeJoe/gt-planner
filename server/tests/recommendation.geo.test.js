import { describe, it, expect } from 'vitest';
import {
  hasCoordinates, haversineKm, travelMinutes, travelMinutesBetween, detourMinutes,
} from '../src/services/recommendation/geo.js';

const sensoji = { latitude: 35.7148, longitude: 139.7967 };
const ueno = { latitude: 35.7148, longitude: 139.7737 };
const skytree = { latitude: 35.7101, longitude: 139.8107 };
const shibuya = { latitude: 35.6595, longitude: 139.7005 };

describe('geo: coordinates', () => {
  it('accepts valid pairs, including numeric strings', () => {
    expect(hasCoordinates(sensoji)).toBe(true);
    expect(hasCoordinates({ latitude: '35.7', longitude: '139.8' })).toBe(true);
    expect(hasCoordinates({ latitude: 0, longitude: 0 })).toBe(true);
  });

  it('rejects missing, partial, blank and out-of-range values', () => {
    expect(hasCoordinates(null)).toBe(false);
    expect(hasCoordinates({})).toBe(false);
    expect(hasCoordinates({ latitude: 35 })).toBe(false);
    expect(hasCoordinates({ latitude: '', longitude: '' })).toBe(false);
    expect(hasCoordinates({ latitude: 91, longitude: 10 })).toBe(false);
    expect(hasCoordinates({ latitude: 10, longitude: 181 })).toBe(false);
    expect(hasCoordinates({ latitude: 'x', longitude: 10 })).toBe(false);
  });
});

describe('geo: distance', () => {
  it('is zero for the same point and symmetric', () => {
    expect(haversineKm(sensoji, sensoji)).toBe(0);
    expect(haversineKm(sensoji, ueno)).toBeCloseTo(haversineKm(ueno, sensoji), 10);
  });

  it('matches a known real-world distance (Senso-ji to Ueno Park is about 2 km)', () => {
    expect(haversineKm(sensoji, ueno)).toBeGreaterThan(1.9);
    expect(haversineKm(sensoji, ueno)).toBeLessThan(2.2);
  });

  it('gives roughly 111 km per degree of latitude', () => {
    expect(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeCloseTo(111.2, 0);
  });
});

describe('geo: travel time', () => {
  it('is zero for no distance and for invalid input', () => {
    expect(travelMinutes(0)).toBe(0);
    expect(travelMinutes(-3)).toBe(0);
    expect(travelMinutes(NaN)).toBe(0);
  });

  it('walks short hops and uses transit for longer ones', () => {
    expect(travelMinutes(0.5)).toBe(6);        // walking
    expect(travelMinutes(10)).toBe(35);        // 5 + 10 * 3
  });

  it('never decreases as distance grows', () => {
    let previous = 0;
    for (let km = 0; km <= 30; km += 0.25) {
      const t = travelMinutes(km);
      expect(t).toBeGreaterThanOrEqual(previous);
      previous = t;
    }
  });

  it('estimates minutes between two points', () => {
    expect(travelMinutesBetween(sensoji, ueno)).toBeGreaterThan(5);
    expect(travelMinutesBetween(sensoji, ueno)).toBeLessThan(15);
  });
});

describe('geo: detour', () => {
  it('is small for a stop that sits on the route', () => {
    // Midway between Ueno and Senso-ji. Not zero: each extra leg pays the
    // fixed transit overhead, so even an on-route stop costs a few minutes.
    const midpoint = { latitude: 35.7148, longitude: 139.7852 };
    const onRoute = detourMinutes(ueno, midpoint, sensoji);
    expect(onRoute).toBeGreaterThan(0);
    expect(onRoute).toBeLessThan(8);
    expect(onRoute).toBeLessThan(detourMinutes(sensoji, shibuya, ueno));
  });

  it('is larger for a stop that is further off the route', () => {
    expect(detourMinutes(sensoji, shibuya, ueno)).toBeGreaterThan(detourMinutes(sensoji, skytree, ueno));
  });

  it('is never negative', () => {
    for (const poi of [ueno, skytree, shibuya, sensoji]) {
      expect(detourMinutes(sensoji, poi, ueno)).toBeGreaterThanOrEqual(0);
    }
  });

  it('with no destination is just the trip to the stop', () => {
    expect(detourMinutes(sensoji, ueno)).toBe(travelMinutesBetween(sensoji, ueno));
  });
});
