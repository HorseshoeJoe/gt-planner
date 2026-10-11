# Testing Evidence – Phase I

## How to reproduce

```bash
npm install
npm test            # server + client
npm run test:server # API, store, budget, conflicts, POI dataset, primary flow
npm run test:client # React forms and dialogs
npm run build       # production build of the client
```

All server tests run against a throwaway data file in the OS temp folder, so they never touch `server/data.json`.

## Result (run on 2026-10-11, Node v22.22.2)

```
 ✓ tests/api.test.js (41 tests) 656ms
 ✓ tests/primaryFlow.test.js (10 tests) 382ms
 ✓ tests/budget.test.js (11 tests) 6ms
 ✓ tests/timeConflicts.test.js (11 tests) 6ms
 ✓ tests/store.test.js (6 tests) 14ms
 ✓ tests/pois.test.js (7 tests) 39ms
 ✓ tests/attractionsGeo.test.js (3 tests) 159ms
 Test Files  7 passed (7)
      Tests  89 passed (89)
 ✓ tests/Dashboard.test.jsx (6 tests) 1194ms
 ✓ tests/Modal.test.jsx (9 tests) 374ms
 Test Files  2 passed (2)
      Tests  15 passed (15)
```

Client production build: succeeds (`npm run build`).
Live smoke test: server booted with `node server/src/index.js`; `/api/health` returned `ok`; `npm run seed` data loaded; login as `henry` succeeded; `/full-itinerary` returned the 4-day Tokyo trip with 4 budget items.

## What each suite covers

| Suite | Covers |
| --- | --- |
| `api.test.js` | Registration and login (username or email), JWT protection, no password-hash exposure, trip CRUD, invitations and pending/joined status, member roles and removal, itinerary CRUD and conflicts (including *Save anyway*), attractions / restaurants / transportation CRUD, budget CRUD and even split, full itinerary view |
| `primaryFlow.test.js` | **Phase I primary user flow, end to end** — register → create trip → join by invite code → add attractions, restaurant and transport → collaborative itinerary → blocked overlap then override → budget split that reconciles → full itinerary → trip ready for suggestions → non-member blocked |
| `budget.test.js` | Category totals and even-split arithmetic |
| `timeConflicts.test.js` | Overlap detection rules |
| `store.test.js` | JSON document store behaviour |
| `pois.test.js` | POI dataset: at least 100 per destination, unique ids, required scoring fields, Tokyo bounds, destination matching |
| `attractionsGeo.test.js` | Attraction latitude/longitude/poiId storage and validation |
| client `Dashboard.test.jsx`, `Modal.test.jsx` | Create-trip form, dialog behaviour (escape to close, focus) |

## Phase I acceptance checklist

| Requirement | Evidence |
| --- | --- |
| CPAN 314 codebase pulled forward and runs | Fresh `npm install`, tests, build and live boot all succeed |
| Primary user flow works end to end | `primaryFlow.test.js` (10 steps) |
| Data model updated per the Revised Proposal | `docs/DATA_MODEL.md`; POI dataset; attraction location fields |
| Seed POI dataset, 100+ per destination | `tokyo.json` (111), enforced by `pois.test.js` |
| README describes current state | `README.md` |

## Known gaps (planned for later phases)

- Only Tokyo has a POI dataset; other destinations return an empty pool until datasets are added.
- POI coordinates and fees are hand-curated and approximate; Phase II Overpass enrichment will verify them.
- Suggestion engine, suggestion UI, accessibility audit and print stylesheet polish are Phase II / III scope.
- Automated accessibility testing is not yet in place.
