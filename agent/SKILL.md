---
name: hermes-homepage-api-mcp
description: 个人主页 HTTP API 与 MCP Server 的完整调用说明书。机器人加载本文件后，应当知道如何发现接口、如何鉴权、每个端点怎么调、MCP 工具怎么启动和使用。
version: 2.0.0
target: hermes
owner: 疏影渡
tags:
  - homepage
  - api
  - mcp
  - agent-integration
---

# Homepage API + MCP 机器人接入手册

本 Skill 不负责决定“收藏什么”，它负责回答一件事：

> **我的机器人怎样才能正确调用这个主页的接口，以及怎样使用它的 MCP Server。**

当任务涉及主页的日常说说、地图故事、工作数据或有趣的搜集时，优先使用 MCP；MCP 不可用时回退到 HTTP API。不要通过抓取 HTML 来读写数据。

## 1. 接入前必须先知道的变量

| 变量 | 含义 | 示例 |
| --- | --- | --- |
| `HOMEPAGE_BASE_URL` | 主页地址，不带结尾斜杠 | `http://localhost:3000` |
| `HERMES_API_TOKEN` | 写操作 Bearer Token | `local-hermes` |
| `HOMEPAGE_ADMIN_TOKEN` | 站长后台口令，机器人通常不需要 | 仅部署和人工登录使用 |
| `HOMEPAGE_ADMIN_SLUG` | 隐藏后台入口路径，机器人通常不需要 | 仅部署和人工登录使用 |

机器人启动后，先做两步自检：

```bash
curl -sS "$HOMEPAGE_BASE_URL/api/health"
curl -sS "$HOMEPAGE_BASE_URL/api/agent/manifest"
```

`/api/agent/manifest` 会返回：

- 当前可用的全部 HTTP 端点
- 每个端点的鉴权要求
- 字段结构 `schemas`
- MCP Server 的启动方式
- MCP 工具清单
- 推荐工作流

请以 manifest 的返回内容为准；如果本文件和 manifest 冲突，以 manifest 为准。

## 2. 鉴权方式

读接口默认公开，不需要 Token。

写接口需要：

```http
Authorization: Bearer <HERMES_API_TOKEN>
Content-Type: application/json
```

注意：

- 不要把 Token 写进 URL、日志或给用户的回复里。
- 收到 `401` 时，不要反复重试，先检查 `HERMES_API_TOKEN` 是否配置正确。
- 机器人只需要 Bearer Token，不需要登录 Cookie。

## 3. HTTP API 速查

所有响应的外层结构统一为：

```json
{ "ok": true, "data": {} }
```

错误响应：

```json
{ "ok": false, "error": "错误说明" }
```

### 3.1 发现与状态

| Method | Path | Auth | 用途 |
| --- | --- | --- | --- |
| `GET` | `/api/health` | 否 | 检查站点可用性与内容统计 |
| `GET` | `/api/agent/manifest` | 否 | 获取端点、字段、MCP 配置等完整清单 |
| `GET` | `/api/agent/digest` | 否 | 获取收件箱统计和最近待整理内容 |

### 3.2 收藏

| Method | Path | Auth | 用途 |
| --- | --- | --- | --- |
| `GET` | `/api/collectibles?status=&type=&tag=&q=&limit=&offset=` | 否 | 检索收藏 |
| `POST` | `/api/agent/collect` | Bearer | 单条或批量收藏，支持按 URL 去重 |
| `POST` | `/api/agent/collect/batch` | Bearer | 批量收藏，最多 50 条 |
| `PATCH` | `/api/collectibles/:id` | Bearer | 更新标题、标签、摘要、状态、精选 |
| `DELETE` | `/api/collectibles/:id` | Bearer | 删除一条收藏 |

### 3.3 日常说说

| Method | Path | Auth | 用途 |
| --- | --- | --- | --- |
| `GET` | `/api/posts?mood=&limit=` | 否 | 读取说说 |
| `POST` | `/api/posts` | Bearer | 发布说说 |
| `PATCH` | `/api/posts/:id` | Bearer | 修改说说 |
| `DELETE` | `/api/posts/:id` | Bearer | 删除说说 |

### 3.4 地图故事

| Method | Path | Auth | 用途 |
| --- | --- | --- | --- |
| `GET` | `/api/map-stories?q=&tag=` | 否 | 读取地图故事 |
| `POST` | `/api/map-stories` | Bearer | 创建地图故事 |
| `PATCH` | `/api/map-stories/:id` | Bearer | 修改标注，或移动照片坐标 |
| `DELETE` | `/api/map-stories/:id` | Bearer | 删除地图故事 |

### 3.5 媒体与工作

| Method | Path | Auth | 用途 |
| --- | --- | --- | --- |
| `POST` | `/api/upload` | Bearer | 上传图片或 PDF，返回公开 URL |
| `GET` | `/api/works` | 否 | 读取工作展示数据 |

## 4. HTTP 调用示例

### 4.1 单条收藏

```bash
curl -sS -X POST "$HOMEPAGE_BASE_URL/api/agent/collect" \
  -H "Authorization: Bearer $HERMES_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "一篇关于注意力的文章",
    "type": "link",
    "url": "https://example.com/attention",
    "description": "为什么安静比通知更稀缺。",
    "agentSummary": "注意力不是被夺走的，而是一点点让渡出去的。",
    "tags": ["阅读", "注意力"],
    "source": "example.com",
    "status": "inbox"
  }'
```

返回重点：

```json
{
  "ok": true,
  "data": {
    "created": [{ "id": "col_xxx", "status": "inbox" }],
    "existed": [],
    "invalid": []
  }
}
```

如果 `existed` 非空，说明 URL 已存在，直接复用其中条目的 `id`，不要重复创建。

### 4.2 批量收藏

```bash
curl -sS -X POST "$HOMEPAGE_BASE_URL/api/agent/collect/batch" \
  -H "Authorization: Bearer $HERMES_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "title": "图像 A", "type": "image", "image": "/photos/photo-01.png", "tags": ["雾"] },
      { "title": "句子 B", "type": "quote", "quote": "安静是一种能力。", "tags": ["句子"] }
    ]
  }'
```

### 4.3 查询收藏

```bash
curl -sS "$HOMEPAGE_BASE_URL/api/collectibles?status=inbox&limit=20"
curl -sS "$HOMEPAGE_BASE_URL/api/collectibles?type=link&tag=%E9%98%85%E8%AF%BB&q=attention"
```

返回：

```json
{
  "ok": true,
  "data": {
    "items": [],
    "total": 10
  }
}
```

### 4.4 更新与归档

```bash
curl -sS -X PATCH "$HOMEPAGE_BASE_URL/api/collectibles/col_xxx" \
  -H "Authorization: Bearer $HERMES_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "curated",
    "agentSummary": "已阅读，建议归入「注意力」主题。",
    "tags": ["阅读", "注意力"],
    "featured": false
  }'
```

归档是把它从公开列表中隐藏，不删除数据：

```bash
curl -sS -X PATCH "$HOMEPAGE_BASE_URL/api/collectibles/col_xxx" \
  -H "Authorization: Bearer $HERMES_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "status": "archived" }'
```

### 4.5 上传本地文件

```bash
curl -sS -X POST "$HOMEPAGE_BASE_URL/api/upload" \
  -H "Authorization: Bearer $HERMES_API_TOKEN" \
  -F "file=@/absolute/path/to/photo.png"
```

返回：

```json
{ "ok": true, "data": { "url": "/uploads/1712345678-abcd1234.png" } }
```

### 4.6 发布日常说说

```bash
curl -sS -X POST "$HOMEPAGE_BASE_URL/api/posts" \
  -H "Authorization: Bearer $HERMES_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "今天把主页的接口文档整理完了。",
    "mood": "静",
    "location": "杭州",
    "images": []
  }'
```

### 4.7 地图故事标注

```bash
curl -sS -X PATCH "$HOMEPAGE_BASE_URL/api/map-stories/story_xxx" \
  -H "Authorization: Bearer $HERMES_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "雨后的山路",
    "note": "石板缝里全是水，茶树的颜色像刚被调亮过。",
    "locationName": "杭州 · 龙井村"
  }'
```

### 4.8 移动地图照片

```bash
curl -sS -X PATCH "$HOMEPAGE_BASE_URL/api/map-stories/story_xxx" \
  -H "Authorization: Bearer $HERMES_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "photo": {
      "id": "photo_xxx",
      "lat": 30.2586,
      "lng": 120.1458
    }
  }'
```

## 5. MCP Server 配置

MCP Server 文件：

```text
mcp/hermes-server.mjs
```

传输方式：`stdio`

环境变量：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `HOMEPAGE_BASE_URL` | 是 | 例如 `http://localhost:3000` |
| `HERMES_API_TOKEN` | 是 | 与主页一致，用于所有写操作 |

### 5.1 在机器人宿主中配置

```json
{
  "mcpServers": {
    "homepage": {
      "command": "node",
      "args": ["/absolute/path/to/HomePage/mcp/hermes-server.mjs"],
      "env": {
        "HOMEPAGE_BASE_URL": "http://localhost:3000",
        "HERMES_API_TOKEN": "your-hermes-token"
      }
    }
  }
}
```

### 5.2 本地手动启动

```bash
cd /path/to/HomePage
HOMEPAGE_BASE_URL=http://localhost:3000 \
HERMES_API_TOKEN=local-hermes \
npm run mcp
```

或让 Node 自动加载 `.env.local`：

```bash
npm run mcp
```

### 5.3 MCP 调用流程

机器人连接 MCP Server 后，按标准 MCP 流程执行：

```text
initialize
notifications/initialized
tools/list
tools/call
```

`tools/list` 会返回全部工具和它们的 `inputSchema`。调用时使用：

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "collect_item",
    "arguments": {
      "title": "一篇关于注意力的文章",
      "type": "link",
      "url": "https://example.com/attention",
      "tags": ["阅读", "注意力"]
    }
  }
}
```

其他工具同理，只替换 `name` 和 `arguments`。

## 6. MCP 工具与 HTTP API 对照

| MCP 工具 | 对应 HTTP | 关键参数 | 返回 |
| --- | --- | --- | --- |
| `collect_item` | `POST /api/agent/collect` | `title`, `type`, `url`, `image`, `quote`, `description`, `agentSummary`, `tags`, `source`, `status` | `created` / `existed` / `invalid` |
| `collect_batch` | `POST /api/agent/collect/batch` | `items[]` | 同上 |
| `list_collections` | `GET /api/collectibles` | `status`, `type`, `tag`, `query`, `limit` | `items[]`, `total` |
| `update_collection` | `PATCH /api/collectibles/:id` | `id` + 任意可更新字段 | 更新后的收藏 |
| `archive_collection` | `PATCH /api/collectibles/:id` | `id` | `status = archived` |
| `create_post` | `POST /api/posts` | `content`, `mood`, `location`, `images[]` | 新说说 |
| `list_map_stories` | `GET /api/map-stories` | `query`, `tag` | `items[]`, `total` |
| `annotate_map_story` | `PATCH /api/map-stories/:id` | `id`, `title`, `note`, `date`, `locationName`, `tags[]` | 更新后的地图故事 |
| `move_map_photo` | `PATCH /api/map-stories/:id` | `storyId`, `photoId`, `lat`, `lng` | 更新后的地图故事 |
| `upload_media` | `POST /api/upload` | `filePath`（本机绝对路径） | `{ url }` |
| `daily_digest` | `GET /api/agent/digest` | 无 | 收件箱统计与最近条目 |

## 7. 常见任务的标准调用顺序

### 把一条内容丢进主页

```text
1. 如果内容里有本地图片：先调用 upload_media，拿到 URL
2. 调用 collect_item，默认 status=inbox，collectedBy=hermes
3. 如果返回 existed 非空，不要重复创建
4. 向用户汇报：新建了 1 条，还是已存在
```

### 整理收件箱

```text
1. 调用 daily_digest 或 list_collections(status=inbox)
2. 对每条内容阅读并生成 agentSummary
3. 调用 update_collection 写入摘要、标签和 status
4. 只把真正完整的内容设为 curated
5. 明显无价值的用 archive_collection 归档
6. 汇报 created / existed / curated / archived / inbox_left
```

### 发布今日总结

```text
1. 先调用 daily_digest，获取今天的收藏和处理记录
2. 生成不超过 300 字的克制总结
3. 调用 create_post 发布，mood 可选，images 可选
```

### 给地图照片做标注

```text
1. 调用 list_map_stories 找到目标故事 id 和照片 id
2. 调用 annotate_map_story 写文字标注
3. 如需移动照片，调用 move_map_photo 更新 lat / lng
4. 每次只改一个故事，改完返回结果确认
```

## 8. 错误处理

| 状态码 | 含义 | 机器人应该做什么 |
| --- | --- | --- |
| `400` | 字段校验失败 | 根据 `error` 修正请求，不要重试原参数 |
| `401` | Token 缺失或错误 | 检查 `HERMES_API_TOKEN`，停止重试并告知用户 |
| `404` | 目标 id 不存在 | 重新查询列表，确认 id |
| `413` | 文件超过 8MB | 压缩文件或分片，不要重复上传 |
| `415` | 文件类型不支持 | 转成 jpg / png / webp / gif / avif / pdf |
| `500` | 服务端错误 | 指数退避最多重试 3 次，仍失败则汇报 |

## 9. 必须遵守的边界

1. 机器人只能通过 API 或 MCP 操作数据，不能直接修改 `data/*.json`。
2. 写操作必须带 `Authorization: Bearer`，不要把 Token 输出给用户。
3. 新收藏默认 `status=inbox`、`collectedBy=hermes`，不要直接设为 `curated`。
4. 删除、公开私人内容、修改已有重要内容前，必须先向用户确认。
5. 不重复创建同 URL 的收藏；优先使用接口的去重能力。
6. 不确定字段含义时，先读 `/api/agent/manifest`。
7. 私有内容不主动外传，不把私人照片或路径写进公开摘要。

## 10. 最短可用清单

如果机器人只能记住五件事：

1. 地址来自 `HOMEPAGE_BASE_URL`。
2. 写操作带 `Authorization: Bearer $HERMES_API_TOKEN`。
3. 先读 `/api/agent/manifest`，再决定调用哪个端点。
4. MCP 就在 `mcp/hermes-server.mjs`，stdio 传输，工具名见第 6 节。
5. 默认进 `inbox`，删除前先确认。
