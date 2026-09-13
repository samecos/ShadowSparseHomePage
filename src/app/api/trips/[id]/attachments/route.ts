import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { isAgentRequest, isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { ensurePrivateUploadDir, privateFilePath } from '@/lib/private-files';
import { mutateCollection, nowIso, readCollection } from '@/lib/storage';
import { isPublicTrip, normalizeTrip, summarizeAttachment } from '@/lib/travel';
import type { Trip, TripAttachment, TripAttachmentKind } from '@/lib/types';

const MAX_SIZE = 8 * 1024 * 1024;
const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'application/pdf': 'pdf'
};

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteProps) {
  if (isAuthorizedWrite(request) === false) return unauthorized();
  const { id } = await params;
  const trips = await readCollection<Trip>('trips');
  const trip = trips.find((item) => item.id === id);
  if (!trip) return fail('旅行不存在。', 404);

  const form = await request.formData();
  const file = form.get('file');
  const rawKind = form.get('kind');
  const kind: TripAttachmentKind = rawKind === 'reservation' ? 'reservation' : 'media';
  const reservationId = form.get('reservationId');

  if (file instanceof File === false) return fail('请上传一个文件。');
  if (file.size > MAX_SIZE) return fail('文件不能超过 8MB。', 413);
  const extension = extensions[file.type];
  if (!extension) return fail('暂不支持这种文件格式。', 415);
  if (kind === 'media' && file.type.startsWith('image/') === false) {
    return fail('旅行媒体只支持图片；PDF 请作为预订材料上传。', 415);
  }
  const linkedReservationId =
    kind === 'reservation' && typeof reservationId === 'string' ? reservationId : undefined;
  if (kind === 'reservation') {
    if (
      linkedReservationId === undefined ||
      trip.reservations.some((reservation) => reservation.id === linkedReservationId) === false
    ) {
      return fail('预订记录不存在。');
    }
  }

  const idPart = `attachment_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const storageKey = path.posix.join('trips', id, `${idPart}.${extension}`);
  const attachment: TripAttachment = {
    id: idPart,
    tripId: id,
    reservationId: linkedReservationId,
    kind,
    originalName: file.name.slice(0, 180),
    storageKey,
    mimeType: file.type,
    size: file.size,
    createdBy: isAgentRequest(request) ? 'hermes' : 'admin',
    createdAt: new Date().toISOString()
  };

  try {
    await ensurePrivateUploadDir();
    await fs.mkdir(path.dirname(privateFilePath(storageKey)), { recursive: true });
    await fs.writeFile(privateFilePath(storageKey), Buffer.from(await file.arrayBuffer()));
    await mutateCollection<TripAttachment, void>('trip-attachments', (items) => {
      items.push(attachment);
    });
    if (linkedReservationId) {
      await mutateCollection<Trip, void>('trips', (items) => {
        const current = items.find((item) => item.id === id);
        const reservation = current?.reservations.find((item) => item.id === linkedReservationId);
        if (!current || !reservation) return;
        if (reservation.attachmentIds.includes(attachment.id) === false) {
          reservation.attachmentIds.push(attachment.id);
        }
        current.updatedAt = nowIso();
        current.lastEditedBy = attachment.createdBy;
      });
    }
  } catch (error) {
    try {
      await fs.unlink(privateFilePath(storageKey));
    } catch {
      // 文件尚未写入时无需清理。
    }
    throw error;
  }

  return ok(
    {
      ...summarizeAttachment(attachment),
      downloadUrl: `/api/trips/${id}/attachments/${attachment.id}`
    },
    { status: 201 }
  );
}

export async function GET(request: NextRequest, { params }: RouteProps) {
  const { id } = await params;
  const storedTrip = (await readCollection<Trip>('trips')).find((item) => item.id === id);
  if (!storedTrip) return fail('旅行不存在。', 404);
  const trip = normalizeTrip(storedTrip);
  const privileged = isAuthorizedWrite(request);
  if (privileged === false && isPublicTrip(trip) === false) return fail('旅行不存在。', 404);

  const attachments = (await readCollection<TripAttachment>('trip-attachments')).filter(
    (attachment) => attachment.tripId === id && (privileged || attachment.kind === 'media')
  );
  return ok({ items: attachments.map(summarizeAttachment), total: attachments.length });
}
