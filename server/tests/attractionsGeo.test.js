import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { clearAll } from '../src/db/store.js';

describe('attraction location fields (CPAN 324)', () => {
  let app, token, tripId;
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const post = (body) => request(app).post(`/api/trips/${tripId}/attractions`).set(auth()).send(body);

  beforeAll(async () => {
    clearAll();
    app = createApp();
    const reg = await request(app).post('/api/auth/register').send({
      username: 'henry', email: 'henry@example.com', password: 'Password123', displayName: 'Henry',
    });
    token = reg.body.token;
    const trip = await request(app).post('/api/trips').set(auth()).send({
      title: 'Tokyo', destination: 'Tokyo, Japan', startDate: '2026-09-14', endDate: '2026-09-17',
    });
    tripId = trip.body._id;
  });

  it('stores latitude, longitude and poiId', async () => {
    const res = await post({ name: 'Senso-ji', latitude: 35.7148, longitude: 139.7967, poiId: 'tokyo-senso-ji-temple' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ latitude: 35.7148, longitude: 139.7967, poiId: 'tokyo-senso-ji-temple' });
  });

  it('still accepts attractions with no location', async () => {
    expect((await post({ name: 'Somewhere nice' })).status).toBe(201);
  });

  it('rejects a lone coordinate and out-of-range values', async () => {
    expect((await post({ name: 'x', latitude: 35 })).status).toBe(400);
    expect((await post({ name: 'x', latitude: 95, longitude: 10 })).status).toBe(400);
    expect((await post({ name: 'x', latitude: 10, longitude: 200 })).status).toBe(400);
    expect((await post({ name: 'x', latitude: 'abc', longitude: 10 })).status).toBe(400);
  });
});
