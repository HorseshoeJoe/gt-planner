# Suggestion Scoring – How Smart Attraction Suggestions Work

Working write-up of the scoring logic (Revised Proposal v2.0, sections 3.1 and 4). Code: `server/src/services/recommendation/`.

## What the engine does

For the day the user is viewing, the engine:

1. **Finds the group's anchors** – attractions scheduled that day that have a location (`latitude`/`longitude`). Each is matched by name to its itinerary activity to learn its time slot, and anchors are put in visiting order.
2. **Finds the gaps** – the free time *between* each pair of consecutive anchors, plus the time *after* the last one until 21:00. A gap with no free time is dropped. If an anchor has no matching activity time, the gap is assumed to be 180 minutes.
3. **Builds the candidate pool** (`poiPool.js`) – the curated points of interest for the trip's destination (`server/src/data/pois/`) plus places returned by the Overpass enrichment service. Overpass results are converted to the same shape and added only if the curated data does not already have a place of that name. If Overpass is slow (more than 4 seconds) or unavailable, the curated pool is used on its own; a destination with no curated data uses Overpass alone.
4. **Removes anything already planned** (as an attraction, by `poiId` or name, or as an itinerary activity, by name) and anything the group dismissed.
5. **Scores every candidate in every gap** with `calculateScore()`, drops stops that do not fit or are more than 60 minutes off route, and keeps each stop's best gap.
6. **Ranks** with `rankSuggestions()` and returns the top 10, each with a short reason such as *"12 minutes off your route between Senso-ji Temple and teamLab Planets"* and a suggested start time (the previous attraction's end plus travel time).

If the day has no located attraction there is nothing to measure a detour from, so the engine ranks on popularity, cost and duration alone, labels the suggestions "Popular attraction that may fit this itinerary day", and adds a note asking the group to add an attraction with a location.

## The formula

```
score = 100 × ( w_popularity × popularity
              + w_cost       × cost
              + w_duration   × duration
              + w_detour     × detour )
```

Each factor is first mapped onto **0 to 1, where 1 is best for the group**, so weights can be compared directly.

| Factor | Input | Mapping |
| --- | --- | --- |
| **Popularity** | POI rating, 1–5 (Overpass: `popularityScore` 0–1 becomes `1 + 4 × score`) | `(rating − 1) / 4` |
| **Cost** | POI `costTier` (curated: 0 free, 1 ≤ ¥1,000, 2 ≤ ¥3,000, 3 above; Overpass: estimate 0 → 0, ≤ 20 → 1, ≤ 60 → 2, else 3) | tier 0 → 1.00, 1 → 0.75, 2 → 0.40, 3 → 0.10; unknown → 0.40 |
| **Duration fit** | typical visit minutes + detour minutes vs. free minutes in the gap | If it does not fit, the stop is excluded. Otherwise `1 − |u − 0.75| / 0.75`, where `u` = time needed ÷ free time. Peaks when the stop uses about 75% of the free time. |
| **Detour** | extra travel minutes to visit the stop | `1 − minutes / 60`, floored at 0 |

**Why the duration factor peaks at 75%:** a 20-minute stop in a four-hour gap wastes the gap, and a stop that only just squeezes in leaves no slack. Aiming for about three quarters of the free time rewards stops that fill the gap comfortably.

**Weights:** each trip stores its own weights (`trip.suggestionWeights`, set from the sliders in the suggestion panel). They are *relative* values, so any scale works; they are normalised to sum to 1 before scoring. The default is equal weights (25 each): no factor is favoured until the group says so. Negative or non-numeric values and all-zero weights are rejected. Setting cost to 100 and the rest to 0 ranks purely by price; setting popularity to 100 ranks purely by rating.

## Travel-time model

Live routing and map APIs are out of scope, so travel time is estimated from straight-line (haversine) distance:

```
minutes(km) = min( 12 × km ,  5 + 3 × km )      # walk vs. transit (≈20 km/h plus 5 min overhead)
```

**Detour** for a stop *P* between *A* and *B*:

```
detour = minutes(A→P) + minutes(P→B) − minutes(A→B)
```

At the end of a day (no next stop) the detour is simply `minutes(A→P)`. The model is non-decreasing and subadditive, so a detour can never come out negative; even a stop exactly on the route costs a few minutes because each extra leg pays the transit overhead.

## Worked example

Senso-ji Temple (09:00–11:00) and teamLab Planets (15:00–17:00) on the same day leave a 240-minute gap. For **Ueno Park** (rating 4.5, free, 90-minute visit) the detour is 12 minutes. With the default equal weights:

| Factor | Value | Weight | Contribution |
| --- | --- | --- | --- |
| Popularity | (4.5 − 1) / 4 = 0.875 | 0.25 | 0.219 |
| Cost | tier 0 → 1.000 | 0.25 | 0.250 |
| Duration | (90 + 12) / 240 = 0.425 → 1 − \|0.425 − 0.75\| / 0.75 = 0.567 | 0.25 | 0.142 |
| Detour | 1 − 12 / 60 = 0.800 | 0.25 | 0.200 |
| **Score** | | | **81.1 / 100** (the engine reports 81.2 because it uses the unrounded detour of about 11.6 minutes) |

## API

All routes are under `/api/trips/:tripId/suggestions` and require a signed-in trip member.

| Route | Purpose |
| --- | --- |
| `GET /?date=YYYY-MM-DD` | Ranked suggestions for one day (the engine) |
| `GET /preferences` | The trip's saved weights and dismissed suggestion ids |
| `PUT /weights` | Save weights `{ popularity, cost, duration, detour }` for the trip (non-negative, not all zero) |
| `POST /dismiss` | Dismiss a suggestion `{ suggestionId }`; it is left out for the whole group from then on |

`GET /?date=` response: `{ date, weights, suggestions, note?, meta }`. Each suggestion has `id`, `name`, `latitude`, `longitude`, `category`, `estimatedCost`, `estimatedDurationMinutes`, `popularityScore`, `detourMinutes`, `score`, `factors`, `gap`, `availableMinutes`, `source` (`curated` or `overpass`), `startTime` and `reason`. `meta` has `poolSize`, `candidates`, `evaluated`, `elapsedMs` and `sources`.

## Performance

The proposal requires suggestions for a day's itinerary in under 2 seconds against a pool of at least 100 POIs. The engine itself is far inside that: a 7-day trip with 3 attractions per day against the 111-POI Tokyo pool takes a median of about 4 ms (worst of 20 runs about 46 ms), and a synthetic 1,000-POI pool across 7 busy days is asserted under 2 seconds in the automated tests. A full request to the running server with the seeded trip returned in about 135 ms. The only slow step is the optional Overpass lookup, which is capped at 4 seconds and cached by the enrichment service after the first success.

## Known limitations

- Curated POI coordinates, ratings and fees were written by hand and are approximate. Overpass results carry only rough estimates (fee yes/no, a fixed 60-minute visit, popularity from whether the place has a Wikipedia entry), so they score less precisely than curated places.
- Cost uses a price tier only; it is not yet compared against the group's budget category.
- Distances are straight-line, not routed.
- Only Tokyo has a curated dataset; other destinations rely on Overpass.
- Demand on the free public Overpass servers can make the enrichment slow or unavailable; the curated data and the 4-second limit keep suggestions working.
