// NOTE: adjust the mock paths to match existing route tests in this folder.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

vi.mock('../src/middleware/auth.js', () => ({
    requireAuth: (req, _res, next) => { req.user = { _id: 'u1' }; next(); },
    requireTripMember: (req, _res, next) => {
        req.trip = { _id: 't1', startDate: '2026-10-05', endDate: '2026-10-07' };
        next();
    },
}));

describe('itinerary routes — conflict handling', () => {
    beforeEach(async () => {
        const db = await import('../src/db/index.js');
        db.Itineraries.remove?.(() => true); // adjust to the actual reset helper
    });

    it('rejects overlap with 409 and lists conflicts', async () => {
        await request(app)
            .post('/api/trips/t1/itinerary/2026-10-05/activities')
            .send({ title: 'A', startTime: '10:00', endTime: '11:00' });

        const res = await request(app)
            .post('/api/trips/t1/itinerary/2026-10-05/activities')
            .send({ title: 'B', startTime: '10:30', endTime: '11:30' });

        expect(res.status).toBe(409);
        expect(res.body.conflicts).toHaveLength(1);
        expect(res.body.conflicts[0].title).toBe('A');
    });

    it('force:true saves anyway', async () => {
        await request(app)
            .post('/api/trips/t1/itinerary/2026-10-05/activities')
            .send({ title: 'A', startTime: '10:00', endTime: '11:00' });

        const res = await request(app)
            .post('/api/trips/t1/itinerary/2026-10-05/activities')
            .send({ title: 'B', startTime: '10:30', endTime: '11:30', force: true });

        expect(res.status).toBe(201);
        const titles = res.body.activities.map((a) => a.title);
        expect(titles).toEqual(['A', 'B']);
    });

    it('rejects endTime before startTime', async () => {
        const res = await request(app)
            .post('/api/trips/t1/itinerary/2026-10-05/activities')
            .send({ title: 'Bad', startTime: '11:00', endTime: '10:00' });
        expect(res.status).toBe(400);
    });
});