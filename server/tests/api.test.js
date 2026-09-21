import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { clearAll } from '../src/db/store.js';

/**
 * End-to-end tests against the real API and the real file store.
 * No database server is involved, so these run anywhere `npm install` works.
 */
describe('Group Travel Planner API', () => {
  let app;
  let henry;   // { token, user }
  let hanpin;
  let tripId;

  const auth = (who) => ({ Authorization: `Bearer ${who.token}` });

  async function register(username) {
    const res = await request(app).post('/api/auth/register').send({
      username,
      email: `${username}@example.com`,
      password: 'Password123',
      displayName: username,
    });
    expect(res.status).toBe(201);
    return res.body;
  }

  beforeAll(async () => {
    clearAll();
    app = createApp();
    henry = await register('henry');
    hanpin = await register('hanpin');
  });

  /* ---------------------------------------------------------------- */
  describe('health and routing', () => {
    it('responds to the health check', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('returns JSON for unknown routes', async () => {
      const res = await request(app).get('/api/nope');
      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/route not found/i);
    });
  });

  /* ---------------------------------------------------------------- */
  describe('authentication', () => {
    it('never returns the password hash', async () => {
      expect(henry.user.passwordHash).toBeUndefined();
      expect(henry.user.username).toBe('henry');
    });

    it('rejects a duplicate username', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'henry', email: 'other@example.com', password: 'Password123',
      });
      expect(res.status).toBe(409);
    });

    it('rejects a short password', async () => {
      const res = await request(app).post('/api/auth/register').send({
        username: 'shorty', email: 'shorty@example.com', password: 'abc',
      });
      expect(res.status).toBe(400);
    });

    it('signs in with a username and with an email', async () => {
      const byUsername = await request(app).post('/api/auth/login').send({ identifier: 'henry', password: 'Password123' });
      const byEmail = await request(app).post('/api/auth/login').send({ identifier: 'henry@example.com', password: 'Password123' });
      expect(byUsername.status).toBe(200);
      expect(byEmail.status).toBe(200);
      expect(byUsername.body.token).toBeTruthy();
    });

    it('rejects a wrong password without revealing which field was wrong', async () => {
      const res = await request(app).post('/api/auth/login').send({ identifier: 'henry', password: 'WrongPassword' });
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/incorrect username\/email or password/i);
    });

    it('restores a session from a token', async () => {
      const res = await request(app).get('/api/auth/me').set(auth(henry));
      expect(res.status).toBe(200);
      expect(res.body.user.username).toBe('henry');
    });

    it('rejects protected routes without or with a bad token', async () => {
      expect((await request(app).get('/api/trips')).status).toBe(401);
      expect((await request(app).get('/api/trips').set({ Authorization: 'Bearer nonsense' })).status).toBe(401);
    });
  });

  /* ---------------------------------------------------------------- */
  describe('trips and collaboration', () => {
    it('creates a trip with the creator as admin', async () => {
      const res = await request(app).post('/api/trips').set(auth(henry)).send({
        title: 'Tokyo Trip', destination: 'Tokyo, Japan',
        startDate: '2026-09-14', endDate: '2026-09-17',
      });
      expect(res.status).toBe(201);
      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0].role).toBe('admin');
      expect(res.body.members[0].status).toBe('joined');
      expect(res.body.inviteCode).toMatch(/^[A-Z2-9]{8}$/);
      tripId = res.body._id;
    });

    it('rejects an end date before the start date', async () => {
      const res = await request(app).post('/api/trips').set(auth(henry)).send({
        title: 'Backwards', destination: 'Nowhere', startDate: '2026-09-17', endDate: '2026-09-14',
      });
      expect(res.status).toBe(400);
    });

    it('hides the trip from a non-member', async () => {
      const res = await request(app).get(`/api/trips/${tripId}`).set(auth(hanpin));
      expect(res.status).toBe(403);
    });

    it('invites a member, who shows as pending until they accept', async () => {
      const invite = await request(app).post(`/api/trips/${tripId}/invite`).set(auth(henry)).send({ identifier: 'hanpin' });
      expect(invite.status).toBe(201);

      const members = await request(app).get(`/api/trips/${tripId}/members`).set(auth(henry));
      expect(members.body.counts).toEqual({ joined: 1, pending: 1, total: 2 });
      expect(members.body.members.find((m) => m.username === 'hanpin').status).toBe('pending');

      // A pending member still cannot read the trip contents.
      expect((await request(app).get(`/api/trips/${tripId}`).set(auth(hanpin))).status).toBe(403);
    });

    it('refuses to invite an unknown user or a duplicate', async () => {
      expect((await request(app).post(`/api/trips/${tripId}/invite`).set(auth(henry)).send({ identifier: 'ghost' })).status).toBe(404);
      expect((await request(app).post(`/api/trips/${tripId}/invite`).set(auth(henry)).send({ identifier: 'hanpin' })).status).toBe(409);
    });

    it('flips the member to joined when the invite code is redeemed', async () => {
      const { body: memberList } = await request(app).get(`/api/trips/${tripId}/members`).set(auth(henry));

      const join = await request(app).post('/api/trips/join').set(auth(hanpin)).send({ inviteCode: memberList.inviteCode });
      expect(join.status).toBe(200);

      const after = await request(app).get(`/api/trips/${tripId}/members`).set(auth(henry));
      expect(after.body.counts).toEqual({ joined: 2, pending: 0, total: 2 });
      expect((await request(app).get(`/api/trips/${tripId}`).set(auth(hanpin))).status).toBe(200);
    });

    it('rejects an unknown invite code', async () => {
      const res = await request(app).post('/api/trips/join').set(auth(hanpin)).send({ inviteCode: 'ZZZZZZZZ' });
      expect(res.status).toBe(404);
    });

    it('lets any member edit trip details and stamps who changed it', async () => {
      const res = await request(app).put(`/api/trips/${tripId}`).set(auth(hanpin)).send({ destination: 'Tokyo & Kyoto' });
      expect(res.status).toBe(200);
      expect(res.body.destination).toBe('Tokyo & Kyoto');
      expect(res.body.lastActivityBy.username).toBe('hanpin');
      expect(res.body.lastActivityLabel).toBe('Trip details updated');
    });

    it('lists the trip for both members with the right role', async () => {
      const forHenry = await request(app).get('/api/trips').set(auth(henry));
      const forHanpin = await request(app).get('/api/trips').set(auth(hanpin));
      expect(forHenry.body[0].myRole).toBe('admin');
      expect(forHanpin.body[0].myRole).toBe('member');
      expect(forHenry.body[0].memberCounts).toEqual({ joined: 2, pending: 0 });
    });

    it('only lets the creator remove members', async () => {
      const { body } = await request(app).get(`/api/trips/${tripId}/members`).set(auth(henry));
      const henryMembership = body.members.find((m) => m.username === 'henry');

      const asMember = await request(app).delete(`/api/trips/${tripId}/members/${henryMembership.membershipId}`).set(auth(hanpin));
      expect(asMember.status).toBe(403);

      const creatorSelf = await request(app).delete(`/api/trips/${tripId}/members/${henryMembership.membershipId}`).set(auth(henry));
      expect(creatorSelf.status).toBe(400); // the creator cannot be removed
    });
  });

  /* ---------------------------------------------------------------- */
  describe('itinerary builder and conflict detection', () => {
    const day = '2026-09-15';

    it('returns one entry per day of the trip', async () => {
      const res = await request(app).get(`/api/trips/${tripId}/itinerary`).set(auth(henry));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(4); // Sep 14, 15, 16, 17
      expect(res.body[0].activities).toEqual([]);
    });

    it('adds an activity', async () => {
      const res = await request(app).post(`/api/trips/${tripId}/itinerary/${day}/activities`).set(auth(henry))
        .send({ title: 'Senso-ji Temple', startTime: '09:00', endTime: '11:00', category: 'sightseeing' });
      expect(res.status).toBe(201);
      expect(res.body.activities).toHaveLength(1);
    });

    it('blocks an overlapping activity and names the clash', async () => {
      const res = await request(app).post(`/api/trips/${tripId}/itinerary/${day}/activities`).set(auth(hanpin))
        .send({ title: 'Museum', startTime: '10:00', endTime: '12:00' });
      expect(res.status).toBe(409);
      expect(res.body.conflicts).toHaveLength(1);
      expect(res.body.conflicts[0].title).toBe('Senso-ji Temple');
    });

    it('allows a back-to-back activity', async () => {
      const res = await request(app).post(`/api/trips/${tripId}/itinerary/${day}/activities`).set(auth(hanpin))
        .send({ title: 'Lunch in Asakusa', startTime: '11:00', endTime: '12:00', category: 'food' });
      expect(res.status).toBe(201);
      expect(res.body.activities).toHaveLength(2);
    });

    it('saves an overlapping activity when force is set', async () => {
      const res = await request(app).post(`/api/trips/${tripId}/itinerary/${day}/activities`).set(auth(hanpin))
        .send({ title: 'Split up: shopping', startTime: '10:00', endTime: '12:00', force: true });
      expect(res.status).toBe(201);
      expect(res.body.activities).toHaveLength(3);
    });

    it('keeps activities sorted by start time', async () => {
      const { body } = await request(app).get(`/api/trips/${tripId}/itinerary`).set(auth(henry));
      const times = body.find((d) => d.date === day).activities.map((a) => a.startTime);
      expect(times).toEqual([...times].sort());
    });

    it('rejects an end time before the start time', async () => {
      const res = await request(app).post(`/api/trips/${tripId}/itinerary/${day}/activities`).set(auth(henry))
        .send({ title: 'Time traveller', startTime: '14:00', endTime: '13:00' });
      expect(res.status).toBe(400);
    });

    it('edits an activity without it conflicting with itself', async () => {
      const { body } = await request(app).get(`/api/trips/${tripId}/itinerary`).set(auth(henry));
      const activity = body.find((d) => d.date === day).activities.find((a) => a.title === 'Senso-ji Temple');

      // 09:15-09:45 sits inside the activity's own former slot and touches
      // nothing else, so the only possible conflict is with itself.
      const res = await request(app).put(`/api/trips/${tripId}/itinerary/${day}/activities/${activity._id}`).set(auth(henry))
        .send({ startTime: '09:15', endTime: '09:45' });
      expect(res.status).toBe(200);
      expect(res.body.activities.find((a) => a.title === 'Senso-ji Temple').startTime).toBe('09:15');
    });

    it('still blocks an edit that moves an activity onto a different one', async () => {
      const { body } = await request(app).get(`/api/trips/${tripId}/itinerary`).set(auth(henry));
      const activity = body.find((d) => d.date === day).activities.find((a) => a.title === 'Senso-ji Temple');

      const res = await request(app).put(`/api/trips/${tripId}/itinerary/${day}/activities/${activity._id}`).set(auth(henry))
        .send({ startTime: '11:15', endTime: '11:45' }); // lands on "Lunch in Asakusa"
      expect(res.status).toBe(409);
      expect(res.body.conflicts.map((c) => c.title)).toContain('Lunch in Asakusa');
    });

    it('saves day notes and deletes an activity', async () => {
      const notes = await request(app).put(`/api/trips/${tripId}/itinerary/${day}/notes`).set(auth(henry)).send({ notes: 'Busy day.' });
      expect(notes.body.notes).toBe('Busy day.');

      const { body } = await request(app).get(`/api/trips/${tripId}/itinerary`).set(auth(henry));
      const target = body.find((d) => d.date === day).activities.find((a) => a.title === 'Split up: shopping');

      const del = await request(app).delete(`/api/trips/${tripId}/itinerary/${day}/activities/${target._id}`).set(auth(henry));
      expect(del.status).toBe(200);
      expect(del.body.activities).toHaveLength(2);
    });
  });

  /* ---------------------------------------------------------------- */
  describe('attractions, restaurants and transportation', () => {
    it('creates, lists, edits and deletes an attraction', async () => {
      const created = await request(app).post(`/api/trips/${tripId}/attractions`).set(auth(henry))
        .send({ name: 'Shibuya Sky', rating: 4, visitDate: '2026-09-15' });
      expect(created.status).toBe(201);

      const listed = await request(app).get(`/api/trips/${tripId}/attractions`).set(auth(hanpin));
      expect(listed.body).toHaveLength(1);

      const edited = await request(app).put(`/api/trips/${tripId}/attractions/${created.body._id}`).set(auth(hanpin))
        .send({ rating: 5 });
      expect(edited.body.rating).toBe(5);

      const deleted = await request(app).delete(`/api/trips/${tripId}/attractions/${created.body._id}`).set(auth(henry));
      expect(deleted.status).toBe(200);
      expect((await request(app).get(`/api/trips/${tripId}/attractions`).set(auth(henry))).body).toHaveLength(0);
    });

    it('requires a name for a restaurant', async () => {
      const res = await request(app).post(`/api/trips/${tripId}/restaurants`).set(auth(henry)).send({ cuisine: 'Ramen' });
      expect(res.status).toBe(400);
    });

    it('stores a transportation entry with a booking reference', async () => {
      const res = await request(app).post(`/api/trips/${tripId}/transportation`).set(auth(henry)).send({
        type: 'flight', provider: 'Air Canada AC001',
        fromLocation: 'Toronto (YYZ)', toLocation: 'Tokyo (HND)',
        departureTime: '2026-09-14T13:30', bookingReference: 'AC7X2Q',
      });
      expect(res.status).toBe(201);
      expect(res.body.bookingReference).toBe('AC7X2Q');
    });

    it('does not leak another trip\'s records', async () => {
      const other = await request(app).post('/api/trips').set(auth(henry)).send({
        title: 'Other trip', destination: 'Montreal', startDate: '2026-10-01', endDate: '2026-10-03',
      });
      const res = await request(app).get(`/api/trips/${other.body._id}/transportation`).set(auth(henry));
      expect(res.body).toHaveLength(0);
    });
  });

  /* ---------------------------------------------------------------- */
  describe('budget tracker', () => {
    let hotelId;

    it('adds an expense and returns the recalculated summary', async () => {
      const res = await request(app).post(`/api/trips/${tripId}/budget`).set(auth(henry)).send({
        description: 'Hotel — 3 nights', category: 'accommodation',
        estimatedAmount: 900, actualAmount: 870, paidBy: henry.user.userId,
      });
      expect(res.status).toBe(201);
      expect(res.body.summary.totalEstimated).toBe(900);
      expect(res.body.summary.totalActual).toBe(870);
      hotelId = res.body.item._id;
    });

    it('splits evenly across joined members and balances the ledger', async () => {
      await request(app).post(`/api/trips/${tripId}/budget`).set(auth(hanpin)).send({
        description: 'Return flights', category: 'transport',
        estimatedAmount: 2400, actualAmount: 2400, paidBy: hanpin.user.userId,
      });

      const { body } = await request(app).get(`/api/trips/${tripId}/budget`).set(auth(henry));
      expect(body.summary.totalActual).toBe(3270);
      expect(body.members).toHaveLength(2);

      const forHenry = body.summary.perMember.find((m) => m.userId === henry.user.userId);
      const forHanpin = body.summary.perMember.find((m) => m.userId === hanpin.user.userId);

      expect(forHenry.owed).toBe(1635);   // (870 + 2400) / 2
      expect(forHanpin.owed).toBe(1635);
      expect(forHenry.paid).toBe(870);
      expect(forHanpin.paid).toBe(2400);
      expect(forHenry.balance).toBe(-765);
      expect(forHanpin.balance).toBe(765);
    });

    it('uses the estimate until an actual amount is recorded', async () => {
      await request(app).post(`/api/trips/${tripId}/budget`).set(auth(henry)).send({
        description: 'teamLab tickets', category: 'activities', estimatedAmount: 120, actualAmount: 0,
      });
      const { body } = await request(app).get(`/api/trips/${tripId}/budget`).set(auth(henry));
      expect(body.summary.categoryTotals.activities).toBe(120);
      expect(body.summary.totalActual).toBe(3270);
      expect(body.summary.remaining).toBe(150);
    });

    it('applies the split-evenly action and reports the per-person share', async () => {
      await request(app).put(`/api/trips/${tripId}/budget/${hotelId}`).set(auth(henry))
        .send({ splitEvenly: false, splitBetween: [henry.user.userId] });

      const res = await request(app).post(`/api/trips/${tripId}/budget/${hotelId}/split-evenly`).set(auth(hanpin));
      expect(res.status).toBe(200);
      expect(res.body.perPerson).toBe(435); // 870 / 2
      expect(res.body.item.splitEvenly).toBe(true);
      expect(res.body.shares).toHaveLength(2);
    });

    it('deletes an expense and updates the totals', async () => {
      const del = await request(app).delete(`/api/trips/${tripId}/budget/${hotelId}`).set(auth(henry));
      expect(del.status).toBe(200);
      expect(del.body.summary.totalActual).toBe(2400);
    });
  });

  /* ---------------------------------------------------------------- */
  describe('full itinerary view', () => {
    it('aggregates every section into one chronological payload', async () => {
      const res = await request(app).get(`/api/trips/${tripId}/full-itinerary`).set(auth(henry));
      expect(res.status).toBe(200);

      expect(res.body.trip.title).toBe('Tokyo Trip');
      expect(res.body.days).toHaveLength(4);

      const sep15 = res.body.days.find((d) => d.date === '2026-09-15');
      expect(sep15.activities.length).toBe(2);
      expect(sep15.notes).toBe('Busy day.');

      const sep14 = res.body.days.find((d) => d.date === '2026-09-14');
      expect(sep14.transportation).toHaveLength(1); // the flight, matched by departure date

      expect(res.body.budget.totalActual).toBe(2400);
      expect(res.body.unscheduled).toHaveProperty('restaurants');
    });

    it('lists an entry dated outside the trip range as unscheduled rather than dropping it', async () => {
      // A flight that departs the day before the trip starts, and an attraction
      // pinned to a date after it ends: both must still be visible somewhere.
      await request(app).post(`/api/trips/${tripId}/transportation`).set(auth(henry))
        .send({ type: 'flight', provider: 'Outbound leg', departureTime: '2026-09-13T13:30' });
      await request(app).post(`/api/trips/${tripId}/attractions`).set(auth(henry))
        .send({ name: 'Day-after museum', visitDate: '2026-09-20' });

      const res = await request(app).get(`/api/trips/${tripId}/full-itinerary`).set(auth(henry));

      const shownOnADay = res.body.days.flatMap((d) => d.transportation.map((t) => t.provider));
      expect(shownOnADay).not.toContain('Outbound leg');
      expect(res.body.unscheduled.transportation.map((t) => t.provider)).toContain('Outbound leg');
      expect(res.body.unscheduled.attractions.map((a) => a.name)).toContain('Day-after museum');
    });
  });

  /* ---------------------------------------------------------------- */
  describe('deleting a trip', () => {
    it('is refused for a non-admin and cascades for the creator', async () => {
      expect((await request(app).delete(`/api/trips/${tripId}`).set(auth(hanpin))).status).toBe(403);

      const del = await request(app).delete(`/api/trips/${tripId}`).set(auth(henry));
      expect(del.status).toBe(200);

      expect((await request(app).get(`/api/trips/${tripId}`).set(auth(henry))).status).toBe(404);
      expect((await request(app).get(`/api/trips/${tripId}/itinerary`).set(auth(henry))).status).toBe(404);
    });
  });
});
