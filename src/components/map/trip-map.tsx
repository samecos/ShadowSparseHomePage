'use client';

import { useEffect, useRef, useState } from 'react';
import type { LayerGroup, Map as LeafletMap, TileLayer } from 'leaflet';
import { site, type MapLayerId } from '@/lib/site';
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

export function TripMap({
  points,
  editable = false,
  selectedId = null,
  onSelectPoint,
  onMovePoint
}: {
  points: TripMapPoint[];
  editable?: boolean;
  selectedId?: string | null;
  onSelectPoint?: (id: string) => void;
  onMovePoint?: (id: string, lat: number, lng: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const fittedKeyRef = useRef('');
  const onSelectPointRef = useRef(onSelectPoint);
  const onMovePointRef = useRef(onMovePoint);

  const [ready, setReady] = useState(false);
  const [activeMapLayerId, setActiveMapLayerId] = useState<MapLayerId>(site.map.defaultLayer);
  const activeMapLayer =
    site.map.layers.find((layer) => layer.id === activeMapLayerId) ?? site.map.layers[0];

  useEffect(() => {
    onSelectPointRef.current = onSelectPoint;
  }, [onSelectPoint]);

  useEffect(() => {
    onMovePointRef.current = onMovePoint;
  }, [onMovePoint]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const L = await import('leaflet');
      if (cancelled || !containerRef.current) return;

      leafletRef.current = L;
      const map = L.map(containerRef.current, {
        center: [...site.map.center] as [number, number],
        zoom: site.map.zoom,
        minZoom: site.map.minZoom,
        maxZoom: site.map.maxZoom,
        zoomControl: true,
        attributionControl: true
      });
      const layer = L.layerGroup().addTo(map);

      map.on('click', () => {
        onSelectPointRef.current?.('');
      });

      mapRef.current = map;
      layerRef.current = layer;
      window.setTimeout(() => map.invalidateSize(), 100);
      setReady(true);
    }

    initialize();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      tileLayerRef.current = null;
      leafletRef.current = null;
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

  useEffect(() => {
    const container = containerRef.current;
    if (ready === false || container === null) return;

    const observer = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (ready === false || map === null || !selectedId) return;
    const point = points.find((item) => item.id === selectedId);
    if (point) map.panTo([point.lat, point.lng]);
  }, [points, ready, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    const L = leafletRef.current;
    if (ready === false || !map || !layer || !L) return;

    layer.clearLayers();
    points.forEach((point, index) => {
      const selected = point.id === selectedId;
      const icon = L.divIcon({
        className: `${styles.marker} ${editable ? styles.markerDraggable : ''} ${
          selected ? styles.markerSelected : ''
        }`,
        html: `<span class="${styles.markerInner}">${index + 1}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      const marker = L.marker([point.lat, point.lng], {
        icon,
        draggable: editable,
        riseOnHover: true,
        title: point.label
      });
      marker.on('click', () => {
        onSelectPointRef.current?.(point.id);
      });
      marker.on('dragend', () => {
        const position = marker.getLatLng();
        onSelectPointRef.current?.(point.id);
        onMovePointRef.current?.(point.id, position.lat, position.lng);
      });
      if (selected) marker.setZIndexOffset(500);
      marker.bindTooltip(escapeHtml(point.label), { direction: 'top', offset: [0, -14] }).addTo(layer);
    });

    const fitKey = points.map((point) => point.id).join('|');
    if (fitKey && fitKey !== fittedKeyRef.current) {
      fittedKeyRef.current = fitKey;
      if (points.length > 1) {
        map.fitBounds(
          L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number])),
          { padding: [40, 40], maxZoom: site.map.zoom }
        );
      } else {
        map.setView([points[0].lat, points[0].lng], Math.max(site.map.zoom, 13));
      }
    }
  }, [editable, points, ready, selectedId]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.map} ref={containerRef} aria-label="旅行地点地图" />
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
      {editable && points.length > 0 ? (
        <p className={styles.hint}>拖动编号标记可直接调整坐标</p>
      ) : null}
      {points.length === 0 ? <p className={styles.empty}>添加地点后，这里会出现行程地图。</p> : null}
    </div>
  );
}
