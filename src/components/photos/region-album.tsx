'use client';

import { useEffect, useMemo, useRef } from 'react';
import { site } from '@/lib/site';
import type { Photo } from '@/lib/types';
import styles from './region-album.module.css';

type GeotaggedPhoto = Photo & { lat: number; lng: number };

interface CityGroup {
  key: string;
  label: string;
  items: Photo[];
}

export function RegionAlbum({
  photos,
  onOpenPhoto
}: {
  photos: Photo[];
  onOpenPhoto: (photoId: string, list: Photo[]) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const geotagged = useMemo(
    () =>
      photos.filter(
        (photo): photo is GeotaggedPhoto => photo.lat !== undefined && photo.lng !== undefined
      ),
    [photos]
  );

  const groups = useMemo(() => {
    const map = new Map<string, CityGroup>();
    photos.forEach((photo) => {
      const key = photo.region?.adcode ?? 'unlocated';
      const label = photo.region ? `${photo.region.province} · ${photo.region.city}` : '未定位';
      const existing = map.get(key);
      if (existing) existing.items.push(photo);
      else map.set(key, { key, label, items: [photo] });
    });
    return [...map.values()].sort((a, b) =>
      a.key === 'unlocated' ? 1 : b.key === 'unlocated' ? -1 : b.items.length - a.items.length
    );
  }, [photos]);

  const geoKey = geotagged.map((photo) => photo.id).join(',');

  useEffect(() => {
    let cancelled = false;
    let map: import('leaflet').Map | null = null;

    async function initialize() {
      const L = await import('leaflet');
      if (cancelled || containerRef.current === null) return;
      map = L.map(containerRef.current, {
        center: [...site.map.center] as [number, number],
        zoom: 4,
        minZoom: site.map.minZoom,
        maxZoom: site.map.maxZoom,
        worldCopyJump: true
      });
      const layer =
        site.map.layers.find((item) => item.id === site.map.defaultLayer) ?? site.map.layers[0];
      L.tileLayer(layer.tileUrl, {
        attribution: layer.attribution,
        tileSize: 512,
        zoomOffset: -1,
        maxZoom: site.map.maxZoom
      }).addTo(map);

      geotagged.forEach((photo) => {
        const icon = L.divIcon({
          className: styles.marker,
          html: `<div class="${styles.markerInner}"><img src="${photo.url}" alt="" /></div>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22]
        });
        L.marker([photo.lat, photo.lng], { icon })
          .addTo(map!)
          .on('click', () => onOpenPhoto(photo.id, geotagged));
      });

      if (geotagged.length > 0) {
        map.fitBounds(
          L.latLngBounds(geotagged.map((photo) => [photo.lat, photo.lng] as [number, number])).pad(0.2)
        );
      }
    }

    initialize();
    return () => {
      cancelled = true;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoKey]);

  if (photos.length === 0) {
    return <div className="empty">还没有照片。</div>;
  }

  return (
    <div className={styles.regionAlbum}>
      <div ref={containerRef} className={styles.map} aria-label="照片地图" />
      {groups.map((group) => (
        <section key={group.key} className={styles.cityGroup}>
          <h2 className={styles.cityHead}>
            {group.label}
            <span className={styles.cityCount}>{group.items.length}</span>
          </h2>
          <div className={styles.cityGrid}>
            {group.items.map((photo) => (
              <button
                key={photo.id}
                type="button"
                className={styles.photoTile}
                onClick={() => onOpenPhoto(photo.id, group.items)}
                aria-label={photo.title || photo.locationName || '查看照片'}
              >
                <img src={photo.url} alt={photo.title || ''} loading="lazy" />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
