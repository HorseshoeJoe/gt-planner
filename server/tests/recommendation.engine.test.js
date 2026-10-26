import { describe, it, expect } from 'vitest';
import {
  RecommendationEngine, rankSuggestions, buildDayGaps, describeReason, normaliseName,
  DEFAULT_GAP_MINUTES, DAY_END_MINUTES,
} from '../src/services/recommendation/engine.js';
import { normaliseWeights } from '../src/services/recommendation/weights.js';

const trip = { destination: 'Tokyo, Japan', startDate: '2026-09-14', endDate: '2026-09-16' };
const DAY = '2026-09-15';

const sensoji = { _id: 'a1', name: 'Senso-ji Temple', visitDate: DAY, latitude: 35.7148, longitude: 139.7967, poiId: 'tokyo-senso-ji-temple' };
const teamlab = { _id: 'a2', name: 'teamLab Planets', visitDate: DAY, latitude: 35.6492, longitude: 139.7896 };
const activities = {
  [DAY]: [
    { title: 'Senso-ji Temple', startTime: '09:00', endTime: '11:00' },
    { title: 'teamLab Planets', startTime: '15:00', endTime: '17:00' },
  ],
};

const engine = new RecommendationEngine();
const run = (over = {}) => engine.generateSuggestions({ trip, attractions: [sensoji, teamlab], activitiesByDate: activities, ...over });
const day = (result, date = DAY) => result.days.find((d) => d.date === date);

describe('normaliseName', () => {
  it('treats punctuation and case differences as the same place', () => {
    expect(normaliseName('Senso-ji Temple')).toBe(normaliseName('senso ji  TEMPLE!'));
    expect(normaliseName(undefined)).toBe('');
  });
});

describe('rankSuggestions', () => {
  const s = (name, score, detourMinutes = 5, popularity = 4) => ({ score, detourMinutes, poi: { name, popularity } });

  it('orders by score, best first, without mutating the input', () => {
    const input = [s('B', 60), s('A', 90), s('C', 75)];
    expect(rankSuggestions(input).map((x) => x.poi.name)).toEqual(['A', 'C', 'B']);
    expect(input.map((x) => x.poi.name)).toEqual(['B', 'A', 'C']);
  });

  it('breaks ties by smaller detour, then popularity, then name', () => {
    expect(rankSuggestions([s('X', 80, 10), s('Y', 80, 4)]).map((x) => x.poi.name)).toEqual(['Y', 'X']);
    expect(rankSuggestions([s('X', 80, 5, 4.0), s('Y', 80, 5, 4.8)]).map((x) => x.poi.name)).toEqual(['Y', 'X']);
    expect(rankSuggestions([s('Zed', 80), s('Alpha', 80)]).map((x) => x.poi.name)).toEqual(['Alpha', 'Zed']);
  });

  it('honours the limit', () => {
    expect(rankSuggestions([s('A', 3), s('B', 2), s('C', 1)], 2)).toHaveLength(2);
  });
});

describe('describeReason', () => {
  const between = { type: 'between', from: { name: 'Senso-ji' }, to: { name: 'Ueno Park' } };
  it('matches the proposal wording for a stop between two attractions', () => {
    expect(describeReason(12, between)).toBe('12 minutes off your route between Senso-ji and Ueno Park');
  });
  it('says so when the stop is effectively on the route', () => {
    expect(describeReason(0.4, between)).toBe('Right on your route between Senso-ji and Ueno Park');
  });
  it('describes the end-of-day case', () => {
    expect(describeReason(9, { type: 'after', from: { name: 'Senso-ji' }, to: null })).toBe('9 minutes from Senso-ji');
  });
});

describe('buildDayGaps', () => {
  it('measures the gap from the scheduled activity times', () => {
    const { gaps } = buildDayGaps([sensoji, teamlab], activities[DAY]);
    const between = gaps.find((g) => g.type === 'between');
    expect(between.availableMinutes).toBe(240);              // 11:00 -> 15:00
    expect(between.from.name).toBe('Senso-ji Temple');
    expect(between.to.name).toBe('teamLab Planets');
  });

  it('adds an end-of-day gap after the last attraction', () => {
    const after = buildDayGaps([sensoji, teamlab], activities[DAY]).gaps.find((g) => g.type === 'after');
    expect(after.from.name).toBe('teamLab Planets');
    expect(after.availableMinutes).toBe(DAY_END_MINUTES - 17 * 60);
  });

  it('orders attractions by their scheduled time, not insertion order', () => {
    const { anchors } = buildDayGaps([teamlab, sensoji], activities[DAY]);
    expect(anchors.map((a) => a.name)).toEqual(['Senso-ji Temple', 'teamLab Planets']);
  });

  it('falls back to a default gap when times are unknown', () => {
    const { gaps } = buildDayGaps([sensoji, teamlab], []);
    expect(gaps.every((g) => g.availableMinutes === DEFAULT_GAP_MINUTES)).toBe(true);
  });

  it('ignores attractions without coordinates', () => {
    const { anchors } = buildDayGaps([sensoji, { _id: 'x', name: 'Mystery', visitDate: DAY }], []);
    expect(anchors).toHaveLength(1);
  });

  it('drops gaps with no free time', () => {
    const back2back = [
      { title: 'Senso-ji Temple', startTime: '09:00', endTime: '11:00' },
      { title: 'teamLab Planets', startTime: '11:00', endTime: '13:00' },
    ];
    expect(buildDayGaps([sensoji, teamlab], back2back).gaps.some((g) => g.type === 'between')).toBe(false);
  });
});

describe('generateSuggestions', () => {
  it('returns one entry for every day of the trip', () => {
    expect(run().days.map((d) => d.date)).toEqual(['2026-09-14', '2026-09-15', '2026-09-16']);
  });

  it('suggests nearby stops between two scheduled attractions, best first', () => {
    const { suggestions } = day(run());
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(5);
    const scores = suggestions.map((x) => x.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(suggestions[0].gap.type).toBe('between');
    expect(suggestions[0].reason).toMatch(/off your route between Senso-ji Temple and teamLab Planets|Right on your route/);
  });

  it('carries everything the UI needs to show and add a suggestion', () => {
    const s = day(run()).suggestions[0];
    expect(s.poi).toMatchObject({ id: expect.any(String), name: expect.any(String), latitude: expect.any(Number), longitude: expect.any(Number) });
    expect(Object.keys(s.factors).sort()).toEqual(['cost', 'detour', 'duration', 'popularity']);
    expect(s.score).toBeGreaterThan(0);
    expect(s.detourMinutes).toBeGreaterThanOrEqual(0);
  });

  it('never suggests something already planned as an attraction or a poiId', () => {
    const names = day(run()).suggestions.map((s) => s.poi.name);
    expect(names).not.toContain('Senso-ji Temple');
    expect(names).not.toContain('teamLab Planets');   // matched by name, no poiId
  });

  it('never suggests something already in the itinerary as an activity', () => {
    const withActivity = { ...activities, [DAY]: [...activities[DAY], { title: 'Ueno Park', startTime: '12:00', endTime: '13:00' }] };
    const names = day(run({ activitiesByDate: withActivity }), DAY).suggestions.map((s) => s.poi.name);
    expect(names).not.toContain('Ueno Park');
  });

  it('never suggests a dismissed stop', () => {
    const first = day(run()).suggestions[0].poi.id;
    const ids = day(run({ dismissedPoiIds: [first] })).suggestions.map((s) => s.poi.id);
    expect(ids).not.toContain(first);
  });

  it('suggests each stop at most once per day', () => {
    const ids = day(run({ limitPerDay: 50 })).suggestions.map((s) => s.poi.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('honours limitPerDay', () => {
    expect(day(run({ limitPerDay: 2 })).suggestions).toHaveLength(2);
  });

  it('explains days that have nothing to anchor suggestions to', () => {
    const empty = day(run(), '2026-09-14');
    expect(empty.suggestions).toEqual([]);
    expect(empty.note).toMatch(/add an attraction/i);
  });

  it('works with a single located attraction (suggests what is near it)', () => {
    const r = run({ attractions: [sensoji], activitiesByDate: {} });
    const s = day(r).suggestions;
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((x) => x.gap.type === 'after' && x.gap.to === null)).toBe(true);
  });

  it('only suggests stops that fit the free time', () => {
    const tight = { [DAY]: [
      { title: 'Senso-ji Temple', startTime: '09:00', endTime: '11:00' },
      { title: 'teamLab Planets', startTime: '11:45', endTime: '13:00' },   // 45 min gap
    ] };
    const r = run({ activitiesByDate: tight });
    const between = day(r).suggestions.filter((s) => s.gap.type === 'between');
    between.forEach((s) => expect(s.poi.avgVisitMinutes + s.detourMinutes).toBeLessThanOrEqual(45 + 1));
  });

  it('re-ranks when the group changes the weights', () => {
    const loveFree = normaliseWeights({ popularity: 0, cost: 10, duration: 0, detour: 0 });
    const lovePopular = normaliseWeights({ popularity: 10, cost: 0, duration: 0, detour: 0 });
    const free = day(run({ weights: loveFree })).suggestions;
    const popular = day(run({ weights: lovePopular })).suggestions;

    expect(free[0].poi.costTier).toBe(0);
    expect(popular[0].poi.popularity).toBeGreaterThanOrEqual(free[0].poi.popularity);
    expect(free.map((s) => s.poi.id)).not.toEqual(popular.map((s) => s.poi.id));
  });

  it('returns an empty, explained result for a destination with no POI data', () => {
    const r = engine.generateSuggestions({ trip: { ...trip, destination: 'Atlantis' }, attractions: [sensoji], activitiesByDate: {} });
    expect(r.meta.poolSize).toBe(0);
    r.days.forEach((d) => expect(d.suggestions).toEqual([]));
  });

  it('accepts a custom POI provider', () => {
    const custom = new RecommendationEngine({
      poiProvider: () => [{ id: 'x-1', name: 'Test Cafe', category: 'food', popularity: 4, costTier: 0, avgVisitMinutes: 60, latitude: 35.70, longitude: 139.78 }],
    });
    const r = custom.generateSuggestions({ trip, attractions: [sensoji, teamlab], activitiesByDate: activities });
    expect(day(r).suggestions.map((s) => s.poi.id)).toEqual(['x-1']);
  });

  it('skips POIs that have no coordinates', () => {
    const custom = new RecommendationEngine({ poiProvider: () => [{ id: 'bad', name: 'Nowhere', popularity: 5, costTier: 0, avgVisitMinutes: 30 }] });
    expect(custom.generateSuggestions({ trip, attractions: [sensoji], activitiesByDate: {} }).meta.poolSize).toBe(0);
  });
});

describe('performance (proposal 3.2: under 2 seconds for 100+ POIs)', () => {
  it('generates a full trip in well under 2 seconds against the real 100+ POI pool', () => {
    const r = run();
    expect(r.meta.poolSize).toBeGreaterThanOrEqual(100);
    expect(r.meta.elapsedMs).toBeLessThan(2000);
  });

  it('stays under 2 seconds with a 1,000-POI pool and a busy 7-day trip', () => {
    const big = Array.from({ length: 1000 }, (_, i) => ({
      id: `p-${i}`, name: `Place ${i}`, category: 'park', popularity: 1 + (i % 5), costTier: i % 4,
      avgVisitMinutes: 30 + (i % 6) * 15,
      latitude: 35.55 + ((i * 7919) % 300) / 1000, longitude: 139.45 + ((i * 104729) % 500) / 1000,
    }));
    const attractions = [];
    const acts = {};
    for (let d = 14; d <= 20; d += 1) {
      const date = `2026-09-${d}`;
      attractions.push({ _id: `${d}a`, name: `A${d}`, visitDate: date, latitude: 35.68, longitude: 139.70 });
      attractions.push({ _id: `${d}b`, name: `B${d}`, visitDate: date, latitude: 35.71, longitude: 139.80 });
      attractions.push({ _id: `${d}c`, name: `C${d}`, visitDate: date, latitude: 35.65, longitude: 139.75 });
      acts[date] = [{ title: `A${d}`, startTime: '09:00', endTime: '10:30' }, { title: `B${d}`, startTime: '13:00', endTime: '14:00' }, { title: `C${d}`, startTime: '17:00', endTime: '18:00' }];
    }
    const started = performance.now();
    const r = new RecommendationEngine({ poiProvider: () => big })
      .generateSuggestions({ trip: { destination: 'Big', startDate: '2026-09-14', endDate: '2026-09-20' }, attractions, activitiesByDate: acts });
    expect(performance.now() - started).toBeLessThan(2000);
    expect(r.days).toHaveLength(7);
  });
});
