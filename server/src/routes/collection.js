import express from 'express';
import { requireAuth, requireTripMember } from '../middleware/auth.js';
import { requireFields, touchTrip } from '../utils/helpers.js';

/**
 * Attractions, restaurants and transportation are structurally identical
 * trip-scoped collections (list / create / update / delete, all members may
 * edit). This factory builds the router once so the three feature routes stay
 * consistent and any future fix applies to all of them.
 */
export function createCollectionRouter({ store, label, requiredFields, editableFields, sortBy }) {
  const router = express.Router({ mergeParams: true });
  router.use(requireAuth, requireTripMember);

  const forTrip = (tripId) => {
    const docs = store.find((d) => d.tripId === tripId);
    if (sortBy) docs.sort((a, b) => String(a[sortBy] ?? '').localeCompare(String(b[sortBy] ?? '')));
    return docs;
  };

  router.get('/', (req, res) => res.json(forTrip(req.trip._id)));

  router.post('/', (req, res) => {
    const missing = requireFields(req.body, requiredFields);
    if (missing) return res.status(400).json({ message: missing });

    const payload = { tripId: req.trip._id, createdBy: req.user._id };
    editableFields.forEach((f) => {
      payload[f] = req.body[f] === undefined || req.body[f] === '' ? null : req.body[f];
    });

    const doc = store.insert(payload);
    touchTrip(req.trip._id, req.user._id, `Added ${label}: ${doc.name || doc.provider || doc.type}`);
    return res.status(201).json(doc);
  });

  router.put('/:id', (req, res) => {
    const doc = store.findById(req.params.id);
    if (!doc || doc.tripId !== req.trip._id) return res.status(404).json({ message: `${label} not found.` });

    const patch = {};
    editableFields.forEach((f) => {
      if (req.body[f] !== undefined) patch[f] = req.body[f] === '' ? null : req.body[f];
    });

    const updated = store.update(doc._id, patch);
    touchTrip(req.trip._id, req.user._id, `Updated ${label}`);
    return res.json(updated);
  });

  router.delete('/:id', (req, res) => {
    const doc = store.findById(req.params.id);
    if (!doc || doc.tripId !== req.trip._id) return res.status(404).json({ message: `${label} not found.` });

    store.remove(doc._id);
    touchTrip(req.trip._id, req.user._id, `Removed ${label}`);
    return res.json({ message: `${label} removed.` });
  });

  return router;
}
