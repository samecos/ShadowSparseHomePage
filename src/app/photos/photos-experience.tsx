'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, TouchEvent as ReactTouchEvent } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  HeartIcon,
  InfoIcon,
  RestoreIcon,
  SearchIcon,
  TrashIcon,
  UploadIcon
} from '@/components/icons';
import { PageBackdrop } from '@/components/site/page-backdrop';
import { PeopleAlbum } from '@/components/photos/people-album';
import { RegionAlbum } from '@/components/photos/region-album';
import { formatBytes, formatDate, formatTime } from '@/lib/format';
import { readPhotoExif } from '@/lib/exif';
import { groupPhotosByDay, sortPhotos, TRASH_RETENTION_DAYS } from '@/lib/photos';
import type { Photo } from '@/lib/types';
import styles from './photos.module.css';

type ViewId = 'library' | 'favorites' | 'trash';
type Dimension = 'time' | 'people' | 'region';
type BatchAction = 'favorite' | 'unfavorite' | 'trash' | 'restore' | 'purge';

const TILE_MIN = 96;
const TILE_MAX = 224;
const TILE_STORAGE_KEY = 'photos-tile-size';

const clampTile = (value: number) => Math.min(TILE_MAX, Math.max(TILE_MIN, value));

function splitTags(value: string) {
  return value
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function isoToLocalInput(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputToIso(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function uploadImage(file: File) {
  const body = new FormData();
  body.append('file', file);
  const response = await fetch('/api/upload', { method: 'POST', body });
  const payload = (await response.json()) as { data?: { url?: string }; error?: string };
  if (response.ok === false || !payload.data?.url) {
    throw new Error(payload.error ?? '图片上传失败。');
  }
  return payload.data.url;
}

function readDimensions(url: string) {
  return new Promise<{ width?: number; height?: number }>((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({});
    image.src = url;
  });
}

interface InfoDraft {
  title: string;
  date: string;
  locationName: string;
  lat: string;
  lng: string;
  tags: string;
  visibility: 'public' | 'private';
}

export function PhotosExperience({
  initialPhotos,
  initialAdmin
}: {
  initialPhotos: Photo[];
  initialAdmin: boolean;
}) {
  const admin = initialAdmin;
  const gridRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  const [photos, setPhotos] = useState(initialPhotos);
  const [view, setView] = useState<ViewId>('library');
  const [query, setQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tileSize, setTileSize] = useState(132);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [lightboxList, setLightboxList] = useState<Photo[] | null>(null);
  const [dimension, setDimension] = useState<Dimension>('time');
  const [infoOpen, setInfoOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [savingInfo, setSavingInfo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [infoDraft, setInfoDraft] = useState<InfoDraft>({
    title: '',
    date: '',
    locationName: '',
    lat: '',
    lng: '',
    tags: '',
    visibility: 'public'
  });

  useEffect(() => {
    const saved = window.localStorage.getItem(TILE_STORAGE_KEY);
    if (saved) {
      const value = Number(saved);
      if (Number.isFinite(value)) setTileSize(clampTile(value));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(TILE_STORAGE_KEY, String(tileSize));
  }, [tileSize]);

  useEffect(() => {
    if (!admin && view === 'trash') setView('library');
  }, [admin, view]);

  useEffect(() => {
    if (lightboxId) return;
    const grid = gridRef.current;
    if (!grid) return;
    const handler = (event: WheelEvent) => {
      if (event.ctrlKey === false && event.metaKey === false) return;
      event.preventDefault();
      const step = event.deltaY > 0 ? -12 : 12;
      setTileSize((current) => clampTile(current + step));
    };
    grid.addEventListener('wheel', handler, { passive: false });
    return () => grid.removeEventListener('wheel', handler);
  }, [dimension, lightboxId]);

  const viewList = useMemo(() => {
    let items: Photo[];
    if (view === 'favorites') items = photos.filter((photo) => photo.favorite && !photo.deletedAt);
    else if (view === 'trash') items = photos.filter((photo) => photo.deletedAt);
    else items = photos.filter((photo) => !photo.deletedAt);

    const keyword = query.trim().toLowerCase();
    if (keyword) {
      items = items.filter((photo) =>
        [photo.title, photo.locationName, ...photo.tags].join(' ').toLowerCase().includes(keyword)
      );
    }
    return sortPhotos(items);
  }, [photos, query, view]);

  const groups = useMemo(
    () => groupPhotosByDay(viewList, (value) => formatDate(value)),
    [viewList]
  );

  const libraryPhotos = useMemo(() => photos.filter((photo) => !photo.deletedAt), [photos]);

  const libraryCount = photos.filter((photo) => !photo.deletedAt).length;
  const favoriteCount = photos.filter((photo) => photo.favorite && !photo.deletedAt).length;
  const trashCount = photos.filter((photo) => photo.deletedAt).length;

  const lightboxPhoto = useMemo(
    () => photos.find((photo) => photo.id === lightboxId) ?? null,
    [lightboxId, photos]
  );
  const activeList = lightboxList ?? viewList;
  const lightboxIndex = activeList.findIndex((photo) => photo.id === lightboxId);

  const openLightbox = useCallback((photoId: string, list: Photo[]) => {
    setLightboxList(list);
    setLightboxId(photoId);
    setZoomed(false);
    setInfoOpen(false);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxId(null);
    setLightboxList(null);
    setInfoOpen(false);
  }, []);

  const goTo = useCallback(
    (delta: number) => {
      if (lightboxIndex === -1) return;
      const next = activeList[lightboxIndex + delta];
      if (next) {
        setLightboxId(next.id);
        setZoomed(false);
      }
    },
    [lightboxIndex, activeList]
  );

  useEffect(() => {
    const photoId = lightboxPhoto?.id;
    if (!photoId) return;
    setZoomed(false);
    setInfoDraft({
      title: lightboxPhoto.title,
      date: isoToLocalInput(lightboxPhoto.date),
      locationName: lightboxPhoto.locationName,
      lat: lightboxPhoto.lat !== undefined ? String(lightboxPhoto.lat) : '',
      lng: lightboxPhoto.lng !== undefined ? String(lightboxPhoto.lng) : '',
      tags: lightboxPhoto.tags.join(', '),
      visibility: lightboxPhoto.visibility
    });
  }, [lightboxPhoto?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (lightboxId === null) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeLightbox();
      }
      if (event.key === 'ArrowLeft') goTo(-1);
      if (event.key === 'ArrowRight') goTo(1);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeLightbox, goTo, lightboxId]);

  useEffect(() => {
    if (lightboxId === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [lightboxId]);

  useEffect(() => {
    if (selectMode === false || lightboxId !== null) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectMode(false);
        setSelectedIds(new Set());
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxId, selectMode]);

  function toggleSelect(photoId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  function handleTileClick(photo: Photo) {
    if (selectMode) {
      toggleSelect(photo.id);
      return;
    }
    setZoomed(false);
    setLightboxId(photo.id);
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function applyBatch(action: BatchAction, ids: string[]) {
    if (ids.length === 0) return;
    const snapshot = photos;
    const now = new Date().toISOString();
    setBusy(true);
    setError('');

    setPhotos((current) =>
      current
        .map((photo) => {
          if (ids.includes(photo.id) === false) return photo;
          switch (action) {
            case 'favorite':
              return { ...photo, favorite: true };
            case 'unfavorite':
              return { ...photo, favorite: false };
            case 'trash':
              return { ...photo, deletedAt: now };
            case 'restore':
              return { ...photo, deletedAt: null };
            default:
              return photo;
          }
        })
        .filter((photo) => (action === 'purge' ? ids.includes(photo.id) === false : true))
    );

    const response = await fetch('/api/photos/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ids })
    });

    setBusy(false);
    if (response.ok === false) {
      setPhotos(snapshot);
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? '批量操作失败，请确认登录状态。');
    }
  }

  async function runBatchSelected(action: BatchAction) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    if (action === 'purge') {
      const label = ids.length === 1 ? '这张照片' : `这 ${ids.length} 张照片`;
      if (window.confirm(`彻底删除后无法恢复。确定清除${label}吗？`) === false) return;
    }

    await applyBatch(action, ids);
    exitSelectMode();
  }

  async function toggleFavorite(photo: Photo) {
    const next = !photo.favorite;
    setPhotos((current) =>
      current.map((item) => (item.id === photo.id ? { ...item, favorite: next } : item))
    );
    const response = await fetch(`/api/photos/${photo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite: next })
    });
    if (response.ok === false) {
      setPhotos((current) =>
        current.map((item) => (item.id === photo.id ? { ...item, favorite: photo.favorite } : item))
      );
      setError('收藏状态保存失败，可能登录状态已失效。');
    }
  }

  async function saveInfo() {
    if (!lightboxPhoto) return;
    const latText = infoDraft.lat.trim();
    const lngText = infoDraft.lng.trim();
    const lat = latText === '' ? null : Number(latText);
    const lng = lngText === '' ? null : Number(lngText);
    if (latText !== '' && Number.isFinite(lat) === false) {
      setError('纬度需要是数字。');
      return;
    }
    if (lngText !== '' && Number.isFinite(lng) === false) {
      setError('经度需要是数字。');
      return;
    }
    const nextDate = localInputToIso(infoDraft.date);

    setSavingInfo(true);
    setError('');
    const response = await fetch(`/api/photos/${lightboxPhoto.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: infoDraft.title,
        date: nextDate ?? lightboxPhoto.date,
        locationName: infoDraft.locationName,
        lat,
        lng,
        tags: splitTags(infoDraft.tags),
        visibility: infoDraft.visibility
      })
    });
    const payload = (await response.json()) as { data?: Photo; error?: string };
    if (response.ok === false || !payload.data) {
      setError(payload.error ?? '保存失败，请确认登录状态。');
      setSavingInfo(false);
      return;
    }
    const saved = payload.data;
    setPhotos((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    setSavingInfo(false);
  }

  async function deleteFromLightbox() {
    if (!lightboxPhoto) return;
    const isTrashed = Boolean(lightboxPhoto.deletedAt);
    if (isTrashed && window.confirm('彻底删除后无法恢复，确定吗？') === false) return;

    const response = await fetch(`/api/photos/${lightboxPhoto.id}`, { method: 'DELETE' });
    const payload = (await response.json()) as { data?: { result?: string }; error?: string };
    if (response.ok === false) {
      setError(payload.error ?? '删除失败。');
      return;
    }

    if (payload.data?.result === 'trashed') {
      const trashed = { ...lightboxPhoto, deletedAt: new Date().toISOString() };
      setPhotos((current) => current.map((item) => (item.id === trashed.id ? trashed : item)));
      const next = activeList[lightboxIndex + 1] ?? activeList[lightboxIndex - 1] ?? null;
      if (next && next.id !== trashed.id) setLightboxId(next.id);
      else closeLightbox();
      return;
    }

    setPhotos((current) => current.filter((item) => item.id !== lightboxPhoto.id));
    closeLightbox();
  }

  async function restoreFromLightbox() {
    if (!lightboxPhoto) return;
    const next = activeList[lightboxIndex + 1] ?? activeList[lightboxIndex - 1] ?? null;
    if (next) setLightboxId(next.id);
    else closeLightbox();
    await applyBatch('restore', [lightboxPhoto.id]);
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    setError('');
    setUploadProgress({ done: 0, total: files.length });

    const created: Photo[] = [];
    let firstError = '';

    for (const file of files) {
      try {
        const url = await uploadImage(file);
        const [dimensions, exif] = await Promise.all([readDimensions(url), readPhotoExif(file)]);
        const response = await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url,
            date: exif.date,
            lat: exif.lat,
            lng: exif.lng,
            width: dimensions.width,
            height: dimensions.height,
            size: file.size,
            mimeType: file.type || undefined
          })
        });
        const payload = (await response.json()) as { data?: Photo; error?: string };
        if (response.ok === false || !payload.data) throw new Error(payload.error ?? '照片保存失败。');
        created.push(payload.data);
      } catch (uploadError) {
        firstError = uploadError instanceof Error ? uploadError.message : '照片上传失败。';
      }
      setUploadProgress((current) => ({ ...current, done: current.done + 1 }));
    }

    if (created.length > 0) setPhotos((current) => [...created, ...current]);
    if (firstError) setError(firstError);
    setUploadProgress({ done: 0, total: 0 });
  }

  async function emptyTrash() {
    const ids = photos.filter((photo) => photo.deletedAt).map((photo) => photo.id);
    if (ids.length === 0) return;
    if (window.confirm(`清空回收站将彻底删除 ${ids.length} 张照片，无法恢复。确定吗？`) === false) return;
    await applyBatch('purge', ids);
    exitSelectMode();
  }

  function handleTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null || zoomed) return;
    const delta = (event.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(delta) > 60) goTo(delta < 0 ? 1 : -1);
  }

  const uploading = uploadProgress.total > 0;
  const tabs: { id: ViewId; label: string; count: number }[] = [
    { id: 'library', label: '图库', count: libraryCount },
    { id: 'favorites', label: '收藏', count: favoriteCount }
  ];
  if (admin) tabs.push({ id: 'trash', label: '最近删除', count: trashCount });

  const inTrash = view === 'trash';

  return (
    <div className={styles.page}>
      <header className={`${styles.toolbar} reveal`}>
        <PageBackdrop src="/photos/photo-07.png" position="center 26%" />
        <div className={styles.toolbarTop}>
          <div>
            <p className="eyebrow">02 · Library</p>
            <h1 className={styles.pageTitle}>照片</h1>
            <p className={styles.pageSub}>
              {dimension === 'region'
                ? '按拍摄城市整理，地图上是每张照片的位置。'
                : dimension === 'people'
                  ? '自动识别并聚在一起的面孔。'
                  : inTrash
                    ? `回收站 · 停留 ${TRASH_RETENTION_DAYS} 天后自动清除`
                    : '按拍摄时间排列。点开一张照片，可以放大、收藏和补写信息。'}
            </p>
          </div>

          <div className={styles.toolbarActions}>
            <div className={styles.dimensionTabs} role="tablist" aria-label="分类维度">
              {(
                [
                  { id: 'time', label: '时间' },
                  { id: 'region', label: '地区' },
                  ...(admin ? [{ id: 'people' as const, label: '人物' }] : [])
                ] as { id: Dimension; label: string }[]
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={dimension === item.id}
                  className={`${styles.tab} ${dimension === item.id ? styles.tabActive : ''}`}
                  onClick={() => {
                    setDimension(item.id);
                    setView('library');
                    exitSelectMode();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {dimension === 'time' ? (
              <>
                <div className={styles.tabs} role="tablist" aria-label="照片视图">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={view === tab.id}
                      className={`${styles.tab} ${view === tab.id ? styles.tabActive : ''}`}
                      onClick={() => {
                        setView(tab.id);
                        exitSelectMode();
                      }}
                    >
                      {tab.label}
                      <span className={styles.tabCount}>{tab.count}</span>
                    </button>
                  ))}
                </div>

                <label className={styles.search}>
                  <SearchIcon size={14} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索标题、地点、标签"
                    aria-label="搜索照片"
                  />
                </label>

                {admin ? (
                  <div className={styles.adminActions}>
                    <button
                      type="button"
                      className={`btn btn--small ${selectMode ? styles.selectActive : ''}`}
                      onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                    >
                      {selectMode ? '退出选择' : '选择'}
                    </button>
                    <label className={`btn btn--small btn--primary ${styles.uploadLabel}`}>
                      <UploadIcon size={13} />
                      {uploading ? `上传中 ${uploadProgress.done}/${uploadProgress.total}` : '上传照片'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                        multiple
                        onChange={handleUpload}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {dimension === 'time' ? (
          <div className={styles.toolbarBottom}>
            <span className={styles.gridMeta}>
              {viewList.length > 0 ? `${viewList.length} 张照片` : '没有照片'}
            </span>
            <label className={styles.zoomControl} aria-label="调整缩略图大小">
              <span className={styles.zoomLabel}>缩放</span>
              <input
                type="range"
                min={TILE_MIN}
                max={TILE_MAX}
                step={4}
                value={tileSize}
                onChange={(event) => setTileSize(clampTile(Number(event.target.value)))}
              />
            </label>
          </div>
        ) : null}

        {dimension === 'time' && selectMode ? (
          <div className={styles.selectBar}>
            <button
              type="button"
              className={styles.selectBarItem}
              onClick={() =>
                setSelectedIds(
                  selectedIds.size === viewList.length
                    ? new Set()
                    : new Set(viewList.map((photo) => photo.id))
                )
              }
            >
              {selectedIds.size === viewList.length && viewList.length > 0 ? '取消全选' : '全选'}
            </button>
            <span className={styles.selectCount}>已选 {selectedIds.size} 张</span>
            <div className={styles.selectActions}>
              {inTrash ? (
                <>
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={selectedIds.size === 0 || busy}
                    onClick={() => runBatchSelected('restore')}
                  >
                    <RestoreIcon size={13} />
                    恢复
                  </button>
                  <button
                    type="button"
                    className="btn btn--small btn--danger"
                    disabled={selectedIds.size === 0 || busy}
                    onClick={() => runBatchSelected('purge')}
                  >
                    <TrashIcon size={13} />
                    彻底删除
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={selectedIds.size === 0 || busy}
                    onClick={() => runBatchSelected('favorite')}
                  >
                    <HeartIcon size={13} />
                    收藏
                  </button>
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={selectedIds.size === 0 || busy}
                    onClick={() => runBatchSelected('unfavorite')}
                  >
                    取消收藏
                  </button>
                  <button
                    type="button"
                    className="btn btn--small btn--danger"
                    disabled={selectedIds.size === 0 || busy}
                    onClick={() => runBatchSelected('trash')}
                  >
                    <TrashIcon size={13} />
                    删除
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}

        {dimension === 'time' && inTrash && trashCount > 0 ? (
          <div className={styles.trashRow}>
            <span className={styles.trashHint}>删除的照片会先留在这里，{TRASH_RETENTION_DAYS} 天后自动清除。</span>
            <button type="button" className="btn btn--small btn--danger" disabled={busy} onClick={emptyTrash}>
              清空回收站
            </button>
          </div>
        ) : null}

        {error ? <p className={styles.error}>{error}</p> : null}
      </header>

      {dimension === 'time' ? (
        <div ref={gridRef} className={styles.gridScope}>
          {groups.length === 0 ? (
            <div className="empty">
              {view === 'favorites'
                ? '还没有收藏的照片。'
                : view === 'trash'
                  ? '回收站是空的。'
                  : admin
                    ? '还没有照片。点右上角「上传照片」，把一段时光放进来。'
                    : '这里还没有照片。'}
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.key} className={styles.dayGroup}>
                <h2 className={styles.dayHead}>{group.label}</h2>
                <div className={styles.grid} style={{ '--tile': `${tileSize}px` } as CSSProperties}>
                  {group.items.map((photo, index) => {
                    const selected = selectedIds.has(photo.id);
                    return (
                      <button
                        key={photo.id}
                        type="button"
                        className={`${styles.tile} ${selected ? styles.tileSelected : ''}`}
                        style={{ '--stagger': String(Math.min(index, 8)) } as CSSProperties}
                        onClick={() => handleTileClick(photo)}
                        aria-label={photo.title || photo.locationName || '查看照片'}
                        aria-pressed={selectMode ? selected : undefined}
                      >
                        <img src={photo.url} alt={photo.title || photo.locationName || ''} loading="lazy" />
                        {photo.favorite && !inTrash ? (
                          <span className={styles.tileHeart} aria-label="已收藏">
                            <HeartIcon size={11} filled />
                          </span>
                        ) : null}
                        {selectMode ? (
                          <span className={`${styles.tileCheck} ${selected ? styles.tileCheckOn : ''}`}>
                            ✓
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      ) : dimension === 'people' && admin ? (
        <PeopleAlbum admin={admin} photos={libraryPhotos} onOpenPhoto={openLightbox} />
      ) : (
        <RegionAlbum photos={libraryPhotos} onOpenPhoto={openLightbox} />
      )}

      {lightboxPhoto ? (
        <div
          className={`${styles.lightbox} ${infoOpen ? styles.lightboxInfoOpen : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="照片查看"
        >
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={closeLightbox}
            aria-label="关闭"
          >
            <CloseIcon size={16} />
          </button>

          <div className={styles.lightboxTop}>
            <span className={styles.lightboxCounter}>
              {lightboxIndex + 1} / {activeList.length}
            </span>
            <span className={styles.lightboxCaption}>
              {formatDate(lightboxPhoto.date)}
              {lightboxPhoto.locationName ? ` · ${lightboxPhoto.locationName}` : ''}
            </span>
          </div>

          {lightboxIndex > 0 ? (
            <button
              type="button"
              className={`${styles.lightboxNav} ${styles.lightboxPrev}`}
              onClick={() => goTo(-1)}
              aria-label="上一张"
            >
              <ChevronLeftIcon size={22} />
            </button>
          ) : null}
          {lightboxIndex < activeList.length - 1 ? (
            <button
              type="button"
              className={`${styles.lightboxNav} ${styles.lightboxNext}`}
              onClick={() => goTo(1)}
              aria-label="下一张"
            >
              <ChevronRightIcon size={22} />
            </button>
          ) : null}

          <div
            className={`${styles.lightboxStage} ${zoomed ? styles.lightboxZoomed : ''}`}
            onDoubleClick={() => setZoomed((current) => !current)}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <img
              className={styles.lightboxImage}
              src={lightboxPhoto.url}
              alt={lightboxPhoto.title || lightboxPhoto.locationName || '照片'}
              draggable={false}
            />
          </div>

          <footer className={styles.lightboxBar}>
            {inTrash ? (
              <>
                <button type="button" className={styles.lightboxAction} onClick={restoreFromLightbox}>
                  <RestoreIcon size={15} />
                  恢复
                </button>
                <button
                  type="button"
                  className={`${styles.lightboxAction} ${styles.lightboxActionDanger}`}
                  onClick={deleteFromLightbox}
                >
                  <TrashIcon size={15} />
                  彻底删除
                </button>
              </>
            ) : (
              <button
                type="button"
                className={`${styles.lightboxAction} ${lightboxPhoto.favorite ? styles.lightboxActionActive : ''}`}
                onClick={() => (admin ? toggleFavorite(lightboxPhoto) : setInfoOpen(true))}
                disabled={!admin}
              >
                <HeartIcon size={15} filled={lightboxPhoto.favorite} />
                {lightboxPhoto.favorite ? '已收藏' : '收藏'}
              </button>
            )}
            <span className={styles.lightboxMeta}>
              {formatTime(lightboxPhoto.date)}
              {lightboxPhoto.width && lightboxPhoto.height
                ? ` · ${lightboxPhoto.width}×${lightboxPhoto.height}`
                : ''}
            </span>
            <button
              type="button"
              className={`${styles.lightboxAction} ${infoOpen ? styles.lightboxActionActive : ''}`}
              onClick={() => setInfoOpen((current) => !current)}
              aria-expanded={infoOpen}
            >
              <InfoIcon size={15} />
              信息
            </button>
          </footer>

          {infoOpen ? (
            <aside className={styles.infoPanel}>
              <div className={styles.infoHead}>
                <span>照片信息</span>
                <button type="button" onClick={() => setInfoOpen(false)} aria-label="收起信息">
                  <CloseIcon size={13} />
                </button>
              </div>

              <dl className={styles.infoList}>
                <div>
                  <dt>时间</dt>
                  <dd>
                    {formatDate(lightboxPhoto.date)} {formatTime(lightboxPhoto.date)}
                  </dd>
                </div>
                {lightboxPhoto.width && lightboxPhoto.height ? (
                  <div>
                    <dt>尺寸</dt>
                    <dd>
                      {lightboxPhoto.width} × {lightboxPhoto.height}
                    </dd>
                  </div>
                ) : null}
                {formatBytes(lightboxPhoto.size) ? (
                  <div>
                    <dt>大小</dt>
                    <dd>{formatBytes(lightboxPhoto.size)}</dd>
                  </div>
                ) : null}
                {lightboxPhoto.lat !== undefined ? (
                  <div>
                    <dt>坐标</dt>
                    <dd className="mono">
                      {lightboxPhoto.lat.toFixed(5)}, {lightboxPhoto.lng?.toFixed(5)}
                    </dd>
                  </div>
                ) : null}
                {!admin && lightboxPhoto.tags.length > 0 ? (
                  <div>
                    <dt>标签</dt>
                    <dd>{lightboxPhoto.tags.join(' · ')}</dd>
                  </div>
                ) : null}
              </dl>

              {admin ? (
                <form
                  className={styles.infoForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveInfo();
                  }}
                >
                  <label className={styles.infoField}>
                    <span>标题</span>
                    <input
                      value={infoDraft.title}
                      onChange={(event) => setInfoDraft({ ...infoDraft, title: event.target.value })}
                      placeholder="给这张照片一个名字"
                    />
                  </label>
                  <label className={styles.infoField}>
                    <span>拍摄时间</span>
                    <input
                      type="datetime-local"
                      value={infoDraft.date}
                      onChange={(event) => setInfoDraft({ ...infoDraft, date: event.target.value })}
                    />
                  </label>
                  <label className={styles.infoField}>
                    <span>地点</span>
                    <input
                      value={infoDraft.locationName}
                      onChange={(event) =>
                        setInfoDraft({ ...infoDraft, locationName: event.target.value })
                      }
                      placeholder="例如：西湖 · 北山街"
                    />
                  </label>
                  <div className={styles.infoPair}>
                    <label className={styles.infoField}>
                      <span>纬度</span>
                      <input
                        value={infoDraft.lat}
                        onChange={(event) => setInfoDraft({ ...infoDraft, lat: event.target.value })}
                        placeholder="30.25"
                        inputMode="decimal"
                      />
                    </label>
                    <label className={styles.infoField}>
                      <span>经度</span>
                      <input
                        value={infoDraft.lng}
                        onChange={(event) => setInfoDraft({ ...infoDraft, lng: event.target.value })}
                        placeholder="120.14"
                        inputMode="decimal"
                      />
                    </label>
                  </div>
                  <label className={styles.infoField}>
                    <span>标签</span>
                    <input
                      value={infoDraft.tags}
                      onChange={(event) => setInfoDraft({ ...infoDraft, tags: event.target.value })}
                      placeholder="多个标签用逗号分隔"
                    />
                  </label>
                  <label className={styles.infoField}>
                    <span>可见性</span>
                    <select
                      value={infoDraft.visibility}
                      onChange={(event) =>
                        setInfoDraft({
                          ...infoDraft,
                          visibility: event.target.value as 'public' | 'private'
                        })
                      }
                    >
                      <option value="public">公开</option>
                      <option value="private">私密（仅自己可见）</option>
                    </select>
                  </label>

                  <div className={styles.infoActions}>
                    {inTrash ? null : (
                      <button
                        type="button"
                        className="btn btn--small btn--danger"
                        onClick={deleteFromLightbox}
                      >
                        <TrashIcon size={13} />
                        删除
                      </button>
                    )}
                    <button type="submit" className="btn btn--primary btn--small" disabled={savingInfo}>
                      {savingInfo ? '保存中…' : '保存信息'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className={styles.infoReadonly}>
                  {lightboxPhoto.title || '这张照片还没有名字。'}
                </div>
              )}
            </aside>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
