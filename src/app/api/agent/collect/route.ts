import type { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { collectMany } from '@/lib/collect';
import { collectibleCreateSchema } from '@/lib/schemas';
import type { CollectibleInput } from '@/lib/collect';

export async function POST(request: NextRequest) {
  if (isAuthorizedWrite(request) === false) return unauthorized();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return fail('请求体不是合法 JSON。');
  }

  const envelope = raw as { items?: unknown[]; dedupeByUrl?: boolean } | null;
  const list: unknown[] = Array.isArray(raw) ? raw : Array.isArray(envelope?.items) ? envelope.items : [raw];
  const dedupeByUrl = Array.isArray(raw) ? true : envelope?.dedupeByUrl !== false;

  const valid: CollectibleInput[] = [];
  const invalid: Array<{ index: number; error: string }> = [];

  list.forEach((item, index) => {
    const parsed = collectibleCreateSchema.safeParse(item);
    if (parsed.success === false) {
      invalid.push({
        index,
        error: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('；')
      });
      return;
    }
    valid.push(parsed.data);
  });

  const result = await collectMany(valid, dedupeByUrl);
  return ok({ ...result, invalid }, { status: result.created.length > 0 ? 201 : 200 });
}
