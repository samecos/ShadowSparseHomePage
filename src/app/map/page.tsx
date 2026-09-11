import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';
import { visiblePhotos } from '@/lib/photos';
import { readCollection } from '@/lib/storage';
import type { MapStory, Photo } from '@/lib/types';
import { MapLoader } from './map-loader';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '地图故事',
  description: '把照片放回发生的地方，并为每段记忆留下文字标注。'
};

export default async function MapPage() {
  const cookieStore = await cookies();
  const admin = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  const [stories, photos] = await Promise.all([
    readCollection<MapStory>('map-stories'),
    readCollection<Photo>('photos')
  ]);
  const sorted = [...stories].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const mappedPhotos = visiblePhotos(photos, admin).filter((photo) => photo.deletedAt == null);

  return (
    <main className="main main--flush">
      <MapLoader stories={sorted} photos={mappedPhotos} />
    </main>
  );
}
