import type { NextRequest } from 'next/server';
import { parseBody, fail, ok } from '@/lib/api';
import { isAdminRequest, isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { postCreateSchema } from '@/lib/schemas';
import { createId, mutateCollection, nowIso, readCollection } from '@/lib/storage';
import type { Post } from '@/lib/types';

export async function GET(request: NextRequest) {
  const admin = isAdminRequest(request);
  const params = new URL(request.url).searchParams;
  const mood = params.get('mood');
  const limit = Number(params.get('limit') ?? 100);

  let posts = await readCollection<Post>('posts');
  if (admin === false) posts = posts.filter((post) => post.visibility === 'public');
  if (mood) posts = posts.filter((post) => post.mood === mood);

  posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return ok({
    items: posts.slice(0, Number.isFinite(limit) ? Math.max(1, limit) : 100),
    total: posts.length,
    admin
  });
}

export async function POST(request: NextRequest) {
  if (isAuthorizedWrite(request) === false) return unauthorized();

  const parsed = await parseBody(request, postCreateSchema);
  if (parsed.valid === false) return fail(parsed.error);

  const now = nowIso();
  const post: Post = {
    id: createId('post'),
    ...parsed.data,
    createdAt: now,
    updatedAt: now
  };

  const saved = await mutateCollection<Post, Post>('posts', (current) => {
    current.push(post);
    return post;
  });

  return ok(saved, { status: 201 });
}
