import { Attractions } from '../db/index.js';
import { createCollectionRouter } from './collection.js';

/** Class diagram: Attraction { attractionId, name, description, rating } */
export default createCollectionRouter({
  store: Attractions,
  label: 'attraction',
  requiredFields: ['name'],
  editableFields: ['name', 'description', 'rating', 'mapLink', 'visitDate'],
  sortBy: 'createdAt',
});
