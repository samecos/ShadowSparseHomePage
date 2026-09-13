# 相册自动分类实施计划(人物 / 时间 / 地区)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `/photos` 相册增加自动分类:时间(保持现状为默认)、人物(face-api 浏览器检测 + 服务端聚类,iCloud 风格展示)、地区(自建行政区划表 PIP 反查至少市级 + 地图展示)。

**Architecture:** 人脸识别在管理员浏览器完成(模型随 `@vladmandic/face-api` npm 包分发,拷贝到 `public/models/face-api/`),只上传人脸框 + 128 维特征 + 裁剪头像;聚类/存储在服务端,JSON 文件持久化。地区分类用阿里云 DataV GeoAtlas 城市级边界离线构建 `data/admin-regions.json`,服务端射线法 PIP,照片写入/修改坐标时自动打标,管理端 API 回填存量。

**Tech Stack:** Next.js 16 App Router、TypeScript 严格模式、zod v4、`@vladmandic/face-api`、Leaflet 1.9 + MapTiler 瓦片代理、JSON 文件存储(`src/lib/storage.ts`)。

**Spec:** `docs/superpowers/specs/2026-09-13-photos-auto-classification-design.md`

## Global Constraints

- 项目**没有测试框架**;每个任务的验证 = `npm run build` 通过 + 任务内给出的脚本/curl/手动检查。禁止新增测试框架。
- 代码风格:两空格缩进、单引号、分号、严格 TypeScript(禁止 `any`)、PascalCase 组件、camelCase 函数、`*.module.css`。
- 默认 Server Component;浏览器 API 才用 `'use client'`。
- 写操作鉴权一律 `isAuthorizedWrite(request)`(管理员 session 或 HERMES Bearer token),失败返回 `unauthorized()`(来自 `src/lib/auth.ts`)。
- API 响应一律用 `src/lib/api.ts` 的 `ok(data)` / `fail(message, status)` / `parseBody(request, schema)`。
- JSON 持久化一律走 `readCollection` / `mutateCollection` / `createId` / `nowIso`(`src/lib/storage.ts`),不要直接写 `data/` 文件。
- 人物数据(faces/people)**永不向未登录访客暴露**:API 401,UI 不渲染。
- `photo.region` 由服务端计算,**不允许客户端通过 POST/PATCH body 直接设置**(不进入 schema)。
- 不影响现有时间视图行为:默认视图、按天分组、回收站语义全部保持。

---

### Task 1: 行政区划数据构建脚本

**Files:**
- Create: `scripts/build-admin-regions.mjs`
- Create(脚本产物): `data/admin-regions.json`

**Interfaces:**
- Produces: `data/admin-regions.json`,结构 `{ version: string, regions: Array<{ adcode: string; province: string; city: string; bbox: [number,number,number,number]; polygons: number[][][][] }> }`(`polygons` 为 MultiPolygon:`[polygon][ring][point]`,point = `[lng, lat]`,坐标已量化到 4 位小数;`regions` 前段为市级条目,**末尾追加省级条目作为降级兜底**)。Task 2 的查找库消费此文件。

- [ ] **Step 1: 写脚本**

```js
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
```

- [ ] **Step 2: 注册 npm script 并运行**

`package.json` 的 `scripts` 增加:

```json
"build:regions": "node scripts/build-admin-regions.mjs"
```

运行 `npm run build:regions`。
预期:输出各省级区划的市级数量,末尾打印总条数与体积;`data/admin-regions.json` 存在且体积 < 8MB,市级条目 300+ 条。

- [ ] **Step 3: Commit**

```bash
git add scripts/build-admin-regions.mjs data/admin-regions.json package.json
git commit -m "Add admin-region boundary build script and dataset"
```

---

### Task 2: 地区反查库

**Files:**
- Create: `src/lib/geo/regions.ts`
- Create: `scripts/check-regions.mjs`

**Interfaces:**
- Consumes: `data/admin-regions.json`(Task 1)
- Produces: `export interface RegionInfo { adcode: string; province: string; city: string }` 与 `export async function lookupRegion(lng: number, lat: number): Promise<RegionInfo | null>`。Task 4 的 API 路由消费。只允许 erasable TS 语法(不用 enum/namespace/参数属性),以便 node 直接执行做自测。

- [ ] **Step 1: 写查找库**

```ts
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
    const [minLng, minLat, maxLng, maxLat] = region.bbox;
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
    if (region.polygons.some((polygon) => polygonContains(polygon, lng, lat))) {
      return { adcode: region.adcode, province: region.province, city: region.city };
    }
  }
  return null;
}
```

注意:ray-casting 循环写法是 `for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1)`(j 保存前一个顶点)。

- [ ] **Step 2: 写自测脚本**

`scripts/check-regions.mjs`:

```js
// 已知坐标断言:node --experimental-strip-types scripts/check-regions.mjs
import { lookupRegion } from '../src/lib/geo/regions.ts';

const cases = [
  { lng: 120.1392, lat: 30.2666, city: '杭州市', label: '杭州北山街' },
  { lng: 116.4074, lat: 39.9042, city: '北京市', label: '北京城区' },
  { lng: 121.4737, lat: 31.2304, city: '上海市', label: '上海城区' },
  { lng: 109.5083, lat: 18.2479, city: '三亚市', label: '三亚' },
  { lng: 87.6168, lat: 43.8256, city: '乌鲁木齐市', label: '乌鲁木齐' },
  { lng: 2.3522, lat: 48.8566, city: null, label: '巴黎(境外应为 null)' }
];

let failed = 0;
for (const item of cases) {
  const region = await lookupRegion(item.lng, item.lat);
  const got = region ? region.city : null;
  const pass = got === item.city;
  if (!pass) failed += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${item.label}: 期望 ${item.city},实际 ${got}`);
}
if (failed > 0) process.exit(1);
console.log('全部通过');
```

- [ ] **Step 3: 运行自测**

Run: `node --experimental-strip-types scripts/check-regions.mjs`
Expected: 6 条全 PASS(若 Node 报 `--experimental-strip-types` 未知,直接 `node scripts/check-regions.mjs`,Node ≥22.18 默认支持类型擦除)。

- [ ] **Step 4: Commit**

```bash
git add src/lib/geo/regions.ts scripts/check-regions.mjs
git commit -m "Add point-in-polygon region lookup library"
```

---

### Task 3: 数据模型与存储扩展

**Files:**
- Modify: `src/lib/types.ts`(Photo 加 region;新增 FaceInstance / Person)
- Modify: `src/lib/storage.ts`(CollectionName 与 fileNames 增加 faces / people)
- Modify: `src/lib/schemas.ts`(人脸提交与人物编辑的 zod schema)

**Interfaces:**
- Produces(后续任务依赖的确切类型):
  - `PhotoRegion = { adcode: string; province: string; city: string }`;`Photo.region?: PhotoRegion | null`
  - `FaceInstance = { id: string; photoId: string; box: { x: number; y: number; w: number; h: number }; descriptor: number[]; thumbUrl: string; personId: string | null; createdAt: string }`
  - `Person = { id: string; name: string | null; faceIds: string[]; coverFaceId: string | null; hidden: boolean; createdAt: string; updatedAt: string }`
  - schemas:`photoFacesSchema`、`personPatchSchema`、`peopleMergeSchema`

- [ ] **Step 1: types.ts**

在 `Photo` 接口的 `mimeType?: string;` 之后插入 `region?: PhotoRegion | null;`,并在 `Photo` 前新增:

```ts
export interface PhotoRegion {
  adcode: string;
  province: string;
  city: string;
}
```

文件末尾追加:

```ts
export interface FaceInstance {
  id: string;
  photoId: string;
  /** 相对原图的归一化坐标(0-1) */
  box: { x: number; y: number; w: number; h: number };
  /** 128 维人脸特征向量 */
  descriptor: number[];
  thumbUrl: string;
  personId: string | null;
  createdAt: string;
}

export interface Person {
  id: string;
  name: string | null;
  faceIds: string[];
  coverFaceId: string | null;
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: storage.ts**

`CollectionName` 联合类型追加 `'faces' | 'people'`,`fileNames` 追加:

```ts
  faces: 'faces.json',
  people: 'people.json'
```

- [ ] **Step 3: schemas.ts**

在 `photoBatchSchema` 之后追加(`trimmed` 是文件内已有的 `z.string().trim()`):

```ts
export const faceBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().positive().max(1),
  h: z.number().positive().max(1)
});

export const photoFacesSchema = z.object({
  faces: z
    .array(
      z.object({
        box: faceBoxSchema,
        descriptor: z.array(z.number()).length(128),
        thumbUrl: trimmed.min(1).max(300)
      })
    )
    .max(32)
});

export const personPatchSchema = z.object({
  name: trimmed.min(1).max(40).nullable().optional(),
  coverFaceId: trimmed.min(1).nullable().optional(),
  hidden: z.boolean().optional()
});

export const peopleMergeSchema = z.object({
  sourceId: trimmed.min(1),
  targetId: trimmed.min(1)
});
```

注意:photo 的 create/patch schema **不加** region 字段(服务端计算)。

- [ ] **Step 4: 建空集合文件**

```bash
echo '[]' > data/faces.json && echo '[]' > data/people.json
```

- [ ] **Step 5: 构建验证 + Commit**

Run: `npm run build`
Expected: 通过,无类型错误。

```bash
git add src/lib/types.ts src/lib/storage.ts src/lib/schemas.ts data/faces.json data/people.json
git commit -m "Extend data model with photo region, faces and people collections"
```

---

### Task 4: 地区自动打标与筛选 API

**Files:**
- Modify: `src/app/api/photos/route.ts`(POST 打标、GET 加 region 筛选)
- Modify: `src/app/api/photos/[id]/route.ts`(PATCH 坐标变更时重算)
- Create: `src/app/api/photos/reclassify/route.ts`

**Interfaces:**
- Consumes: `lookupRegion`(Task 2)、`Photo.region`(Task 3)
- Produces: `GET /api/photos?region={adcode}` 筛选参数;`POST /api/photos/reclassify` 返回 `{ total, tagged }`;Task 9 的 RegionAlbum 消费 `photo.region`。

- [ ] **Step 1: POST 打标**

`src/app/api/photos/route.ts`:顶部 import `import { lookupRegion } from '@/lib/geo/regions';`。POST 中 `mutateCollection` 之前(photo 对象构造之后)插入:

```ts
  if (photo.lat !== undefined && photo.lng !== undefined) {
    photo.region = await lookupRegion(photo.lng, photo.lat);
  }
```

- [ ] **Step 2: GET region 筛选**

同文件 GET:`const favorite = params.get('favorite');` 之后加 `const region = params.get('region');`,在 favorite 筛选后加:

```ts
  if (region) photos = photos.filter((photo) => photo.region?.adcode === region);
```

- [ ] **Step 3: PATCH 重算**

`src/app/api/photos/[id]/route.ts`:`mutateCollection` 的 mutator 内,`photo.updatedAt = nowIso();` 之前插入(mutator 已允许 async):

```ts
    if (patch.lat !== undefined || patch.lng !== undefined) {
      if (photo.lat !== undefined && photo.lng !== undefined) {
        photo.region = await lookupRegion(photo.lng, photo.lat);
      } else {
        delete photo.region;
      }
    }
```

- [ ] **Step 4: reclassify 路由**

`src/app/api/photos/reclassify/route.ts`(静态段优先于 `[id]`,无冲突):

```ts
import type { NextRequest } from 'next/server';
import { ok } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { lookupRegion } from '@/lib/geo/regions';
import { mutateCollection } from '@/lib/storage';
import type { Photo } from '@/lib/types';

/** 对全部照片重算行政区划(幂等,可随时重跑)。 */
export async function POST(request: NextRequest) {
  if (isAuthorizedWrite(request) === false) return unauthorized();

  const result = await mutateCollection<Photo, { total: number; tagged: number }>(
    'photos',
    async (current) => {
      let tagged = 0;
      for (const photo of current) {
        if (photo.lat !== undefined && photo.lng !== undefined) {
          const region = await lookupRegion(photo.lng, photo.lat);
          if (region) {
            photo.region = region;
            tagged += 1;
          } else {
            delete photo.region;
          }
        } else {
          delete photo.region;
        }
      }
      return { total: current.length, tagged };
    }
  );

  return ok(result);
}
```

- [ ] **Step 5: 构建 + 运行时验证**

Run: `npm run build` → 通过。
然后 `npm run dev` 起服务,用管理员 cookie 或 `Authorization: Bearer $HERMES_API_TOKEN` 验证:

```bash
curl -s -X POST http://localhost:3000/api/photos/reclassify -H "Authorization: Bearer $HERMES_API_TOKEN"
# 期望 {"ok":true,"data":{"total":12,"tagged":12}}(占位照片全部带杭州坐标)
curl -s "http://localhost:3000/api/photos" | head -c 400
# 期望照片记录里出现 region 字段
curl -s "http://localhost:3000/api/photos?region=330104" # 或其他数据里真实存在的 adcode
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/photos
git commit -m "Auto-tag photo admin region on write and support region filter"
```

---

### Task 5: 人物聚类核心库

**Files:**
- Create: `src/lib/people.ts`
- Create: `scripts/check-people.mjs`

**Interfaces:**
- Consumes: Task 3 的 `FaceInstance` / `Person` / storage 集合
- Produces(Task 6 的 API 与 Task 4 之后的级联都消费这些函数):
  - `FACE_MATCH_THRESHOLD = 0.55`
  - `descriptorDistance(a: number[], b: number[]): number`(欧氏距离)
  - `assignFaces(people, keptFaces, newFaces, removedFaceIds, now): { people: Person[]; assignments: Map<string, string> }`(纯函数)
  - `replacePhotoFaces(photoId: string, inputs: FaceScanInput[]): Promise<{ faces: FaceInstance[]; people: Person[] }>`
  - `patchPerson(id, patch): Promise<Person | null>`
  - `mergePeople(sourceId, targetId): Promise<Person | null>`
  - `deleteFace(faceId): Promise<FaceInstance | null>`
  - `removeFacesForPhotos(photoIds: string[]): Promise<void>`(照片彻底清除时级联)
  - `listPeopleWithFaces(): Promise<PersonSummary[]>`(不含 descriptor)

- [ ] **Step 1: 写 `src/lib/people.ts`**

```ts
import { createId, mutateCollection, nowIso, readCollection } from './storage';
import type { FaceInstance, Person } from './types';

export const FACE_MATCH_THRESHOLD = 0.55;

export function descriptorDistance(a: number[], b: number[]) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function centroid(descriptors: number[][]): number[] {
  const size = descriptors[0]?.length ?? 0;
  const center = new Array<number>(size).fill(0);
  descriptors.forEach((descriptor) => {
    for (let i = 0; i < size; i += 1) center[i] += descriptor[i] ?? 0;
  });
  return center.map((value) => value / Math.max(1, descriptors.length));
}

export interface FaceScanInput {
  box: FaceInstance['box'];
  descriptor: number[];
  thumbUrl: string;
}

export interface AssignResult {
  people: Person[];
  assignments: Map<string, string>; // faceId -> personId
}

/**
 * 纯函数:先把 removedFaceIds 从各聚类中摘除(空聚类删除),
 * 再把 newFaces 逐张分配到成员质心距离最近的聚类(< FACE_MATCH_THRESHOLD),否则新建聚类。
 * 不触碰存储,返回新聚类状态与分配结果。
 */
export function assignFaces(
  people: Person[],
  keptFaces: FaceInstance[],
  newFaces: FaceInstance[],
  removedFaceIds: Set<string>,
  now: string
): AssignResult {
  const byId = new Map(keptFaces.map((face) => [face.id, face]));
  const assignments = new Map<string, string>();

  const working = people
    .map((person) => ({
      ...person,
      faceIds: person.faceIds.filter((id) => removedFaceIds.has(id) === false)
    }))
    .filter((person) => person.faceIds.length > 0);

  for (const face of newFaces) {
    let best: Person | null = null;
    let bestDistance = Infinity;
    for (const person of working) {
      const members = person.faceIds
        .map((id) => byId.get(id))
        .filter((item): item is FaceInstance => Boolean(item));
      if (members.length === 0) continue;
      const distance = descriptorDistance(
        centroid(members.map((member) => member.descriptor)),
        face.descriptor
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        best = person;
      }
    }

    if (best && bestDistance < FACE_MATCH_THRESHOLD) {
      best.faceIds.push(face.id);
      best.updatedAt = now;
      assignments.set(face.id, best.id);
    } else {
      const person: Person = {
        id: createId('person'),
        name: null,
        faceIds: [face.id],
        coverFaceId: face.id,
        hidden: false,
        createdAt: now,
        updatedAt: now
      };
      working.push(person);
      assignments.set(face.id, person.id);
    }
    byId.set(face.id, face);
  }

  working.forEach((person) => {
    if (!person.coverFaceId || person.faceIds.includes(person.coverFaceId) === false) {
      person.coverFaceId = person.faceIds[0] ?? null;
    }
  });

  return { people: working, assignments };
}

/** 整体替换某张照片的人脸扫描结果,并把新人脸归入人物聚类。 */
export async function replacePhotoFaces(photoId: string, inputs: FaceScanInput[]) {
  const now = nowIso();
  const storedFaces = await readCollection<FaceInstance>('faces');
  const removedFaceIds = new Set(
    storedFaces.filter((face) => face.photoId === photoId).map((face) => face.id)
  );
  const keptFaces = storedFaces.filter((face) => removedFaceIds.has(face.id) === false);
  const created: FaceInstance[] = inputs.map((input) => ({
    id: createId('face'),
    photoId,
    box: input.box,
    descriptor: input.descriptor,
    thumbUrl: input.thumbUrl,
    personId: null,
    createdAt: now
  }));

  const people = await readCollection<Person>('people');
  const { people: nextPeople, assignments } = assignFaces(
    people,
    keptFaces,
    created,
    removedFaceIds,
    now
  );
  created.forEach((face) => {
    face.personId = assignments.get(face.id) ?? null;
  });

  await mutateCollection<Person, void>('people', (current) => {
    current.splice(0, current.length, ...nextPeople);
  });
  await mutateCollection<FaceInstance, void>('faces', (current) => {
    const kept = current.filter((face) => face.photoId !== photoId);
    current.splice(0, current.length, ...kept, ...created);
  });

  return { faces: created, people: nextPeople };
}

export async function patchPerson(
  id: string,
  patch: { name?: string | null; coverFaceId?: string | null; hidden?: boolean }
) {
  return mutateCollection<Person, Person | null>('people', (current) => {
    const person = current.find((item) => item.id === id);
    if (!person) return null;
    if (patch.name !== undefined) person.name = patch.name;
    if (patch.hidden !== undefined) person.hidden = patch.hidden;
    if (patch.coverFaceId !== undefined && patch.coverFaceId !== null) {
      if (person.faceIds.includes(patch.coverFaceId) === false) return null;
      person.coverFaceId = patch.coverFaceId;
    }
    person.updatedAt = nowIso();
    return person;
  });
}

export async function mergePeople(sourceId: string, targetId: string) {
  if (sourceId === targetId) return null;
  const merged = await mutateCollection<Person, Person | null>('people', (current) => {
    const source = current.find((item) => item.id === sourceId);
    const target = current.find((item) => item.id === targetId);
    if (!source || !target) return null;
    target.faceIds = [...new Set([...target.faceIds, ...source.faceIds])];
    if (!target.coverFaceId || target.faceIds.includes(target.coverFaceId) === false) {
      target.coverFaceId = target.faceIds[0] ?? null;
    }
    target.updatedAt = nowIso();
    current.splice(current.indexOf(source), 1);
    return target;
  });
  if (merged === null) return null;
  await mutateCollection<FaceInstance, void>('faces', (current) => {
    current.forEach((face) => {
      if (face.personId === sourceId) face.personId = targetId;
    });
  });
  return merged;
}

export async function deleteFace(faceId: string) {
  const removed = await mutateCollection<FaceInstance, FaceInstance | null>('faces', (current) => {
    const index = current.findIndex((face) => face.id === faceId);
    if (index === -1) return null;
    const [face] = current.splice(index, 1);
    return face;
  });
  if (removed?.personId) {
    const personId = removed.personId;
    await mutateCollection<Person, void>('people', (current) => {
      const index = current.findIndex((person) => person.id === personId);
      if (index === -1) return;
      const person = current[index];
      person.faceIds = person.faceIds.filter((id) => id !== faceId);
      if (person.coverFaceId === faceId) person.coverFaceId = person.faceIds[0] ?? null;
      if (person.faceIds.length === 0) current.splice(index, 1);
      else person.updatedAt = nowIso();
    });
  }
  return removed;
}

/** 照片被彻底清除时级联删除其人脸,并清理空聚类。 */
export async function removeFacesForPhotos(photoIds: string[]) {
  const idSet = new Set(photoIds);
  const removedFaceIds = new Set<string>();
  await mutateCollection<FaceInstance, void>('faces', (current) => {
    for (let i = current.length - 1; i >= 0; i -= 1) {
      if (idSet.has(current[i].photoId)) {
        removedFaceIds.add(current[i].id);
        current.splice(i, 1);
      }
    }
  });
  if (removedFaceIds.size === 0) return;
  await mutateCollection<Person, void>('people', (current) => {
    for (let i = current.length - 1; i >= 0; i -= 1) {
      const person = current[i];
      person.faceIds = person.faceIds.filter((id) => removedFaceIds.has(id) === false);
      if (person.coverFaceId && removedFaceIds.has(person.coverFaceId)) {
        person.coverFaceId = person.faceIds[0] ?? null;
      }
      if (person.faceIds.length === 0) current.splice(i, 1);
    }
  });
}

export interface PersonSummary {
  id: string;
  name: string | null;
  hidden: boolean;
  count: number;
  coverThumbUrl: string | null;
  faces: Array<{ id: string; photoId: string; thumbUrl: string; box: FaceInstance['box'] }>;
}

/** 管理端人物列表(剥离 descriptor,按人脸数降序)。 */
export async function listPeopleWithFaces(): Promise<PersonSummary[]> {
  const [people, faces] = await Promise.all([
    readCollection<Person>('people'),
    readCollection<FaceInstance>('faces')
  ]);
  const byId = new Map(faces.map((face) => [face.id, face]));
  return people
    .map((person) => {
      const members = person.faceIds
        .map((id) => byId.get(id))
        .filter((face): face is FaceInstance => Boolean(face));
      const cover = (person.coverFaceId ? byId.get(person.coverFaceId) : undefined) ?? members[0];
      return {
        id: person.id,
        name: person.name,
        hidden: person.hidden,
        count: members.length,
        coverThumbUrl: cover?.thumbUrl ?? null,
        faces: members.map((face) => ({
          id: face.id,
          photoId: face.photoId,
          thumbUrl: face.thumbUrl,
          box: face.box
        }))
      };
    })
    .sort((a, b) => b.count - a.count);
}
```

- [ ] **Step 2: 写自测脚本 `scripts/check-people.mjs`**

```js
// 聚类纯函数自测:node --experimental-strip-types scripts/check-people.mjs
import { assignFaces, descriptorDistance } from '../src/lib/people.ts';

const vec = (index, value) => {
  const v = new Array(128).fill(0);
  v[index] = value;
  return v;
};
const face = (id, descriptor) => ({
  id,
  photoId: 'photo_x',
  box: { x: 0, y: 0, w: 0.1, h: 0.1 },
  descriptor,
  thumbUrl: '/uploads/x.jpg',
  personId: null,
  createdAt: 'now'
});

const checks = [];
// 相近人脸(a1/a2 距离 0.1)应进同一聚类;远人脸(b1 距离约 1.4)应新建聚类
const a1 = face('f1', vec(0, 1));
const a2 = face('f2', vec(0, 1.1));
const b1 = face('f3', vec(1, 1));
const first = assignFaces([], [], [a1, a2], new Set(), 't0');
checks.push(['两张相近人脸同聚类', first.assignments.get('f1') === first.assignments.get('f2')]);
const second = assignFaces(first.people, [a1, a2], [b1], new Set(), 't1');
checks.push(['远人脸新建聚类', second.assignments.get('f3') !== second.assignments.get('f2')]);
checks.push(['共两个聚类', second.people.length === 2]);
// 删除某照片的全部人脸后,单脸聚类被清理
const third = assignFaces(second.people, [b1], [], new Set(['f1', 'f2']), 't2');
checks.push(['空聚类被清理', third.people.length === 1]);
checks.push(['欧氏距离', Math.abs(descriptorDistance(vec(0, 3), vec(0, 0)) - 3) < 1e-9]);

let failed = 0;
checks.forEach(([label, pass]) => {
  if (!pass) failed += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${label}`);
});
if (failed > 0) process.exit(1);
console.log('全部通过');
```

- [ ] **Step 3: 运行自测 + 构建**

Run: `node --experimental-strip-types scripts/check-people.mjs` → 全部 PASS;`npm run build` → 通过。

- [ ] **Step 4: Commit**

```bash
git add src/lib/people.ts scripts/check-people.mjs
git commit -m "Add face clustering library with people/face storage helpers"
```

---

### Task 6: 人物 API 与照片删除级联

**Files:**
- Create: `src/app/api/people/route.ts`
- Create: `src/app/api/people/merge/route.ts`
- Create: `src/app/api/people/[id]/route.ts`
- Create: `src/app/api/photos/[id]/faces/route.ts`
- Create: `src/app/api/faces/[id]/route.ts`
- Modify: `src/app/api/photos/[id]/route.ts`(purge 分支级联)
- Modify: `src/app/api/photos/batch/route.ts`(purge 动作级联)

**Interfaces:**
- Consumes: Task 5 全部导出;`photoFacesSchema` / `personPatchSchema` / `peopleMergeSchema`(Task 3)
- Produces: `GET /api/people`、`PATCH /api/people/:id`、`POST /api/people/merge`、`POST /api/photos/:id/faces`、`DELETE /api/faces/:id`(全部仅 `isAuthorizedWrite`)。Task 8 的前端消费。

- [ ] **Step 1: `GET /api/people`**

```ts
import type { NextRequest } from 'next/server';
import { ok } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { listPeopleWithFaces } from '@/lib/people';

export async function GET(request: NextRequest) {
  if (isAuthorizedWrite(request) === false) return unauthorized();
  return ok({ items: await listPeopleWithFaces() });
}
```

- [ ] **Step 2: `PATCH /api/people/[id]`**

```ts
import type { NextRequest } from 'next/server';
import { fail, ok, parseBody } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { patchPerson } from '@/lib/people';
import { personPatchSchema } from '@/lib/schemas';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  if (isAuthorizedWrite(request) === false) return unauthorized();
  const { id } = await context.params;
  const parsed = await parseBody(request, personPatchSchema);
  if (parsed.valid === false) return fail(parsed.error);

  const updated = await patchPerson(id, parsed.data);
  if (updated === null) return fail('没有找到这个人物,或封面人脸不属于该人物。', 404);
  return ok(updated);
}
```

- [ ] **Step 3: `POST /api/people/merge`**

```ts
import type { NextRequest } from 'next/server';
import { fail, ok, parseBody } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { mergePeople } from '@/lib/people';
import { peopleMergeSchema } from '@/lib/schemas';

export async function POST(request: NextRequest) {
  if (isAuthorizedWrite(request) === false) return unauthorized();
  const parsed = await parseBody(request, peopleMergeSchema);
  if (parsed.valid === false) return fail(parsed.error);

  const merged = await mergePeople(parsed.data.sourceId, parsed.data.targetId);
  if (merged === null) return fail('没有找到要合并的人物。', 404);
  return ok(merged);
}
```

- [ ] **Step 4: `POST /api/photos/[id]/faces`**

```ts
import type { NextRequest } from 'next/server';
import { fail, ok, parseBody } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { replacePhotoFaces } from '@/lib/people';
import { photoFacesSchema } from '@/lib/schemas';
import { readCollection } from '@/lib/storage';
import type { Photo } from '@/lib/types';

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  if (isAuthorizedWrite(request) === false) return unauthorized();
  const { id } = await context.params;
  const parsed = await parseBody(request, photoFacesSchema);
  if (parsed.valid === false) return fail(parsed.error);

  const photos = await readCollection<Photo>('photos');
  if (photos.some((photo) => photo.id === id) === false) return fail('没有找到这张照片。', 404);

  const result = await replacePhotoFaces(id, parsed.data.faces);
  return ok({ faces: result.faces.length, people: result.people.length }, { status: 201 });
}
```

- [ ] **Step 5: `DELETE /api/faces/[id]`**

```ts
import type { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { isAuthorizedWrite, unauthorized } from '@/lib/auth';
import { deleteFace } from '@/lib/people';

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  if (isAuthorizedWrite(request) === false) return unauthorized();
  const { id } = await context.params;
  const removed = await deleteFace(id);
  if (removed === null) return fail('没有找到这张人脸。', 404);
  return ok({ id });
}
```

- [ ] **Step 6: 照片彻底清除时级联删除人脸**

`src/app/api/photos/[id]/route.ts` DELETE:mutateCollection 返回 `'purged'` 后(即 `if (result === 'purged')`)调用 `await removeFacesForPhotos([id]);`(import 自 `@/lib/people`)。

`src/app/api/photos/batch/route.ts`:读完整文件,找到 `purge` 动作分支(彻底删除回收站照片处)。收集实际被 splice 掉的照片 id,在 mutateCollection 之后调用 `await removeFacesForPhotos(purgedIds);`。注意 purgeExpiredTrash 自动清理的过期照片不在此列,可忽略(它们的 faces 会残留为脏数据但无展示入口——在 Task 11 文档中注明该权衡)。

- [ ] **Step 7: 构建 + curl 验证**

Run: `npm run build` → 通过。`npm run dev` 起服务后:

```bash
# 未授权访问应 401
curl -s http://localhost:3000/api/people
# 提交两张虚拟人脸(128 维向量),应各自成聚类或按距离合并
curl -s -X POST http://localhost:3000/api/photos/<真实photoId>/faces \
  -H "Authorization: Bearer $HERMES_API_TOKEN" -H 'Content-Type: application/json' \
  -d '{"faces":[{"box":{"x":0.1,"y":0.1,"w":0.2,"h":0.2},"descriptor":['"$(node -e 'console.log(new Array(128).fill(0).map((_,i)=>i===0?1:0).join(","))"')'],"thumbUrl":"/uploads/test-face.jpg"}]}'
curl -s http://localhost:3000/api/people -H "Authorization: Bearer $HERMES_API_TOKEN"
# PATCH 重命名、POST merge、DELETE face 各验一次;最后把测试数据 DELETE 干净
```

- [ ] **Step 8: Commit**

```bash
git add src/app/api/people src/app/api/faces src/app/api/photos
git commit -m "Add people/face APIs with cascade cleanup on photo purge"
```

---

### Task 7: 人脸检测前端库与模型

**Files:**
- Modify: `package.json`(新增依赖与 `setup:faces` script)
- Create: `scripts/copy-face-models.mjs`
- Create(脚本产物): `public/models/face-api/*`
- Create: `src/lib/faces.ts`

**Interfaces:**
- Produces(Task 8 消费):
  - `pendingScans(photos: Photo[]): Photo[]`(按 localStorage 中 photoId→updatedAt 标记过滤)
  - `scanPhoto(photo: Photo): Promise<number>`(检测→传头像→POST faces→写标记,返回人脸数)
  - `loadFaceApi(): Promise<FaceApi>`(单例加载模型)

- [ ] **Step 1: 安装依赖**

```bash
npm install @vladmandic/face-api
```

- [ ] **Step 2: 模型拷贝脚本 `scripts/copy-face-models.mjs`**

```js
// 把 face-api 模型从 npm 包拷贝到 public,供浏览器加载。用法:npm run setup:faces
import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const PREFIXES = ['ssd_mobilenetv1', 'face_landmark_68', 'face_recognition'];
const source = path.join(process.cwd(), 'node_modules', '@vladmandic', 'face-api', 'model');
const target = path.join(process.cwd(), 'public', 'models', 'face-api');

await mkdir(target, { recursive: true });
const files = (await readdir(source)).filter((name) =>
  PREFIXES.some((prefix) => name.startsWith(prefix))
);
if (files.length === 0) {
  console.error(`在 ${source} 没有找到模型文件,确认 @vladmandic/face-api 已安装。`);
  process.exit(1);
}
for (const file of files) {
  await cp(path.join(source, file), path.join(target, file));
}
console.log(`拷贝 ${files.length} 个模型文件 → ${path.relative(process.cwd(), target)}/`);
```

`package.json` scripts 增加 `"setup:faces": "node scripts/copy-face-models.mjs"`,并运行一次确认 `public/models/face-api/` 下有 `ssd_mobilenetv1_model-weights_manifest.json`、`face_landmark_68_model-weights_manifest.json`、`face_recognition_model-weights_manifest.json` 及对应 `.bin` shard。

- [ ] **Step 3: 写 `src/lib/faces.ts`**

```ts
'use client';

import type { Photo } from './types';

type FaceApi = typeof import('@vladmandic/face-api');

const MODEL_URL = '/models/face-api';
const SCAN_STORAGE_KEY = 'photos-face-scan-v1';
const THUMB_SIZE = 160;

let apiPromise: Promise<FaceApi> | null = null;

/** 单例加载 face-api 与三个模型(检测/关键点/特征)。 */
export function loadFaceApi(): Promise<FaceApi> {
  apiPromise ??= (async () => {
    const faceapi = await import('@vladmandic/face-api');
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    return faceapi;
  })();
  return apiPromise;
}

export interface DetectedFace {
  box: { x: number; y: number; w: number; h: number }; // 归一化
  descriptor: number[];
  thumb: Blob;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`图片加载失败:${url}`));
    image.src = url;
  });
}

function cropFace(
  image: HTMLImageElement,
  box: { x: number; y: number; width: number; height: number }
): Promise<Blob> {
  const size = Math.max(box.width, box.height) * 1.7;
  const sx = Math.max(0, box.x + box.width / 2 - size / 2);
  const sy = Math.max(0, box.y + box.height / 2 - size / 2);
  const side = Math.min(size, image.naturalWidth - sx, image.naturalHeight - sy);
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('无法创建画布。'));
  context.drawImage(image, sx, sy, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('头像裁剪失败。'))),
      'image/jpeg',
      0.85
    );
  });
}

/** 对单张照片做人脸检测 + 特征提取 + 头像裁剪。 */
export async function detectFacesInPhoto(url: string): Promise<DetectedFace[]> {
  const faceapi = await loadFaceApi();
  const image = await loadImage(url);
  const results = await faceapi
    .detectAllFaces(image, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  const { naturalWidth: width, naturalHeight: height } = image;
  const faces: DetectedFace[] = [];
  for (const result of results) {
    const box = result.detection.box;
    faces.push({
      box: { x: box.x / width, y: box.y / height, w: box.width / width, h: box.height / height },
      descriptor: Array.from(result.descriptor),
      thumb: await cropFace(image, box)
    });
  }
  return faces;
}

async function uploadThumb(blob: Blob) {
  const body = new FormData();
  body.append('file', new File([blob], `face-${Date.now()}.jpg`, { type: 'image/jpeg' }));
  const response = await fetch('/api/upload', { method: 'POST', body });
  const payload = (await response.json()) as { data?: { url?: string }; error?: string };
  if (response.ok === false || !payload.data?.url) {
    throw new Error(payload.error ?? '头像上传失败。');
  }
  return payload.data.url;
}

function readScanMarkers(): Record<string, string> {
  try {
    return JSON.parse(window.localStorage.getItem(SCAN_STORAGE_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function markScanned(photoId: string, updatedAt: string) {
  const markers = readScanMarkers();
  markers[photoId] = updatedAt;
  window.localStorage.setItem(SCAN_STORAGE_KEY, JSON.stringify(markers));
}

/** 还没扫描过(或扫描后照片有更新)的照片。 */
export function pendingScans(photos: Photo[]): Photo[] {
  const markers = readScanMarkers();
  return photos.filter((photo) => markers[photo.id] !== photo.updatedAt);
}

/** 扫描单张照片并把结果提交到服务端聚类。返回检测到的人脸数。 */
export async function scanPhoto(photo: Photo): Promise<number> {
  const detected = await detectFacesInPhoto(photo.url);
  const faces = [];
  for (const item of detected) {
    const thumbUrl = await uploadThumb(item.thumb);
    faces.push({ box: item.box, descriptor: item.descriptor, thumbUrl });
  }
  const response = await fetch(`/api/photos/${photo.id}/faces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ faces })
  });
  if (response.ok === false) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? '人脸结果保存失败。');
  }
  markScanned(photo.id, photo.updatedAt);
  return faces.length;
}
```

- [ ] **Step 4: 构建验证 + Commit**

Run: `npm run build` → 通过(faces.ts 只在客户端引用,不进服务端 bundle)。

```bash
git add package.json package-lock.json scripts/copy-face-models.mjs public/models/face-api src/lib/faces.ts
git commit -m "Add browser-side face detection with bundled face-api models"
```

---

### Task 8: PeopleAlbum 组件(iCloud 风格人物视图)

**Files:**
- Create: `src/components/photos/people-album.tsx`
- Create: `src/components/photos/people-album.module.css`

**Interfaces:**
- Consumes: `pendingScans` / `scanPhoto`(Task 7);`GET /api/people`、`PATCH /api/people/:id`、`POST /api/people/merge`、`DELETE /api/faces/:id`(Task 6)
- Produces(Task 10 消费):`export function PeopleAlbum({ admin, photos, onOpenPhoto }: { admin: boolean; photos: Photo[]; onOpenPhoto: (photoId: string, list: Photo[]) => void })`

**设计要求**(对齐 iCloud 相册"人物"):
- 主视图:圆形头像网格,头像 = `coverThumbUrl`,下方名字(未命名显示"未命名人物")与人脸数;按人脸数降序。
- 点头像 → 该人物的照片网格(由 faces 的 photoId 映射到 `photos` prop,去重,保持片原顺序);照片沿用全站灯箱(点击调 `onOpenPhoto(photoId, personPhotos)`)。
- 详情页顶部(admin):重命名输入框、合并下拉(选目标人物后确认)、隐藏/取消隐藏、返回。
- 详情页人脸条(admin):每张人脸缩略图,点击设为封面,角标 × 删除误检。
- 主视图顶部(admin):"扫描人物"按钮 + 进度 `已扫 x/y`;`hidden` 人物收进底部"已隐藏"区,可恢复。
- 访客永不渲染此组件(由 Task 10 的父组件保证),组件内仍不输出 descriptor。

- [ ] **Step 1: 写组件 `src/components/photos/people-album.tsx`**

```tsx
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
```

- [ ] **Step 2: 写样式 `src/components/photos/people-album.module.css`**

遵循项目既有视觉(参考 `src/app/photos/photos.module.css` 的 tile/hover 处理与 DESIGN.md 的降饱和原则):圆形头像(`border-radius: 50%`、统一 96px、object-fit cover、hover 放大 ≤1.05)、卡片纵向居中排布、人脸条横向滚动、照片网格用 `repeat(auto-fill, minmax(140px, 1fr))`。需要的 class 名以组件内引用为准:`detail / detailHeader / detailActions / nameInput / mergeSelect / detailTitle / detailCount / faceStrip / faceItem / faceThumb / faceRemove / photoGrid / photoTile / peopleToolbar / peopleMeta / peopleActions / peopleGrid / personCard / personFace / personFallback / personName / personCount / personHide / error`。

- [ ] **Step 3: 构建验证 + Commit**

Run: `npm run build` → 通过。

```bash
git add src/components/photos
git commit -m "Add iCloud-style people album component"
```

---

### Task 9: RegionAlbum 组件(地图 + 城市分组)

**Files:**
- Create: `src/components/photos/region-album.tsx`
- Create: `src/components/photos/region-album.module.css`

**Interfaces:**
- Consumes: `Photo.region`(Task 4 起服务端写入)、`site.map`(图层配置)、leaflet(全局 CSS 已在 `src/app/layout.tsx` 引入)
- Produces(Task 10 消费):`export function RegionAlbum({ photos, onOpenPhoto }: { photos: Photo[]; onOpenPhoto: (photoId: string, list: Photo[]) => void })`

**要求:**
- 上半部分 Leaflet 地图(命令式建图,模式参考 `src/components/map/map-experience.tsx:112-176`:`await import('leaflet')` → `L.map` → `L.tileLayer(默认图层, tileSize:512, zoomOffset:-1)`);每张小坐标照片一个 44px 圆形 divIcon 标记,点击标记调 `onOpenPhoto(photo.id, geotagged)`;`fitBounds` 到全部标记(空则不设置视野)。
- 下半部分按城市分组网格:标题 `省 · 市(数量)`;`region` 为 null 的照片归入最后的「未定位」组;点照片调 `onOpenPhoto(photo.id, group.items)`。
- 组件卸载时 `map.remove()`;`photos` 变化用 id 拼接 key 做 effect 依赖。

- [ ] **Step 1: 写组件 `src/components/photos/region-album.tsx`**

```tsx
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
```

- [ ] **Step 2: 写样式 `src/components/photos/region-album.module.css`**

- `.map`:高度 `min(52vh, 460px)`、圆角、overflow hidden(与 `map-experience` 的容器风格一致)。
- `.marker`:圆形照片标记,参考 `src/components/map/map.module.css` 里 `.marker`/`.markerInner` 的既有写法(白边圆形、阴影),尺寸 44px。
- `.cityGroup / .cityHead / .cityCount`:与 `photos.module.css` 的 `dayGroup / dayHead` 视觉一致。
- `.cityGrid`:`repeat(auto-fill, minmax(140px, 1fr))`,`.photoTile` 方形裁切(object-fit cover)。

- [ ] **Step 3: 构建验证 + Commit**

Run: `npm run build` → 通过。

```bash
git add src/components/photos
git commit -m "Add region album with map and city groups"
```

---

### Task 10: 相册页集成视图切换

**Files:**
- Modify: `src/app/photos/photos-experience.tsx`
- Modify: `src/app/photos/photos.module.css`

**Interfaces:**
- Consumes: `PeopleAlbum`(Task 8)、`RegionAlbum`(Task 9)
- Produces: `/photos` 页面顶部「时间 / 人物 / 地区」维度切换,默认时间;灯箱在三个维度下都可用且左右切换范围 = 当前维度的照片列表。

- [ ] **Step 1: 维度状态与灯箱列表共享**

在 `photos-experience.tsx`:

1. 顶部 import:`import { PeopleAlbum } from '@/components/photos/people-album';` 与 `import { RegionAlbum } from '@/components/photos/region-album';`
2. 新增类型与状态:

```ts
type Dimension = 'time' | 'people' | 'region';
```

```ts
  const [dimension, setDimension] = useState<Dimension>('time');
  const [lightboxList, setLightboxList] = useState<Photo[] | null>(null);
```

3. 灯箱导航改为基于活动列表。现有代码:

```ts
  const lightboxIndex = viewList.findIndex((photo) => photo.id === lightboxId);
```

改为:

```ts
  const activeList = lightboxList ?? viewList;
  const lightboxIndex = activeList.findIndex((photo) => photo.id === lightboxId);
```

`goTo` 内的 `viewList` 同步换成 `activeList`(依赖数组同步改)。

4. 新增打开函数,并保证所有关闭灯箱的入口(Escape、关闭按钮、背景点击——逐一在文件内搜 `setLightboxId(null)`)同时 `setLightboxList(null)`:

```ts
  const openLightbox = useCallback((photoId: string, list: Photo[]) => {
    setLightboxList(list);
    setLightboxId(photoId);
    setZoomed(false);
    setInfoOpen(false);
  }, []);
```

5. 派生 `libraryPhotos`:

```ts
  const libraryPhotos = useMemo(() => photos.filter((photo) => !photo.deletedAt), [photos]);
```

- [ ] **Step 2: 维度切换 UI**

在 `toolbarTop` 里现有 `tabs`(图库/收藏/最近删除)**之前**插入维度切换(人物仅 admin):

```tsx
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
                    exitSelectMode();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
```

现有 图库/收藏/最近删除 tabs、搜索框、选择/上传按钮、toolbarBottom、selectBar、trashRow 仅在 `dimension === 'time'` 时渲染(包一层 `{dimension === 'time' ? (...) : null}`)。`pageSub` 文案按维度切换:时间保持原文案;地区 `按拍摄城市整理,地图上是每张照片的位置。`;人物 `自动识别并聚在一起的面孔。`

- [ ] **Step 3: 按维度渲染内容区**

现有 `<div ref={gridRef} className={styles.gridScope}>…</div>` 改为:

```tsx
      {dimension === 'time' ? (
        <div ref={gridRef} className={styles.gridScope}>
          …原有 groups 渲染,原样保留…
        </div>
      ) : dimension === 'people' && admin ? (
        <PeopleAlbum admin={admin} photos={libraryPhotos} onOpenPhoto={openLightbox} />
      ) : (
        <RegionAlbum photos={libraryPhotos} onOpenPhoto={openLightbox} />
      )}
```

- [ ] **Step 4: 样式**

`photos.module.css` 增加 `.dimensionTabs`(与 `.tabs` 相同的胶囊排布,可用 `display:flex; gap:6px;`),如与 `.tabs` 视觉重复可复用类名组合。保持移动端折行正常(`flex-wrap: wrap`)。

- [ ] **Step 5: 全量验证**

Run: `npm run build` → 通过。
`npm run dev` 手动验证清单:
1. 默认打开 `/photos` = 时间视图,按天分组与现状一致;
2. 切到「地区」:地图渲染、照片标记可点开灯箱、城市分组正确(占位照片应归到「浙江 · 杭州市」);
3. 游客(无 cookie)看不到「人物」tab;`curl /api/people` 401;
4. admin 切「人物」→ 扫描按钮可用(有真人照片时),扫描后聚类出现;命名/合并/隐藏/删脸/设封面全部生效;
5. 人物详情点照片 → 灯箱打开,左右切换不越出该人物照片集;
6. 回收站彻底删除一张有脸的照片 → `data/faces.json` 对应记录消失,空聚类被清理。

- [ ] **Step 6: Commit**

```bash
git add src/app/photos
git commit -m "Add time/people/region dimension switcher to album"
```

---

### Task 11: 文档同步与收尾

**Files:**
- Modify: `docs/API.md`
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-09-13-photos-auto-classification-design.md`(若实现与 spec 有偏差,回填说明)

- [ ] **Step 1: docs/API.md**

在照片 API 章节(`docs/API.md:202-260` 附近)补充:
- `GET /api/photos` 新增 `region` 查询参数说明;
- `POST /api/photos/reclassify`(仅管理员/Agent,幂等回填行政区划);
- `POST /api/photos/:id/faces`、`GET /api/people`、`PATCH /api/people/:id`、`POST /api/people/merge`、`DELETE /api/faces/:id`(全部需写权限;人物数据不公开);
- 注明照片彻底清除会级联删除人脸;回收站自动过期清理的照片不级联(已知取舍)。

- [ ] **Step 2: AGENTS.md**

- `data/` 描述里补充 `faces.json`、`people.json`、`admin-regions.json`;
- 命令列表补充 `npm run build:regions`(重建行政区划数据)与 `npm run setup:faces`(拷贝人脸模型)。

- [ ] **Step 3: 最终构建 + 提交**

Run: `npm run build` → 通过。

```bash
git add docs/API.md AGENTS.md docs/superpowers
git commit -m "Document album classification APIs and data files"
```

---

## Self-Review 记录

- Spec 覆盖:时间默认(现状,Task 10 保持)/ 人物(Task 5-8,10)/ 地区(Task 1-4,9-10)/ 级联删除(Task 6)/ 隐私边界(Task 6、8、10)/ 文档(Task 11)✓
- Spec 偏差(已在 spec 中同步):地区回填用 `POST /api/photos/reclassify` 代替独立脚本;境外照片不做在线逆地理,直接归「未定位」。
- 已知取舍:回收站自动过期的照片不级联删 faces(无展示入口,数据无害残留);扫描标记在 localStorage,换浏览器会重扫(幂等,无副作用)。
