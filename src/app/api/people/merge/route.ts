import type { NextRequest } from 'next/server';
import { fail, ok, parseBody } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { mergePeople } from '@/lib/people';
import { peopleMergeSchema } from '@/lib/schemas';

export async function POST(request: NextRequest) {
  if (isAuthorizedWrite(request) === false) return unauthorized();
  const parsed = await parseBody(request, peopleMergeSchema);
  if (parsed.valid === false) return fail(parsed.error);

  const merged = await mergePeople(parsed.data.sourceId, parsed.data.targetId);
  if (merged === null) return fail('没有找到要合并的人物。', 404);
  return ok(merged);
}
