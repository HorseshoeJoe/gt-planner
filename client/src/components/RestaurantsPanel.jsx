import CollectionPanel from './CollectionPanel.jsx';
import { Badge } from './ui.jsx';

export default function RestaurantsPanel({ trip, onChanged }) {
  return (
    <CollectionPanel
      trip={trip}
      onChanged={onChanged}
      resource="restaurants"
      noun="Restaurant"
      title="Restaurant recommendations"
      subtitle="Dining ideas the whole group can add to and vote on in person."
      addLabel="Add restaurant"
      emptyTitle="No restaurants saved yet"
      emptyMessage="Add places to eat with cuisine, price range and reservation notes."
      fields={[
        { name: 'name', label: 'Restaurant name', required: true, full: true },
        { name: 'cuisine', label: 'Cuisine', hint: 'e.g. Ramen, Italian' },
        {
          name: 'priceRange',
          label: 'Price range',
          type: 'select',
          defaultValue: '$$',
          options: [
            { value: '$', label: '$ — budget' },
            { value: '$$', label: '$$ — moderate' },
            { value: '$$$', label: '$$$ — pricey' },
            { value: '$$$$', label: '$$$$ — splurge' },
          ],
        },
        { name: 'address', label: 'Address', full: true },
        { name: 'reservationNotes', label: 'Reservation notes', type: 'textarea', full: true },
      ]}
      renderItem={(item) => (
        <>
          <p className="font-semibold text-slate-900">{item.name}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {item.cuisine && <Badge tone="blue">{item.cuisine}</Badge>}
            <Badge tone="green">{item.priceRange}</Badge>
          </div>
          {item.address && <p className="mt-2 text-sm text-slate-600">{item.address}</p>}
          {item.reservationNotes && <p className="mt-1 text-sm italic text-slate-600">{item.reservationNotes}</p>}
        </>
      )}
    />
  );
}
