import type { NextRequest } from 'next/server';
import { ok } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { lookupRegion } from '@/lib/geo/regions';
import { mutateCollection } from '@/lib/storage';
import type { Photo } from '@/lib/types';

/** 对全部照片重算行政区划(幂等,可随时重跑)。 */
export async function POST(request: NextRequest) {
  if (isAuthorizedWrite(request) === false) return unauthorized();

  const result = await mutateCollection<Photo, { total: number; tagged: number }>(
    'photos',
    async (current) => {
      let tagged = 0;
      for (const photo of current) {
        if (photo.lat !== undefined && photo.lng !== undefined) {
          const region = await lookupRegion(photo.lng, photo.lat);
          if (region) {
            photo.region = region;
            tagged += 1;
          } else {
            delete photo.region;
          }
        } else {
          delete photo.region;
        }
      }
      return { total: current.length, tagged };
    }
  );

  return ok(result);
}
