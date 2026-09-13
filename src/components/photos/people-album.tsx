'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { pendingScans, scanPhoto } from '@/lib/faces';
import type { Photo } from '@/lib/types';
import styles from './people-album.module.css';

interface PersonFace {
  id: string;
  photoId: string;
  thumbUrl: string;
  box: { x: number; y: number; w: number; h: number };
}

interface PersonItem {
  id: string;
  name: string | null;
  hidden: boolean;
  count: number;
  coverThumbUrl: string | null;
  faces: PersonFace[];
}

export function PeopleAlbum({
  admin,
  photos,
  onOpenPhoto
}: {
  admin: boolean;
  photos: Photo[];
  onOpenPhoto: (photoId: string, list: Photo[]) => void;
}) {
  const [people, setPeople] = useState<PersonItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [mergeTarget, setMergeTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const photoById = useMemo(() => new Map(photos.map((photo) => [photo.id, photo])), [photos]);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/people');
      if (response.ok === false) throw new Error('人物数据加载失败。');
      const payload = (await response.json()) as { data: { items: PersonItem[] } };
      setPeople(payload.data.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '人物数据加载失败。');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = people.find((person) => person.id === selectedId) ?? null;

  useEffect(() => {
    setDraftName(selected?.name ?? '');
    setMergeTarget('');
  }, [selectedId, selected?.name]);

  const listed = people.filter((person) => person.hidden === showHidden);
  const hiddenCount = people.filter((person) => person.hidden).length;

  const selectedPhotos = useMemo(() => {
    if (!selected) return [];
    const seen = new Set<string>();
    const items: Photo[] = [];
    selected.faces.forEach((face) => {
      if (seen.has(face.photoId)) return;
      const photo = photoById.get(face.photoId);
      if (photo) {
        seen.add(face.photoId);
        items.push(photo);
      }
    });
    return items;
  }, [selected, photoById]);

  async function startScan() {
    const queue = pendingScans(photos);
    if (queue.length === 0) return;
    setError('');
    setScanProgress({ done: 0, total: queue.length });
    let failed = 0;
    for (let i = 0; i < queue.length; i += 1) {
      try {
        await scanPhoto(queue[i]);
      } catch {
        failed += 1;
      }
      setScanProgress({ done: i + 1, total: queue.length });
    }
    setScanProgress(null);
    if (failed > 0) setError(`${failed} 张照片扫描失败,已跳过。`);
    await load();
  }

  async function run(action: () => Promise<Response>, onDone?: () => void) {
    setBusy(true);
    setError('');
    try {
      const response = await action();
      if (response.ok === false) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? '操作失败。');
      }
      await load();
      onDone?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '操作失败。');
    } finally {
      setBusy(false);
    }
  }

  const saveName = () =>
    run(
      () =>
        fetch(`/api/people/${selectedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: draftName.trim() || null })
        })
    );

  const toggleHidden = (person: PersonItem) =>
    run(
      () =>
        fetch(`/api/people/${person.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hidden: !person.hidden })
        }),
      () => {
        if (person.id === selectedId && person.hidden === false) setSelectedId(null);
      }
    );

  const mergeInto = () => {
    if (!selectedId || !mergeTarget) return;
    run(
      () =>
        fetch('/api/people/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceId: selectedId, targetId: mergeTarget })
        }),
      () => setSelectedId(mergeTarget)
    );
  };

  const setCover = (faceId: string) =>
    run(() =>
      fetch(`/api/people/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverFaceId: faceId })
      })
    );

  const removeFace = (faceId: string) =>
    run(() => fetch(`/api/faces/${faceId}`, { method: 'DELETE' }));

  if (selected) {
    return (
      <div className={styles.detail}>
        <div className={styles.detailHeader}>
          <button type="button" className="btn btn--small" onClick={() => setSelectedId(null)}>
            ← 全部人物
          </button>
          {admin ? (
            <div className={styles.detailActions}>
              <input
                className={styles.nameInput}
                value={draftName}
                placeholder="未命名人物"
                maxLength={40}
                onChange={(event) => setDraftName(event.target.value)}
                aria-label="人物名字"
              />
              <button type="button" className="btn btn--small" disabled={busy} onClick={saveName}>
                保存名字
              </button>
              <select
                className={styles.mergeSelect}
                value={mergeTarget}
                onChange={(event) => setMergeTarget(event.target.value)}
                aria-label="合并到"
              >
                <option value="">合并到…</option>
                {people
                  .filter((person) => person.id !== selected.id)
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name ?? '未命名人物'}({person.count})
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="btn btn--small"
                disabled={busy || !mergeTarget}
                onClick={mergeInto}
              >
                合并
              </button>
              <button
                type="button"
                className="btn btn--small"
                disabled={busy}
                onClick={() => toggleHidden(selected)}
              >
                隐藏
              </button>
            </div>
          ) : null}
        </div>

        <h2 className={styles.detailTitle}>
          {selected.name ?? '未命名人物'}
          <span className={styles.detailCount}>{selectedPhotos.length} 张照片</span>
        </h2>

        {admin ? (
          <div className={styles.faceStrip}>
            {selected.faces.map((face) => (
              <span key={face.id} className={styles.faceItem}>
                <button
                  type="button"
                  className={styles.faceThumb}
                  title="设为封面"
                  onClick={() => setCover(face.id)}
                >
                  <img src={face.thumbUrl} alt="" loading="lazy" />
                </button>
                <button
                  type="button"
                  className={styles.faceRemove}
                  title="删除误检"
                  disabled={busy}
                  onClick={() => removeFace(face.id)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.photoGrid}>
          {selectedPhotos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className={styles.photoTile}
              onClick={() => onOpenPhoto(photo.id, selectedPhotos)}
              aria-label={photo.title || photo.locationName || '查看照片'}
            >
              <img src={photo.url} alt={photo.title || ''} loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.peopleToolbar}>
        <span className={styles.peopleMeta}>
          {loaded ? `${listed.length} 个人物` : '加载中…'}
        </span>
        {admin ? (
          <div className={styles.peopleActions}>
            <button
              type="button"
              className="btn btn--small btn--primary"
              disabled={scanProgress !== null}
              onClick={startScan}
            >
              {scanProgress
                ? `扫描中 ${scanProgress.done}/${scanProgress.total}`
                : '扫描人物'}
            </button>
            {hiddenCount > 0 ? (
              <button
                type="button"
                className="btn btn--small"
                onClick={() => setShowHidden((value) => !value)}
              >
                {showHidden ? '返回人物' : `已隐藏(${hiddenCount})`}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {loaded && listed.length === 0 ? (
        <div className="empty">
          {showHidden
            ? '没有隐藏的人物。'
            : admin
              ? '还没有识别人物。点右上角「扫描人物」,自动把照片里的人聚到一起。'
              : '还没有人物。'}
        </div>
      ) : (
        <div className={styles.peopleGrid}>
          {listed.map((person) => (
            <div key={person.id} className={styles.personCard}>
              <button
                type="button"
                className={styles.personFace}
                onClick={() => setSelectedId(person.id)}
                aria-label={person.name ?? '未命名人物'}
              >
                {person.coverThumbUrl ? (
                  <img src={person.coverThumbUrl} alt="" loading="lazy" />
                ) : (
                  <span className={styles.personFallback} />
                )}
              </button>
              <span className={styles.personName}>{person.name ?? '未命名人物'}</span>
              <span className={styles.personCount}>{person.count}</span>
              {admin ? (
                <button
                  type="button"
                  className={styles.personHide}
                  disabled={busy}
                  onClick={() => toggleHidden(person)}
                >
                  {person.hidden ? '恢复' : '隐藏'}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
