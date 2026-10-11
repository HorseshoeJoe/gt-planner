# Phase I Demo Script (3–5 minutes)

Setup before recording: `npm run seed`, then `npm run dev`. Open **two browser windows** (one normal, one private): henry in the first, chantal in the second. Both password `Password123`.

| Time | Show | Say (design decision) |
| --- | --- | --- |
| 0:00 | Title, team, goal | This is the CPAN 314 planner carried forward; Phase I proves the core flow still works and prepares the data layer for Smart Attraction Suggestions. |
| 0:30 | Henry's dashboard → open **Tokyo Trip** | One shared workspace per trip; every change shows who made it and when. |
| 1:00 | **Members** tab; in window 2 sign in as chantal → **Join a trip** → paste code | Invite by code, username or email. Status flips *pending → joined*. Admin vs. member roles. |
| 1:45 | **Itinerary**: add an overlapping activity, read the clash message, then **Save anyway** | Conflicts are caught on type and on save, name the exact clash, and the group can still override. |
| 2:30 | **Attractions**, **Restaurants**, **Transport**: add/edit/delete one each; show the other window updating | Polling every 20 s was agreed with the stakeholder instead of WebSockets. |
| 3:15 | **Budget**: add an expense, **Split evenly**, show balances | Even split reconciles to the cent; per-member owed / paid / balance. |
| 3:45 | **View full itinerary** | Read-only chronological summary; print stylesheet. |
| 4:15 | VS Code: `server/src/data/pois/tokyo.json` (111 POIs), `server/src/db/store.js`, then run `npm test` | What changed for CPAN 324: POI dataset scoped per destination, attractions now carry coordinates, data model documented. Tests prove the primary flow. |
| 4:45 | Close: Phase II = RecommendationEngine and suggestion UI | |

Questions to be ready for: *Why a JSON store?* (runs with `npm install` only; the `find/findOne/insert/update/remove` interface isolates storage so MongoDB is a one-module change.) *Why are POIs not a collection?* (static reference data; keeps the eight documented collections and survives reset.) *Why polling?* (accepted by the stakeholder; no socket infrastructure for a classroom prototype.)
