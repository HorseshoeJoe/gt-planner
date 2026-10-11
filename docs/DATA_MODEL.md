# Data Model

Phase I data model for the Group Travel Planner (CPAN 324 Revised Proposal v2.0, section 4: *eight application collections* plus the document-database interface).

## Storage

User data is stored in a single JSON file, `server/data.json`, as an object with one array per collection. `server/src/db/store.js` is the only module that reads or writes it, and exposes a document-database interface per collection:

| Method | Purpose |
| --- | --- |
| `find(predicate)` / `findOne(predicate)` / `findById(id)` / `all()` | Read (always returns copies) |
| `insert(doc)` | Adds `_id` (UUID), `createdAt`, `updatedAt` |
| `update(id, patchOrFn)` | Merge a patch, or mutate a draft; refreshes `updatedAt` |
| `remove(id)` / `removeWhere(predicate)` | Delete |
| `count(predicate)` | Count |

Every document has `_id`, `createdAt`, `updatedAt`. Relationships are stored as `_id` strings (the code "hydrates" them for the client the way `populate()` would in Mongoose). Because routes only use this interface, moving to MongoDB would be a change to `store.js` alone.

## Collections

### users
`username` (unique, case-insensitive), `email` (unique), `passwordHash` (bcrypt, never sent to the client), `displayName`

### trips
`title`, `destination`, `startDate`, `endDate` (`YYYY-MM-DD`), `description`, `createdBy` → users, `inviteCode` (8 chars), `members[]`, `lastActivityAt`, `lastActivityBy` → users, `lastActivityLabel`

`members[]` entries: `_id`, `userId` → users, `role` (`admin` | `member`), `status` (`pending` | `joined`), `invitedAt`, `joinedAt`. Maximum 20 per trip.

### invitations
`tripId` → trips, `invitedUserId` → users, `invitedIdentifier`, `invitedById` → users, `inviteCode`, `status` (`pending` | `accepted`), `respondedAt`

### itineraries (one document per trip day)
`tripId` → trips, `date`, `notes`, `activities[]`

`activities[]` entries: `_id`, `title`, `startTime`, `endTime` (`HH:MM`), `category` (sightseeing, food, rest, transit), `notes`, `createdBy` → users, `createdAt`. Overlaps are rejected unless the request sets `force`.

### attractions
`tripId` → trips, `name`, `description`, `rating`, `mapLink`, `visitDate`, `createdBy` → users
**New in Phase I:** `latitude`, `longitude` (optional; both or neither; valid ranges enforced) and `poiId` (optional link to the POI dataset). The suggestion engine uses coordinates on scheduled attractions to measure detour cost.

### restaurants
`tripId` → trips, `name`, `cuisine`, `priceRange`, `address`, `reservationNotes`, `createdBy` → users

### transportation
`tripId` → trips, `type`, `provider`, `fromLocation`, `toLocation`, `departureTime`, `arrivalTime`, `bookingReference`, `notes`, `createdBy` → users

### budgetItems
`tripId` → trips, `description`, `category` (accommodation, food, activities, transport, other), `estimatedAmount`, `actualAmount`, `currency`, `paidBy` → users, `splitEvenly`, `splitBetween[]` → users, `createdBy` → users

## POI dataset (new in Phase I, not a collection)

Points of interest are static reference data, so they live in `server/src/data/pois/<destination>.json` rather than in `data.json`. This keeps the application at eight collections and means `npm run reset` never removes them. `server/src/db/pois.js` loads them read-only and scopes lookups to one destination, so scoring cost does not grow as destinations are added.

File shape: `{ destination, country, aliases[], currency, source, pois[] }`

Each POI: `id` (`<destination>-<slug>`), `name`, `category`, `area`, `latitude`, `longitude`, `popularity` (1–5), `entryFeeJPY` (0 = free), `costTier` (0 free, 1 ≤ ¥1,000, 2 ≤ ¥3,000, 3 above), `avgVisitMinutes`.

These map onto the four scoring factors in proposal section 3.1: popularity → `popularity`; cost → `entryFeeJPY` / `costTier`; average visit duration → `avgVisitMinutes`; detour cost → `latitude` / `longitude` compared with the trip's located attractions.

Currently available: Tokyo (111 POIs). The dataset was hand-curated; coordinates and fees are approximate and are to be verified by the Phase II Overpass enrichment.

## Relationships

```
users ─┬─< trips.members (userId)          trips ─┬─< itineraries.tripId
       ├─< trips.createdBy                         ├─< attractions.tripId ··· poiId → POI dataset
       └─< invitations.invitedUserId               ├─< restaurants.tripId
                                                   ├─< transportation.tripId
                                                   ├─< budgetItems.tripId
                                                   └─< invitations.tripId
```

Deleting a trip removes its itineraries, attractions, restaurants, transportation, budget items and invitations (admin only).
