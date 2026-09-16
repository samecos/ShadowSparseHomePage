import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowUpRight } from '@/components/icons';
import { PageBackdrop } from '@/components/site/page-backdrop';
import { readCollection } from '@/lib/storage';
import type { Work } from '@/lib/types';
import styles from './case.module.css';

type PageProps = { params: Promise<{ slug: string }> };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const works = await readCollection<Work>('works');
  const work = works.find((item) => item.slug === slug);
  if (!work) return { title: '项目不存在' };
  return { title: work.title, description: work.subtitle };
}

export default async function WorkCasePage({ params }: PageProps) {
  const { slug } = await params;
  const works = await readCollection<Work>('works');
  const sorted = [...works].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((item) => item.slug === slug);
  if (index === -1) notFound();

  const work = sorted[index];
  const next = sorted[(index + 1) % sorted.length];

  return (
    <main className="main">
      <div className="shell">
        <Link className={styles.back} href="/work">
          <span className={styles.backArrow}>
            <ArrowRight size={13} style={{ transform: 'rotate(180deg)' }} />
          </span>
          返回工作列表
        </Link>

        <header className={`${styles.hero} reveal`}>
          <PageBackdrop src="/photos/photo-10.png" position="center 45%" />
          <div>
            <p className="eyebrow">
              {work.year} · {work.client ?? '个人项目'}
            </p>
            <h1 className={styles.heroTitle}>{work.title}</h1>
            <p className={styles.heroSubtitle}>{work.subtitle}</p>
          </div>
          <aside className={styles.summary}>
            <p>{work.summary}</p>
          </aside>
        </header>

        <figure className={`${styles.cover} reveal reveal-delay-1`}>
          <img src={work.cover} alt={`${work.title} 项目封面`} />
        </figure>

        <dl className={styles.meta}>
          <div className={styles.metaItem}>
            <dt>Year</dt>
            <dd>{work.year}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt>Role</dt>
            <dd>{work.role}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt>Context</dt>
            <dd>{work.client ?? '个人项目'}</dd>
          </div>
          <div className={styles.metaItem}>
            <dt>Discipline</dt>
            <dd>{work.tags.join(' / ')}</dd>
          </div>
        </dl>

        <section className={styles.metrics}>
          {work.metrics.map((metric) => (
            <div className={styles.metric} key={metric.label}>
              <span className={styles.metricValue}>{metric.value}</span>
              <span className={styles.metricLabel}>{metric.label}</span>
              {metric.note ? <span className={styles.metricNote}>{metric.note}</span> : null}
            </div>
          ))}
        </section>

        {work.sections.map((section, sectionIndex) => (
          <section
            className={`${styles.section} ${sectionIndex % 2 === 1 ? styles.sectionEven : ''}`}
            key={section.heading}
          >
            <div className={styles.sectionBody}>
              <span className={styles.sectionIndex}>{String(sectionIndex + 1).padStart(2, '0')}</span>
              <h2 className={styles.sectionHeading}>{section.heading}</h2>
              <div className={styles.sectionText}>
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
            {section.image ? (
              <figure className={styles.sectionMedia}>
                <img src={section.image} alt={section.heading} loading="lazy" />
                {section.caption ? <figcaption className={styles.sectionCaption}>{section.caption}</figcaption> : null}
              </figure>
            ) : (
              <div />
            )}
          </section>
        ))}

        <Link className={styles.next} href={`/work/${next.slug}`}>
          <div>
            <span className={styles.nextLabel}>Next project · {next.year}</span>
            <h2 className={styles.nextTitle}>{next.title}</h2>
          </div>
          <span className={styles.nextArrow}>
            <ArrowUpRight size={34} />
          </span>
        </Link>
      </div>
    </main>
  );
}
