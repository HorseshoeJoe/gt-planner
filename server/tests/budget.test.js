import { describe, it, expect } from 'vitest';
import { splitEvenly, calculateTotals, effectiveAmount, round2 } from '../src/utils/budget.js';

describe('splitEvenly', () => {
  it('splits a clean amount', () => {
    expect(splitEvenly(100, ['a', 'b', 'c', 'd'])).toEqual([25, 25, 25, 25]);
  });

  it('distributes leftover cents so the shares add back up', () => {
    const shares = splitEvenly(100, ['a', 'b', 'c']);
    expect(shares).toEqual([33.34, 33.33, 33.33]);
    expect(round2(shares.reduce((s, v) => s + v, 0))).toBe(100);
  });

  it('accepts a member count instead of a list', () => {
    expect(splitEvenly(50, 2)).toEqual([25, 25]);
  });

  it('returns an empty split when there are no members', () => {
    expect(splitEvenly(50, [])).toEqual([]);
  });
});

describe('effectiveAmount', () => {
  it('prefers the actual amount once it is recorded', () => {
    expect(effectiveAmount({ estimatedAmount: 900, actualAmount: 870 })).toBe(870);
  });

  it('falls back to the estimate before anything is spent', () => {
    expect(effectiveAmount({ estimatedAmount: 120, actualAmount: 0 })).toBe(120);
  });
});

describe('calculateTotals', () => {
  const members = ['u1', 'u2'];
  const items = [
    { description: 'Hotel', category: 'accommodation', estimatedAmount: 900, actualAmount: 870, paidBy: 'u1', splitEvenly: true },
    { description: 'Flights', category: 'transport', estimatedAmount: 2400, actualAmount: 2400, paidBy: 'u2', splitEvenly: true },
    { description: 'Tickets', category: 'activities', estimatedAmount: 120, actualAmount: 0, paidBy: 'u1', splitEvenly: true },
  ];

  it('totals estimated, actual and remaining', () => {
    const s = calculateTotals(items, members);
    expect(s.totalEstimated).toBe(3420);
    expect(s.totalActual).toBe(3270);
    expect(s.remaining).toBe(150);
    expect(s.itemCount).toBe(3);
  });

  it('groups spend by category', () => {
    const s = calculateTotals(items, members);
    expect(s.categoryTotals.accommodation).toBe(870);
    expect(s.categoryTotals.transport).toBe(2400);
    expect(s.categoryTotals.activities).toBe(120);
    expect(s.categoryTotals.food).toBe(0);
  });

  it('computes what each member owes, paid and their balance', () => {
    const s = calculateTotals(items, members);
    const u1 = s.perMember.find((m) => m.userId === 'u1');
    const u2 = s.perMember.find((m) => m.userId === 'u2');

    expect(u1.owed).toBe(1695); // (870 + 2400 + 120) / 2
    expect(u2.owed).toBe(1695);
    expect(u1.paid).toBe(870);
    expect(u2.paid).toBe(2400);
    expect(u1.balance).toBe(-825);
    expect(u2.balance).toBe(705);
  });

  it('honours an explicit split list', () => {
    const s = calculateTotals(
      [{ description: 'Solo tour', category: 'activities', estimatedAmount: 100, actualAmount: 100, paidBy: 'u1', splitEvenly: false, splitBetween: ['u1'] }],
      members
    );
    expect(s.perMember.find((m) => m.userId === 'u1').owed).toBe(100);
    expect(s.perMember.find((m) => m.userId === 'u2').owed).toBe(0);
  });

  it('returns zeroed totals for an empty ledger', () => {
    const s = calculateTotals([], members);
    expect(s.totalEstimated).toBe(0);
    expect(s.perMember.every((m) => m.owed === 0 && m.paid === 0)).toBe(true);
  });
});
