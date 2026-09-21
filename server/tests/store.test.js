import { describe, it, expect, beforeEach } from 'vitest';
import { collection, clearAll } from '../src/db/store.js';

/** The file store itself: ids, timestamps, isolation and persistence. */
describe('JSON file store', () => {
  const Trips = collection('trips');

  beforeEach(() => clearAll());

  it('assigns an id and timestamps on insert', () => {
    const trip = Trips.insert({ title: 'Tokyo' });
    expect(trip._id).toBeTruthy();
    expect(trip.createdAt).toBeTruthy();
    expect(trip.updatedAt).toBeTruthy();
  });

  it('finds records by id and by predicate', () => {
    const a = Trips.insert({ title: 'Tokyo' });
    Trips.insert({ title: 'Montreal' });

    expect(Trips.findById(a._id).title).toBe('Tokyo');
    expect(Trips.findOne((t) => t.title === 'Montreal')).toBeTruthy();
    expect(Trips.find((t) => t.title.startsWith('M'))).toHaveLength(1);
    expect(Trips.findById('does-not-exist')).toBeNull();
  });

  it('returns copies, so callers cannot mutate the store by accident', () => {
    const trip = Trips.insert({ title: 'Tokyo' });
    const fetched = Trips.findById(trip._id);
    fetched.title = 'Hacked';
    expect(Trips.findById(trip._id).title).toBe('Tokyo');
  });

  it('updates with a patch object or a mutator function', () => {
    const trip = Trips.insert({ title: 'Tokyo', members: [] });

    const patched = Trips.update(trip._id, { title: 'Tokyo & Kyoto' });
    expect(patched.title).toBe('Tokyo & Kyoto');

    const mutated = Trips.update(trip._id, (draft) => {
      draft.members.push({ userId: 'u1' });
    });
    expect(mutated.members).toHaveLength(1);
    expect(mutated._id).toBe(trip._id);
    expect(mutated.createdAt).toBe(trip.createdAt);
  });

  it('removes a single record and removes by predicate', () => {
    const a = Trips.insert({ title: 'Tokyo' });
    Trips.insert({ title: 'Montreal' });
    Trips.insert({ title: 'Manila' });

    expect(Trips.remove(a._id)).toBe(true);
    expect(Trips.remove('nope')).toBe(false);
    expect(Trips.removeWhere((t) => t.title.startsWith('M'))).toBe(2);
    expect(Trips.count()).toBe(0);
  });

  it('rejects an unknown collection name', () => {
    expect(() => collection('nonsense')).toThrow(/unknown collection/i);
  });
});
