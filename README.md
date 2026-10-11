# Group Travel Planner

A collaborative web application that lets a small travel group plan a trip together from one shared workspace: itinerary, attractions, restaurants, transportation and a shared budget, all in one place.

**CPAN 324 – Project Development II · Group 3** — Henry Dineros, Han-Pin Hung, Jonathan Pipim, Vedant Patel
**Stakeholder:** Chantal Nguyen (student / frequent traveller)
**Baseline:** the CPAN 314 prototype, extended in CPAN 324 with **Smart Attraction Suggestions**.

---

## Project status

| Phase | Scope | State |
| --- | --- | --- |
| CPAN 314 baseline | Collaborative planner (everything under "Features" below) | Carried forward, verified working |
| **Phase I** (this submission) | Verify the core planner end to end, document and update the data model, add the destination POI dataset the suggestion engine will read | **Complete** |
| Phase II | RecommendationEngine, `calculateScore()`, POI enrichment, suggestion UI, dismiss + adjustable weights | Not started |
| Phase III | Accessibility pass, print stylesheet, whole-cent split reconciliation, scoring tests, performance tuning | Not started |

### What changed in Phase I
- **POI dataset:** 111 curated Tokyo points of interest in `server/src/data/pois/tokyo.json`, with a read-only, destination-scoped loader (`server/src/db/pois.js`). More destinations are added by dropping in another JSON file.
- **Attractions are now locatable:** `latitude`, `longitude` and `poiId` fields (validated) so the suggestion engine can measure detours from scheduled stops.
- **Data model documented:** see [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).
- **Primary-flow acceptance test** and recorded test evidence: see [`docs/TESTING.md`](docs/TESTING.md).

---

## Features

- **Accounts:** register, sign in with username *or* email, JWT sessions that survive a page refresh, bcrypt-hashed passwords.
- **Trips and collaboration:** create a trip; invite members by username/email or share an 8-character invite code; members show as *pending* or *joined*; the creator is admin (can remove members and delete the trip), every member can edit shared content. Up to 20 members per trip.
- **Daily itinerary builder:** time-blocked activities with categories and notes. Overlaps are flagged as you type and again on save, naming the exact clash, with an explicit **Save anyway** override.
- **Attractions, restaurants, transportation:** full add / edit / delete for each.
- **Budget tracker:** estimated vs. actual expenses, category totals, one-click even split, per-member owed / paid / balance.
- **Full itinerary view:** a read-only, chronological summary of the whole trip with a print / save-as-PDF button. Items outside the trip dates are listed as "not yet scheduled".
- **Near real-time collaboration:** the workspace re-fetches shared data every 20 seconds and shows who last changed what and when (polling, not WebSockets — agreed with the stakeholder).
- **Accessible, responsive UI** (desktop and mobile).

**Out of scope (confirmed with the stakeholder):** live map integration, third-party booking APIs, in-app chat, real payment transfer, cloud deployment.

---

## Quick start

Requires **Node.js 18.18 or newer** (LTS recommended). No database server and no `.env` file are needed.

```bash
git clone https://github.com/HorseshoeJoe/gt-planner.git
cd gt-planner
npm install
npm run dev
```

Then open **http://localhost:5173** (the API runs on http://localhost:5000).

A step-by-step guide for first-time terminal users is in [`SETUP.md`](SETUP.md).

### Load the demo trip (optional)

```bash
npm run seed
```

This replaces any existing data with three demo accounts and a fully populated four-day Tokyo trip.

| Username | Password |
| --- | --- |
| `henry` | `Password123` |
| `hanpin` | `Password123` |
| `chantal` | `Password123` (has a *pending* invitation — sign in and use **Join a trip** with the code the seed command prints) |

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts API (port 5000) and React client (port 5173) together |
| `npm run seed` | Loads the demo trip (replaces existing data) |
| `npm run reset` | Empties the data file |
| `npm test` | Runs the server and client test suites |
| `npm run test:server` / `npm run test:client` | Run one suite |
| `npm run build` | Production build of the client |

Optional environment variables: `PORT`, `DATA_FILE`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_ORIGIN` (all have working defaults — see `server/src/config.js`).

---

## Primary user flow (what to try)

1. **Register** two accounts (use a second private window for the second user).
2. **Create a trip** (name, destination, dates). You become its admin.
3. **Members tab:** copy the invite code. In the other window choose **Join a trip** and paste it — the member flips from *Invite pending* to *Joined*.
4. **Itinerary tab:** add activities to a day. Add one that overlaps — you are told exactly what it clashes with and can choose **Save anyway**.
5. **Attractions / Restaurants / Transport tabs:** add, edit and delete entries; the other window updates within 20 seconds.
6. **Budget tab:** add expenses, press **Split evenly**, and check the per-member balances.
7. **View full itinerary:** the whole trip in order, ready to print.

This exact flow is also run automatically by `server/tests/primaryFlow.test.js`.

---

## Architecture

```
client/   React 18 + Vite + Tailwind CSS (shared component library in src/components/ui.jsx)
server/   Node.js + Express API
  src/routes/      HTTP routes (auth, trips, itinerary, attractions, restaurants, transportation, budget)
  src/db/store.js  JSON document store: find / findOne / insert / update / remove
  src/db/index.js  Typed collections + helpers (hashing, hydrating trips)
  src/db/pois.js   Read-only POI dataset loader (destination-scoped)
  src/data/pois/   Curated POI datasets, one JSON file per destination
  src/utils/       Budget maths, time-conflict detection, helpers
  tests/           Vitest + Supertest suites
docs/     Data model and testing evidence
```

- **Storage:** all user data lives in one file, `server/data.json` (git-ignored; created on first run). The store exposes a document-database interface, so route code never touches the file directly and a future MongoDB move is a one-module change. Writes are atomic (temp file + rename), and a corrupt file is backed up rather than overwritten.
- **Security:** bcrypt password hashes (never returned by the API), JWT-protected routes, membership checks on every trip route, admin-only member removal and trip deletion.
- **Data model:** eight collections plus a static POI dataset — see [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md).

---

## Testing

```bash
npm test
```

Server tests cover accounts, trips and invitations, itinerary conflicts, all four CRUD modules, budget maths, the JSON store, the POI dataset and a full primary-flow acceptance test. Client tests cover the create-trip form and dialogs. Results and how to reproduce them: [`docs/TESTING.md`](docs/TESTING.md).

---

## Team

| Member | Phase I focus |
| --- | --- |
| Henry Dineros | Repository and data-store work; POI dataset; attractions / restaurants / transport / budget CRUD |
| Han-Pin Hung | Trip CRUD, invitations and member roles; Stakeholder Review Report 1 |
| Jonathan Pipim | Itinerary builder and conflict detection; POI preparation |
| Vedant Patel | Authentication; budget CRUD; scoring and accessibility preparation |

## Documents

Revised Proposal v2.0, Project Plan and the 14-week timeline are submitted separately through the course site.
