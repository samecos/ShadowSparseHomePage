# API 文档

所有响应统一为：

```json
{ "ok": true, "data": {} }
```

错误响应：

```json
{ "ok": false, "error": "错误说明" }
```


## 机器人接入顺序

如果调用方是个人 Agent，请按以下顺序工作：

1. 读取 `GET /api/agent/manifest`，获取最新端点、schemas 与 MCP 配置。
2. 能使用 MCP 时，优先调用 `mcp/hermes-server.mjs` 暴露的工具。
3. MCP 不可用时，调用本文档中的 HTTP 端点。
4. 写操作携带 `Authorization: Bearer <HERMES_API_TOKEN>`。
5. 完整操作手册见 `agent/SKILL.md`，机器可读版本见 `agent/skill.manifest.json`。

## 鉴权

- 公开读取：无需 Token。
- 站长写操作：通过隐藏入口（`HOMEPAGE_ADMIN_SLUG`）登录后，由 `hp_session` Cookie 提供。
- 登录接口 `POST /api/auth` 需要同时提交口令与隐藏入口标识；隐藏入口页面会自动携带。
- Agent 写操作：`Authorization: Bearer <HERMES_API_TOKEN>`。

## 内容类型

### Post

```ts
{
  id: string
  content: string
  mood?: string
  images: string[]
  location?: string
  visibility: 'public' | 'private'
  pinned: boolean
  createdAt: string
  updatedAt: string
}
```

### MapStory / MapPhoto

```ts
{
  id: string
  title: string
  note: string
  date: string
  locationName: string
  tags: string[]
  photos: Array<{
    id: string
    url: string
    caption: string
    lat: number
    lng: number
  }>
}
```

### Collectible

```ts
{
  id: string
  title: string
  type: 'link' | 'image' | 'quote' | 'moment' | 'file'
  url?: string
  image?: string
  quote?: string
  description?: string
  agentSummary?: string
  tags: string[]
  source?: string
  collectedBy: 'me' | 'hermes' | 'unknown'
  status: 'inbox' | 'curated' | 'archived'
  featured: boolean
}
```

## 收藏 API

### GET /api/collectibles

查询参数：`status`、`type`、`tag`、`q`、`limit`、`offset`。

### POST /api/collectibles

创建一条收藏，需要写权限。

### PATCH /api/collectibles/:id

局部更新收藏。

### DELETE /api/collectibles/:id

删除收藏。

### POST /api/agent/collect

单条或批量收藏的 Agent 入口。支持请求体：

```json
{
  "title": "标题",
  "type": "link",
  "url": "https://example.com",
  "tags": ["阅读"],
  "dedupeByUrl": true
}
```

或：

```json
{
  "items": [{ "title": "A", "type": "link", "url": "https://a.com" }]
}
```

返回：

```json
{
  "created": [],
  "existed": [],
  "invalid": []
}
```

### POST /api/agent/collect/batch

请求体 `{ "items": [...] }`，最多 50 条。

### GET /api/agent/digest

返回状态统计、类型分布、热门标签和最近收件箱内容。

### GET /api/agent/manifest

返回完整 manifest，包含端点、MCP 工具、SKILL 循环和站点信息。

## 日常说说 API

- `GET /api/posts?mood=&limit=`
- `POST /api/posts`
- `PATCH /api/posts/:id`
- `DELETE /api/posts/:id`

## 地图故事 API

- `GET /api/map-stories?q=&tag=`
- `POST /api/map-stories`
- `PATCH /api/map-stories/:id`
- `DELETE /api/map-stories/:id`

移动照片：

```json
{ "photo": { "id": "photo_01", "lat": 30.25, "lng": 120.14 } }
```

## 旅行 API

旅行以 `Trip` 为聚合对象，包含每日行程、准备清单、预订记录、沿途记录和回顾草稿。

- `GET /api/trips?status=&q=`：访客只返回已完成且公开的旅行；管理员会话或 Agent Token 可读取全部旅行。
- `POST /api/trips`：创建旅行，默认 `status=planning`、`visibility=private`。
- `GET /api/trips/:id`：读取旅行详情及附件元数据；私密旅行需要鉴权。
- `PATCH /api/trips/:id`：更新旅行字段。`planning` 和 `active` 状态由服务端强制保持私密。
- `DELETE /api/trips/:id`：删除旅行及其私有附件，需要写权限。
- `GET /api/trips/:id/attachments`：读取附件元数据；私有附件需要鉴权。
- `POST /api/trips/:id/attachments`：上传旅行媒体或预订附件，使用 `multipart/form-data` 的 `file` 字段；支持图片/PDF，单文件不超过 8MB。预订附件还需要 `kind=reservation` 和 `reservationId`。
- `GET /api/trips/:id/attachments/:attachmentId`：读取附件。公开旅行只允许读取媒体附件，预订附件永不公开。

最小创建请求：

```json
{
  "title": "沿着海岸线慢慢走",
  "destinations": ["厦门", "泉州"],
  "startDate": "2026-10-01",
  "endDate": "2026-10-05",
  "summary": "给自己几天不赶路的时间。"
}
```

旅行写入建议先读取完整对象，在内存中合并 `days`、`reservations` 或 `entries` 后再 PATCH，避免覆盖其他阶段的数据。Agent 使用同一组端点和 Bearer Token；它不是协作者账号，不能自行公开进行中的旅行。

注意：普通 `POST /api/upload` 返回公开媒体地址，不能用于预订材料。预订材料存放在 `data/private-uploads`，通过旅行附件接口鉴权读取。

## 照片 API

### Photo

```ts
{
  id: string
  url: string
  title: string
  date: string              // 拍摄时间，ISO 8601
  locationName: string
  lat?: number
  lng?: number
  tags: string[]
  favorite: boolean
  visibility: 'public' | 'private'
  width?: number
  height?: number
  size?: number
  mimeType?: string
  deletedAt?: string | null // 回收站标记
  createdAt: string
  updatedAt: string
}
```

### GET /api/photos

查询参数：`q`、`tag`、`favorite`。访客只返回公开且未删除的照片；携带管理员会话或
Agent Token 时返回全部内容（含回收站）。

### POST /api/photos

登记一张照片，需要写权限。`url` 必须先通过 `POST /api/upload` 获得。
`lat` 和 `lng` 需要成对出现。

### PATCH /api/photos/:id

局部更新照片元数据。`lat` / `lng` 传 `null` 可以清除坐标。

### DELETE /api/photos/:id

两段式删除：第一次调用进入「最近删除」（`deletedAt` 被标记）；回收站内的照片再次
调用则彻底删除记录（图片文件仍保留在 `public/uploads`，不会自动清理）。
回收站中的照片超过 30 天后会在任何一次读取时自动清除。

### POST /api/photos/batch

批量操作，需要写权限：

```json
{ "action": "favorite", "ids": ["photo_xxx", "photo_yyy"] }
```

`action` 取值：`favorite`、`unfavorite`、`trash`（进回收站）、`restore`、`purge`（彻底删除）。

## 上传 API

`POST /api/upload`，`multipart/form-data`，字段名为 `file`，单文件不超过 8MB，支持图片和 PDF。
