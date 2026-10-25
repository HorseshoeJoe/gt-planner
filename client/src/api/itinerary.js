const BASE = '/api';

async function request(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        ...options,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

export const getItinerary = (tripId) =>
    request(`/trips/${tripId}/itinerary`);

export const updateDayNotes = (tripId, date, notes) =>
    request(`/trips/${tripId}/itinerary/${date}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ notes }),
    });

export const addActivity = (tripId, date, body) =>
    request(`/trips/${tripId}/itinerary/${date}/activities`, {
        method: 'POST',
        body: JSON.stringify(body),
    });

export const editActivity = (tripId, date, activityId, body) =>
    request(`/trips/${tripId}/itinerary/${date}/activities/${activityId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
    });

export const deleteActivity = (tripId, date, activityId) =>
    request(`/trips/${tripId}/itinerary/${date}/activities/${activityId}`, {
        method: 'DELETE',
    });

export const checkConflicts = (tripId, date, startTime, endTime, ignoreId) => {
    const qs = new URLSearchParams({ startTime, endTime });
    if (ignoreId) qs.set('ignoreId', ignoreId);
    return request(`/trips/${tripId}/itinerary/${date}/conflicts?${qs}`);
};