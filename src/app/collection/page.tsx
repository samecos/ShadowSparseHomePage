import type { Metadata } from 'next';
import { readCollection } from '@/lib/storage';
import type { Collectible } from '@/lib/types';
import { CollectionGrid } from './collection-grid';
import styles from './collection.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '有趣的搜集',
  description: '由 HERMES 持续整理的链接、图像、句子、声音与文件。'
};

export default async function CollectionPage() {
  const items = await readCollection<Collectible>('collectibles');
  const visible = items
    .filter((item) => item.status !== 'archived')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <main className="main">
      <div className="shell">
        <header className={`${styles.header} reveal`}>
          <div>
            <p className="eyebrow">05 · Agent managed</p>
            <h1 className="page-title">有趣的搜集</h1>
            <p className="page-intro">
              一个不追求整齐、但持续被照看的收藏夹。日常丢进来的链接和灵感，会由 HERMES
              自动归位，再慢慢显露出它自己的秩序。
            </p>
          </div>

          <aside className={styles.agentPanel}>
            <span className={styles.agentPanelTitle}>HERMES</span>
            <p>个人收藏 Agent · 支持 API、MCP 与 SKILL 三种接管方式。</p>
          </aside>
        </header>

        <CollectionGrid items={visible} />
      </div>
    </main>
  );
}
