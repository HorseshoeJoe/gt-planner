/**
 * Phase 2 enhancement - budget maths.
 *
 * Stakeholder Meeting 2, Q2: "a 'split evenly' option ... a button that divides
 * the cost equally among members would save a lot of manual calculation."
 * Q5: "the budget tracker should update instantly ... so the running total is
 * always accurate."
 *
 * Kept pure so totals can be unit-tested and recomputed on the client without
 * a round trip to the API.
 */

export const BUDGET_CATEGORIES = ['accommodation', 'food', 'activities', 'transport', 'other'];

/** Rounds to cents; avoids 0.1 + 0.2 style float noise in displayed totals. */
export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Splits an amount across n people so the parts always add back up to the
 * original amount. Any leftover cent is given to the earliest members.
 */
export function splitEvenly(amount, people) {
  const n = Array.isArray(people) ? people.length : Number(people);
  if (!n || n < 1) return [];
  const cents = Math.round(Number(amount) * 100);
  const base = Math.floor(cents / n);
  const remainder = cents - base * n;
  return Array.from({ length: n }, (_, i) => round2((base + (i < remainder ? 1 : 0)) / 100));
}

/** Effective cost of a line item: actual spend once known, otherwise estimate. */
export function effectiveAmount(item) {
  const actual = Number(item.actualAmount) || 0;
  return actual > 0 ? actual : Number(item.estimatedAmount) || 0;
}

/**
 * Aggregates a list of budget items into the summary the dashboard renders.
 * UML: BudgetSummary { totalAmount, categoryTotals, calculateTotals() }
 */
export function calculateTotals(items = [], members = []) {
  const memberIds = members.map((m) => String(m));

  const categoryTotals = Object.fromEntries(BUDGET_CATEGORIES.map((c) => [c, 0]));
  const perMemberOwed = Object.fromEntries(memberIds.map((id) => [id, 0]));
  const perMemberPaid = Object.fromEntries(memberIds.map((id) => [id, 0]));

  let totalEstimated = 0;
  let totalActual = 0;

  for (const item of items) {
    const estimated = Number(item.estimatedAmount) || 0;
    const actual = Number(item.actualAmount) || 0;
    const effective = effectiveAmount(item);

    totalEstimated += estimated;
    totalActual += actual;

    const category = BUDGET_CATEGORIES.includes(item.category) ? item.category : 'other';
    categoryTotals[category] += effective;

    // Who shares this cost: an explicit list, or everyone when split evenly.
    let sharers = (item.splitBetween || []).map(String).filter((id) => memberIds.includes(id));
    if (item.splitEvenly || sharers.length === 0) sharers = memberIds;

    const shares = splitEvenly(effective, sharers);
    sharers.forEach((id, i) => {
      perMemberOwed[id] = round2((perMemberOwed[id] || 0) + shares[i]);
    });

    const payer = item.paidBy ? String(item.paidBy._id || item.paidBy) : null;
    if (payer && payer in perMemberPaid) {
      perMemberPaid[payer] = round2(perMemberPaid[payer] + actual);
    }
  }

  const perMember = memberIds.map((id) => ({
    userId: id,
    owed: round2(perMemberOwed[id] || 0),
    paid: round2(perMemberPaid[id] || 0),
    balance: round2((perMemberPaid[id] || 0) - (perMemberOwed[id] || 0)),
  }));

  return {
    totalEstimated: round2(totalEstimated),
    totalActual: round2(totalActual),
    remaining: round2(totalEstimated - totalActual),
    categoryTotals: Object.fromEntries(
      Object.entries(categoryTotals).map(([k, v]) => [k, round2(v)])
    ),
    perMember,
    itemCount: items.length,
  };
}
