# Testing Evidence

Evidence for the test plan in [`TEST_PLAN.md`](TEST_PLAN.md). Phase II results are first; the Phase I record is kept below.

# Phase II

## How to reproduce

```bash
npm install
npm test                                     # server + client suites
npm run test:coverage --workspace server     # server suites with coverage
npm run build                                # production build
```

## Results (run on 2026-10-25, Node v22)

Server (16 files, 204 tests, all passing):

```
✓ tests/api.test.js (41 tests)
✓ tests/attractionsGeo.test.js (3 tests)
✓ tests/budget.test.js (11 tests)
✓ tests/coreFlow.test.js (4 tests)
✓ tests/itineraries.route.test.js (3 tests)
✓ tests/poiService.test.js (10 tests)
✓ tests/pois.test.js (7 tests)
✓ tests/primaryFlow.test.js (10 tests)
✓ tests/recommendation.engine.test.js (40 tests)
✓ tests/recommendation.geo.test.js (13 tests)
✓ tests/recommendation.poiPool.test.js (10 tests)
✓ tests/recommendation.scoring.test.js (16 tests)
✓ tests/recommendation.weights.test.js (6 tests)
✓ tests/store.test.js (6 tests)
✓ tests/suggestions.integration.test.js (13 tests)
✓ tests/timeConflicts.test.js (11 tests)
```

Client (2 files, 15 tests, all passing): `Dashboard.test.jsx` (6), `Modal.test.jsx` (9).
Client production build: succeeds.

**Total: 219 tests, 0 failures, 0 skipped.** Phase I ended with 104 tests (89 server + 15 client). Phase II adds 115 server tests: 108 for the suggestion engine, the POI pool and the enrichment service, and 7 core-flow and itinerary-route tests for weights, dismissals and conflict handling.

## Tests added in Phase II

| File | Level | Tests | What it proves |
| --- | --- | --- | --- |
| `recommendation.geo.test.js` | Unit | 13 | Coordinate validation, haversine distance against a known real distance, travel-time model is monotonic, detour is never negative |
| `recommendation.weights.test.js` | Unit | 6 | Defaults sum to 1, normalisation, partial and string input, rejection of negative / non-numeric / all-zero weights |
| `recommendation.scoring.test.js` | Unit | 16 | Every factor's mapping and edge cases; score is the weighted sum; a perfect stop scores 100; popularity / cost / detour ordering; weights change the winner |
| `recommendation.engine.test.js` | Unit | 40 | Gap detection from activity times, ordering, default gaps, exclusion of planned / dismissed stops, one suggestion per stop per day, limits, empty-day notes and the anchorless fallback, suggested start times, supplied candidate pools, performance (real pool and 1,000-POI synthetic pool) |
| `recommendation.poiPool.test.js` | Unit | 10 | Overpass-to-engine conversion, cost tiers, merge with curated data, duplicates and bad records ignored, Overpass failure and 30 ms timeout handled |
| `poiService.test.js` | Unit (scripted network) | 10 | Geocoding, Overpass request and normalisation, 80-place cap, endpoint fallback, cache reuse, clear errors |
| `suggestions.integration.test.js` | Integration | 13 | Auth and input checks, ranking between two attractions, response shape used by the suggestion panel, start times, planned stops excluded, saved weights re-rank, dismissals persist for the group, Overpass merge, Overpass down, anchorless day, Overpass-only destination, empty result, updates after itinerary changes |
| `coreFlow.test.js`, `itineraries.route.test.js` | Integration | 7 | Trip and itinerary conflict flow, saving weights, dismissing a suggestion |

## Coverage (server)

```
Statements   : 93.72% ( 2315/2470 )
Branches     : 85.23% ( 589/691 )
Functions    : 94.89% ( 93/98 )
Lines        : 93.72% ( 2315/2470 )
```

Key modules:

```
All files          |   93.72 |    85.23 |   94.89 |   93.72 |                   
  suggestions.js   |   85.08 |    71.15 |     100 |   85.08 | ...61-367,408-414 
  poiService.js    |   90.59 |       90 |     100 |   90.59 | ...38-143,214-228 
  engine.js        |     100 |    95.55 |     100 |     100 | 55,70,78,229      
  geo.js           |     100 |      100 |     100 |     100 |                   
  poiPool.js       |     100 |    97.22 |     100 |     100 | 75                
  scoring.js       |     100 |       95 |     100 |     100 | 81                
  weights.js       |     100 |      100 |     100 |     100 |                   
```

## Performance evidence

| Measurement | Result | Requirement |
| --- | --- | --- |
| Engine: 7-day trip, 3 attractions per day, 111-POI pool (median of 20 runs) | about 4 ms (worst about 46 ms) | under 2 s for 100+ POIs |
| Engine: 7 busy days against a synthetic 1,000-POI pool | asserted under 2 s in `recommendation.engine.test.js` | – |
| Whole `GET /suggestions?date=` against the running server, seeded trip | about 135 ms | – |
| `meta.elapsedMs` returned with every response | asserted under 2000 in the integration tests | – |

## Live check

The server was started with the seeded demo trip and `GET /api/trips/:id/suggestions?date=2026-09-15` was called as a signed-in member. It returned ranked stops between Senso-ji Temple and teamLab Planets (for example Akihabara Electric Town, Tsukiji Outer Market, Ueno Park), each with a reason such as "8 minutes off your route between Senso-ji Temple and teamLab Planets", a suggested start time after 11:00, and its cost.

## Known gaps

See section 9 of the test plan: the React suggestion panel is covered through the API tests and manual checks rather than component tests; accessibility testing is manual so far.

---

# Phase I (kept for reference)

## Phase I – how to reproduce

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
