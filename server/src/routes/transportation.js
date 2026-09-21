import { Transportation } from '../db/index.js';
import { createCollectionRouter } from './collection.js';

/** Class diagram: Transportation { transportId, type, departureTime, arrivalTime } */
export default createCollectionRouter({
  store: Transportation,
  label: 'transportation entry',
  requiredFields: ['type'],
  editableFields: [
    'type', 'provider', 'fromLocation', 'toLocation',
    'departureTime', 'arrivalTime', 'bookingReference', 'notes',
  ],
  sortBy: 'departureTime',
});
