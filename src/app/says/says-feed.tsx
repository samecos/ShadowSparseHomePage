'use client';

import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { CloseIcon, UploadIcon } from '@/components/icons';
import { PageBackdrop } from '@/components/site/page-backdrop';
import { formatDate, formatTime } from '@/lib/format';
import { useAdminSession } from '@/lib/use-admin-session';
import type { Post } from '@/lib/types';
import styles from './says.module.css';

const moods = ['晴', '阴', '雨', '夜', '静', '忙', '困'];

export function SaysFeed({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('静');
  const [location, setLocation] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const { admin } = useAdminSession();

  const availableMoods = useMemo(
    () => Array.from(new Set(posts.map((post) => post.mood).filter(Boolean))) as string[],
    [posts]
  );

  const filteredPosts = useMemo(
    () => (activeMood ? posts.filter((post) => post.mood === activeMood) : posts),
    [activeMood, posts]
  );

  const stats = useMemo(() => {
    const photoCount = posts.reduce((total, post) => total + post.images.length, 0);
    const days = new Set(posts.map((post) => post.createdAt.slice(0, 10))).size;
    return { total: posts.length, photoCount, days };
  }, [posts]);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setUploading(true);
    setError('');
    const uploaded: string[] = [];

    for (const file of files) {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/upload', { method: 'POST', body });
      const payload = (await response.json()) as { data?: { url?: string }; error?: string };
      if (response.ok === false || !payload.data?.url) {
        setError(payload.error ?? '图片上传失败。');
        break;
      }
      uploaded.push(payload.data.url);
    }

    if (uploaded.length > 0) setImages((current) => [...current, ...uploaded].slice(0, 9));
    setUploading(false);
    event.target.value = '';
  }

  async function handlePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (content.trim().length === 0) return;

    setSubmitting(true);
    setError('');

    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        mood: mood || undefined,
        location: location || undefined,
        images,
        visibility: 'public',
        pinned: false
      })
    });
    const payload = (await response.json()) as { data?: Post; error?: string };

    if (response.ok === false || !payload.data) {
      setError(payload.error ?? '发布失败，请稍后重试。');
      setSubmitting(false);
      return;
    }

    setPosts((current) => [payload.data as Post, ...current]);
    setContent('');
    setLocation('');
    setImages([]);
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (window.confirm('确认删除这条说说吗？') === false) return;
    const response = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    if (response.ok) {
      setPosts((current) => current.filter((post) => post.id !== id));
    } else {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? '删除失败。');
    }
  }

  return (
    <div className={styles.layout}>
      <div>
        <header className={`${styles.header} reveal`}>
          <PageBackdrop src="/photos/photo-02.png" position="center 40%" />
          <div>
            <p className="eyebrow">01 · Daily notes</p>
            <h1 className="page-title">日常说说</h1>
            <p className="page-intro">
              碎片一样的记录。没有主题限制，也不负责完整，只是把此刻留下来。
            </p>
          </div>
          <span className={styles.headerMeta}>{stats.total} 则记录</span>
        </header>

        {admin ? (
          <form className={`${styles.composer} reveal reveal-delay-1`} onSubmit={handlePublish}>
            <textarea
              className={`textarea ${styles.composerTextarea}`}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="此刻想写点什么…"
              maxLength={2000}
            />

            {images.length > 0 ? (
              <div className={styles.previewStrip}>
                {images.map((image) => (
                  <span className={styles.previewItem} key={image}>
                    <img src={image} alt="待发布图片" />
                    <button
                      className={styles.previewRemove}
                      type="button"
                      onClick={() => setImages((current) => current.filter((item) => item !== image))}
                      aria-label="移除图片"
                    >
                      <CloseIcon size={12} />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <div className={styles.composerToolbar}>
              <div className={styles.moodOptions}>
                {moods.map((item) => (
                  <button
                    className={`chip ${mood === item ? 'chip--active' : ''}`}
                    key={item}
                    type="button"
                    onClick={() => setMood(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <input
                className={`input ${styles.composerLocation}`}
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="地点（可选）"
                maxLength={80}
              />
            </div>

            <div className={styles.composerFooter}>
              <label className={styles.uploadButton}>
                <UploadIcon size={14} />
                {uploading ? '上传中…' : '添加图片'}
                <input type="file" accept="image/*" multiple onChange={handleUpload} disabled={uploading} />
              </label>
              <button className="btn btn--primary" type="submit" disabled={submitting || content.trim().length === 0}>
                {submitting ? '发布中…' : '发布说说'}
              </button>
            </div>
            {error ? <p className={styles.formError}>{error}</p> : null}
          </form>
        ) : null}

        <section className={styles.feed}>
          <div className={`${styles.feedTools} reveal`}>
            <span className={styles.feedCount}>
              {activeMood ? `筛选：${activeMood}` : '全部记录'} · {filteredPosts.length}
            </span>
            {availableMoods.length > 0 ? (
              <div className={styles.moodOptions}>
                <button
                  className={`chip ${activeMood === null ? 'chip--active' : ''}`}
                  type="button"
                  onClick={() => setActiveMood(null)}
                >
                  全部
                </button>
                {availableMoods.map((item) => (
                  <button
                    className={`chip ${activeMood === item ? 'chip--active' : ''}`}
                    key={item}
                    type="button"
                    onClick={() => setActiveMood(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {filteredPosts.length === 0 ? (
            <p className="empty">还没有记录。第一句话可以从今天开始。</p>
          ) : (
            filteredPosts.map((post, index) => (
              <article
                className={`${styles.post} reveal`}
                key={post.id}
                style={{ animationDelay: `${Math.min(index, 5) * 70}ms` }}
              >
                <div className={styles.postTime}>
                  <strong>{formatDate(post.createdAt)}</strong>
                  <span>{formatTime(post.createdAt)}</span>
                </div>
                <div>
                  <div className={styles.postHeader}>
                    {post.mood ? <span className={styles.postMood}>{post.mood}</span> : null}
                    {post.location ? <span className={styles.postLocation}>{post.location}</span> : null}
                    {post.pinned ? <span className={styles.postLocation}>置顶</span> : null}
                  </div>
                  <p className={styles.postContent}>{post.content}</p>

                  {post.images.length > 0 ? (
                    <div className={styles.imageGrid} data-count={post.images.length}>
                      {post.images.map((image) => (
                        <a href={image} target="_blank" rel="noreferrer" key={image}>
                          <img src={image} alt="说说配图" loading="lazy" />
                        </a>
                      ))}
                    </div>
                  ) : null}

                  <div className={styles.postFooter}>
                    <span>{post.visibility === 'public' ? '公开' : '仅自己可见'}</span>
                    {admin ? (
                      <button className={styles.postDelete} type="button" onClick={() => handleDelete(post.id)}>
                        删除
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>

      <aside className={`${styles.aside} reveal reveal-delay-2`}>
        <div>
          <h2 className={styles.asideTitle}>About</h2>
          <p>
            这里沿用了轻博客的节奏：短、即时、允许不完整。图片会保持低饱和，让文字始终是主角。
          </p>
        </div>

        <div>
          <h2 className={styles.asideTitle}>Archive</h2>
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>说说</dt>
              <dd>{stats.total}</dd>
            </div>
            <div className={styles.stat}>
              <dt>照片</dt>
              <dd>{stats.photoCount}</dd>
            </div>
            <div className={styles.stat}>
              <dt>记录天数</dt>
              <dd>{stats.days}</dd>
            </div>
          </dl>
        </div>

        <div>
          <h2 className={styles.asideTitle}>Mood</h2>
          <div className={styles.archiveLinks}>
            <button type="button" data-active={activeMood === null} onClick={() => setActiveMood(null)}>
              <span>全部</span>
              <span>{posts.length}</span>
            </button>
            {availableMoods.map((item) => (
              <button
                key={item}
                type="button"
                data-active={activeMood === item}
                onClick={() => setActiveMood(item)}
              >
                <span>{item}</span>
                <span>{posts.filter((post) => post.mood === item).length}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
