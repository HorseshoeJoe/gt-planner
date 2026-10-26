/**
 * Optional demo data loader:  npm run seed  (from the project root)
 *
 * Creates three demo accounts and one fully populated trip so the prototype can
 * be marked without hand-entering data first. Running it replaces any existing
 * data, so it is also a quick way to get back to a known state.
 */
import { clearAll, dataFilePath } from './db/store.js';
import {
  Users, Trips, Itineraries, Attractions, Restaurants, Transportation, BudgetItems, Invitations,
  hashPassword, generateId,
} from './db/index.js';
import { generateInviteCode } from './utils/helpers.js';

const now = () => new Date().toISOString();

const DEMO = [
  { username: 'henry', email: 'henry@example.com', displayName: 'Henry Dineros' },
  { username: 'hanpin', email: 'hanpin@example.com', displayName: 'Han-Pin Hung' },
  { username: 'chantal', email: 'chantal@example.com', displayName: 'Chantal Nguyen' },
];

async function run() {
  clearAll();

  const users = [];
  for (const spec of DEMO) {
    users.push(Users.insert({ ...spec, passwordHash: await hashPassword('Password123') }));
  }
  const [henry, hanpin, chantal] = users;

  const inviteCode = generateInviteCode();
  const trip = Trips.insert({
    title: 'Tokyo Trip',
    destination: 'Tokyo, Japan',
    startDate: '2026-09-14',
    endDate: '2026-09-17',
    description: 'Four days in Tokyo — the demo dataset for CPAN 314 Phase 2.',
    createdBy: henry._id,
    inviteCode,
    members: [
      { _id: generateId(), userId: henry._id, role: 'admin', status: 'joined', invitedAt: now(), joinedAt: now() },
      { _id: generateId(), userId: hanpin._id, role: 'member', status: 'joined', invitedAt: now(), joinedAt: now() },
      // Left pending on purpose so the member status indicator has something to show.
      { _id: generateId(), userId: chantal._id, role: 'member', status: 'pending', invitedAt: now(), joinedAt: null },
    ],
    lastActivityAt: now(),
    lastActivityBy: henry._id,
    lastActivityLabel: 'Demo data loaded',
  });

  Invitations.insert({
    tripId: trip._id,
    invitedUserId: chantal._id,
    invitedIdentifier: 'chantal',
    invitedById: henry._id,
    inviteCode,
    status: 'pending',
    respondedAt: null,
  });

  const activity = (title, startTime, endTime, category, createdBy) => ({
    _id: generateId(), title, startTime, endTime, category, notes: '', createdBy, createdAt: now(),
  });

  Itineraries.insert({
    tripId: trip._id,
    date: '2026-09-14',
    notes: 'Arrival day — keep it light.',
    activities: [
      activity('Land at Haneda Airport', '09:30', '10:30', 'transit', henry._id),
      activity('Check in at hotel', '12:00', '13:00', 'rest', henry._id),
      activity('Dinner in Shibuya', '18:30', '20:00', 'food', hanpin._id),
    ],
  });

  Itineraries.insert({
    tripId: trip._id,
    date: '2026-09-15',
    notes: 'Full sightseeing day.',
    activities: [
      activity('Senso-ji Temple', '09:00', '11:00', 'sightseeing', hanpin._id),
      activity('Lunch in Asakusa', '12:00', '13:00', 'food', hanpin._id),
      activity('teamLab Planets', '15:00', '17:00', 'sightseeing', henry._id),
    ],
  });

  Attractions.insert({
    tripId: trip._id, name: 'Senso-ji Temple', description: 'Oldest temple in Tokyo.',
    rating: 5, visitDate: '2026-09-15', mapLink: 'https://maps.google.com/?q=Senso-ji', createdBy: hanpin._id,
    latitude: 35.7148, longitude: 139.7967, poiId: 'tokyo-senso-ji-temple',
  });
  // A second located attraction on the same day gives the suggestion engine a
  // gap to work with (Senso-ji ends 11:00, teamLab starts 15:00).
  Attractions.insert({
    tripId: trip._id, name: 'teamLab Planets', description: 'Immersive digital art museum.',
    rating: 5, visitDate: '2026-09-15', mapLink: null, createdBy: henry._id,
    latitude: 35.6492, longitude: 139.7896, poiId: 'tokyo-teamlab-planets',
  });
  Attractions.insert({
    tripId: trip._id, name: 'Shibuya Sky', description: 'Rooftop observation deck.',
    rating: 4, visitDate: null, mapLink: null, createdBy: henry._id,
    latitude: 35.6585, longitude: 139.7021, poiId: 'tokyo-shibuya-sky',
  });

  Restaurants.insert({
    tripId: trip._id, name: 'Ichiran Shibuya', cuisine: 'Ramen', priceRange: '$$',
    address: 'Shibuya, Tokyo', reservationNotes: 'No reservations — queue early.', createdBy: hanpin._id,
  });
  Restaurants.insert({
    tripId: trip._id, name: 'Sushi Zanmai', cuisine: 'Sushi', priceRange: '$$$',
    address: 'Tsukiji, Tokyo', reservationNotes: null, createdBy: henry._id,
  });

  Transportation.insert({
    tripId: trip._id, type: 'flight', provider: 'Air Canada AC001',
    fromLocation: 'Toronto (YYZ)', toLocation: 'Tokyo (HND)',
    departureTime: '2026-09-13T13:30', arrivalTime: '2026-09-14T09:30',
    bookingReference: 'AC7X2Q', notes: null, createdBy: henry._id,
  });
  Transportation.insert({
    tripId: trip._id, type: 'local transit', provider: 'Tokyo Metro 72h pass',
    fromLocation: null, toLocation: null, departureTime: null, arrivalTime: null,
    bookingReference: null, notes: 'Buy at the airport station.', createdBy: hanpin._id,
  });

  const joined = [henry._id, hanpin._id];
  const expense = (description, category, estimatedAmount, actualAmount, paidBy) =>
    BudgetItems.insert({
      tripId: trip._id, description, category, estimatedAmount, actualAmount,
      currency: 'CAD', paidBy, splitEvenly: true, splitBetween: joined, createdBy: paidBy,
    });

  expense('Hotel — 3 nights', 'accommodation', 900, 870, henry._id);
  expense('Return flights', 'transport', 2400, 2400, hanpin._id);
  expense('teamLab tickets', 'activities', 120, 0, henry._id);
  expense('Food budget', 'food', 600, 240, hanpin._id);

  console.log('');
  console.log('  Demo data loaded into ' + dataFilePath());
  console.log('');
  console.log('  Sign in with:   henry   / Password123');
  console.log('              or  hanpin  / Password123');
  console.log('');
  console.log(`  "chantal" has a pending invitation. Invite code: ${inviteCode}`);
  console.log('  Sign in as chantal / Password123 and use "Join a trip" to accept it.');
  console.log('');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
