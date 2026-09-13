import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';
import { isPublicTrip, normalizeTrip, publicTrip, sortTrips } from '@/lib/travel';
import { readCollection } from '@/lib/storage';
import type { Trip } from '@/lib/types';
import { TravelExperience } from './travel-experience';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '旅行',
  description: '提前安排一次旅行，也为途中和回来后的记录留出位置。'
};

export default async function TravelPage() {
  const cookieStore = await cookies();
  const admin = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  const stored = (await readCollection<Trip>('trips')).map(normalizeTrip);
  const trips = sortTrips(
    admin ? stored : stored.filter(isPublicTrip).map(publicTrip)
  );

  return (
    <main className="main">
      <div className="shell">
        <TravelExperience initialTrips={trips} initialAdmin={admin} />
      </div>
    </main>
  );
}
