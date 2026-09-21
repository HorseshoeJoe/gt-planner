import { Restaurants } from '../db/index.js';
import { createCollectionRouter } from './collection.js';

/** Class diagram: Restaurant { restaurantId, name, cuisine, priceRange } */
export default createCollectionRouter({
  store: Restaurants,
  label: 'restaurant',
  requiredFields: ['name'],
  editableFields: ['name', 'cuisine', 'priceRange', 'address', 'reservationNotes'],
  sortBy: 'createdAt',
});
