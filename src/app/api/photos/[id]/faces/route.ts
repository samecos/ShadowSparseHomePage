import type { NextRequest } from 'next/server';
import { fail, ok, parseBody } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { replacePhotoFaces } from '@/lib/people';
import { photoFacesSchema } from '@/lib/schemas';
import { readCollection } from '@/lib/storage';
import type { Photo } from '@/lib/types';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  if (isAuthorizedWrite(request) === false) return unauthorized();
  const { id } = await context.params;
  const parsed = await parseBody(request, photoFacesSchema);
  if (parsed.valid === false) return fail(parsed.error);

  const photos = await readCollection<Photo>('photos');
  if (photos.some((photo) => photo.id === id) === false) return fail('没有找到这张照片。', 404);

  const result = await replacePhotoFaces(id, parsed.data.faces);
  return ok({ faces: result.faces.length, people: result.people.length }, { status: 201 });
}
