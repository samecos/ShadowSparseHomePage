import { promises as fs } from 'node:fs';
import type { NextRequest } from 'next/server';
import { fail } from '@/lib/api';
import { isAuthorizedWrite } from '@/lib/auth';
import { privateFilePath } from '@/lib/private-files';
import { readCollection } from '@/lib/storage';
import { isPublicTrip, normalizeTrip } from '@/lib/travel';
import type { Trip, TripAttachment } from '@/lib/types';

type RouteProps = { params: Promise<{ id: string; attachmentId: string }> };

export async function GET(request: NextRequest, { params }: RouteProps) {
  const { id, attachmentId } = await params;
  const trip = (await readCollection<Trip>('trips')).find((item) => item.id === id);
  const attachment = (await readCollection<TripAttachment>('trip-attachments')).find(
    (item) => item.id === attachmentId && item.tripId === id
  );
  if (!trip || !attachment) return fail('文件不存在。', 404);

  const privileged = isAuthorizedWrite(request);
  const canReadPublic = attachment.kind === 'media' && isPublicTrip(normalizeTrip(trip));
  if (privileged === false && canReadPublic === false) return fail('文件不存在。', 404);

  let bytes: Buffer;
  try {
    bytes = await fs.readFile(privateFilePath(attachment.storageKey));
  } catch {
    return fail('文件不存在。', 404);
  }

  const safeName = encodeURIComponent(attachment.originalName).replace(/'/g, '%27');
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': `inline; filename="download"; filename*=UTF-8''${safeName}`,
      'Cache-Control': privileged ? 'private, no-store' : 'public, max-age=3600'
    }
  });
}
