import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

vi.mock('../src/middleware/auth.js', () => ({
    requireAuth: (req, _res, next) => {
        req.user = { _id: 'test-user-1', username: 'jonathan' };
        next();
    },
    requireTripMember: (req, _res, next) => {
        req.trip = {
            _id: 'trip-123',
            startDate: '2026-11-01',
            endDate: '2026-11-03',
            suggestionWeights: null,
            dismissedSuggestionIds: []
        };
        next();
    }
}));

describe('Core Flow Integration Tests', () => {
    beforeEach(() => {
        // Make sure to RESET the database before each test
    });

    describe('1. Auth & Trips', () => {
        it('should successfully create a trip', async () => {
            const res = await request(app)
                .post('/api/trips')
                .send({ name: 'Tokyo Trip', destination: 'Tokyo', startDate: '2026-11-01', endDate: '2026-11-03' });

            expect(res.status).toBe(201);
            expect(res.body.name).toBe('Tokyo Trip');
        });
    });

    describe('2. Itinerary & Conflicts', () => {
        it('should reject overlapping activities (409 Conflict)', async () => {
            await request(app)
                .post('/api/trips/trip-123/itinerary/2026-11-01/activities')
                .send({ title: 'Senso-ji', startTime: '10:00', endTime: '12:00' });

            const res = await request(app)
                .post('/api/trips/trip-123/itinerary/2026-11-01/activities')
                .send({ title: 'Lunch', startTime: '11:30', endTime: '13:00' });

            expect(res.status).toBe(409);
            expect(res.body.conflicts).toHaveLength(1);
            expect(res.body.conflicts[0].title).toBe('Senso-ji');
        });
    });

    describe('3. Suggestion Preferences (Phase II)', () => {
        it('should update scoring weights', async () => {
            const res = await request(app)
                .put('/api/trips/trip-123/suggestions/weights')
                .send({ popularity: 10, cost: 40, duration: 25, detour: 25 });

            expect(res.status).toBe(200);
            expect(res.body.weights.cost).toBe(40);
        });

        it('should dismiss a suggestion', async () => {
            const res = await request(app)
                .post('/api/trips/trip-123/suggestions/dismiss')
                .send({ suggestionId: 'osm-node-12345' });

            expect(res.status).toBe(200);
            expect(res.body.dismissedIds).toContain('osm-node-12345');
        });
    });
});