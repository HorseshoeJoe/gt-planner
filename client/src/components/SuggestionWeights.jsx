import { useState, useEffect } from 'react';

export default function SuggestionWeights({ tripId, onSave }) {
    const [weights, setWeights] = useState({
        popularity: 25,
        cost: 25,
        duration: 25,
        detour: 25,
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch(`/api/trips/${tripId}/suggestions/preferences`, { credentials: 'include' })
            .then(res => res.json())
            .then(data => { if (data.weights) setWeights(data.weights); })
            .catch(console.error);
    }, [tripId]);

    const handleChange = (key, value) => {
        setWeights(prev => ({ ...prev, [key]: parseInt(value, 10) }));
    };

    const handleSave = async () => {
        setSaving(true);
        await fetch(`/api/trips/${tripId}/suggestions/weights`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(weights),
        });
        setSaving(false);
        if (onSave) onSave(weights);
    };

    const total = Object.values(weights).reduce((a, b) => a + b, 0);

    return (
        <div className="rounded-lg border p-4 bg-gray-50 space-y-4">
            <h3 className="font-semibold">Tune Suggestions</h3>
            <p className="text-xs text-gray-500">Adjust what matters most to your group.</p>

            {Object.keys(weights).map((key) => (
                <div key={key} className="flex items-center space-x-3 text-sm capitalize">
                    <span className="w-20">{key}</span>
                    <input
                        type="range" min="0" max="100" value={weights[key]}
                        onChange={(e) => handleChange(key, e.target.value)}
                        className="flex-1"
                    />
                    <span className="w-8 text-right font-mono">{weights[key]}</span>
                </div>
            ))}

            <div className="flex justify-between items-center pt-2 border-t">
        <span className={`text-sm ${total === 0 ? 'text-red-500' : 'text-gray-500'}`}>
          Total: {total} (Weights are normalized)
        </span>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded bg-blue-600 px-4 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Weights'}
                </button>
            </div>
        </div>
    );
}