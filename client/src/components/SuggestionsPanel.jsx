import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { api } from '../api/client.js';
import { useToast } from './ToastProvider.jsx';

import {
  Badge,
  Button,
  EmptyState,
  ErrorNote,
  Field,
  Input,
  Spinner,
} from './ui.jsx';

const DEFAULT_WEIGHTS = {
  popularity: 25,
  cost: 25,
  duration: 25,
  detour: 25,
};

function suggestionsEndpoint(tripId, date) {
  return `/trips/${tripId}/suggestions?date=${encodeURIComponent(
    date,
  )}`;
}

function formatScore(value) {
  const score = Number(value);

  if (!Number.isFinite(score)) {
    return null;
  }

  const percentage =
    score <= 1
      ? Math.round(score * 100)
      : Math.round(score);

  return `${percentage}% match`;
}

function suggestionId(suggestion, index) {
  return String(
    suggestion.id ??
      suggestion.osmId ??
      suggestion.poiId ??
      `${suggestionName(suggestion)}-${index}`,
  );
}

function suggestionName(suggestion) {
  return (
    suggestion.name ||
    suggestion.title ||
    suggestion.poi?.name ||
    'Suggested attraction'
  );
}

function suggestionReason(suggestion) {
  return (
    suggestion.reason ||
    suggestion.explanation ||
    suggestion.description ||
    'This attraction may fit the current itinerary.'
  );
}

function suggestionScore(suggestion) {
  return (
    suggestion.score ??
    suggestion.totalScore ??
    suggestion.rankScore ??
    null
  );
}

function suggestionDuration(suggestion) {
  return (
    suggestion.estimatedDurationMinutes ??
    suggestion.duration ??
    suggestion.averageDuration ??
    suggestion.visitDuration ??
    null
  );
}

function suggestionCost(suggestion) {
  return (
    suggestion.estimatedCost ??
    suggestion.cost ??
    suggestion.expectedCost ??
    suggestion.entryFee ??
    null
  );
}

function suggestionDetour(suggestion) {
  return (
    suggestion.detourMinutes ??
    suggestion.detour ??
    suggestion.detourCost ??
    null
  );
}

function suggestionStartTime(suggestion) {
  return (
    suggestion.startTime ||
    suggestion.suggestedStartTime ||
    suggestion.time ||
    '12:00'
  );
}

function toMinutes(hhmm) {
  const match =
    /^([01]\d|2[0-3]):([0-5]\d)$/.exec(
      hhmm || '',
    );

  if (!match) {
    return null;
  }

  return (
    Number(match[1]) * 60 +
    Number(match[2])
  );
}

function toTime(minutes) {
  if (!Number.isFinite(minutes)) {
    return '';
  }

  const safeMinutes =
    ((Math.round(minutes) % 1440) +
      1440) %
    1440;

  const hours = Math.floor(
    safeMinutes / 60,
  );

  const mins =
    safeMinutes % 60;

  return `${String(hours).padStart(
    2,
    '0',
  )}:${String(mins).padStart(2, '0')}`;
}

function suggestionEndTime(
  suggestion,
  startTime,
) {
  if (suggestion.endTime) {
    return suggestion.endTime;
  }

  if (suggestion.suggestedEndTime) {
    return suggestion.suggestedEndTime;
  }

  const start =
    toMinutes(startTime);

  if (start === null) {
    return '';
  }

  const duration =
    Number(
      suggestionDuration(suggestion),
    );

  if (
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    return '';
  }

  return toTime(start + duration);
}

function normalizeSuggestions(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (
    Array.isArray(
      payload?.suggestions,
    )
  ) {
    return payload.suggestions;
  }

  if (
    Array.isArray(payload?.results)
  ) {
    return payload.results;
  }

  return [];
}

function normalizeWeights(payload) {
  return {
    popularity:
      Number(
        payload?.weights?.popularity,
      ) ||
      DEFAULT_WEIGHTS.popularity,

    cost:
      Number(
        payload?.weights?.cost,
      ) ||
      DEFAULT_WEIGHTS.cost,

    duration:
      Number(
        payload?.weights?.duration,
      ) ||
      DEFAULT_WEIGHTS.duration,

    detour:
      Number(
        payload?.weights?.detour,
      ) ||
      DEFAULT_WEIGHTS.detour,
  };
}

export default function SuggestionsPanel({
  trip,
  date,
  activities = [],
  onAdded,
}) {
  const toast = useToast();

  const [
    suggestions,
    setSuggestions,
  ] = useState([]);

  const [
    weights,
    setWeights,
  ] = useState(DEFAULT_WEIGHTS);

  const [loading, setLoading] =
    useState(true);

  const [
    savingWeights,
    setSavingWeights,
  ] = useState(false);

  const [
    addingId,
    setAddingId,
  ] = useState(null);

  const [
    dismissingId,
    setDismissingId,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState('');

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('');

  const [
    showWeights,
    setShowWeights,
  ] = useState(false);

  const loadPreferences =
    useCallback(async () => {
      if (!trip?._id) {
        return;
      }

      try {
        const data =
          await api.get(
            `/trips/${trip._id}/suggestions/preferences`,
          );

        setWeights(
          normalizeWeights(data),
        );
      } catch (err) {
        console.warn(
          'Could not load suggestion preferences:',
          err.message,
        );
      }
    }, [trip?._id]);

  const loadSuggestions =
    useCallback(async () => {
      if (!trip?._id || !date) {
        return;
      }

      setLoading(true);
      setError('');
      setSuccessMessage('');

      try {
        const payload =
          await api.get(
            suggestionsEndpoint(
              trip._id,
              date,
            ),
          );

        setSuggestions(
          normalizeSuggestions(
            payload,
          ),
        );
      } catch (err) {
        setSuggestions([]);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, [trip?._id, date]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const visibleSuggestions =
    useMemo(() => {
      const existingTitles =
        new Set(
          activities
            .map(
              (activity) =>
                activity.title
                  ?.trim()
                  .toLowerCase(),
            )
            .filter(Boolean),
        );

      return suggestions.filter(
        (suggestion) => {
          const name =
            suggestionName(
              suggestion,
            )
              .trim()
              .toLowerCase();

          return !existingTitles.has(
            name,
          );
        },
      );
    }, [
      suggestions,
      activities,
    ]);

  const weightsTotal =
    Number(weights.popularity) +
    Number(weights.cost) +
    Number(weights.duration) +
    Number(weights.detour);

  async function saveWeights() {
    setError('');
    setSuccessMessage('');

    if (weightsTotal <= 0) {
      setError(
        'At least one weight must be greater than zero.',
      );
      return;
    }

    setSavingWeights(true);

    try {
      const result =
        await api.put(
          `/trips/${trip._id}/suggestions/weights`,
          {
            popularity:
              Number(
                weights.popularity,
              ),
            cost:
              Number(weights.cost),
            duration:
              Number(
                weights.duration,
              ),
            detour:
              Number(
                weights.detour,
              ),
          },
        );

      setWeights(
        normalizeWeights(result),
      );

      const message =
        'Suggestion weights updated.';

      toast.success(message);
      setSuccessMessage(message);

      await loadSuggestions();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingWeights(false);
    }
  }

  async function dismissSuggestion(
    suggestion,
    index,
  ) {
    const id =
      suggestionId(
        suggestion,
        index,
      );

    const name =
      suggestionName(
        suggestion,
      );

    setError('');
    setSuccessMessage('');
    setDismissingId(id);

    try {
      await api.post(
        `/trips/${trip._id}/suggestions/dismiss`,
        {
          suggestionId: id,
        },
      );

      setSuggestions(
        (current) =>
          current.filter(
            (item, itemIndex) =>
              suggestionId(
                item,
                itemIndex,
              ) !== id,
          ),
      );

      const message =
        `"${name}" dismissed.`;

      toast.success(message);
      setSuccessMessage(message);
    } catch (err) {
      setError(err.message);
    } finally {
      setDismissingId(null);
    }
  }

  async function addToItinerary(
    suggestion,
    index,
  ) {
    const id =
      suggestionId(
        suggestion,
        index,
      );

    const name =
      suggestionName(
        suggestion,
      );

    const startTime =
      suggestionStartTime(
        suggestion,
      );

    const endTime =
      suggestionEndTime(
        suggestion,
        startTime,
      );

    const reason =
      suggestionReason(
        suggestion,
      );

    const body = {
      title: name,
      startTime,
      endTime,
      category: 'sightseeing',
      notes: `Smart suggestion: ${reason}`,
    };

    setError('');
    setSuccessMessage('');
    setAddingId(id);

    try {
      await api.post(
        `/trips/${trip._id}/itinerary/${date}/activities`,
        body,
      );

      const message =
        `"${name}" added to itinerary.`;

      toast.success(message);
      setSuccessMessage(message);

      setSuggestions(
        (current) =>
          current.filter(
            (item, itemIndex) =>
              suggestionId(
                item,
                itemIndex,
              ) !== id,
          ),
      );

      await onAdded?.();
    } catch (err) {
      if (err.status === 409) {
        setError(
          `"${name}" conflicts with an existing itinerary activity. Choose a different time before adding it.`,
        );
      } else {
        setError(err.message);
      }
    } finally {
      setAddingId(null);
    }
  }

  return (
    <section
      className="mt-5 border-t border-slate-200 pt-5"
      aria-labelledby="smart-suggestions-heading"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="smart-suggestions-heading"
            className="text-base font-semibold text-slate-900"
          >
            Smart Attraction Suggestions
          </h3>

          <p className="mt-1 text-sm text-slate-600">
            Recommended places that may
            fit naturally into this
            day&apos;s itinerary.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              setShowWeights(
                (current) =>
                  !current,
              )
            }
          >
            {showWeights
              ? 'Hide weights'
              : 'Adjust weights'}
          </Button>

          <Button
            variant="secondary"
            onClick={
              loadSuggestions
            }
            disabled={loading}
          >
            {loading
              ? 'Refreshing…'
              : 'Refresh suggestions'}
          </Button>
        </div>
      </div>

      {showWeights && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3">
            <p className="font-semibold text-slate-900">
              Recommendation weights
            </p>

            <p className="mt-1 text-sm text-slate-600">
              Adjust how much each factor
              affects the ranking.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Popularity">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min="0"
                  value={
                    weights.popularity
                  }
                  onChange={(event) =>
                    setWeights({
                      ...weights,
                      popularity:
                        event.target
                          .value,
                    })
                  }
                />
              )}
            </Field>

            <Field label="Cost">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min="0"
                  value={
                    weights.cost
                  }
                  onChange={(event) =>
                    setWeights({
                      ...weights,
                      cost:
                        event.target
                          .value,
                    })
                  }
                />
              )}
            </Field>

            <Field label="Duration">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min="0"
                  value={
                    weights.duration
                  }
                  onChange={(event) =>
                    setWeights({
                      ...weights,
                      duration:
                        event.target
                          .value,
                    })
                  }
                />
              )}
            </Field>

            <Field label="Detour">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min="0"
                  value={
                    weights.detour
                  }
                  onChange={(event) =>
                    setWeights({
                      ...weights,
                      detour:
                        event.target
                          .value,
                    })
                  }
                />
              )}
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Total: {weightsTotal}
            </p>

            <Button
              onClick={
                saveWeights
              }
              disabled={
                savingWeights
              }
            >
              {savingWeights
                ? 'Saving…'
                : 'Save weights'}
            </Button>
          </div>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="mb-3 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-800"
        >
          ✓ {successMessage}
        </div>
      )}

      {error && (
        <div className="mb-3">
          <ErrorNote>
            {error}
          </ErrorNote>
        </div>
      )}

      {loading && (
        <Spinner label="Loading smart attraction suggestions" />
      )}

      {!loading &&
        !error &&
        visibleSuggestions.length ===
          0 && (
          <EmptyState
            title="No new suggestions for this day"
            message="The recommendation engine did not find any additional attractions that fit this itinerary."
          />
        )}

      {!loading &&
        visibleSuggestions.length >
          0 && (
          <ul className="space-y-3">
            {visibleSuggestions.map(
              (
                suggestion,
                index,
              ) => {
                const id =
                  suggestionId(
                    suggestion,
                    index,
                  );

                const name =
                  suggestionName(
                    suggestion,
                  );

                const reason =
                  suggestionReason(
                    suggestion,
                  );

                const score =
                  formatScore(
                    suggestionScore(
                      suggestion,
                    ),
                  );

                const duration =
                  suggestionDuration(
                    suggestion,
                  );

                const cost =
                  suggestionCost(
                    suggestion,
                  );

                const detour =
                  suggestionDetour(
                    suggestion,
                  );

                const isAdding =
                  addingId === id;

                const isDismissing =
                  dismissingId === id;

                return (
                  <li
                    key={id}
                    className="rounded-lg border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">
                            {name}
                          </p>

                          {score && (
                            <Badge tone="blue">
                              {score}
                            </Badge>
                          )}
                        </div>

                        <p className="mt-1 text-sm text-slate-600">
                          {reason}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {duration !==
                            null &&
                            duration !==
                              undefined && (
                              <Badge tone="slate">
                                {
                                  duration
                                }{' '}
                                min visit
                              </Badge>
                            )}

                          {cost !== null &&
                            cost !==
                              undefined && (
                              <Badge tone="green">
                                Cost:{' '}
                                {typeof cost ===
                                'number'
                                  ? `$${cost}`
                                  : cost}
                              </Badge>
                            )}

                          {detour !==
                            null &&
                            detour !==
                              undefined && (
                              <Badge tone="amber">
                                Detour:{' '}
                                {
                                  detour
                                }{' '}
                                min
                              </Badge>
                            )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() =>
                            dismissSuggestion(
                              suggestion,
                              index,
                            )
                          }
                          disabled={
                            isAdding ||
                            isDismissing
                          }
                        >
                          {isDismissing
                            ? 'Dismissing…'
                            : 'Dismiss'}
                        </Button>

                        <Button
                          onClick={() =>
                            addToItinerary(
                              suggestion,
                              index,
                            )
                          }
                          disabled={
                            isAdding ||
                            isDismissing
                          }
                        >
                          {isAdding
                            ? 'Adding…'
                            : 'Add to itinerary'}
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              },
            )}
          </ul>
        )}
    </section>
  );
}