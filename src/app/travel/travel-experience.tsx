'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowUpRight, CloseIcon, PlusIcon } from '@/components/icons';
import { formatDate } from '@/lib/format';
import { datesBetween } from '@/lib/travel';
import type { Trip } from '@/lib/types';
import styles from './travel.module.css';

function splitList(value: string) {
  return value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function statusLabel(status: Trip['status']) {
  return {
    planning: '准备中',
    active: '进行中 · 私密',
    completed: '旅行记忆',
    archived: '已归档'
  }[status];
}

function coverUrl(trip: Trip) {
  return trip.coverAttachmentId
    ? `/api/trips/${trip.id}/attachments/${trip.coverAttachmentId}`
    : '/photos/photo-01.png';
}

export function TravelExperience({
  initialTrips,
  initialAdmin
}: {
  initialTrips: Trip[];
  initialAdmin: boolean;
}) {
  const [trips, setTrips] = useState(initialTrips);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [destinations, setDestinations] = useState('');
  const [summary, setSummary] = useState('');
  const [tags, setTags] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  const groups = useMemo(
    () => ({
      active: trips.filter((trip) => trip.status === 'active'),
      planning: trips.filter((trip) => trip.status === 'planning'),
      completed: trips.filter((trip) => trip.status === 'completed'),
      archived: trips.filter((trip) => trip.status === 'archived')
    }),
    [trips]
  );

  async function createTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !startDate || !endDate) return;
    setSaving(true);
    setError('');
    const response = await fetch('/api/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        summary,
        destinations: splitList(destinations),
        startDate,
        endDate,
        tags: splitList(tags),
        status: 'planning',
        visibility: 'private'
      })
    });
    const payload = (await response.json().catch(() => null)) as { data?: Trip; error?: string } | null;
    setSaving(false);
    if (!response.ok || !payload?.data) {
      setError(payload?.error ?? '创建旅行失败，请稍后重试。');
      return;
    }
    setTrips((current) => [payload.data as Trip, ...current]);
    window.location.href = `/travel/${payload.data.slug}`;
  }

  function resetForm() {
    setCreateOpen(false);
    setError('');
    setTitle('');
    setDestinations('');
    setSummary('');
    setTags('');
  }

  return (
    <>
      <header className={`${styles.header} reveal`}>
        <div>
          <p className="eyebrow">06 · Travel planner</p>
          <h1 className="page-title">旅行</h1>
          <p className="page-intro">
            先把要去的地方、每天的安排和预订材料放在一起。出发以后，再决定留下多少沿途记录。
          </p>
        </div>
        <aside className={styles.headerAside}>
          <strong>{initialAdmin ? '规划优先' : '旅行记忆'}</strong>
          <span>{initialAdmin ? '准备中与进行中的内容仅站长和 HERMES 可见。' : '这里只展示已经完成并主动公开的旅行。'}</span>
          <span>{trips.length} 段旅程 · {groups.planning.length} 段准备中</span>
        </aside>
      </header>

      {initialAdmin ? (
        <section className={styles.createSection}>
          <div className={styles.sectionHead}>
            <div>
              <p className="eyebrow">Start with a plan</p>
              <h2>下一段路，从一个空白计划开始。</h2>
            </div>
            <button className="btn btn--primary" type="button" onClick={() => setCreateOpen((open) => !open)}>
              {createOpen ? <CloseIcon size={14} /> : <PlusIcon size={14} />}
              {createOpen ? '收起' : '新建旅行'}
            </button>
          </div>

          {createOpen ? (
            <form className={styles.createForm} onSubmit={createTrip}>
              <label className="field">
                <span className="field__label">标题</span>
                <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：沿着海岸线慢慢走" required />
              </label>
              <label className="field">
                <span className="field__label">目的地</span>
                <input className="input" value={destinations} onChange={(event) => setDestinations(event.target.value)} placeholder="城市之间用逗号分隔" />
              </label>
              <div className={styles.dateFields}>
                <label className="field">
                  <span className="field__label">开始日期</span>
                  <input className="input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
                </label>
                <label className="field">
                  <span className="field__label">结束日期</span>
                  <input className="input" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
                </label>
              </div>
              <label className="field">
                <span className="field__label">一句话说明</span>
                <textarea className="textarea" value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="这次旅行想要怎样的节奏？" />
              </label>
              <label className="field">
                <span className="field__label">标签</span>
                <input className="input" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="例如：海边，慢旅行" />
              </label>
              <div className={styles.formFooter}>
                <span className={styles.formNote}>新建后默认私密，随后可以继续添加行程和预订材料。</span>
                <div className={styles.formActions}>
                  <button className="btn" type="button" onClick={resetForm}>取消</button>
                  <button className="btn btn--primary" type="submit" disabled={saving}>
                    {saving ? '保存中…' : '创建计划'}
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              </div>
              {error ? <p className={styles.error}>{error}</p> : null}
            </form>
          ) : null}
        </section>
      ) : null}

      <section className={`${styles.listSection} reveal reveal-delay-1`}>
        <div className={styles.sectionHead}>
          <div>
            <p className="eyebrow">Your journeys</p>
            <h2>旅行索引</h2>
          </div>
          <span className={styles.sectionMeta}>{trips.length} ENTRIES</span>
        </div>

        {trips.length === 0 ? (
          <div className={styles.empty}>还没有公开的旅行记忆。</div>
        ) : (
          <div className={styles.groups}>
            {(['active', 'planning', 'completed', 'archived'] as const).map((group) => {
              const items = groups[group];
              if (items.length === 0) return null;
              return (
                <section className={styles.group} key={group}>
                  <div className={styles.groupLabel}>
                    <span>{statusLabel(group)}</span>
                    <span>{String(items.length).padStart(2, '0')}</span>
                  </div>
                  <div className={styles.tripList}>
                    {items.map((trip) => (
                      <Link className={styles.tripRow} href={`/travel/${trip.slug}`} key={trip.id}>
                        <span className={styles.tripIndex}>{String(trips.indexOf(trip) + 1).padStart(2, '0')}</span>
                        <span className={styles.tripBody}>
                          <span className={styles.tripTitle}>{trip.title}</span>
                          <span className={styles.tripSummary}>{trip.summary || '还没有写下说明。'}</span>
                          <span className={styles.tripMeta}>
                            {trip.destinations.length > 0 ? trip.destinations.join(' · ') : '目的地待定'}
                            {' · '}
                            {formatDate(trip.startDate)} — {formatDate(trip.endDate)}
                          </span>
                        </span>
                        <span className={styles.tripStats}>
                          <span>{datesBetween(trip.startDate, trip.endDate).length} 天</span>
                          <span>{trip.days.reduce((total, day) => total + day.items.length, 0)} 个安排</span>
                        </span>
                        <span className={styles.tripCover}>
                          <img src={coverUrl(trip)} alt="" loading="lazy" />
                        </span>
                        <span className={styles.tripArrow}><ArrowUpRight size={19} /></span>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
