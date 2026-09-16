'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, SearchIcon, SparkIcon } from '@/components/icons';
import { formatDate } from '@/lib/format';
import type { Collectible, CollectibleStatus, CollectibleType } from '@/lib/types';
import styles from './collection.module.css';

const typeLabels: Record<CollectibleType, string> = {
  link: '链接',
  image: '图像',
  quote: '句子',
  moment: '声音 / 时刻',
  file: '文件'
};

const filters: Array<{ value: 'all' | CollectibleType; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'link', label: '链接' },
  { value: 'image', label: '图像' },
  { value: 'quote', label: '句子' },
  { value: 'moment', label: '声音' },
  { value: 'file', label: '文件' }
];

const statusFilters: Array<{ value: 'all' | CollectibleStatus; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'curated', label: '已归位' },
  { value: 'inbox', label: '待整理' }
];

function CollectionCard({ item }: { item: Collectible }) {
  const className = `${styles.card} ${item.featured ? styles.featured : ''}`;

  const body = (
    <>
      <span className={styles.cardTop}>
        <span>{typeLabels[item.type]}</span>
        <span>{item.source || (item.collectedBy === 'hermes' ? 'HERMES' : 'ME')}</span>
      </span>

      {item.type === 'image' && item.image ? (
        <span className={styles.cardImage}>
          <img src={item.image} alt={item.title} loading="lazy" />
        </span>
      ) : null}

      <div className={styles.cardBody}>
        {item.type === 'quote' ? (
          <blockquote className={styles.quoteCard}>
            <span className={styles.quoteMark}>“</span>
            {item.quote || item.title}
            <span className={styles.quoteMark}>”</span>
          </blockquote>
        ) : (
          <h3 className={styles.cardTitle}>{item.title}</h3>
        )}

        {item.description && item.type !== 'quote' ? (
          <p className={styles.cardDescription}>{item.description}</p>
        ) : null}

        {item.type === 'moment' ? (
          <span className={styles.momentLines} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        ) : null}

        {item.agentSummary ? (
          <span className={styles.agentNote}>
            <SparkIcon size={13} />
            {item.agentSummary}
          </span>
        ) : null}
      </div>

      <span className={styles.cardFooter}>
        <span>
          {formatDate(item.createdAt)}
          {item.tags[0] ? ` · ${item.tags[0]}` : ''}
        </span>
        {item.url ? <ArrowUpRight size={14} /> : null}
      </span>
    </>
  );

  if (item.url) {
    return (
      <a className={className} data-type={item.type} href={item.url} target="_blank" rel="noreferrer">
        {body}
      </a>
    );
  }

  return (
    <article className={className} data-type={item.type}>
      {body}
    </article>
  );
}

export function CollectionGrid({ items }: { items: Collectible[] }) {
  const [activeType, setActiveType] = useState<'all' | CollectibleType>('all');
  const [activeStatus, setActiveStatus] = useState<'all' | CollectibleStatus>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      if (activeType !== 'all' && item.type !== activeType) return false;
      if (activeStatus !== 'all' && item.status !== activeStatus) return false;
      if (!normalized) return true;
      return [item.title, item.description, item.agentSummary, item.quote, item.source, ...item.tags]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [activeStatus, activeType, items, query]);

  return (
    <>
      <div className={`${styles.agentPanel} ${styles.agentPanelSection}`}>
        <div className={styles.agentPanelTop}>
          <span className={styles.agentPanelTitle}>HERMES · CURATOR MODE</span>
          <a className="btn btn--small" href="/collection/hermes">
            API / MCP / SKILL
            <ArrowUpRight size={13} />
          </a>
        </div>
        <p>
          所有内容先进入收件箱，由 HERMES 去重、摘要、打标签，再决定是否精选。你也可以随时手动调整。
        </p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {filters.map((filter) => (
            <button
              className={`chip ${activeType === filter.value ? 'chip--active' : ''}`}
              key={filter.value}
              type="button"
              onClick={() => setActiveType(filter.value)}
            >
              {filter.label}
            </button>
          ))}
          <span style={{ width: 10 }} />
          {statusFilters.map((filter) => (
            <button
              className={`chip ${activeStatus === filter.value ? 'chip--active' : ''}`}
              key={filter.value}
              type="button"
              onClick={() => setActiveStatus(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <label className={styles.search}>
          <SearchIcon size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、标签或 Agent 摘要"
          />
        </label>
      </div>

      <div className={styles.grid}>
        {filtered.length === 0 ? (
          <p className={styles.empty}>这里暂时是空的，等 HERMES 找到下一件有趣的东西。</p>
        ) : (
          filtered.map((item) => <CollectionCard item={item} key={item.id} />)
        )}
      </div>
    </>
  );
}
