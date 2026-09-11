import { ok } from '@/lib/api';
import { readCollection } from '@/lib/storage';
import type { Work } from '@/lib/types';

export async function GET() {
  const works = await readCollection<Work>('works');
  const sorted = [...works].sort((a, b) => a.order - b.order);
  return ok({ items: sorted, total: sorted.length });
}
