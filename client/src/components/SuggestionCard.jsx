import { useState } from 'react';

export default function SuggestionCard({ tripId, suggestion, onDismiss, onAdd }) {
    const [dismissing, setDismissing] = useState(false);

    const handleDismiss = async () => {
        setDismissing(true);
        await fetch(`/api/trips/${tripId}/suggestions/dismiss`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ suggestionId: suggestion.osmId }),
        });
        if (onDismiss) onDismiss(suggestion.osmId);
    };

    return (
        <div className="border rounded-lg p-3 bg-white shadow-sm flex flex-col space-y-2">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-semibold text-gray-800">{suggestion.name}</h4>
                    <p className="text-xs text-gray-500">{suggestion.category}</p>
                </div>
                <button
                    onClick={handleDismiss}
                    disabled={dismissing}
                    className="text-gray-400 hover:text-red-500 text-sm"
                    title="Dismiss this suggestion"
                >
                    ✕
                </button>
            </div>

            <div className="text-sm text-gray-600">
                Est. cost: ${suggestion.estimatedCost} · Duration: {suggestion.estimatedDurationMinutes} mins
            </div>

            <button
                onClick={() => onAdd(suggestion)}
                className="mt-2 w-full rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
            >
                + Add to Itinerary
            </button>
        </div>
    );
}