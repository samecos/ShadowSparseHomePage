import { ok } from '@/lib/api';
import { readCollection } from '@/lib/storage';
import type { Collectible, MapStory, Post, Work } from '@/lib/types';

export async function GET() {
  const [posts, stories, works, collectibles] = await Promise.all([
    readCollection<Post>('posts'),
    readCollection<MapStory>('map-stories'),
    readCollection<Work>('works'),
    readCollection<Collectible>('collectibles')
  ]);

  return ok({
    status: 'ok',
    site: 'personal-homepage',
    version: '0.1.0',
    counts: {
      posts: posts.length,
      mapStories: stories.length,
      works: works.length,
      collectibles: collectibles.length,
      inbox: collectibles.filter((item) => item.status === 'inbox').length
    },
    time: new Date().toISOString()
  });
}
