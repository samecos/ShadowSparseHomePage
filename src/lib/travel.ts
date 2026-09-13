import type { Trip, TripAttachment, TripAttachmentSummary, TripDay } from './types';

export function isPublicTrip(trip: Trip) {
  return trip.status === 'completed' && trip.visibility === 'public';
}

export function normalizeTrip(trip: Trip): Trip {
  if (trip.status === 'planning' || trip.status === 'active') {
    return { ...trip, visibility: 'private' };
  }
  return trip;
}

export function publicTrip(trip: Trip): Trip {
  const hiddenEntryIds = new Set(trip.recap?.hiddenEntryIds ?? []);
  const days: TripDay[] = trip.days.map((day) => ({
    ...day,
    checklist: [],
    items: day.items.map((item) => ({ ...item }))
  }));

  return {
    ...trip,
    reservations: [],
    days,
    entries: trip.entries
      .filter((entry) => entry.visibility === 'public' && hiddenEntryIds.has(entry.id) === false)
      .map((entry) => ({ ...entry, visibility: 'public' as const }))
      .map((entry) => ({ ...entry, attachmentIds: entry.attachmentIds ?? [] })),
    recap: trip.recap
      ? {
          ...trip.recap,
          hiddenEntryIds: []
        }
      : undefined
  };
}

export function summarizeAttachment(attachment: TripAttachment): TripAttachmentSummary {
  const { storageKey: _storageKey, ...summary } = attachment;
  return summary;
}

export function sortTrips(trips: Trip[]) {
  const order: Record<Trip['status'], number> = {
    active: 0,
    planning: 1,
    completed: 2,
    archived: 3
  };

  return [...trips].sort((a, b) => {
    const statusDiff = order[a.status] - order[b.status];
    if (statusDiff !== 0) return statusDiff;
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });
}

export function slugifyTripTitle(title: string, id: string) {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${ascii || 'trip'}-${id.slice(-6)}`;
}

export function datesBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && dates.length < 100) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
