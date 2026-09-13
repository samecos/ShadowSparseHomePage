import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';
import { isPublicTrip, normalizeTrip, publicTrip, summarizeAttachment } from '@/lib/travel';
import { readCollection } from '@/lib/storage';
import type { Trip, TripAttachment } from '@/lib/types';
import { TravelDetail } from './travel-detail';

type PageProps = { params: Promise<{ slug: string }> };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const trips = await readCollection<Trip>('trips');
  const trip = trips.find((item) => item.slug === slug);
  if (!trip) return { title: '旅行不存在' };
  return {
    title: trip.title,
    description: trip.summary || `${trip.destinations.join(' · ')} 的旅行计划`,
    robots: isPublicTrip(normalizeTrip(trip)) ? undefined : { index: false, follow: false }
  };
}

export default async function TravelDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const admin = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  const stored = (await readCollection<Trip>('trips')).map(normalizeTrip);
  const rawTrip = stored.find((item) => item.slug === slug);
  if (!rawTrip || (admin === false && isPublicTrip(rawTrip) === false)) notFound();

  const trip = admin ? rawTrip : publicTrip(rawTrip);
  const storedAttachments = await readCollection<TripAttachment>('trip-attachments');
  const attachments = storedAttachments
    .filter((attachment) => attachment.tripId === rawTrip.id)
    .filter((attachment) => admin || (isPublicTrip(rawTrip) && attachment.kind === 'media'))
    .map(summarizeAttachment);

  return (
    <main className="main">
      <div className="shell">
        <TravelDetail initialTrip={trip} initialAttachments={attachments} initialAdmin={admin} />
      </div>
    </main>
  );
}
