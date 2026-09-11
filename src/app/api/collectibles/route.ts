import type { NextRequest } from 'next/server';
import { fail, ok, parseBody } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { collectibleCreateSchema } from '@/lib/schemas';
import { createId, mutateCollection, nowIso, readCollection } from '@/lib/storage';
import type { Collectible } from '@/lib/types';

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const status = params.get('status');
  const type = params.get('type');
  const tag = params.get('tag');
  const query = (params.get('q') ?? '').trim().toLowerCase();
  const limit = Number(params.get('limit') ?? 100);
  const offset = Number(params.get('offset') ?? 0);

  let items = await readCollection<Collectible>('collectibles');
  if (status) items = items.filter((item) => item.status === status);
  if (type) items = items.filter((item) => item.type === type);
  if (tag) items = items.filter((item) => item.tags.includes(tag));
  if (query) {
    items = items.filter((item) =>
      [item.title, item.description, item.agentSummary, item.quote, item.source, ...item.tags]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const total = items.length;
  const page = items.slice(
    Number.isFinite(offset) ? Math.max(0, offset) : 0,
    Number.isFinite(limit) ? Math.max(1, offset + limit) : 100
  );

  return ok({ items: page, total });
}

export async function POST(request: NextRequest) {
  if (isAuthorizedWrite(request) === false) return unauthorized();

  const parsed = await parseBody(request, collectibleCreateSchema);
  if (parsed.valid === false) return fail(parsed.error);

  const now = nowIso();
  const collectible: Collectible = {
    id: createId('col'),
    ...parsed.data,
    createdAt: now,
    updatedAt: now
  };

  const saved = await mutateCollection<Collectible, Collectible>('collectibles', (current) => {
    current.push(collectible);
    return collectible;
  });

  return ok(saved, { status: 201 });
}
