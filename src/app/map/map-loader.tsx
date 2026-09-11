'use client';

import dynamic from 'next/dynamic';
import type { MapStory, Photo } from '@/lib/types';

const MapExperience = dynamic(
  () => import('@/components/map/map-experience').then((module) => module.MapExperience),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          display: 'grid',
          height: 'calc(100vh - var(--header-height))',
          placeItems: 'center',
          color: 'var(--ink-faint)',
          fontFamily: 'var(--font-display)',
          fontSize: 18
        }}
      >
        正在展开地图…
      </div>
    )
  }
);

export function MapLoader({ stories, photos }: { stories: MapStory[]; photos: Photo[] }) {
  return <MapExperience initialStories={stories} initialPhotos={photos} />;
}
