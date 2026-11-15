# Progress Notes – Phase II

What changed since Phase I, and why. Phase I notes are in the README status table and the Phase I section of `docs/TESTING.md`.

## Summary

Phase I proved the CPAN 314 planner still works end to end and prepared the data layer. Phase II delivers the feature the Revised Proposal names as the focus of CPAN 324, **Smart Attraction Suggestions**, and connects it to the itinerary workflow: the application reads a group's itinerary, finds the free time between attractions already scheduled, and shows ranked nearby points of interest in the itinerary, each with a reason and a score. The group can add a suggestion to the day, dismiss it, and change the weight of popularity, cost, duration and detour.

## Features delivered (traceability to the Revised Proposal)

| Feature | Proposal reference | Owner | Where |
| --- | --- | --- | --- |
| Recommendation engine: gap detection, weighted scoring, generate and rank | 3.1 suggestion engine; 5 recommendation engine | Henry | `server/src/services/recommendation/` |
| Suggestions shown in the itinerary, each with a short reason, and an **Add to itinerary** action | 3.1 "surfaced within the itinerary builder… with an Add to itinerary action" | Han-Pin | `client/src/components/SuggestionsPanel.jsx`, `ItineraryPanel.jsx` |
| **Dismiss** a suggestion (saved for the whole group) | 3.1 "members can dismiss a suggestion" | Jonathan, Han-Pin | `POST /suggestions/dismiss`, panel |
| **Adjustable weights** saved per trip | 3.1 "adjust the relative weighting of the scoring factors" | Jonathan, Han-Pin | `PUT /suggestions/weights`, weight sliders |
| **POI enrichment** from OpenStreetMap / Overpass, key-less, scoped to the destination | 5 recommendation engine data source | Jonathan | `server/src/services/poiService.js` |
| Curated POI dataset (111 Tokyo places) merged with Overpass results | 3.2 pool of at least 100 POIs | Henry | `server/src/data/pois/`, `poiPool.js` |
| Performance: suggestions under 2 seconds against 100+ POIs | 3.2 performance | Henry | measured in `docs/TESTING.md` |

## Phase I feedback and how it was addressed

| Feedback | Status | What was done / what remains |
| --- | --- | --- |
| Each member must submit the self-assessment form | **Team action** | Cannot be done in the repository. Each member submits their own form before the deadline. |
| Phase I commits came from one member in two large commits; every member should commit their own work from their own account throughout Phase II | **Addressed in part** | Phase II history on `main` now has commits from several accounts (Henry, Jonathan as `DSSparda`, Han-Pin as `HAN-PIN`), and Henry's work is in small single-purpose commits (geo helpers, weights, scoring, engine, pool adapter, route integration, tests, then one commit per document). Remaining members commit their own work from their own accounts. |

## Stakeholder Review Report 2

Meeting date October 18, 2026, with Chantal Nguyen. Owner: Han-Pin Hung. The report confirmed the Phase II scope and each member's role, set Week 8 as the completion target, and recorded no new change requests. It scored 3 of 3, with one request for the next report: record the stakeholder's feedback in more detail, even when it confirms the plan.

| Item from the report | Decision | How it was addressed |
| --- | --- | --- |
| Phase II follows the Project Plan: Smart Attraction Suggestions connected to the itinerary workflow | Proceed; Week 8 completion target | Engine, enrichment, suggestion panel, dismiss and weights are on `main` (table above) |
| Henry: RecommendationEngine scaffold, generate/rank logic, scoring and edge-case test support | Action item, Week 8 | Complete. 62 unit tests cover scoring, ranking and the engine, including edge cases: stops that do not fit, zero or maximum detour, missing coordinates, days with no anchor attraction, destinations with no POI data, all-zero or invalid weights, planned and dismissed stops |
| Supporting CRUD modules: "confirm final branch before submission wording" | Confirm the branch | The submission branch is `main`. Attractions, restaurants, transportation and budget CRUD are covered by automated tests on `main` (`api.test.js`, `attractionsGeo.test.js`, `primaryFlow.test.js`). The itinerary-builder branch's work reached `main` as part of the Phase II pull requests, and its route test was repaired and passes |
| Integration testing: "verify the final test count against the submitted branch" | Verify | Verified on `main` on 2026-10-25: 219 tests, all passing (104 at the end of Phase I). See `docs/TESTING.md` |
| Exit condition: ranked suggestions visible in the itinerary UI with Add to itinerary, dismiss and weighting controls working | Exit condition for Phase II | Implemented: the suggestion panel in the itinerary shows ranked cards with Add to itinerary, Dismiss and weight sliders, backed by the engine API and covered by the integration tests. The click-through is shown in the demo |
| All members support integration testing | Team action | `suggestions.integration.test.js`, `coreFlow.test.js` and `primaryFlow.test.js` are the integration suites; teammates add tests for their own work |
| Report 3 should record the stakeholder's feedback in more detail, even when it confirms the plan | Carry forward | Han-Pin: for Report 3, record what the stakeholder said about the suggestions (are the stops and reasons useful and trustworthy, rather than intrusive), questions asked, and requests, with the decision on each |

## What changed since Phase I

### Recommendation engine (Henry)

| Change | Why | Code |
| --- | --- | --- |
| **RecommendationEngine**, a pure service that takes plain trip data and a POI pool and returns suggestions | Proposal 3.1: "reads the trip's confirmed itinerary… identifies gaps". Kept free of Express and the database so it can be unit tested and its POI source swapped | `engine.js` |
| **Gap detection**: anchors are the day's located attractions in time order; gaps are the free time between them and after the last one | Proposal 3.1: "between two attractions already booked on the same day" | `buildDayGaps()` |
| **`calculateScore()`**: weighted popularity, cost, duration fit and detour, each mapped to 0–1 | Proposal 3.1: the four named scoring factors | `scoring.js` |
| **Travel-time and detour model** from straight-line distance | Live map and routing APIs are out of scope (Proposal section 2) | `geo.js` |
| **`generateSuggestions()` and `rankSuggestions()`**: ranked, deterministic tie-breaks, a reason such as "12 minutes off your route between A and B", and a suggested start time | Proposal 3.1: reasons; timeline week 7 | `engine.js` |
| **Weights** validated and normalised; default is equal weights, matching the sliders | Proposal 3.1: adjustable weighting | `weights.js` |
| **Integration with the suggestion route:** the route's own distance-based scoring was replaced by the engine, keeping the route's URLs, saved weights, dismissals and response fields, so the panel works unchanged and the scoring logic lives in one place | One scoring implementation to test and document | `routes/suggestions.js` |
| **POI pool:** curated dataset merged with Overpass results through an adapter; Overpass limited to 4 seconds, never blocks suggestions | Suggestions stay fast and work for any destination | `poiPool.js` |
| **Tests** for the engine, adapter, enrichment service and the whole API; coverage reporting | Phase II requires visible testing and QA | `server/tests/` |

### Design decisions

- **Pure engine, thin route.** All logic lives in the service; the route only reads the request and shapes the response. Most of the new tests are fast unit tests.
- **Factors are 0–1 with relative weights.** The group can say "favour low cost over popularity" without knowing the maths; weights are normalised so any scale works.
- **The duration factor peaks at 75% use of the free time**, rather than rewarding the shortest stop, so a gap is filled sensibly and stops that do not fit are excluded.
- **Planned and dismissed stops are never suggested**, whether they were added as an attraction (by id or name) or as an itinerary activity (by name).
- **Curated data first, Overpass as enrichment.** Curated places carry real ratings, fees and visit times; Overpass adds coverage and other destinations but only rough estimates, so duplicates keep the curated record.
- **Honest empty states.** A day without a located attraction ranks on the other three factors and says why; a destination with no data returns an empty list, not an error.

### Teammates' work (summaries for the record; owners keep their own notes)

- **Jonathan:** POI enrichment service (Nominatim geocoding, three Overpass servers with fallback, in-memory cache); weights and dismissal routes saved on the trip; core-flow tests.
- **Han-Pin:** suggestion panel in the itinerary (cards, Add to itinerary, Dismiss, weight sliders); repaired itinerary route test; Stakeholder Review Report 2.
- **Vedant:** scoring co-ownership, accessibility and documentation: owner to update.

### Testing (see `docs/TEST_PLAN.md` and `docs/TESTING.md`)

- 115 new server tests; the suite grew from 104 to **219 tests, all passing**.
- Server coverage is now reported (`npm run test:coverage --workspace server`): 93.7% statements overall, 100% for the recommendation module.
- Suggestions take about 4 ms in the engine for a 7-day trip against the 111-POI pool (requirement: under 2 seconds).

## Known limitations

- Only Tokyo has curated POI data; other destinations rely on Overpass, which gives rough estimates of cost, visit time and popularity.
- Curated coordinates, ratings and fees are hand-written and approximate.
- Cost is scored from a price tier, not yet against the group's budget category.
- Distances are straight-line estimates, not routed.
- Some components are not used by the app: the itinerary branch's `ItineraryBuilder`, `ActivityForm` and `ConflictBanner`, and the earlier `SuggestionCard` and `SuggestionWeights` (superseded by the suggestion panel and `ItineraryPanel`). They can be removed.
- The React suggestion panel has no component tests yet.

## Next (Phase III)

- Accessibility pass (WCAG AA, aria-live, focus) and print stylesheet.
- Suggestion-scoring edge cases against enriched data; performance tuning and the 3-second page-load target.
- Final scoring write-up, building on `docs/SCORING.md`.
