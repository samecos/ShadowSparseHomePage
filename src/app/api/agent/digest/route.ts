import { ok } from '@/lib/api';
import { readCollection } from '@/lib/storage';
import type { Collectible } from '@/lib/types';

export async function GET() {
  const items = await readCollection<Collectible>('collectibles');
  const statusCount = {
    inbox: items.filter((item) => item.status === 'inbox').length,
    curated: items.filter((item) => item.status === 'curated').length,
    archived: items.filter((item) => item.status === 'archived').length
  };
  const typeCount = items.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.type] = (accumulator[item.type] ?? 0) + 1;
    return accumulator;
  }, {});
  const tags = items.reduce<Record<string, number>>((accumulator, item) => {
    item.tags.forEach((tag) => {
      accumulator[tag] = (accumulator[tag] ?? 0) + 1;
    });
    return accumulator;
  }, {});

  return ok({
    statusCount,
    typeCount,
    topTags: Object.entries(tags)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count })),
    inbox: items
      .filter((item) => item.status === 'inbox')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5),
    generatedAt: new Date().toISOString()
  });
}
