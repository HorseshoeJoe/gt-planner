import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Trips, Itineraries } from '../src/db/index.js';
import { findConflicts, isValidRange } from '../src/utils/timeConflicts.js';
import { splitEvenly } from '../src/utils/budget.js';

vi.mock('../src/middleware/auth.js', () => ({
    requireAuth: (req, _res, next) => {
        req.user = {
            _id: 'test-user-1',
            username: 'jonathan'
        };
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

        req.membership = {
            role: 'admin',
            status: 'joined'
        };

        next();
    },

    requireTripAdmin: (_req, _res, next) => {
        next();
    }
}));

const app = createApp();

describe('Core Flow Integration Tests', () => {
    beforeEach(() => {
        Itineraries.removeWhere(() => true);
        Trips.removeWhere(() => true);

        Trips.insert({
            _id: 'trip-123',
            title: 'Test Trip',
            destination: 'Tokyo',
            startDate: '2026-11-01',
            endDate: '2026-11-03',
            members: [
                {
                    _id: 'member-1',
                    userId: 'test-user-1',
                    role: 'admin',
                    status: 'joined'
                }
            ],
            suggestionWeights: null,
            dismissedSuggestionIds: []
        });
    });

    describe('1. Auth & Trips', () => {
        it('should successfully create a trip', async () => {
            const res = await request(app)
                .post('/api/trips')
                .send({
                    title: 'Tokyo Trip',
                    destination: 'Tokyo',
                    startDate: '2026-11-01',
                    endDate: '2026-11-03'
                });

            expect(res.status).toBe(201);
            expect(res.body.title).toBe('Tokyo Trip');
        });
    });

    describe('2. Itinerary & Conflicts', () => {
        it('should reject overlapping activities (409 Conflict)', async () => {
            await request(app)
                .post('/api/trips/trip-123/itinerary/2026-11-01/activities')
                .send({
                    title: 'Senso-ji',
                    startTime: '10:00',
                    endTime: '12:00'
                });

            const res = await request(app)
                .post('/api/trips/trip-123/itinerary/2026-11-01/activities')
                .send({
                    title: 'Lunch',
                    startTime: '11:30',
                    endTime: '13:00'
                });

            expect(res.status).toBe(409);
        });
    });

    describe('3. Suggestion Preferences (Phase II)', () => {
        it('should update scoring weights', async () => {
            const res = await request(app)
                .put('/api/trips/trip-123/suggestions/weights')
                .send({
                    popularity: 10,
                    cost: 40,
                    duration: 25,
                    detour: 25
                });

            expect(res.status).toBe(200);
        });

        it('should dismiss a suggestion', async () => {
            const res = await request(app)
                .post('/api/trips/trip-123/suggestions/dismiss')
                .send({
                    suggestionId: 'osm-node-12345'
                });

            expect(res.status).toBe(200);
            expect(res.body.dismissedIds).toContain('osm-node-12345');
        });
    });
});

// Pure unit tests (from feature branch)
describe('Phase III Core Flow Unit Tests', () => {

    describe('Accounts and Authentication Logic', () => {
        it('should validate required fields manually', () => {
            const reqBody = { username: 'newuser' };
            const required = ['username', 'email', 'password'];

            const missing = required.filter(field => !reqBody[field]);
            expect(missing.length).toBeGreaterThan(0);
            expect(missing).toContain('email');
            expect(missing).toContain('password');
        });
    });

    describe('Itinerary Conflict Detection (unit)', () => {
        const existingActivities = [
            { _id: 'act-1', title: 'Senso-ji Temple', startTime: '10:00', endTime: '12:00' }
        ];

        it('should reject overlapping activities', () => {
            const newActivity = { title: 'Sushi Lunch', startTime: '11:30', endTime: '13:00' };
            const conflicts = findConflicts(newActivity, existingActivities);

            expect(conflicts).toHaveLength(1);
            expect(conflicts[0].title).toBe('Senso-ji Temple');
        });

        it('should ALLOW non-overlapping activities', () => {
            const newActivity = { title: 'Shopping', startTime: '13:00', endTime: '14:00' };
            const conflicts = findConflicts(newActivity, existingActivities);

            expect(conflicts).toHaveLength(0);
        });

        it('should reject endTime before startTime', () => {
            const isValid = isValidRange('14:00', '13:00');
            expect(isValid).toBe(false);
        });
    });

    describe('Budget Even Split', () => {
        it('should split evenly across 3 members with no floating point errors', () => {
            const shares = splitEvenly(100, ['u1', 'u2', 'u3']);

            expect(shares[0]).toBe(33.34);
            expect(shares[1]).toBe(33.33);
            expect(shares[2]).toBe(33.33);

            const total = shares.reduce((sum, val) => sum + val, 0);
            expect(total).toBe(100);
        });
    });
});