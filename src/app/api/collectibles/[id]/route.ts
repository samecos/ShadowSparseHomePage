import type { NextRequest } from 'next/server';
import { fail, ok, parseBody } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { collectiblePatchSchema } from '@/lib/schemas';
import { mutateCollection, nowIso } from '@/lib/storage';
import type { Collectible } from '@/lib/types';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  if (isAuthorizedWrite(request) === false) return unauthorized();

  const { id } = await context.params;
  const parsed = await parseBody(request, collectiblePatchSchema);
  if (parsed.valid === false) return fail(parsed.error);

  const updated = await mutateCollection<Collectible, Collectible | null>('collectibles', (current) => {
    const index = current.findIndex((item) => item.id === id);
    if (index === -1) return null;
    current[index] = { ...current[index], ...parsed.data, updatedAt: nowIso() };
    return current[index];
  });

  if (updated === null) return fail('没有找到这条收藏。', 404);
  return ok(updated);
}

export async function DELETE(request: NextRequest, context: Context) {
  if (isAuthorizedWrite(request) === false) return unauthorized();

  const { id } = await context.params;
  const removed = await mutateCollection<Collectible, boolean>('collectibles', (current) => {
    const index = current.findIndex((item) => item.id === id);
    if (index === -1) return false;
    current.splice(index, 1);
    return true;
  });

  if (removed === false) return fail('没有找到这条收藏。', 404);
  return ok({ id });
}
