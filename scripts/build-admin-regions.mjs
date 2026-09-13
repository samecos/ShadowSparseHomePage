#!/usr/bin/env node
/**
 * 从阿里云 DataV GeoAtlas 拉取全国行政区划边界,抽稀量化后写入 data/admin-regions.json。
 * 市级条目在前;省级条目追加在末尾,作为市级 PIP 未命中时的兜底。
 * 用法:npm run build:regions
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://geo.datav.aliyun.com/areas_v3/bound';
const TOLERANCE = 0.005; // Douglas-Peucker 容差(度),约 500m
const PRECISION = 4; // 坐标量化位数,约 11m
// 直辖市与港澳台:市级分类直接用省级面
const SELF_CITY = new Set(['110000', '120000', '310000', '500000', '710000', '810000', '820000']);

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`请求失败 ${response.status}: ${url}`);
  return response.json();
}

function perpendicularDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function simplifyDP(points, tolerance) {
  if (points.length <= 2) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let maxDist = 0;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const d = perpendicularDistance(points[i], points[first], points[last]);
      if (d > maxDist) { maxDist = d; index = i; }
    }
    if (maxDist > tolerance && index !== -1) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function quantize(value) {
  return Number(value.toFixed(PRECISION));
}

function simplifyRing(ring) {
  const simplified = simplifyDP(ring, TOLERANCE).map(([lng, lat]) => [quantize(lng), quantize(lat)]);
  const deduped = simplified.filter(
    (point, i) => i === 0 || point[0] !== simplified[i - 1][0] || point[1] !== simplified[i - 1][1]
  );
  if (deduped.length > 1) {
    const first = deduped[0];
    const last = deduped[deduped.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) deduped.push([...first]);
  }
  return deduped;
}

function bboxOf(polygons) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  return [minLng, minLat, maxLng, maxLat];
}

function makeRegion(feature, province, city) {
  const geometry = feature.geometry;
  const raw = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  const polygons = raw
    .map((rings) => rings.map(simplifyRing).filter((ring) => ring.length >= 4))
    .filter((rings) => rings.length > 0);
  return {
    adcode: String(feature.properties.adcode),
    province,
    city,
    bbox: bboxOf(polygons),
    polygons
  };
}

async function main() {
  const china = await fetchJson(`${BASE}/100000_full.json`);
  const provinces = china.features.map((feature) => ({
    adcode: String(feature.properties.adcode),
    name: feature.properties.name,
    feature
  }));

  const cityRegions = [];
  const provinceRegions = [];

  for (const province of provinces) {
    provinceRegions.push(makeRegion(province.feature, province.name, province.name));

    if (SELF_CITY.has(province.adcode)) {
      console.log(`${province.name}: 直辖市/特区,使用省级面`);
      continue;
    }

    let cities = [];
    try {
      const full = await fetchJson(`${BASE}/${province.adcode}_full.json`);
      cities = full.features.filter((f) => String(f.properties.adcode) !== province.adcode);
    } catch (error) {
      console.warn(`${province.name}: 市级数据拉取失败(${error.message}),仅保留省级面`);
    }
    if (cities.length === 0) continue;
    for (const city of cities) {
      cityRegions.push(makeRegion(city, province.name, city.properties.name));
    }
    console.log(`${province.name}: ${cities.length} 个市级行政区`);
  }

  const payload = { version: new Date().toISOString(), regions: [...cityRegions, ...provinceRegions] };
  const target = path.join(process.cwd(), 'data', 'admin-regions.json');
  await writeFile(target, `${JSON.stringify(payload)}\n`, 'utf8');
  const sizeMB = (Buffer.byteLength(JSON.stringify(payload)) / 1024 / 1024).toFixed(1);
  console.log(`完成:市级 ${cityRegions.length} + 省级 ${provinceRegions.length} 条,${sizeMB}MB → ${target}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
