import type { NextRequest } from 'next/server';
import { fail, ok, parseQuery } from '@/lib/api';
import { isAdminRequest, isAgentRequest, isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { tripCreateSchema } from '@/lib/schemas';
import { isPublicTrip, normalizeTrip, publicTrip, datesBetween, slugifyTripTitle, sortTrips } from '@/lib/travel';
import { createId, mutateCollection, nowIso, readCollection } from '@/lib/storage';
import type { Trip } from '@/lib/types';

function defaultDays(startDate: string, endDate: string) {
  return datesBetween(startDate, endDate).map((date) => ({
    id: createId('day'),
    date,
    title: '',
    items: [],
    checklist: []
  }));
}

export async function GET(request: NextRequest) {
  const privileged = isAuthorizedWrite(request);
  const params = parseQuery(request);
  const status = params.get('status');
  const query = (params.get('q') ?? '').trim().toLowerCase();

  let trips = (await readCollection<Trip>('trips')).map(normalizeTrip);
  if (privileged === false) {
    trips = trips.filter(isPublicTrip).map(publicTrip);
  }
  if (status && ['planning', 'active', 'completed', 'archived'].includes(status)) {
    trips = trips.filter((trip) => trip.status === status);
  }
  if (query) {
    trips = trips.filter((trip) =>
      [trip.title, trip.summary, ...trip.destinations, ...trip.tags].join(' ').toLowerCase().includes(query)
    );
  }

  const sorted = sortTrips(trips);
  return ok({
    items: sorted,
    total: sorted.length,
    admin: isAdminRequest(request),
    agent: isAgentRequest(request)
  });
}

export async function POST(request: NextRequest) {
  if (isAuthorizedWrite(request) === false) return unauthorized();

  const parsed = await request.json().catch(() => null);
  const validated = tripCreateSchema.safeParse(parsed);
  if (validated.success === false) {
    return fail(
      validated.error.issues
        .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
        .join('；')
    );
  }

  const id = createId('trip');
  const now = nowIso();
  const data = validated.data;
  const trip: Trip = normalizeTrip({
    id,
    slug: slugifyTripTitle(data.title, id),
    title: data.title,
    summary: data.summary,
    coverAttachmentId: data.coverAttachmentId,
    destinations: data.destinations,
    startDate: data.startDate,
    endDate: data.endDate,
    status: data.status,
    visibility: data.visibility,
    tags: data.tags,
    days: data.days.length > 0 ? data.days : defaultDays(data.startDate, data.endDate),
    reservations: data.reservations,
    entries: data.entries,
    recap: data.recap,
    lastEditedBy: isAgentRequest(request) ? 'hermes' : 'admin',
    createdAt: now,
    updatedAt: now
  });

  const saved = await mutateCollection<Trip, Trip>('trips', (current) => {
    current.push(trip);
    return trip;
  });

  return ok(saved, { status: 201 });
}
