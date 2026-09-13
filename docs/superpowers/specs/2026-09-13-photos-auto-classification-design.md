# 相册自动分类设计(人物 / 时间 / 地区)

日期:2026-09-13
状态:已实现(2026-09-13,人物/地区/文档同步完成)

## 1. 背景与目标

`/photos` 相册目前已有按"天"分组的时间视图、EXIF(拍摄时间 + GPS)浏览器端解析、收藏/回收站等能力。本次新增**自动分类**能力,三个维度:

| 维度 | 现状/目标 |
|---|---|
| 时间 | **保持现状**,作为相册默认视图(按天分组) |
| 人物 | 新增。人脸检测 + 特征聚类,展示效果参考 iCloud 相册"人物"(圆形头像网格 → 个人照片集) |
| 地区 | 新增。① 在地图上展示照片;② 基于自建行政区划表做点在多边形内(Point-in-Polygon)反查,精确到**市一级**的分类 |

非目标(YAGNI):照片与旅行(trips)的关联、EXIF 全字段落库、人脸识别的跨设备同步、视频支持。

## 2. 关键决策(已选定)

### 2.1 人物识别:浏览器端推理 + 服务端聚类

- 人脸识别库:**`@vladmandic/face-api`**(face-api.js 的维护分支,纯 JS/TF.js,可跑在浏览器,无需 Python/原生依赖)。
- **模型文件**随 npm 包分发(`node_modules/@vladmandic/face-api/model`),由脚本拷贝到 `public/models/face-api/`,不走外网下载。
- **推理在浏览器完成**(管理员在相册页点"扫描人物"):检测人脸框 + 128 维特征向量 + canvas 裁剪头像缩略图;原图与特征计算不出本机。
- **聚类在服务端完成**:浏览器把 `[{box, descriptor[128], thumbUrl}]` 提交给 API,服务端用贪心聚类(与现有 person 质心的欧氏距离 < 0.55 则归入,否则新建 person)。人物命名、合并、隐藏由管理员在 UI 操作。
- 备选方案及否决理由:浏览器原生 `FaceDetector` API(只能检测不能识别,无法聚类);服务端 tfjs-node/face-api(引入重型原生依赖,JSON 文件站无必要);调云端人脸 API(隐私与成本)。

### 2.2 地区分类:自建行政区划表 + 服务端点查

- 数据源:**阿里云 DataV GeoAtlas**(`https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json`,民政部国标行政区划代码),城市级(地级行政区,约 340 个)边界。
- 构建脚本 `scripts/build-admin-regions.mjs`:拉取全国各省级 `_full.json` → 提取市级要素 → Douglas-Peucker 抽稀(容差 ~0.005°,约 500m 精度)+ 坐标量化到 4 位小数 → 输出 `data/admin-regions.json`(含 adcode、省名、市名、bbox、抽稀后的 MultiPolygon)。体积目标 < 5MB,仅服务端加载。
- 反查:`src/lib/geo/regions.ts` 做 bbox 预筛 + 射线法 PIP,输入 (lng, lat) 输出 `{adcode, province, city}`。
- **写入时机**:服务端在 `POST /api/photos` 创建、`PATCH /api/photos/:id` 修改 lat/lng 时自动计算并写入 `photo.region`;存量照片由管理端 `POST /api/photos/reclassify` 回填(可随时重跑,幂等)。
- **降级**:构建产物中市级条目在前、省级条目在后,市级 PIP 未命中时自动落到省级;坐标不在任何面内(如海外)→ `region = null`,归入"未定位"分组(照片的 `locationName` 仍可手动编辑)。绝不阻塞照片写入。

### 2.3 时间分类:不动

默认视图维持 `groupPhotosByDay` 现状。三个维度通过相册页顶部视图切换器切换,**默认仍是时间**。

## 3. 数据模型

`Photo` 增加一个可选字段(schemas.ts / types.ts 同步更新,保持向后兼容):

```ts
region?: { adcode: string; province: string; city: string } | null
```

新增两个 JSON 集合(沿用现有 JSON 文件存储模式,不引数据库):

`data/faces.json` — 人脸实例:
```ts
{
  id: string;            // face_xxx
  photoId: string;
  box: { x: number; y: number; w: number; h: number }; // 相对原图的归一化坐标
  descriptor: number[];  // 128 维,仅服务端/管理员使用
  thumbUrl: string;      // canvas 裁剪后经 /api/upload 上传的头像
  personId: string | null;
  createdAt: string;
}
```

`data/people.json` — 人物聚类:
```ts
{
  id: string;            // person_xxx
  name: string | null;   // 管理员命名,如 "阿澄"
  faceIds: string[];
  coverFaceId: string | null; // 封面头像(默认第一张,可改)
  hidden: boolean;       // 误检聚类可隐藏
  createdAt: string; updatedAt: string;
}
```

行政区划表 `data/admin-regions.json`:
```ts
{
  version: string;             // 构建时间戳
  regions: Array<{
    adcode: string; province: string; city: string;
    bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
    polygons: number[][][][];  // MultiPolygon: [polygon][ring][point][lng,lat]
  }>
}
```

## 4. API

| 方法/路径 | 权限 | 说明 |
|---|---|---|
| `GET /api/people` | **仅管理员** | 人物列表(含 face 数、封面、姓名);人脸数据不公开 |
| `PATCH /api/people/:id` | 仅管理员 | 重命名 / 设置封面 / 隐藏 |
| `POST /api/people/merge` | 仅管理员 | 合并两个聚类 `{sourceId, targetId}` |
| `POST /api/photos/:id/faces` | 仅管理员 | 提交某张照片的扫描结果(整体替换该照片的 faces,触发增量聚类) |
| `DELETE /api/faces/:id` | 仅管理员 | 删除误检人脸 |
| `GET /api/photos?region={adcode}` | 公开(按现有可见性规则) | 按行政区划筛选照片 |
| `POST /api/photos/reclassify` | 仅管理员 | 对全部照片重算 `region`(幂等回填) |
| `POST/PATCH /api/photos*` | 现有权限 | 内部自动补算 `region`,对外契约不变 |

删除照片(彻底清除)时级联删除其 faces,并从对应 person 的 faceIds 中移除。回收站自动过期清理的照片不做级联(已知取舍:残留人脸无展示入口,数据无害)。

## 5. 前端

`photos-experience.tsx` 已 950+ 行,本次**把视图层拆出独立组件**,主组件只加视图状态:

```
photos-experience.tsx
 ├─ 顶部视图切换:时间 | 人物 | 地区  (默认:时间;"人物"仅 admin 可见)
 ├─ 时间 → 现有 dayGroup 渲染(原样保留)
 ├─ 人物 → <PeopleAlbum/>  (新组件 src/components/photos/people-album.tsx)
 └─ 地区 → <RegionAlbum/>  (新组件 src/components/photos/region-album.tsx)
```

**PeopleAlbum(iCloud 风格)**:
- 网格圆形头像(cover face crop),未命名显示"未命名人物",下方照片数;点击进入该人物的照片网格(复用现有灯箱)。
- 管理员:每个聚类支持命名、换封面、隐藏;两张人物卡可"合并";顶部"扫描人物"按钮带进度条(逐张 fetch 图片 → face-api 检测 → 裁头像上传 → POST faces)。扫描状态持久化在 localStorage(记录已扫 photoId+updatedAt,跳过未变更的)。

**RegionAlbum**:
- 复用现有 Leaflet + MapTiler 代理的建图方式(参考 map-experience.tsx),按市聚合显示圆形照片标记(复用 62×62 divIcon 样式),点击标记弹出现有灯箱。
- 地图旁/下方为城市分组列表:"浙江 · 杭州(12)"→ 点击展开该城市照片网格;`region=null` 的进"未定位"组。

样式:沿用 `*.module.css`、降饱和图片处理原则(DESIGN.md 43-48)。

## 6. 错误处理与边界

- face-api 模型加载失败 → 扫描按钮降级为错误提示,不影响其他视图。
- 某张照片检测失败(网络/解码)→ 跳过并计入失败数,不中断批量扫描。
- 行政区划表缺失或坐标非法 → `region=null`,照片正常写入。
- descriptor 不上传原图;`faces.json`/`people.json` 走与现有 JSON 存储一致的原子写。
- 公开访客:永远看不到人物数据(API 401 + UI 不渲染);地区/时间视图遵守现有 `visibility` 过滤。

## 7. 测试与验证

- `npm run build` 通过(TypeScript 严格模式)。
- 手动验证清单:
  1. 上传带 GPS 的 JPEG → photos.json 自动写入正确 `region`(至少市级);
  2. 调用 `POST /api/photos/reclassify` 回填 → 存量照片全部获得 region;
  3. 地区视图:地图标记 + 城市分组 + 灯箱可用;
  4. 人物扫描(含人脸的照片)→ 聚类生成 → 命名/合并/隐藏/删脸;
  5. 游客视角:人物 tab 不可见,`/api/people` 401;
  6. 删除照片后其 faces 级联清理。

## 8. 实施步骤(概要,详见实施计划)

1. 行政区划:build-admin-regions 脚本 + regions.ts 查找库 + 自测脚本
2. 数据层:types/schemas/storage 扩展 + Photo.region
3. 地区分类:POST/PATCH 自动打标 + `POST /api/photos/reclassify` 回填 + `?region=` 筛选
4. 人物后端:faces/people 存储 + 聚类 + API + 级联删除
5. 人物前端:模型拷贝脚本 + 扫描器 + PeopleAlbum
6. 地区前端:RegionAlbum + 视图切换器
7. 文档:docs/API.md、docs/DESIGN.md、AGENTS.md 数据清单同步
