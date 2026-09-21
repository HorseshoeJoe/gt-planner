import express from 'express';
import { BudgetItems, Users, publicUser, joinedMemberIds } from '../db/index.js';
import { requireAuth, requireTripMember } from '../middleware/auth.js';
import { requireFields, touchTrip } from '../utils/helpers.js';
import { calculateTotals, splitEvenly, round2 } from '../utils/budget.js';

const router = express.Router({ mergeParams: true });
router.use(requireAuth, requireTripMember);

/** Expands the payer id into a user object for display. */
const expand = (item) => ({ ...item, paidBy: publicUser(Users.findById(item.paidBy)) });

function ledger(tripId) {
  return BudgetItems.find((b) => b.tripId === tripId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
    .map(expand);
}

/**
 * GET /api/trips/:tripId/budget
 * Returns the ledger and the recomputed summary in one response, so the running
 * total is always in step with the item list (Stakeholder Meeting 2, Q5).
 */
router.get('/', (req, res) => {
  const items = ledger(req.trip._id);

  res.json({
    items,
    summary: calculateTotals(items, joinedMemberIds(req.trip)),
    members: req.tripView.members
      .filter((m) => m.status === 'joined')
      .map((m) => ({
        userId: String(m.user?._id),
        username: m.user?.username,
        displayName: m.user?.displayName,
      })),
  });
});

/** POST /api/trips/:tripId/budget */
router.post('/', (req, res) => {
  const missing = requireFields(req.body, ['description']);
  if (missing) return res.status(400).json({ message: missing });

  const members = joinedMemberIds(req.trip);
  const splitEven = req.body.splitEvenly !== false;

  const item = BudgetItems.insert({
    tripId: req.trip._id,
    description: String(req.body.description).trim(),
    category: req.body.category || 'other',
    estimatedAmount: Math.max(0, Number(req.body.estimatedAmount) || 0),
    actualAmount: Math.max(0, Number(req.body.actualAmount) || 0),
    currency: req.body.currency || 'CAD',
    paidBy: req.body.paidBy || req.user._id,
    splitEvenly: splitEven,
    // "Split evenly" stores every joined member; otherwise only those selected.
    splitBetween: splitEven ? members : (req.body.splitBetween || []),
    createdBy: req.user._id,
  });

  touchTrip(req.trip._id, req.user._id, `Added expense: ${item.description}`);

  return res.status(201).json({
    item: expand(item),
    summary: calculateTotals(ledger(req.trip._id), members),
  });
});

/** PUT /api/trips/:tripId/budget/:id */
router.put('/:id', (req, res) => {
  const existing = BudgetItems.findById(req.params.id);
  if (!existing || existing.tripId !== req.trip._id) {
    return res.status(404).json({ message: 'Budget item not found.' });
  }

  const members = joinedMemberIds(req.trip);

  const updated = BudgetItems.update(existing._id, (draft) => {
    ['description', 'category', 'currency', 'paidBy'].forEach((f) => {
      if (req.body[f] !== undefined) draft[f] = req.body[f];
    });
    if (req.body.estimatedAmount !== undefined) draft.estimatedAmount = Math.max(0, Number(req.body.estimatedAmount) || 0);
    if (req.body.actualAmount !== undefined) draft.actualAmount = Math.max(0, Number(req.body.actualAmount) || 0);

    if (req.body.splitEvenly !== undefined) {
      draft.splitEvenly = Boolean(req.body.splitEvenly);
      draft.splitBetween = draft.splitEvenly ? members : (req.body.splitBetween || draft.splitBetween);
    } else if (req.body.splitBetween !== undefined) {
      draft.splitBetween = req.body.splitBetween;
      draft.splitEvenly = false;
    }
  });

  touchTrip(req.trip._id, req.user._id, `Updated expense: ${updated.description}`);

  return res.json({ item: expand(updated), summary: calculateTotals(ledger(req.trip._id), members) });
});

/** DELETE /api/trips/:tripId/budget/:id */
router.delete('/:id', (req, res) => {
  const item = BudgetItems.findById(req.params.id);
  if (!item || item.tripId !== req.trip._id) {
    return res.status(404).json({ message: 'Budget item not found.' });
  }

  BudgetItems.remove(item._id);
  touchTrip(req.trip._id, req.user._id, `Removed expense: ${item.description}`);

  return res.json({
    message: 'Budget item removed.',
    summary: calculateTotals(ledger(req.trip._id), joinedMemberIds(req.trip)),
  });
});

/**
 * POST /api/trips/:tripId/budget/:id/split-evenly
 * Phase 2 enhancement - the one-click "Split evenly" button asked for in
 * Stakeholder Meeting 2. Returns the per-person share so the UI can confirm
 * the exact amount without duplicating the rounding rules.
 */
router.post('/:id/split-evenly', (req, res) => {
  const item = BudgetItems.findById(req.params.id);
  if (!item || item.tripId !== req.trip._id) {
    return res.status(404).json({ message: 'Budget item not found.' });
  }

  const members = joinedMemberIds(req.trip);
  const updated = BudgetItems.update(item._id, { splitEvenly: true, splitBetween: members });

  const total = updated.actualAmount > 0 ? updated.actualAmount : updated.estimatedAmount;
  const shares = splitEvenly(total, members);

  touchTrip(req.trip._id, req.user._id, `Split "${updated.description}" evenly`);

  return res.json({
    item: expand(updated),
    perPerson: shares[0] ?? 0,
    shares: members.map((id, i) => ({ userId: id, share: shares[i] })),
    total: round2(total),
    summary: calculateTotals(ledger(req.trip._id), members),
  });
});

export default router;
