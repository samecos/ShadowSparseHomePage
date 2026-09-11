import type { NextRequest } from 'next/server';
import { fail, ok, parseBody, parseQuery } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { photoCreateSchema } from '@/lib/schemas';
import { isTrashed, purgeExpiredTrash, sortPhotos, visiblePhotos } from '@/lib/photos';
import { createId, mutateCollection, nowIso, readCollection } from '@/lib/storage';
import type { Photo } from '@/lib/types';

export async function GET(request: NextRequest) {
  const admin = isAuthorizedWrite(request);
  const params = parseQuery(request);
  const query = (params.get('q') ?? '').trim().toLowerCase();
  const tag = params.get('tag');
  const favorite = params.get('favorite');

  const stored = await readCollection<Photo>('photos');
  const purged = purgeExpiredTrash(stored);

  if (purged.length !== stored.length) {
    await mutateCollection<Photo, void>('photos', (current) => {
      current.splice(0, current.length, ...purged);
    });
  }

  let photos = visiblePhotos(purged, admin);
  if (tag) photos = photos.filter((photo) => photo.tags.includes(tag));
  if (favorite === 'true') photos = photos.filter((photo) => photo.favorite);
  if (favorite === 'false') photos = photos.filter((photo) => !photo.favorite);
  if (query) {
    photos = photos.filter((photo) =>
      [photo.title, photo.locationName, ...photo.tags].join(' ').toLowerCase().includes(query)
    );
  }

  photos = sortPhotos(photos);
  return ok({ items: photos, total: photos.length, trashed: admin ? purged.filter(isTrashed).length : 0 });
}

export async function POST(request: NextRequest) {
  if (isAuthorizedWrite(request) === false) return unauthorized();

  const parsed = await parseBody(request, photoCreateSchema);
  if (parsed.valid === false) return fail(parsed.error);

  const now = nowIso();
  const photo: Photo = {
    id: createId('photo'),
    url: parsed.data.url,
    title: parsed.data.title ?? '',
    date: parsed.data.date,
    locationName: parsed.data.locationName ?? '',
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    tags: parsed.data.tags ?? [],
    favorite: parsed.data.favorite ?? false,
    visibility: parsed.data.visibility ?? 'public',
    width: parsed.data.width,
    height: parsed.data.height,
    size: parsed.data.size,
    mimeType: parsed.data.mimeType,
    deletedAt: null,
    createdAt: now,
    updatedAt: now
  };

  const saved = await mutateCollection<Photo, Photo>('photos', (current) => {
    current.push(photo);
    return photo;
  });

  return ok(saved, { status: 201 });
}
