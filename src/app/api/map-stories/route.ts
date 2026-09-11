import type { NextRequest } from 'next/server';
import { fail, ok, parseBody } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { mapStoryCreateSchema } from '@/lib/schemas';
import { createId, mutateCollection, nowIso, readCollection } from '@/lib/storage';
import type { MapStory } from '@/lib/types';

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const query = (params.get('q') ?? '').trim().toLowerCase();
  const tag = params.get('tag');

  let stories = await readCollection<MapStory>('map-stories');
  if (tag) stories = stories.filter((story) => story.tags.includes(tag));
  if (query) {
    stories = stories.filter((story) =>
      [story.title, story.note, story.locationName, ...story.tags]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }

  stories.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return ok({ items: stories, total: stories.length });
}

export async function POST(request: NextRequest) {
  if (isAuthorizedWrite(request) === false) return unauthorized();

  const parsed = await parseBody(request, mapStoryCreateSchema);
  if (parsed.valid === false) return fail(parsed.error);

  const now = nowIso();
  const story: MapStory = {
    id: createId('story'),
    ...parsed.data,
    createdAt: now,
    updatedAt: now
  };

  const saved = await mutateCollection<MapStory, MapStory>('map-stories', (current) => {
    current.push(story);
    return story;
  });

  return ok(saved, { status: 201 });
}
