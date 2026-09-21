import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config.js';

/**
 * A very small document store backed by one JSON file.
 *
 * Why not a database server? The prototype has to be runnable by anyone who can
 * open a terminal: `npm install`, `npm run dev`, done. Nothing to install, no
 * account to create, no connection string to paste. All application data lives
 * in server/data.json, which can be opened in any text editor and deleted to
 * reset the app.
 *
 * The collection API below (find / findOne / insert / update / remove) mirrors
 * the shape of a document database, so the route code reads the same way it
 * would against MongoDB and could be swapped over later.
 */

const COLLECTIONS = [
  'users',
  'trips',
  'itineraries',
  'attractions',
  'restaurants',
  'transportation',
  'budgetItems',
  'invitations',
];

function emptyData() {
  return Object.fromEntries(COLLECTIONS.map((name) => [name, []]));
}

let data = emptyData();
let loadedFrom = null;

/** Reads the data file into memory, creating it if this is the first run. */
export function loadData(file = config.dataFile) {
  loadedFrom = file;

  if (!fs.existsSync(file)) {
    data = emptyData();
    persist();
    return data;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    data = { ...emptyData(), ...parsed };
  } catch (err) {
    // A corrupted file should not silently wipe the user's trips.
    const backup = `${file}.corrupt-${Date.now()}`;
    fs.renameSync(file, backup);
    console.error(`[store] ${path.basename(file)} could not be parsed (${err.message}).`);
    console.error(`[store] It was moved to ${path.basename(backup)} and a fresh file was created.`);
    data = emptyData();
    persist();
  }

  return data;
}

/**
 * Writes to a temporary file and renames it over the original, so an
 * interrupted write can never leave a half-written data file behind.
 */
function persist() {
  const file = loadedFrom || config.dataFile;
  const tmp = `${file}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

export function generateId() {
  return crypto.randomUUID();
}

/** Returned records are copies, so callers cannot mutate the store by accident. */
function clone(value) {
  return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
}

export function collection(name) {
  if (!COLLECTIONS.includes(name)) throw new Error(`Unknown collection: ${name}`);

  const rows = () => data[name];

  return {
    all: () => clone(rows()),

    find: (predicate = () => true) => clone(rows().filter(predicate)),

    findOne: (predicate) => clone(rows().find(predicate) ?? null),

    findById: (id) => clone(rows().find((r) => r._id === String(id)) ?? null),

    insert(doc) {
      const now = new Date().toISOString();
      const record = { _id: generateId(), ...doc, createdAt: now, updatedAt: now };
      rows().push(record);
      persist();
      return clone(record);
    },

    /** Applies a patch object, or a function that mutates a draft of the record. */
    update(id, patch) {
      const index = rows().findIndex((r) => r._id === String(id));
      if (index === -1) return null;

      const draft = clone(rows()[index]);
      const next = typeof patch === 'function' ? (patch(draft) ?? draft) : { ...draft, ...patch };
      next._id = draft._id;
      next.createdAt = draft.createdAt;
      next.updatedAt = new Date().toISOString();

      rows()[index] = next;
      persist();
      return clone(next);
    },

    remove(id) {
      const index = rows().findIndex((r) => r._id === String(id));
      if (index === -1) return false;
      rows().splice(index, 1);
      persist();
      return true;
    },

    removeWhere(predicate) {
      const before = rows().length;
      data[name] = rows().filter((r) => !predicate(r));
      persist();
      return before - data[name].length;
    },

    count: (predicate = () => true) => rows().filter(predicate).length,
  };
}

/** Used by the reset script and the test suite. */
export function clearAll() {
  data = emptyData();
  persist();
}

export function dataFilePath() {
  return loadedFrom || config.dataFile;
}
