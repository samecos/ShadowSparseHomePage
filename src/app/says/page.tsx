import type { Metadata } from 'next';
import { readCollection } from '@/lib/storage';
import type { Post } from '@/lib/types';
import { SaysFeed } from './says-feed';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '日常说说',
  description: '碎片一样的日常记录。'
};

export default async function SaysPage() {
  const posts = await readCollection<Post>('posts');
  const publicPosts = posts
    .filter((post) => post.visibility === 'public')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <main className="main">
      <div className="shell">
        <SaysFeed initialPosts={publicPosts} />
      </div>
    </main>
  );
}
