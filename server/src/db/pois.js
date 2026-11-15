import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Read-only points-of-interest dataset for the Smart Attraction Suggestions
 * engine (CPAN 324).
 *
 * POIs are static reference data, not user data, so they live in
 * src/data/pois/<destination>.json rather than in server/data.json. That keeps
 * the application at its eight documented collections and means "reset" never
 * wipes them.
 *
 * Datasets are scoped per destination: the engine asks for the pool belonging
 * to a trip's destination only, so scoring cost does not grow with the number
 * of destinations on disk (proposal 3.2, Scalability).
 */

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'pois');

let byKey = null; // normalised alias -> dataset

/** "Tokyo, Japan" -> "tokyo"; "  TOKYO " -> "tokyo". */
export function normaliseDestination(value) {
  return String(value || '')
    .split(',')[0]
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function load() {
  if (byKey) return byKey;
  byKey = new Map();
  if (!fs.existsSync(dir)) return byKey;

  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const dataset = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const keys = new Set([dataset.destination, ...(dataset.aliases || [])].map(normaliseDestination));
    keys.forEach((k) => k && byKey.set(k, dataset));
  }
  return byKey;
}

/** All POIs for a trip destination string, or [] when no dataset exists. */
export function poisForDestination(destination) {
  return load().get(normaliseDestination(destination))?.pois ?? [];
}

export function hasPoiDataset(destination) {
  return load().has(normaliseDestination(destination));
}

export function getPoi(id) {
  for (const dataset of new Set(load().values())) {
    const hit = dataset.pois.find((p) => p.id === id);
    if (hit) return hit;
  }
  return null;
}

export function availableDestinations() {
  return [...new Set(load().values())].map((d) => ({ destination: d.destination, count: d.pois.length }));
}
