import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';
import { sortPhotos, visiblePhotos } from '@/lib/photos';
import { readCollection } from '@/lib/storage';
import type { Photo } from '@/lib/types';
import { PhotosExperience } from './photos-experience';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '照片',
  description: '按时间排列的照片底片库：查看、收藏与整理每一张照片。'
};

export default async function PhotosPage() {
  const cookieStore = await cookies();
  const admin = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  const photos = await readCollection<Photo>('photos');
  const initialPhotos = sortPhotos(visiblePhotos(photos, admin));

  return (
    <main className="main">
      <div className="shell">
        <PhotosExperience initialPhotos={initialPhotos} initialAdmin={admin} />
      </div>
    </main>
  );
}
