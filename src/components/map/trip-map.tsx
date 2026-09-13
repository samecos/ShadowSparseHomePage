'use client';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, LayerGroup } from 'leaflet';
import { site } from '@/lib/site';
import styles from './trip-map.module.css';

export interface TripMapPoint {
  id: string;
  label: string;
  lat: number;
  lng: number;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function TripMap({ points }: { points: TripMapPoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const L = await import('leaflet');
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [...site.map.center] as [number, number],
        zoom: site.map.zoom,
        minZoom: site.map.minZoom,
        maxZoom: site.map.maxZoom,
        zoomControl: true,
        attributionControl: true
      });
      const layer = L.layerGroup().addTo(map);
      const tileLayer = L.tileLayer(site.map.layers.find((item) => item.id === 'base')?.tileUrl ?? site.map.layers[0].tileUrl, {
        attribution: site.map.layers.find((item) => item.id === 'base')?.attribution ?? '',
        tileSize: 512,
        zoomOffset: -1,
        maxZoom: site.map.maxZoom
      }).addTo(map);

      mapRef.current = map;
      layerRef.current = layer;
      window.setTimeout(() => map.invalidateSize(), 100);

      return () => {
        tileLayer.remove();
        map.remove();
      };
    }

    let cleanup: (() => void) | undefined;
    initialize().then((dispose) => {
      cleanup = dispose;
    });

    return () => {
      cancelled = true;
      cleanup?.();
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    import('leaflet').then((L) => {
      if (!mapRef.current || !layerRef.current) return;
      layer.clearLayers();
      points.forEach((point, index) => {
        const icon = L.divIcon({
          className: styles.marker,
          html: `<span class="${styles.markerInner}">${index + 1}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });
        L.marker([point.lat, point.lng], {
          icon,
          title: point.label
        }).bindTooltip(escapeHtml(point.label), { direction: 'top', offset: [0, -14] }).addTo(layer);
      });

      if (points.length > 1) {
        map.fitBounds(
          L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number])),
          { padding: [40, 40], maxZoom: site.map.zoom }
        );
      } else if (points.length === 1) {
        map.setView([points[0].lat, points[0].lng], Math.max(site.map.zoom, 13));
      }
    });
  }, [points]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.map} ref={containerRef} aria-label="旅行地点地图" />
      {points.length === 0 ? <p className={styles.empty}>添加地点后，这里会出现行程地图。</p> : null}
    </div>
  );
}
