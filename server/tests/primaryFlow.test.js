import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { clearAll } from '../src/db/store.js';
import { poisForDestination } from '../src/db/pois.js';

/**
 * PRIMARY USER FLOW - Phase I acceptance test.
 *
 * One narrative, run in order, exactly as a group would use the product:
 *   register -> create trip -> invite by code -> collaborate on the plan
 *   -> hit and override a schedule conflict -> track the budget
 *   -> read the consolidated itinerary -> confirm the trip is ready for the
 *      Phase II suggestion engine (destination POI pool + located attractions).
 *
 * Each step depends on the one before it, so a failure points at the exact
 * point where the flow breaks.
 */
describe('Primary user flow: plan a group trip end to end', () => {
  let app, henry, hanpin, tripId, inviteCode;
  const auth = (who) => ({ Authorization: `Bearer ${who.token}` });
  const T = () => `/api/trips/${tripId}`;

  beforeAll(() => {
    clearAll();
    app = createApp();
  });

  it('1. two travellers register', async () => {
    for (const name of ['henry', 'hanpin']) {
      const res = await request(app).post('/api/auth/register').send({
        username: name, email: `${name}@example.com`, password: 'Password123', displayName: name,
      });
      expect(res.status).toBe(201);
      if (name === 'henry') henry = res.body; else hanpin = res.body;
    }
  });

  it('2. one creates a trip and becomes its admin', async () => {
    const res = await request(app).post('/api/trips').set(auth(henry)).send({
      title: 'Tokyo Trip', destination: 'Tokyo, Japan', startDate: '2026-09-14', endDate: '2026-09-17',
    });
    expect(res.status).toBe(201);
    tripId = res.body._id;
    inviteCode = res.body.inviteCode;
    expect(res.body.members[0].role).toBe('admin');
  });

  it('3. the other joins with the 8-character invite code', async () => {
    const res = await request(app).post('/api/trips/join').set(auth(hanpin)).send({ inviteCode });
    expect(res.status).toBe(200);
    const members = await request(app).get(`${T()}/members`).set(auth(henry));
    expect(members.body.counts.joined).toBe(2);
  });

  it('4. both members add attractions, a restaurant and transport', async () => {
    const a = await request(app).post(`${T()}/attractions`).set(auth(henry)).send({
      name: 'Senso-ji Temple', rating: 5, visitDate: '2026-09-15',
      latitude: 35.7148, longitude: 139.7967, poiId: 'tokyo-senso-ji-temple',
    });
    const b = await request(app).post(`${T()}/attractions`).set(auth(hanpin)).send({
      name: 'Ueno Park', rating: 4, visitDate: '2026-09-15', latitude: 35.7148, longitude: 139.7737,
    });
    const r = await request(app).post(`${T()}/restaurants`).set(auth(hanpin)).send({
      name: 'Ichiran Shibuya', cuisine: 'Ramen', priceRange: '$$',
    });
    const t = await request(app).post(`${T()}/transportation`).set(auth(henry)).send({
      type: 'flight', provider: 'Air Canada', departureTime: '2026-09-14T09:00',
    });
    [a, b, r, t].forEach((res) => expect(res.status).toBe(201));
  });

  it('5. the shared itinerary accepts activities from both members', async () => {
    const one = await request(app).post(`${T()}/itinerary/2026-09-15/activities`).set(auth(henry))
      .send({ title: 'Senso-ji Temple', startTime: '09:00', endTime: '11:00', category: 'sightseeing' });
    const two = await request(app).post(`${T()}/itinerary/2026-09-15/activities`).set(auth(hanpin))
      .send({ title: 'Ueno Park', startTime: '13:00', endTime: '15:00', category: 'sightseeing' });
    expect(one.status).toBe(201);
    expect(two.status).toBe(201);
    expect(two.body.activities.map((x) => x.title)).toEqual(['Senso-ji Temple', 'Ueno Park']);
  });

  it('6. an overlapping activity is blocked, names the clash, and can be saved anyway', async () => {
    const body = { title: 'Early lunch', startTime: '10:30', endTime: '11:30', category: 'food' };
    const blocked = await request(app).post(`${T()}/itinerary/2026-09-15/activities`).set(auth(hanpin)).send(body);
    expect(blocked.status).toBe(409);
    expect(blocked.body.conflicts[0].title).toBe('Senso-ji Temple');

    const forced = await request(app).post(`${T()}/itinerary/2026-09-15/activities`).set(auth(hanpin))
      .send({ ...body, force: true });
    expect(forced.status).toBe(201);
  });

  it('7. the budget splits evenly and the balances reconcile to the cent', async () => {
    const res = await request(app).post(`${T()}/budget`).set(auth(henry)).send({
      description: 'Hotel', category: 'accommodation', estimatedAmount: 100, actualAmount: 100.01, splitEvenly: true,
    });
    expect(res.status).toBe(201);
    const { perMember, totalActual } = res.body.summary;
    expect(perMember).toHaveLength(2);
    expect(perMember.reduce((s, m) => s + m.owed, 0)).toBeCloseTo(totalActual, 2);
    expect(perMember.reduce((s, m) => s + m.balance, 0)).toBeCloseTo(0, 2);
  });

  it('8. the full itinerary pulls every section together in date order', async () => {
    const res = await request(app).get(`${T()}/full-itinerary`).set(auth(hanpin));
    expect(res.status).toBe(200);
    expect(res.body.days.map((d) => d.date)).toEqual(['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17']);
    const day = res.body.days.find((d) => d.date === '2026-09-15');
    expect(day.activities.length).toBe(3);
    expect(day.attractions.map((a) => a.name)).toEqual(expect.arrayContaining(['Senso-ji Temple', 'Ueno Park']));
    expect(res.body.days[0].transportation).toHaveLength(1);
    expect(res.body.unscheduled.restaurants).toHaveLength(1);
    expect(res.body.budget.itemCount).toBe(1);
  });

  it('9. the trip is ready for Phase II: it has a POI pool and located attractions', async () => {
    const trip = await request(app).get(T()).set(auth(henry));
    expect(poisForDestination(trip.body.destination).length).toBeGreaterThanOrEqual(100);

    const attractions = await request(app).get(`${T()}/attractions`).set(auth(henry));
    const located = attractions.body.filter((a) => a.latitude != null && a.longitude != null);
    expect(located.length).toBeGreaterThanOrEqual(2);
  });

  it('10. a non-member cannot see any of it', async () => {
    const stranger = (await request(app).post('/api/auth/register').send({
      username: 'stranger', email: 'stranger@example.com', password: 'Password123',
    })).body;
    expect((await request(app).get(`${T()}/full-itinerary`).set(auth(stranger))).status).toBe(403);
  });
});
