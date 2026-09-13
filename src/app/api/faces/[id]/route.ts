import type { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { deleteFace } from '@/lib/people';

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  if (isAuthorizedWrite(request) === false) return unauthorized();
  const { id } = await context.params;
  const removed = await deleteFace(id);
  if (removed === null) return fail('没有找到这张人脸。', 404);
  return ok({ id });
}
