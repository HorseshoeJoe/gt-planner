import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Overpass is a live public service; tests control exactly what it returns.
const overpass = vi.hoisted(() => ({ fetch: vi.fn(async () => []) }));
vi.mock('../src/services/poiService.js', () => ({
  fetchPOIsForDestination: (...args) => overpass.fetch(...args),
  clearPOICache: () => {},
}));

import { createApp } from '../src/app.js';
import { clearAll } from '../src/db/store.js';

/**
 * Integration: the suggestion panel's API (GET ?date=, PUT /weights,
 * POST /dismiss) running on the RecommendationEngine, through the real
 * Express app, auth, JSON store, curated POI data and the Overpass adapter.
 */
describe('Suggestions API (engine + weights + dismissals)', () => {
  let app, henry, hanpin, stranger, tripId, quietTripId, atlantisId;
  const DAY = '2026-09-15';
  const auth = (who) => ({ Authorization: `Bearer ${who.token}` });
  const get = (id, qs = `?date=${DAY}`, who = henry) => request(app).get(`/api/trips/${id}/suggestions${qs}`).set(auth(who));
  const names = (res) => res.body.suggestions.map((s) => s.name);
  const register = async (u) => (await request(app).post('/api/auth/register').send({ username: u, email: `${u}@example.com`, password: 'Password123' })).body;

  beforeAll(async () => {
    clearAll();
    app = createApp();
    henry = await register('henry');
    hanpin = await register('hanpin');
    stranger = await register('stranger');

    const mk = async (b) => (await request(app).post('/api/trips').set(auth(henry)).send(b)).body._id;
    tripId = await mk({ title: 'Tokyo', destination: 'Tokyo, Japan', startDate: '2026-09-14', endDate: '2026-09-16' });
    quietTripId = await mk({ title: 'Quiet', destination: 'Tokyo', startDate: '2026-09-14', endDate: '2026-09-15' });
    atlantisId = await mk({ title: 'Atlantis', destination: 'Atlantis', startDate: '2026-09-14', endDate: '2026-09-15' });

    const code = (await request(app).get(`/api/trips/${tripId}`).set(auth(henry))).body.inviteCode;
    await request(app).post('/api/trips/join').set(auth(hanpin)).send({ inviteCode: code });

    const add = (path, body) => request(app).post(`/api/trips/${tripId}/${path}`).set(auth(henry)).send(body);
    await add('attractions', { name: 'Senso-ji Temple', visitDate: DAY, latitude: 35.7148, longitude: 139.7967, poiId: 'tokyo-senso-ji-temple' });
    await add('attractions', { name: 'teamLab Planets', visitDate: DAY, latitude: 35.6492, longitude: 139.7896 });
    await add(`itinerary/${DAY}/activities`, { title: 'Senso-ji Temple', startTime: '09:00', endTime: '11:00' });
    await add(`itinerary/${DAY}/activities`, { title: 'teamLab Planets', startTime: '15:00', endTime: '17:00' });
  });

  beforeEach(() => { overpass.fetch.mockReset(); overpass.fetch.mockResolvedValue([]); });

  it('keeps the existing access rules and input checks', async () => {
    expect((await request(app).get(`/api/trips/${tripId}/suggestions?date=${DAY}`)).status).toBe(401);
    expect((await get('nope')).status).toBe(404);
    expect((await get(tripId, `?date=${DAY}`, stranger)).status).toBe(403);
    expect((await get(tripId, '')).status).toBe(400);
    expect((await get(tripId, '?date=tomorrow')).status).toBe(400);
  });

  it('ranks stops that fit the gap between two scheduled attractions', async () => {
    const res = await get(tripId);
    expect(res.status).toBe(200);
    expect(res.body.suggestions.length).toBeGreaterThan(0);
    expect(res.body.suggestions.length).toBeLessThanOrEqual(10);
    const scores = res.body.suggestions.map((s) => s.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(res.body.suggestions[0].reason).toMatch(/Senso-ji Temple and teamLab Planets/);
    expect(res.body.meta.sources.curated).toBeGreaterThanOrEqual(100);
  });

  it('returns every field the suggestion panel reads, plus the engine detail', async () => {
    const s = (await get(tripId)).body.suggestions[0];
    expect(s).toMatchObject({
      id: expect.any(String), name: expect.any(String), score: expect.any(Number),
      reason: expect.any(String), estimatedDurationMinutes: expect.any(Number),
      detourMinutes: expect.any(Number), latitude: expect.any(Number), longitude: expect.any(Number),
    });
    expect(s.startTime).toMatch(/^\d{2}:\d{2}$/);
    expect(Object.keys(s.factors).sort()).toEqual(['cost', 'detour', 'duration', 'popularity']);
    expect(s.gap.type).toBe('between');
  });

  it('proposes a start time after the previous attraction ends', async () => {
    const s = (await get(tripId)).body.suggestions[0];
    expect(s.startTime > '11:00').toBe(true);
    expect(s.startTime < '15:00').toBe(true);
  });

  it('never suggests what is already planned', async () => {
    const all = names(await get(tripId));
    expect(all).not.toContain('Senso-ji Temple');
    expect(all).not.toContain('teamLab Planets');
  });

  it('re-ranks when the trip weights change (PUT /weights)', async () => {
    const before = await get(tripId);
    const put = await request(app).put(`/api/trips/${tripId}/suggestions/weights`).set(auth(hanpin))
      .send({ popularity: 0, cost: 100, duration: 0, detour: 0 });
    expect(put.status).toBe(200);

    const after = await get(tripId);
    expect(after.body.weights.cost).toBe(100);
    expect(names(after)).not.toEqual(names(before));
    expect(after.body.suggestions[0].estimatedCost).toBe('Free');

    await request(app).put(`/api/trips/${tripId}/suggestions/weights`).set(auth(henry))
      .send({ popularity: 25, cost: 25, duration: 25, detour: 25 });
  });

  it('leaves out dismissed suggestions (POST /dismiss) for the whole group', async () => {
    const first = (await get(tripId)).body.suggestions[0];
    const dismiss = await request(app).post(`/api/trips/${tripId}/suggestions/dismiss`).set(auth(hanpin))
      .send({ suggestionId: first.id });
    expect(dismiss.status).toBe(200);

    expect(names(await get(tripId, undefined, henry))).not.toContain(first.name);
  });

  it('adds Overpass places to the pool and scores them like any other', async () => {
    overpass.fetch.mockResolvedValue([{
      osmId: 424242, name: 'Riverside Shrine Garden', latitude: 35.6900, longitude: 139.7900,
      category: 'garden', estimatedCost: 0, estimatedDurationMinutes: 60, popularityScore: 0.9, website: 'https://example.org',
    }]);
    const res = await get(tripId);
    expect(res.body.meta.sources.overpass).toBe(1);
    const hit = res.body.suggestions.find((s) => s.name === 'Riverside Shrine Garden');
    expect(hit).toBeTruthy();
    expect(hit).toMatchObject({ id: '424242', source: 'overpass', website: 'https://example.org' });
  });

  it('still works when Overpass is down', async () => {
    overpass.fetch.mockRejectedValue(new Error('Overpass unavailable'));
    const res = await get(tripId);
    expect(res.status).toBe(200);
    expect(res.body.suggestions.length).toBeGreaterThan(0);
  });

  it('on a day with nothing scheduled, still offers popular stops and says why', async () => {
    const res = await get(quietTripId, '?date=2026-09-14');
    expect(res.status).toBe(200);
    expect(res.body.suggestions.length).toBeGreaterThan(0);
    expect(res.body.suggestions[0].reason).toMatch(/popular attraction/i);
    expect(res.body.note).toMatch(/add an attraction/i);
    expect(res.body.suggestions[0].gap).toBeNull();
  });

  it('works for a destination that only Overpass knows', async () => {
    overpass.fetch.mockResolvedValue([{
      osmId: 7, name: 'Old Harbour', latitude: 1.0, longitude: 1.0, category: 'attraction',
      estimatedCost: 0, estimatedDurationMinutes: 60, popularityScore: 0.5,
    }]);
    const res = await get(atlantisId, '?date=2026-09-14');
    expect(names(res)).toEqual(['Old Harbour']);
  });

  it('returns an empty list, not an error, when no data exists anywhere', async () => {
    const res = await get(atlantisId, '?date=2026-09-14');
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toEqual([]);
  });

  it('reacts to itinerary changes on the next request', async () => {
    const top = (await get(tripId)).body.suggestions[0];
    await request(app).post(`/api/trips/${tripId}/attractions`).set(auth(hanpin))
      .send({ name: top.name, visitDate: DAY, latitude: top.latitude, longitude: top.longitude });
    expect(names(await get(tripId))).not.toContain(top.name);
  });
});
