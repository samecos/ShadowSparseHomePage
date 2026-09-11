import type { NextRequest } from 'next/server';
import { fail, ok, parseBody } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { mapStoryPatchSchema } from '@/lib/schemas';
import { mutateCollection, nowIso } from '@/lib/storage';
import type { MapStory } from '@/lib/types';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  if (isAuthorizedWrite(request) === false) return unauthorized();

  const { id } = await context.params;
  const parsed = await parseBody(request, mapStoryPatchSchema);
  if (parsed.valid === false) return fail(parsed.error);

  const updated = await mutateCollection<MapStory, MapStory | null>('map-stories', (current) => {
    const story = current.find((item) => item.id === id);
    if (!story) return null;

    if (parsed.data.title !== undefined) story.title = parsed.data.title;
    if (parsed.data.note !== undefined) story.note = parsed.data.note;
    if (parsed.data.date !== undefined) story.date = parsed.data.date;
    if (parsed.data.locationName !== undefined) story.locationName = parsed.data.locationName;
    if (parsed.data.tags !== undefined) story.tags = parsed.data.tags;
    if (parsed.data.photos !== undefined) story.photos = parsed.data.photos;

    if (parsed.data.photo) {
      const photo = story.photos.find((item) => item.id === parsed.data.photo?.id);
      if (!photo) return null;
      photo.lat = parsed.data.photo.lat;
      photo.lng = parsed.data.photo.lng;
    }

    story.updatedAt = nowIso();
    return story;
  });

  if (updated === null) return fail('没有找到这段地图故事或照片。', 404);
  return ok(updated);
}

export async function DELETE(request: NextRequest, context: Context) {
  if (isAuthorizedWrite(request) === false) return unauthorized();

  const { id } = await context.params;
  const removed = await mutateCollection<MapStory, boolean>('map-stories', (current) => {
    const index = current.findIndex((story) => story.id === id);
    if (index === -1) return false;
    current.splice(index, 1);
    return true;
  });

  if (removed === false) return fail('没有找到这段地图故事。', 404);
  return ok({ id });
}
