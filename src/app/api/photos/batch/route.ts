import type { NextRequest } from 'next/server';
import { fail, ok, parseBody } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { photoBatchSchema } from '@/lib/schemas';
import { purgeExpiredTrash } from '@/lib/photos';
import { mutateCollection, nowIso } from '@/lib/storage';
import type { Photo } from '@/lib/types';

export async function POST(request: NextRequest) {
  if (isAuthorizedWrite(request) === false) return unauthorized();

  const parsed = await parseBody(request, photoBatchSchema);
  if (parsed.valid === false) return fail(parsed.error);

  const { action, ids } = parsed.data;
  const idSet = new Set(ids);

  const result = await mutateCollection<Photo, number>('photos', (current) => {
    const purged = purgeExpiredTrash(current);
    current.splice(0, current.length, ...purged);

    let affected = 0;
    const now = nowIso();

    current.forEach((photo) => {
      if (idSet.has(photo.id) === false) return;

      switch (action) {
        case 'favorite':
          if (photo.favorite === false) {
            photo.favorite = true;
            photo.updatedAt = now;
            affected += 1;
          }
          break;
        case 'unfavorite':
          if (photo.favorite) {
            photo.favorite = false;
            photo.updatedAt = now;
            affected += 1;
          }
          break;
        case 'trash':
          if (photo.deletedAt === null || photo.deletedAt === undefined) {
            photo.deletedAt = now;
            photo.updatedAt = now;
            affected += 1;
          }
          break;
        case 'restore':
          if (photo.deletedAt) {
            photo.deletedAt = null;
            photo.updatedAt = now;
            affected += 1;
          }
          break;
        case 'purge':
          break;
      }
    });

    if (action === 'purge') {
      const kept = current.filter((photo) => (photo.deletedAt !== null && idSet.has(photo.id)) === false);
      affected = current.length - kept.length;
      current.splice(0, current.length, ...kept);
    }

    return affected;
  });

  return ok({ action, affected: result });
}
