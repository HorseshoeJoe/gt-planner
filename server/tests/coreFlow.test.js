import { describe, it, expect, vi } from 'vitest';
import { findConflicts, isValidRange } from '../src/utils/timeConflicts.js';
import { splitEvenly } from '../src/utils/budget.js';

describe('Phase III Core Flow Tests', () => {

    // ACCOUNTS & AUTH VALIDATION
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

    // ITINERARY CONFLICTS
    describe('Itinerary Conflict Detection', () => {
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

    // BUDGET SPLIT
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