import CollectionPanel from './CollectionPanel.jsx';
import { Badge } from './ui.jsx';

function when(value) {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TransportationPanel({ trip, onChanged }) {
  return (
    <CollectionPanel
      trip={trip}
      onChanged={onChanged}
      resource="transportation"
      noun="Transport entry"
      itemLabel={(i) => [i.type, i.fromLocation && i.toLocation ? `${i.fromLocation} → ${i.toLocation}` : ''].filter(Boolean).join(' ')}
      title="Transportation"
      subtitle="Flights, trains, rentals and local transit — with booking references in one place."
      addLabel="Add transport"
      emptyTitle="No transport logged yet"
      emptyMessage="Add flights, trains or rentals so nobody has to dig through their email."
      fields={[
        {
          name: 'type',
          label: 'Type',
          type: 'select',
          required: true,
          defaultValue: 'flight',
          options: ['flight', 'train', 'bus', 'car rental', 'local transit', 'other'].map((v) => ({
            value: v,
            label: v.charAt(0).toUpperCase() + v.slice(1),
          })),
        },
        { name: 'provider', label: 'Provider / number', hint: 'e.g. Air Canada AC001' },
        { name: 'fromLocation', label: 'From' },
        { name: 'toLocation', label: 'To' },
        { name: 'departureTime', label: 'Departure', type: 'datetime-local' },
        { name: 'arrivalTime', label: 'Arrival', type: 'datetime-local' },
        { name: 'bookingReference', label: 'Booking reference', full: true },
        { name: 'notes', label: 'Notes', type: 'textarea', full: true },
      ]}
      renderItem={(item) => (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">{item.type}</Badge>
            {item.bookingReference && <Badge tone="slate">Ref {item.bookingReference}</Badge>}
          </div>
          <p className="mt-2 font-semibold text-slate-900">{item.provider || '—'}</p>
          {(item.fromLocation || item.toLocation) && (
            <p className="mt-1 text-sm text-slate-700">
              {item.fromLocation || '?'} → {item.toLocation || '?'}
            </p>
          )}
          {when(item.departureTime) && (
            <p className="mt-1 text-sm text-slate-600">
              Departs {when(item.departureTime)}
              {when(item.arrivalTime) ? ` · Arrives ${when(item.arrivalTime)}` : ''}
            </p>
          )}
          {item.notes && <p className="mt-1 text-sm italic text-slate-600">{item.notes}</p>}
        </>
      )}
    />
  );
}
