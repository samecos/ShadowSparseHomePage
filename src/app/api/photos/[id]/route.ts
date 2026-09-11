import type { NextRequest } from 'next/server';
import { fail, ok, parseBody } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { photoPatchSchema } from '@/lib/schemas';
import { mutateCollection, nowIso } from '@/lib/storage';
import type { Photo } from '@/lib/types';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  if (isAuthorizedWrite(request) === false) return unauthorized();

  const { id } = await context.params;
  const parsed = await parseBody(request, photoPatchSchema);
  if (parsed.valid === false) return fail(parsed.error);

  const updated = await mutateCollection<Photo, Photo | null>('photos', (current) => {
    const photo = current.find((item) => item.id === id);
    if (!photo) return null;

    const patch = parsed.data;
    if (patch.url !== undefined) photo.url = patch.url;
    if (patch.title !== undefined) photo.title = patch.title;
    if (patch.date !== undefined) photo.date = patch.date;
    if (patch.locationName !== undefined) photo.locationName = patch.locationName;
    if (patch.lat === null) delete photo.lat;
    else if (patch.lat !== undefined) photo.lat = patch.lat;
    if (patch.lng === null) delete photo.lng;
    else if (patch.lng !== undefined) photo.lng = patch.lng;
    if (patch.tags !== undefined) photo.tags = patch.tags;
    if (patch.favorite !== undefined) photo.favorite = patch.favorite;
    if (patch.visibility !== undefined) photo.visibility = patch.visibility;
    if (patch.width !== undefined) photo.width = patch.width;
    if (patch.height !== undefined) photo.height = patch.height;
    if (patch.size !== undefined) photo.size = patch.size;
    if (patch.mimeType !== undefined) photo.mimeType = patch.mimeType;

    photo.updatedAt = nowIso();
    return photo;
  });

  if (updated === null) return fail('没有找到这张照片。', 404);
  return ok(updated);
}

/**
 * 删除分两步：第一次进入「最近删除」，回收站里的再一次删除则彻底清除。
 */
export async function DELETE(request: NextRequest, context: Context) {
  if (isAuthorizedWrite(request) === false) return unauthorized();

  const { id } = await context.params;
  const result = await mutateCollection<Photo, 'trashed' | 'purged' | null>('photos', (current) => {
    const index = current.findIndex((item) => item.id === id);
    if (index === -1) return null;
    if (current[index].deletedAt) {
      current.splice(index, 1);
      return 'purged';
    }
    current[index].deletedAt = nowIso();
    current[index].updatedAt = nowIso();
    return 'trashed';
  });

  if (result === null) return fail('没有找到这张照片。', 404);
  return ok({ id, result });
}
