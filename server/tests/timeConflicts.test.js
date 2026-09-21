import { describe, it, expect } from 'vitest';
import { toMinutes, overlaps, findConflicts, isValidRange } from '../src/utils/timeConflicts.js';

describe('toMinutes', () => {
  it('converts valid 24-hour times', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('09:30')).toBe(570);
    expect(toMinutes('23:59')).toBe(1439);
  });

  it('rejects malformed input', () => {
    expect(toMinutes('24:00')).toBeNull();
    expect(toMinutes('9:30')).toBeNull();
    expect(toMinutes('')).toBeNull();
    expect(toMinutes(undefined)).toBeNull();
  });
});

describe('overlaps', () => {
  it('detects a genuine overlap', () => {
    expect(overlaps({ startTime: '09:00', endTime: '11:00' }, { startTime: '10:00', endTime: '12:00' })).toBe(true);
  });

  it('allows back-to-back activities', () => {
    expect(overlaps({ startTime: '09:00', endTime: '10:00' }, { startTime: '10:00', endTime: '11:00' })).toBe(false);
  });

  it('treats a fully contained activity as an overlap', () => {
    expect(overlaps({ startTime: '09:00', endTime: '17:00' }, { startTime: '12:00', endTime: '13:00' })).toBe(true);
  });

  it('handles activities with no end time', () => {
    expect(overlaps({ startTime: '10:00' }, { startTime: '09:00', endTime: '11:00' })).toBe(true);
    expect(overlaps({ startTime: '12:00' }, { startTime: '09:00', endTime: '11:00' })).toBe(false);
    expect(overlaps({ startTime: '10:00' }, { startTime: '10:00' })).toBe(true);
  });
});

describe('findConflicts', () => {
  const day = [
    { _id: 'a', title: 'Senso-ji Temple', startTime: '09:00', endTime: '11:00' },
    { _id: 'b', title: 'Lunch', startTime: '12:00', endTime: '13:00' },
  ];

  it('returns only the clashing items', () => {
    const conflicts = findConflicts({ startTime: '10:30', endTime: '12:30' }, day);
    expect(conflicts.map((c) => c.title)).toEqual(['Senso-ji Temple', 'Lunch']);
  });

  it('returns nothing for a free slot', () => {
    expect(findConflicts({ startTime: '14:00', endTime: '15:00' }, day)).toHaveLength(0);
  });

  it('ignores the activity being edited', () => {
    expect(findConflicts({ startTime: '09:30', endTime: '10:30' }, day, 'a')).toHaveLength(0);
  });
});

describe('isValidRange', () => {
  it('accepts a valid range and an open-ended activity', () => {
    expect(isValidRange('09:00', '10:00')).toBe(true);
    expect(isValidRange('09:00', '')).toBe(true);
  });

  it('rejects an end time at or before the start', () => {
    expect(isValidRange('10:00', '09:00')).toBe(false);
    expect(isValidRange('10:00', '10:00')).toBe(false);
    expect(isValidRange('bad', '10:00')).toBe(false);
  });
});
