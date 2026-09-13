import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface RegionInfo {
  adcode: string;
  province: string;
  city: string;
}

interface RegionEntry extends RegionInfo {
  bbox: [number, number, number, number];
  polygons: number[][][][]; // [polygon][ring][point][lng,lat]
}

interface RegionTable {
  version: string;
  regions: RegionEntry[];
}

let tablePromise: Promise<RegionTable | null> | null = null;

function loadTable(): Promise<RegionTable | null> {
  tablePromise ??= readFile(
    path.join(/* turbopackIgnore: true */ process.cwd(), 'data', 'admin-regions.json'),
    'utf8'
  )
    .then((raw) => JSON.parse(raw) as RegionTable)
    .catch(() => null);
  return tablePromise;
}

function ringContains(ring: number[][], lng: number, lat: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function polygonContains(polygon: number[][][], lng: number, lat: number) {
  const [outer, ...holes] = polygon;
  if (!outer || ringContains(outer, lng, lat) === false) return false;
  return holes.every((hole) => ringContains(hole, lng, lat) === false);
}

/** 经纬度反查行政区划,精确到市级(市级未命中时兜底省级)。查不到返回 null。 */
export async function lookupRegion(lng: number, lat: number): Promise<RegionInfo | null> {
  if (Number.isFinite(lng) === false || Number.isFinite(lat) === false) return null;
  const table = await loadTable();
  if (!table) return null;
  for (const region of table.regions) {
    if (region.city === '') continue;
    const [minLng, minLat, maxLng, maxLat] = region.bbox;
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
    if (region.polygons.some((polygon) => polygonContains(polygon, lng, lat))) {
      return { adcode: region.adcode, province: region.province, city: region.city };
    }
  }
  return null;
}
