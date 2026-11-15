# Test Plan – Phase II

Group Travel Planner · CPAN 324 · Group 3

## 1. Purpose and scope

Show that the application's core flows work, that the Phase II code (Smart Attraction Suggestions and the features around it) is correct, and that regressions in Phase I functionality are caught. Everything in the Revised Proposal's functional and non-functional requirements that is implemented is covered; items not yet implemented are listed in section 9.

## 2. Test levels

| Level | What it checks | Tools | Location |
| --- | --- | --- | --- |
| **Unit** | Pure logic in isolation: geography, weights, each scoring factor, ranking, gap detection, the POI adapter, budget maths, conflict rules, the JSON store, the POI loader | Vitest | `server/tests/recommendation.*.test.js`, `budget`, `timeConflicts`, `store`, `pois` |
| **Unit with a scripted network** | The Overpass enrichment service (geocoding, endpoint fallback, caching, normalisation) with `fetch` replaced so nothing touches public servers | Vitest + `vi.stubGlobal` | `poiService.test.js` |
| **Integration** | Real Express app + real JSON store + auth + membership + data from several modules working together | Vitest + Supertest | `api`, `suggestions.integration`, `attractionsGeo`, `itineraries.route`, `coreFlow` |
| **End-to-end flow** | One narrative through the public API: register → trip → invite → plan → budget → itinerary | Vitest + Supertest | `primaryFlow.test.js` |
| **Component** | React forms and dialogs in a simulated browser | Vitest + Testing Library | `client/tests/` |
| **Non-functional** | Suggestion speed (under 2 s for 100+ POIs); Overpass time limit | Vitest timing assertions | `recommendation.engine`, `recommendation.poiPool` |
| **Manual / demo** | Full UI walkthrough, responsive layout, accessibility spot checks | Browser | Section 8 |

## 3. How tests are run

```bash
npm install
npm test                                     # server + client suites
npm run test:server                          # server only
npm run test:client                          # client only
npm run test:coverage --workspace server     # server with coverage report
npm run build                                # production build must succeed
```

Every server test file runs against its own throwaway data file, so tests never touch `server/data.json` and cannot affect one another. Tests never call the public Overpass or Nominatim servers.

## 4. Core flows under test

| # | Core flow | Requirement (Revised Proposal) | Unit | Integration | Result |
| --- | --- | --- | --- | --- | --- |
| F1 | Register, sign in by username or email, session survives refresh, no password leakage | 3.1 accounts, 3.2 security | – | `api` | Pass |
| F2 | Create trip, invite by code / username, pending → joined, admin vs. member | 3.1 trips, roles | – | `api`, `primaryFlow` | Pass |
| F3 | Itinerary builder with conflict detection and "Save anyway" | 3.1 conflicts | `timeConflicts` | `api`, `primaryFlow`, `itineraries.route`, `coreFlow` | Pass |
| F4 | Attractions, restaurants, transportation CRUD | 3.1 CRUD | – | `api`, `attractionsGeo` | Pass |
| F5 | Budget: totals, even split, per-member balances | 3.1 budget | `budget` | `api`, `primaryFlow` | Pass |
| F6 | Full itinerary view in date order, unscheduled items listed | 3.1 full itinerary | – | `api`, `primaryFlow` | Pass |
| F7 | **Suggestions: gap detection between scheduled attractions** | 3.1 suggestion engine | `recommendation.engine` | `suggestions.integration` | Pass |
| F8 | **Suggestions: weighted scoring of popularity, cost, duration, detour** | 3.1 scoring factors | `recommendation.scoring`, `.geo` | `suggestions.integration` | Pass |
| F9 | **Suggestions: ranked, with a reason and start time, excluding planned stops** | 3.1 reasons | `recommendation.engine` | `suggestions.integration` | Pass |
| F10 | **Adjustable weights saved per trip change the ranking; bad weights rejected** | 3.1 adjustable weighting | `recommendation.weights`, `.scoring` | `suggestions.integration`, `coreFlow` | Pass |
| F11 | **Dismissed suggestions are saved for the trip and left out** | 3.1 dismiss | `recommendation.engine` | `suggestions.integration`, `coreFlow` | Pass |
| F12 | **POI enrichment: Overpass places merged with curated data; works when Overpass is slow or down** | Section 5 recommendation engine | `recommendation.poiPool`, `poiService` | `suggestions.integration` | Pass |
| F13 | **Suggestions: under 2 s against 100+ POIs** | 3.2 performance | `recommendation.engine` | `suggestions.integration` (`meta.elapsedMs`) | Pass |
| F14 | POI dataset: 100+ per destination, valid fields, destination matching | 3.2 scalability, section 4 | `pois` | – | Pass |
| F15 | Access control: non-members cannot read trip data or suggestions | 3.2 security | – | `api`, `suggestions.integration`, `primaryFlow` | Pass |

## 5. Test design approach

- **Boundary and edge cases** for every scoring factor (rating 1 and 5, free vs. priciest tier, zero and maximum detour, a stop that exactly fits or does not, missing fields).
- **Monotonic behaviour:** with everything else equal, a more popular, cheaper, or closer stop must never score lower; changing weights must change the winner.
- **Properties:** detour is never negative; travel time never decreases with distance; weights always sum to 1; a stop is suggested at most once per day.
- **Negative paths:** invalid weights, dates and limits (400), unknown trip (404), non-member (403), no token (401), destination without POI data, days without anchors, Overpass failure, timeout and malformed records.
- **Integration state changes:** adding an attraction removes it from the next set of suggestions; dismissing a suggestion removes it for every member.
- **Isolation of external services:** the Overpass and Nominatim calls are replaced by scripted responses, so tests are fast and repeatable.

## 6. Entry and exit criteria

- **Entry:** code builds, the previous phase's suites pass.
- **Exit for Phase II:** all suites pass with no skipped tests, the production build succeeds, the Phase II suggestion code has near-complete statement coverage, and every flow in section 4 is covered by at least one automated test.

## 7. Results (see `docs/TESTING.md` for the full evidence)

| Suite | Tests | Result |
| --- | --- | --- |
| Server (16 files) | 204 | Pass |
| Client (2 files) | 15 | Pass |
| **Total** | **219** | **Pass** |

Server coverage: 93.7% statements, 85.2% branches, 94.9% functions overall; the recommendation module is at 100% statements and about 96.6% branches.

## 8. Manual checks before each demo

1. `npm run seed`, `npm run dev`, sign in as `henry`.
2. Open the *Tokyo Trip* and the 15 September itinerary (Senso-ji Temple, teamLab Planets).
3. Open the suggestions panel for that day: the cards sit between Asakusa and Odaiba, each with a reason, score, visit time and cost.
4. Change the weights (favour cost, then popularity) and confirm the order changes.
5. Dismiss a suggestion and confirm it disappears; add one to the itinerary and confirm it appears in the day.
6. Resize to a phone width; confirm nothing overflows.

## 9. Not yet covered (planned)

- Automated tests for the suggestion panel's React components (the panel is exercised through the API tests and the manual checks above).
- Automated accessibility checks (WCAG AA); manual checks only so far.
- Load testing beyond the timing assertions.
- Behaviour against the live Overpass service (deliberately not tested automatically).
