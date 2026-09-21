import CollectionPanel from './CollectionPanel.jsx';
import { Badge } from './ui.jsx';

export default function AttractionsPanel({ trip, onChanged }) {
  return (
    <CollectionPanel
      trip={trip}
      onChanged={onChanged}
      resource="attractions"
      noun="Attraction"
      title="Attractions & points of interest"
      subtitle="Places the group wants to see. Assign a date to pin one to a day of the itinerary."
      addLabel="Add attraction"
      emptyTitle="No attractions saved yet"
      emptyMessage="Add the landmarks, museums or viewpoints your group is interested in."
      fields={[
        { name: 'name', label: 'Name', required: true, full: true },
        { name: 'description', label: 'Description', type: 'textarea', full: true },
        {
          name: 'rating',
          label: 'Group rating',
          type: 'select',
          allowEmpty: true,
          options: [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${'★'.repeat(n)} (${n})` })),
        },
        { name: 'visitDate', label: 'Planned visit date', type: 'date', hint: 'Optional.' },
        { name: 'mapLink', label: 'Map link', type: 'url', hint: 'Paste a Google Maps URL.', full: true },
      ]}
      renderItem={(item) => (
        <>
          <p className="font-semibold text-slate-900">{item.name}</p>
          {item.description && <p className="mt-1 text-sm text-slate-600">{item.description}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {item.rating ? <Badge tone="amber">{'★'.repeat(item.rating)}</Badge> : null}
            {item.visitDate ? <Badge tone="blue">{item.visitDate}</Badge> : null}
            {item.mapLink ? (
              <a href={item.mapLink} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand-700 underline">
                Open in maps
              </a>
            ) : null}
          </div>
        </>
      )}
    />
  );
}
