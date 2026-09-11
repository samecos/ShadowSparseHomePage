import type { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { collectMany } from '@/lib/collect';
import type { CollectibleInput } from '@/lib/collect';
import { collectibleBatchSchema } from '@/lib/schemas';

export async function POST(request: NextRequest) {
  if (isAuthorizedWrite(request) === false) return unauthorized();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail('请求体不是合法 JSON。');
  }

  const parsed = collectibleBatchSchema.safeParse(raw);
  if (parsed.success === false) {
    return fail(
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('；')
    );
  }

  const result = await collectMany(parsed.data.items as CollectibleInput[], true);
  return ok(result, { status: result.created.length > 0 ? 201 : 200 });
}
