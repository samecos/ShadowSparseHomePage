'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { LayerGroup, Map as LeafletMap, TileLayer, LeafletMouseEvent } from 'leaflet';
import { CloseIcon, MapPinIcon, MoveIcon, PlusIcon, TrashIcon, UploadIcon } from '@/components/icons';
import { formatDate, formatTime } from '@/lib/format';
import { readPhotoExif } from '@/lib/exif';
import { useAdminSession } from '@/lib/use-admin-session';
import { site, type MapLayerId } from '@/lib/site';
import type { MapStory, Photo } from '@/lib/types';
import styles from './map.module.css';

type Placement = { lat: number; lng: number };
type GeotaggedPhoto = Photo & { lat: number; lng: number };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return map[character] ?? character;
  });
}

function makePhotoId() {
  return `photo_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function MapExperience({
  initialStories,
  initialPhotos
}: {
  initialStories: MapStory[];
  initialPhotos: Photo[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const placingRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [stories, setStories] = useState(initialStories);
  const [photos, setPhotos] = useState(initialPhotos);
  const [selectedId, setSelectedId] = useState<string | null>(initialStories[0]?.id ?? null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [activeMapLayerId, setActiveMapLayerId] = useState<MapLayerId>(site.map.defaultLayer);
  const [placing, setPlacing] = useState(false);
  const [draft, setDraft] = useState<Placement | null>(null);
  const [draftImage, setDraftImage] = useState('/photos/photo-12.png');
  const [draftCamera, setDraftCamera] = useState('');
  const [draftForm, setDraftForm] = useState({
    title: '',
    note: '',
    date: new Date().toISOString().slice(0, 10),
    locationName: ''
  });
  const [detail, setDetail] = useState({
    title: '',
    note: '',
    date: '',
    locationName: '',
    tags: ''
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const { admin } = useAdminSession();
  const initialViewAppliedRef = useRef(false);
  const activeMapLayer =
    site.map.layers.find((layer) => layer.id === activeMapLayerId) ?? site.map.layers[0];

  const selectedStory = useMemo(
    () => stories.find((story) => story.id === selectedId) ?? null,
    [selectedId, stories]
  );
  const geotaggedPhotos = useMemo(
    () =>
      photos.filter(
        (photo): photo is GeotaggedPhoto =>
          typeof photo.lat === 'number' && Number.isFinite(photo.lat) &&
          typeof photo.lng === 'number' && Number.isFinite(photo.lng)
      ),
    [photos]
  );
  const selectedPhoto = useMemo(
    () => geotaggedPhotos.find((photo) => photo.id === selectedPhotoId) ?? null,
    [geotaggedPhotos, selectedPhotoId]
  );

  useEffect(() => {
    placingRef.current = placing;
  }, [placing]);

  useEffect(() => {
    if (!selectedStory) return;
    setDetail({
      title: selectedStory.title,
      note: selectedStory.note,
      date: selectedStory.date,
      locationName: selectedStory.locationName,
      tags: selectedStory.tags.join(', ')
    });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const L = await import('leaflet');
      if (cancelled || containerRef.current === null) return;

      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        center: [...site.map.center] as [number, number],
        zoom: site.map.zoom,
        minZoom: site.map.minZoom,
        maxZoom: site.map.maxZoom,
        zoomControl: false,
        attributionControl: true
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      const layer = L.layerGroup().addTo(map);

      map.on('click', (event: LeafletMouseEvent) => {
        if (placingRef.current) {
          setDraft({ lat: event.latlng.lat, lng: event.latlng.lng });
          setPlacing(false);
          return;
        }
        setSelectedId(null);
        setSelectedPhotoId(null);
      });

      mapRef.current = map;
      layerRef.current = layer;
      window.setTimeout(() => map.invalidateSize(), 120);
      setReady(true);
    }

    initialize();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (ready === false || L === null || map === null) return;

    const tileLayer = L.tileLayer(activeMapLayer.tileUrl, {
      attribution: activeMapLayer.attribution,
      tileSize: 512,
      zoomOffset: -1,
      maxZoom: site.map.maxZoom
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    return () => {
      if (map.hasLayer(tileLayer)) tileLayer.remove();
      if (tileLayerRef.current === tileLayer) tileLayerRef.current = null;
    };
  }, [activeMapLayer, ready]);

  const movePhoto = useCallback(
    async (storyId: string, photoId: string, lat: number, lng: number) => {
      if (admin === false) return;

      setStories((current) =>
        current.map((story) =>
          story.id === storyId
            ? {
                ...story,
                photos: story.photos.map((photo) =>
                  photo.id === photoId ? { ...photo, lat, lng } : photo
                )
              }
            : story
        )
      );

      const response = await fetch(`/api/map-stories/${storyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: { id: photoId, lat, lng } })
      });

      if (response.ok === false) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? '照片位置保存失败，可能登录状态已失效。');
      }
    },
    [admin]
  );

  const moveLibraryPhoto = useCallback(
    async (photoId: string, lat: number, lng: number) => {
      if (admin === false) return;

      setPhotos((current) =>
        current.map((photo) => (photo.id === photoId ? { ...photo, lat, lng } : photo))
      );

      const response = await fetch(`/api/photos/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng })
      });

      if (response.ok === false) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? '图库照片位置保存失败，可能登录状态已失效。');
      }
    },
    [admin]
  );

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (ready === false || L === null || map === null || initialViewAppliedRef.current) return;

    const points: [number, number][] = [
      ...stories.flatMap((story) => story.photos.map((photo) => [photo.lat, photo.lng] as [number, number])),
      ...geotaggedPhotos.map((photo) => [photo.lat, photo.lng] as [number, number])
    ];

    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), {
        padding: [80, 80],
        maxZoom: site.map.zoom
      });
    }
    initialViewAppliedRef.current = true;
  }, [geotaggedPhotos, ready, stories]);

  useEffect(() => {
    const L = leafletRef.current;
    const layer = layerRef.current;
    if (ready === false || L === null || layer === null) return;

    layer.clearLayers();

    stories.forEach((story) => {
      const selected = story.id === selectedId;
      story.photos.forEach((photo) => {
        const caption = photo.caption || story.title;
        const icon = L.divIcon({
          className: `${styles.marker} ${selected ? styles.markerSelected : ''}`,
          html: `<div class="${styles.markerInner}"><img src="${escapeHtml(photo.url)}" alt="" /><span class="${styles.markerCaption}">${escapeHtml(caption)}</span></div>`,
          iconSize: [62, 62],
          iconAnchor: [31, 31]
        });

        const marker = L.marker([photo.lat, photo.lng], {
          icon,
          draggable: admin,
          riseOnHover: true,
          title: caption
        });

        marker.on('click', () => {
          setSelectedId(story.id);
          setSelectedPhotoId(null);
        });
        marker.on('dragend', () => {
          if (admin === false) return;
          const position = marker.getLatLng();
          setSelectedId(story.id);
          setSelectedPhotoId(null);
          movePhoto(story.id, photo.id, position.lat, position.lng);
        });
        if (selected) marker.setZIndexOffset(500);
        marker.addTo(layer);
      });
    });

    geotaggedPhotos.forEach((photo) => {
      const selected = photo.id === selectedPhotoId;
      const caption = photo.title || photo.locationName || '图库照片';
      const icon = L.divIcon({
        className: `${styles.marker} ${selected ? styles.markerSelected : ''}`,
        html: `<div class="${styles.markerInner}"><img src="${escapeHtml(photo.url)}" alt="" /><span class="${styles.markerCaption}">${escapeHtml(caption)}</span></div>`,
        iconSize: [62, 62],
        iconAnchor: [31, 31]
      });

      const marker = L.marker([photo.lat, photo.lng], {
        icon,
        draggable: admin,
        riseOnHover: true,
        title: caption
      });

      marker.on('click', () => {
        setSelectedId(null);
        setSelectedPhotoId(photo.id);
      });
      marker.on('dragend', () => {
        if (admin === false) return;
        const position = marker.getLatLng();
        setSelectedId(null);
        setSelectedPhotoId(photo.id);
        moveLibraryPhoto(photo.id, position.lat, position.lng);
      });
      if (selected) marker.setZIndexOffset(500);
      marker.addTo(layer);
    });

    if (admin && draft) {
      const icon = L.divIcon({
        className: `${styles.marker} ${styles.markerPlacing}`,
        html: `<div class="${styles.markerInner}"><span class="${styles.placementGlyph}">+</span></div>`,
        iconSize: [62, 62],
        iconAnchor: [31, 31]
      });
      L.marker([draft.lat, draft.lng], { icon, interactive: false }).addTo(layer);
    }
  }, [admin, draft, geotaggedPhotos, moveLibraryPhoto, movePhoto, ready, selectedId, selectedPhotoId, stories]);

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

  async function handleDraftUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const [url, exif] = await Promise.all([uploadImage(file), readPhotoExif(file)]);
      setDraftImage(url);
      setDraftCamera(exif.camera ?? '');
      const shotDate = exif.shotDate;
      if (shotDate) {
        setDraftForm((current) => ({ ...current, date: shotDate.slice(0, 10) }));
      }
      if (typeof exif.lat === 'number' && typeof exif.lng === 'number') {
        setDraft({ lat: exif.lat, lng: exif.lng });
        mapRef.current?.panTo([exif.lat, exif.lng]);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '图片上传失败。');
    }
    setUploading(false);
    event.target.value = '';
  }

  async function handleAddPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selectedStory) return;
    setUploading(true);
    setError('');
    try {
      const [url, exif] = await Promise.all([uploadImage(file), readPhotoExif(file)]);
      const base = selectedStory.photos[0] ?? {
        lat: site.map.center[0],
        lng: site.map.center[1]
      };
      const hasGps = typeof exif.lat === 'number' && typeof exif.lng === 'number';
      const photos = [
        ...selectedStory.photos,
        {
          id: makePhotoId(),
          url,
          caption: exif.camera ?? '',
          lat: hasGps ? exif.lat : base.lat + (Math.random() - 0.5) * 0.0035,
          lng: hasGps ? exif.lng : base.lng + (Math.random() - 0.5) * 0.0035
        }
      ];
      const response = await fetch(`/api/map-stories/${selectedStory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos })
      });
      const payload = (await response.json()) as { data?: MapStory; error?: string };
      if (response.ok === false || !payload.data) throw new Error(payload.error ?? '照片添加失败。');
      setStories((current) => current.map((story) => (story.id === payload.data?.id ? payload.data : story)));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : '照片添加失败。');
    }
    setUploading(false);
    event.target.value = '';
  }

  async function handleCreateStory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError('');

    const response = await fetch('/api/map-stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: draftForm.title || '未命名标记',
        note: draftForm.note,
        date: draftForm.date,
        locationName: draftForm.locationName,
        tags: [],
        photos: [
          {
            id: makePhotoId(),
            url: draftImage,
            caption: draftCamera,
            lat: draft.lat,
            lng: draft.lng
          }
        ]
      })
    });
    const payload = (await response.json()) as { data?: MapStory; error?: string };

    if (response.ok === false || !payload.data) {
      setError(payload.error ?? '创建失败，请先登录站长后台。');
      setSaving(false);
      return;
    }

    setStories((current) => [payload.data as MapStory, ...current]);
    setSelectedId(payload.data.id);
    setSelectedPhotoId(null);
    setDraft(null);
    setDraftForm({
      title: '',
      note: '',
      date: new Date().toISOString().slice(0, 10),
      locationName: ''
    });
    setDraftImage('/photos/photo-12.png');
    setDraftCamera('');
    setSaving(false);
  }

  async function handleSaveDetail() {
    if (!selectedStory) return;
    setSaving(true);
    setError('');

    const tags = detail.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const response = await fetch(`/api/map-stories/${selectedStory.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...detail, tags })
    });
    const payload = (await response.json()) as { data?: MapStory; error?: string };

    if (response.ok === false || !payload.data) {
      setError(payload.error ?? '保存失败，请先登录站长后台。');
      setSaving(false);
      return;
    }

    setStories((current) => current.map((story) => (story.id === payload.data?.id ? payload.data : story)));
    setSaving(false);
  }

  async function handleCaptionChange(photoId: string, caption: string) {
    if (!selectedStory) return;
    const photos = selectedStory.photos.map((photo) =>
      photo.id === photoId ? { ...photo, caption } : photo
    );
    const response = await fetch(`/api/map-stories/${selectedStory.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos })
    });
    const payload = (await response.json()) as { data?: MapStory; error?: string };
    if (response.ok && payload.data) {
      setStories((current) => current.map((story) => (story.id === payload.data?.id ? payload.data : story)));
    }
  }

  async function handleDeleteStory() {
    if (!selectedStory) return;
    if (window.confirm(`确认删除「${selectedStory.title}」以及其中的照片吗？`) === false) return;

    const response = await fetch(`/api/map-stories/${selectedStory.id}`, { method: 'DELETE' });
    if (response.ok) {
      setStories((current) => current.filter((story) => story.id !== selectedStory.id));
      setSelectedId(null);
    } else {
      const payload = (await response.json()) as { error?: string };
      setError(payload.error ?? '删除失败。');
    }
  }

  function startPlacing() {
    setError('');
    setDraft(null);
    setSelectedId(null);
    setSelectedPhotoId(null);
    setDraftCamera('');
    setPlacing(true);
  }

  return (
    <div className={styles.experience}>
      <div
        ref={containerRef}
        className={`${styles.map} ${placing ? styles.placing : ''}`}
        aria-label="地图故事"
      />

      <div className={styles.layerSwitch} role="group" aria-label="切换地图底图">
        {site.map.layers.map((layer) => (
          <button
            key={layer.id}
            type="button"
            className={layer.id === activeMapLayerId ? styles.layerSwitchActive : undefined}
            aria-pressed={layer.id === activeMapLayerId}
            onClick={() => setActiveMapLayerId(layer.id)}
          >
            {layer.label}
          </button>
        ))}
      </div>

      <p className={styles.hintPill}>
        {placing ? (
          <>
            <MapPinIcon size={14} />
            点击地图任意位置放置这组照片
          </>
        ) : (
          <>
            <MoveIcon size={14} />
            {admin ? '拖动圆形照片可以调整位置，点击照片查看文字标注' : '点击圆形照片查看文字标注'}
          </>
        )}
      </p>

      <aside
        className={`${styles.panel} ${styles.panelLeft} ${
          selectedStory || selectedPhoto || draft ? styles.panelLeftHiddenMobile : ''
        }`}
      >
        <div className={styles.panelHeader}>
          <p className="eyebrow">03 · Map stories</p>
          <div className={styles.panelHeaderTop}>
            <h1 className={styles.panelTitle}>地图故事</h1>
            <span className="muted" style={{ fontSize: 11 }}>
              {stories.length} 段 · {geotaggedPhotos.length} 张
            </span>
          </div>
          <p className={styles.panelSub}>
            {admin ? '照片可以被拖动，记忆因此有了自己的坐标。' : '点击照片，查看它落在哪里。'}
          </p>
        </div>

        <ul className={styles.storyList}>
          {stories.length === 0 && geotaggedPhotos.length === 0 ? (
            <li className={styles.empty}>
              {admin ? '还没有故事。点下方按钮，在地图上放一张照片。' : '还没有地图故事。'}
            </li>
          ) : (
            <>
              {stories.map((story) => (
                <li key={story.id}>
                  <button
                    className={`${styles.storyItem} ${
                      story.id === selectedId ? styles.storyItemActive : ''
                    }`}
                    type="button"
                    onClick={() => {
                      setDraft(null);
                      setSelectedId(story.id);
                      setSelectedPhotoId(null);
                    }}
                  >
                    <span className={styles.storyThumb}>
                      {story.photos[0] ? (
                        <img src={story.photos[0].url} alt="" />
                      ) : (
                        <span className={styles.storyItemDot} />
                      )}
                    </span>
                    <span className={styles.storyItemBody}>
                      <span className={styles.storyItemTitle}>{story.title}</span>
                      <span className={styles.storyItemMeta}>
                        {story.locationName || '未命名地点'} · {formatDate(story.date)}
                      </span>
                    </span>
                    <span className={styles.storyItemDot} />
                  </button>
                </li>
              ))}
              {geotaggedPhotos.length > 0 ? (
                <li className={styles.listLabel}>图库照片</li>
              ) : null}
              {geotaggedPhotos.map((photo) => (
                <li key={photo.id}>
                  <button
                    className={`${styles.storyItem} ${
                      photo.id === selectedPhotoId ? styles.storyItemActive : ''
                    }`}
                    type="button"
                    onClick={() => {
                      setDraft(null);
                      setSelectedId(null);
                      setSelectedPhotoId(photo.id);
                      mapRef.current?.panTo([photo.lat, photo.lng]);
                    }}
                  >
                    <span className={styles.storyThumb}>
                      <img src={photo.url} alt="" />
                    </span>
                    <span className={styles.storyItemBody}>
                      <span className={styles.storyItemTitle}>{photo.title || '未命名照片'}</span>
                      <span className={styles.storyItemMeta}>
                        {photo.locationName || '来自照片库'} · {formatDate(photo.date)}
                      </span>
                    </span>
                    <span className={styles.storyItemDot} />
                  </button>
                </li>
              ))}
            </>
          )}
        </ul>

        <div className={styles.panelFooter}>
          {admin ? (
            placing ? (
              <div className={styles.placementBanner}>
                <span>在左侧地图上找到位置并点击</span>
                <button className="btn btn--small" type="button" onClick={() => setPlacing(false)}>
                  取消
                </button>
              </div>
            ) : (
              <button className="btn btn--primary" type="button" onClick={startPlacing}>
                <PlusIcon size={14} />
                新的地图标记
              </button>
            )
          ) : null}
          <div className={styles.panelFooterRow}>
            <span>{admin ? '拖拽照片 · 编辑标注 · 自动保存坐标' : '点击照片查看文字标注'}</span>
          </div>
        </div>
      </aside>

      {admin && draft ? (
        <aside className={`${styles.panel} ${styles.panelRight}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderTop}>
              <div>
                <p className="eyebrow">New story</p>
                <h2 className={styles.panelTitle} style={{ marginTop: 12 }}>
                  新建地图故事
                </h2>
              </div>
              <button className={styles.panelClose} type="button" onClick={() => setDraft(null)} aria-label="关闭">
                <CloseIcon size={14} />
              </button>
            </div>
            <p className={styles.panelSub}>
              {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
            </p>
          </div>

          <form className={styles.detailBody} onSubmit={handleCreateStory}>
            <div className={styles.detailFields}>
              <label className="field">
                <span className="field__label">标题</span>
                <input
                  className="input"
                  value={draftForm.title}
                  onChange={(event) => setDraftForm({ ...draftForm, title: event.target.value })}
                  placeholder="给这段记忆一个名字"
                  required
                />
              </label>
              <label className="field">
                <span className="field__label">标注</span>
                <textarea
                  className={`textarea ${styles.detailNote}`}
                  value={draftForm.note}
                  onChange={(event) => setDraftForm({ ...draftForm, note: event.target.value })}
                  placeholder="当时发生了什么，或者你记得什么。"
                />
              </label>
              <div className={styles.detailGrid}>
                <label className="field">
                  <span className="field__label">日期</span>
                  <input
                    className="input"
                    type="date"
                    value={draftForm.date}
                    onChange={(event) => setDraftForm({ ...draftForm, date: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span className="field__label">地点名称</span>
                  <input
                    className="input"
                    value={draftForm.locationName}
                    onChange={(event) => setDraftForm({ ...draftForm, locationName: event.target.value })}
                    placeholder="例如：西湖 · 北山街"
                  />
                </label>
              </div>
            </div>

            <div className={styles.photoList}>
              <span className="field__label">照片</span>
              <div className={styles.photoRow}>
                <img src={draftImage} alt="待上传照片预览" />
                <div className={styles.photoRowBody}>
                  <span className={styles.photoRowMeta}>首张照片将作为地图标记</span>
                  <label className={styles.uploadLabel}>
                    <UploadIcon size={13} />
                    {uploading ? '上传中…' : '更换照片'}
                    <input type="file" accept="image/*" onChange={handleDraftUpload} disabled={uploading} />
                  </label>
                </div>
              </div>
            </div>

            {error ? <p className={styles.error}>{error}</p> : null}

            <div className={styles.detailActions}>
              <span className={styles.autosaveHint}>保存后可直接在地图上拖动</span>
              <div className={styles.detailActionsGroup}>
                <button className="btn btn--small" type="button" onClick={() => setDraft(null)}>
                  取消
                </button>
                <button className="btn btn--primary btn--small" type="submit" disabled={saving}>
                  {saving ? '保存中…' : '保存故事'}
                </button>
              </div>
            </div>
          </form>
        </aside>
      ) : null}

      {selectedStory && draft === null ? (
        <aside className={`${styles.panel} ${styles.panelRight}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderTop}>
              <div>
                <p className="eyebrow">Annotation</p>
                <h2 className={styles.panelTitle} style={{ marginTop: 12 }}>
                  {selectedStory.title}
                </h2>
              </div>
              <button
                className={styles.panelClose}
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="关闭"
              >
                <CloseIcon size={14} />
              </button>
            </div>
            <p className={styles.panelSub}>
              {selectedStory.locationName} · {formatDate(selectedStory.date)}
            </p>
          </div>

          {admin ? (
            <div className={styles.detailBody}>
              <div className={styles.detailFields}>
                <label className="field">
                  <span className="field__label">标题</span>
                  <input
                    className="input"
                    value={detail.title}
                    onChange={(event) => setDetail({ ...detail, title: event.target.value })}
                  />
                </label>
                <label className="field">
                  <span className="field__label">文字标注</span>
                  <textarea
                    className={`textarea ${styles.detailNote}`}
                    value={detail.note}
                    onChange={(event) => setDetail({ ...detail, note: event.target.value })}
                  />
                </label>
                <div className={styles.detailGrid}>
                  <label className="field">
                    <span className="field__label">日期</span>
                    <input
                      className="input"
                      type="date"
                      value={detail.date}
                      onChange={(event) => setDetail({ ...detail, date: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">地点</span>
                    <input
                      className="input"
                      value={detail.locationName}
                      onChange={(event) => setDetail({ ...detail, locationName: event.target.value })}
                    />
                  </label>
                </div>
                <label className="field">
                  <span className="field__label">标签</span>
                  <input
                    className="input"
                    value={detail.tags}
                    onChange={(event) => setDetail({ ...detail, tags: event.target.value })}
                    placeholder="多个标签用英文逗号分隔"
                  />
                </label>
              </div>
  
              <div className={styles.photoList}>
                <span className="field__label">照片 · 拖动地图上的圆形标记可移动</span>
                {selectedStory.photos.map((photo) => (
                  <div className={styles.photoRow} key={photo.id}>
                    <img src={photo.url} alt="" />
                    <div className={styles.photoRowBody}>
                      <input
                        className={`input ${styles.photoRowInput}`}
                        defaultValue={photo.caption}
                        placeholder="给这张照片写一句说明"
                        onBlur={(event) => handleCaptionChange(photo.id, event.target.value)}
                      />
                      <span className={styles.photoRowMeta}>
                        {photo.lat.toFixed(5)}, {photo.lng.toFixed(5)}
                      </span>
                    </div>
                  </div>
                ))}
                <label className={styles.uploadLabel}>
                  <PlusIcon size={13} />
                  {uploading ? '上传中…' : '在这组故事里添加照片'}
                  <input type="file" accept="image/*" onChange={handleAddPhoto} disabled={uploading} />
                </label>
              </div>
  
              {error ? <p className={styles.error}>{error}</p> : null}
  
              <div className={styles.detailActions}>
                <button className="btn btn--small btn--danger" type="button" onClick={handleDeleteStory}>
                  <TrashIcon size={13} />
                  删除
                </button>
                <div className={styles.detailActionsGroup}>
                  <span className={styles.autosaveHint}>坐标已自动保存</span>
                  <button className="btn btn--primary btn--small" type="button" onClick={handleSaveDetail} disabled={saving}>
                    {saving ? '保存中…' : '保存标注'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.detailBody}>
              <div className={styles.detailFields}>
                <div className="field">
                  <span className="field__label">文字标注</span>
                  <p className={styles.readonlyText}>
                    {selectedStory.note || '这段记忆还没有留下文字。'}
                  </p>
                </div>
                <div className="field">
                  <span className="field__label">标签</span>
                  <p className={styles.readonlyText}>
                    {selectedStory.tags.length > 0 ? selectedStory.tags.join(' · ') : '未添加标签'}
                  </p>
                </div>
              </div>

              <div className={styles.photoList}>
                <span className="field__label">照片</span>
                {selectedStory.photos.map((photo) => (
                  <div className={styles.photoRow} key={photo.id}>
                    <img src={photo.url} alt="" />
                    <div className={styles.photoRowBody}>
                      <span className={styles.readonlyText}>{photo.caption || '未命名照片'}</span>
                      <span className={styles.photoRowMeta}>
                        {photo.lat.toFixed(5)}, {photo.lng.toFixed(5)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      ) : null}

      {selectedPhoto && selectedStory === null && draft === null ? (
        <aside className={`${styles.panel} ${styles.panelRight}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderTop}>
              <div>
                <p className="eyebrow">Photo library</p>
                <h2 className={styles.panelTitle} style={{ marginTop: 12 }}>
                  {selectedPhoto.title || '未命名照片'}
                </h2>
              </div>
              <button
                className={styles.panelClose}
                type="button"
                onClick={() => setSelectedPhotoId(null)}
                aria-label="关闭"
              >
                <CloseIcon size={14} />
              </button>
            </div>
            <p className={styles.panelSub}>
              {selectedPhoto.locationName || '来自照片库'} · {formatDate(selectedPhoto.date)}
            </p>
          </div>
          <div className={styles.detailBody}>
            <img
              className={styles.libraryPhoto}
              src={selectedPhoto.url}
              alt={selectedPhoto.title || '照片'}
            />
            <div className={styles.detailFields}>
              <div className="field">
                <span className="field__label">拍摄时间</span>
                <p className={styles.readonlyText}>
                  {formatDate(selectedPhoto.date)} {formatTime(selectedPhoto.date)}
                </p>
              </div>
              <div className="field">
                <span className="field__label">GPS 坐标</span>
                <p className={`${styles.readonlyText} ${styles.photoRowMeta}`}>
                  {selectedPhoto.lat.toFixed(5)}, {selectedPhoto.lng.toFixed(5)}
                </p>
              </div>
            </div>
            {admin ? (
              <p className={styles.autosaveHint}>可直接拖动地图上的照片标记调整坐标。</p>
            ) : null}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
