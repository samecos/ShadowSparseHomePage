import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from '@/components/icons';
import { readCollection } from '@/lib/storage';
import type { Work } from '@/lib/types';
import styles from './work.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '工作展示',
  description: '做过的项目、承担的角色和具体成果。'
};

export default async function WorkPage() {
  const works = await readCollection<Work>('works');
  const sorted = [...works].sort((a, b) => a.order - b.order);

  return (
    <main className="main">
      <div className="shell">
        <header className={`${styles.header} reveal`}>
          <div>
            <p className="eyebrow">04 · Selected work</p>
            <h1 className="page-title">工作展示</h1>
            <p className="page-intro">
              这里不堆砌项目数量，只保留能说明判断力和完成度的片段。点开可以查看完整过程与结果。
            </p>
          </div>
          <div className={styles.headerAside}>
            <strong>{sorted.length} 个代表项目</strong>
            <span>每个项目都是独立子页面，可单独分享。</span>
            <span>角色覆盖产品设计、前端实现与内容系统。</span>
          </div>
        </header>

        <div className={styles.list}>
          {sorted.map((work, index) => (
            <Link className={styles.item} href={`/work/${work.slug}`} key={work.id}>
              <span className={styles.itemIndex}>{String(index + 1).padStart(2, '0')}</span>
              <div className={styles.itemBody}>
                <div className={styles.itemTitleRow}>
                  <h2 className={styles.itemTitle}>{work.title}</h2>
                  <span className={styles.itemYear}>{work.year}</span>
                </div>
                <p className={styles.itemSubtitle}>{work.subtitle}</p>
                <span className={styles.itemMeta}>
                  {work.tags.map((tag) => (
                    <span className="chip" key={tag}>
                      {tag}
                    </span>
                  ))}
                </span>
              </div>
              <span className={styles.itemCover}>
                <img src={work.cover} alt={work.title} loading="lazy" />
              </span>
              <span className={styles.itemArrow}>
                <ArrowUpRight size={20} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
