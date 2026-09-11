import type { NextRequest } from 'next/server';
import { fail, ok, parseBody } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { postPatchSchema } from '@/lib/schemas';
import { mutateCollection, nowIso } from '@/lib/storage';
import type { Post } from '@/lib/types';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  if (isAuthorizedWrite(request) === false) return unauthorized();

  const { id } = await context.params;
  const parsed = await parseBody(request, postPatchSchema);
  if (parsed.valid === false) return fail(parsed.error);

  const updated = await mutateCollection<Post, Post | null>('posts', (current) => {
    const index = current.findIndex((post) => post.id === id);
    if (index === -1) return null;
    current[index] = { ...current[index], ...parsed.data, updatedAt: nowIso() };
    return current[index];
  });

  if (updated === null) return fail('没有找到这条说说。', 404);
  return ok(updated);
}

export async function DELETE(request: NextRequest, context: Context) {
  if (isAuthorizedWrite(request) === false) return unauthorized();

  const { id } = await context.params;
  const removed = await mutateCollection<Post, boolean>('posts', (current) => {
    const index = current.findIndex((post) => post.id === id);
    if (index === -1) return false;
    current.splice(index, 1);
    return true;
  });

  if (removed === false) return fail('没有找到这条说说。', 404);
  return ok({ id });
}
