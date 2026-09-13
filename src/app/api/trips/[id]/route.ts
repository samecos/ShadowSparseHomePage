import type { NextRequest } from 'next/server';
import { fail, ok, parseBody } from '@/lib/api';
import { isAgentRequest, isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { tripPatchSchema } from '@/lib/schemas';
import { removePrivateFile } from '@/lib/private-files';
import { isPublicTrip, normalizeTrip, publicTrip, summarizeAttachment } from '@/lib/travel';
import { mutateCollection, nowIso, readCollection } from '@/lib/storage';
import type { Trip, TripAttachment } from '@/lib/types';

type RouteProps = { params: Promise<{ id: string }> };

async function findTrip(id: string) {
  const trips = await readCollection<Trip>('trips');
  return trips.find((trip) => trip.id === id) ?? null;
}

export async function GET(request: NextRequest, { params }: RouteProps) {
  const { id } = await params;
  const stored = await findTrip(id);
  if (!stored) return fail('旅行不存在。', 404);

  const privileged = isAuthorizedWrite(request);
  const normalized = normalizeTrip(stored);
  if (privileged === false && isPublicTrip(normalized) === false) return fail('旅行不存在。', 404);

  const attachments = await readCollection<TripAttachment>('trip-attachments');
  const visibleTrip = privileged ? normalized : publicTrip(normalized);
  const visibleAttachments = attachments
    .filter((attachment) => attachment.tripId === id)
    .filter((attachment) => privileged || (isPublicTrip(normalized) && attachment.kind === 'media'))
    .map(summarizeAttachment);

  return ok({ trip: visibleTrip, attachments: visibleAttachments });
}

export async function PATCH(request: NextRequest, { params }: RouteProps) {
  if (isAuthorizedWrite(request) === false) return unauthorized();
  const { id } = await params;
  const current = await findTrip(id);
  if (!current) return fail('旅行不存在。', 404);

  const parsed = await parseBody(request, tripPatchSchema);
  if (parsed.valid === false) return fail(parsed.error);

  const now = nowIso();
  const data = parsed.data;
  const startDate = data.startDate ?? current.startDate;
  const endDate = data.endDate ?? current.endDate;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (Number.isFinite(start) && Number.isFinite(end) && end < start) {
    return fail('结束日期不能早于开始日期。');
  }
  const updated = await mutateCollection<Trip, Trip | null>('trips', (items) => {
    const index = items.findIndex((trip) => trip.id === id);
    if (index === -1) return null;
    const next = normalizeTrip({
      ...items[index],
      ...data,
      id: items[index].id,
      slug: items[index].slug,
      createdAt: items[index].createdAt,
      updatedAt: now,
      lastEditedBy: isAgentRequest(request) ? 'hermes' : 'admin'
    });
    items[index] = next;
    return next;
  });

  if (!updated) return fail('旅行不存在。', 404);
  return ok(updated);
}

export async function DELETE(request: NextRequest, { params }: RouteProps) {
  if (isAuthorizedWrite(request) === false) return unauthorized();
  const { id } = await params;
  const current = await findTrip(id);
  if (!current) return fail('旅行不存在。', 404);

  const attachments = await readCollection<TripAttachment>('trip-attachments');
  const related = attachments.filter((attachment) => attachment.tripId === id);

  await mutateCollection<Trip, boolean>('trips', (items) => {
    const index = items.findIndex((trip) => trip.id === id);
    if (index === -1) return false;
    items.splice(index, 1);
    return true;
  });
  await mutateCollection<TripAttachment, void>('trip-attachments', (items) => {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (items[index].tripId === id) items.splice(index, 1);
    }
  });
  await Promise.all(related.map((attachment) => removePrivateFile(attachment.storageKey)));

  return ok({ deleted: true, id });
}
