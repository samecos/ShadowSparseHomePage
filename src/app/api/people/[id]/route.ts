import type { NextRequest } from 'next/server';
import { fail, ok, parseBody } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { patchPerson } from '@/lib/people';
import { personPatchSchema } from '@/lib/schemas';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  if (isAuthorizedWrite(request) === false) return unauthorized();
  const { id } = await context.params;
  const parsed = await parseBody(request, personPatchSchema);
  if (parsed.valid === false) return fail(parsed.error);

  const updated = await patchPerson(id, parsed.data);
  if (updated === null) return fail('没有找到这个人物,或封面人脸不属于该人物。', 404);
  return ok(updated);
}
