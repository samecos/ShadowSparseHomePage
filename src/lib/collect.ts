import { createId, mutateCollection, nowIso } from './storage';
import type { Collectible } from './types';

export interface CollectibleInput {
  title: string;
  type: Collectible['type'];
  url?: string;
  image?: string;
  quote?: string;
  description?: string;
  agentSummary?: string;
  tags: string[];
  source?: string;
  collectedBy: Collectible['collectedBy'];
  status: Collectible['status'];
  featured: boolean;
}

export interface CollectResult {
  created: Collectible[];
  existed: Collectible[];
  invalid: Array<{ index: number; error: string }>;
}

export function normalizeUrl(value?: string) {
  if (!value) return '';
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

export async function collectMany(items: CollectibleInput[], dedupeByUrl = true): Promise<CollectResult> {
  const now = nowIso();
  return mutateCollection<Collectible, CollectResult>('collectibles', (current) => {
    const created: Collectible[] = [];
    const existed: Collectible[] = [];

    for (const input of items) {
      const normalized = normalizeUrl(input.url);
      const duplicate =
        dedupeByUrl && normalized
          ? current.find((item) => normalizeUrl(item.url) === normalized)
          : undefined;

      if (duplicate) {
        existed.push(duplicate);
        continue;
      }

      const collectible: Collectible = {
        id: createId('col'),
        ...input,
        createdAt: now,
        updatedAt: now
      };
      current.push(collectible);
      created.push(collectible);
    }

    return { created, existed, invalid: [] };
  });
}
