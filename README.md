<div align="center">
  <img src="docs/readme/banner.svg" alt="疏影渡 · 常记溪亭日暮，兴尽晚回舟，误入藕花深处" width="960" />
  <img src="docs/readme/meta.svg" alt="Next.js · TypeScript · MapTiler · HERMES MCP" width="960" />
</div>

## <img src="docs/readme/sprout.svg" width="20" alt="" /> 模块一览

<div align="center">
  <img src="docs/readme/modules.svg" alt="六盏荷花灯顺着小河漂:01 日常说说、02 照片、03 地图故事、04 工作展示、05 有趣的搜集、06 旅行" width="680" />
</div>

- **01 · 日常说说** —— 参考轻博客的时间流，支持心情、地点、图片和置顶。
- **02 · 照片** —— 比照 iCloud 相册的图库体验：按时间、人物、地区自动分类，密度缩放、多选整理、收藏、灯箱与信息补写；上传时自动读取 EXIF 的拍摄时间与 GPS，并按坐标归入城市。
- **03 · 地图故事** —— 照片落在真实坐标上，可以拖动照片、编辑文字标注、添加或删除照片。
- **04 · 工作展示** —— 项目列表 + 独立子页面，包含角色、指标和完整案例叙事。
- **05 · 有趣的搜集** —— 由 HERMES 通过 API / MCP / SKILL 接管：先入收件箱，再去重、摘要、打标签和归位。
- **06 · 旅行** —— 以提前规划为主，集中管理行程、清单和私有预订材料，并为途中记录与旅行回顾留出位置。

## <img src="docs/readme/sprout.svg" width="20" alt="" /> 视觉方向

<div align="center">
  <img src="docs/readme/palette.svg" alt="冷灰蓝 #658092 · 雾白 #F6F7F8 · 墨色 #191D22 · 深灰蓝 #3F586A" width="760" />
</div>

- 低饱和照片，充足留白
- 细线、极轻的玻璃质感、很少但必要的动效
- 中文标题使用宋体衬线，正文使用系统无衬线
- 不做数据大屏，不做卡片堆叠，不做强渐变

## <img src="docs/readme/sprout.svg" width="20" alt="" /> 快速开始

```bash
npm install
npm run dev
```

打开 <http://localhost:3000>。

> 本地开发默认口令已经写在 `.env.local`：默认访客模式下，页面不展示登录或后台入口；后台口令为 `local-admin`，HERMES Token 为 `local-hermes`。部署前请修改 `.env.local` 或平台环境变量，参考 `.env.example`。

<details>
<summary><b>隐藏登录入口怎么生成？</b></summary>

隐藏登录地址由 `HOMEPAGE_ADMIN_SLUG` 决定，形如 `http://localhost:3000/<随机字符串>`，请使用只有你知道的随机值：

```bash
node -e "console.log(require('crypto').randomBytes(8).toString('hex'))"
```

把输出填到 `.env.local` 或部署平台的 `HOMEPAGE_ADMIN_SLUG`，然后访问
`https://你的域名/<HOMEPAGE_ADMIN_SLUG>` 登录。`/login` 等猜测性地址不会再出现登录页。

</details>

## <img src="docs/readme/sprout.svg" width="20" alt="" /> 地图底图

地图组件使用 [MapTiler Cloud](https://cloud.maptiler.com/)：

- 默认加载 `satellite-v4` 鸟瞰卫星影像，地图上方可切换 `base-v4`（Base 地图）
- 按 MapTiler 官方 Leaflet 接入方式使用 512px 瓦片（`tileSize: 512` + `zoomOffset: -1`）
- Key 不直接暴露给浏览器：浏览器不允许 JavaScript 自定义 `User-Agent`，因此瓦片统一通过
  `/api/map-tiles/*` 服务端代理请求，并由代理发送你在 MapTiler 控制台配置的
  `Allowed user-agent header`

<details>
<summary><b>配置与注意事项</b></summary>

在 `.env.local` 中配置：

```bash
MAPTILER_KEY=你的_MAPTILER_API_KEY
MAPTILER_USER_AGENT=personal-homepage-maptiler/1.0
```

- `MAPTILER_USER_AGENT` 必须和 MapTiler 控制台 API key 的
  **Allowed user-agent header** 字段完全一致（区分大小写）。
- 如果 key 同时启用了 **Allowed HTTP origins**，代理会把当前页面的 `Referer` 转发给 MapTiler；此时需要把
  `http://localhost:3000`、生产域名等实际访问地址都加入该列表（两者是 AND 关系）。
- 默认底图可通过 `NEXT_PUBLIC_MAP_DEFAULT_LAYER=base` 改为 Base 地图；页面上方仍然可以手动切换。
- 如需使用自己在 MapTiler 创建的地图样式，可额外配置 `MAPTILER_SATELLITE_MAP_ID` 与
  `MAPTILER_BASE_MAP_ID`。

</details>

## <img src="docs/readme/sprout.svg" width="20" alt="" /> 数据存储

当前使用 JSON 文件，开箱即用：

| 文件 | 内容 |
|------|------|
| `data/posts.json` | 日常说说 |
| `data/photos.json` | 照片 |
| `data/faces.json` / `data/people.json` | 相册人物聚类：人脸实例与人物，仅管理员可见 |
| `data/admin-regions.json` | 城市级行政区划边界，由 `npm run build:regions` 生成 |
| `data/uploads.json` | 本地人工上传照片的元数据，默认被 `.gitignore` 忽略，不会进入开源仓库 |
| `data/map-stories.json` | 地图故事 |
| `data/works.json` | 工作展示 |
| `data/collectibles.json` | 有趣的搜集 |
| `data/trips.json` | 旅行行程 |
| `data/trip-attachments.json` | 旅行附件元数据；文件存储在私有目录，不进入公开资源 |
| `public/uploads/` | 上传文件（默认被 `.gitignore` 忽略） |

数据层集中在 `src/lib/storage.ts`，未来可以平滑替换为 SQLite、Postgres 或对象存储。

## <img src="docs/readme/sprout.svg" width="20" alt="" /> HERMES 接入

### 1 · HTTP API

```bash
curl -X POST http://localhost:3000/api/agent/collect \
  -H "Authorization: Bearer $HERMES_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"一篇好文章","type":"link","url":"https://example.com","tags":["阅读"]}'
```

Manifest：`GET /api/agent/manifest`，包含完整端点、MCP 工具和字段说明。

### 2 · MCP Server

```bash
npm run mcp
```

<details>
<summary><b>MCP 配置示例</b></summary>

```json
{
  "mcpServers": {
    "homepage": {
      "command": "node",
      "args": ["/path/to/HomePage/mcp/hermes-server.mjs"],
      "env": {
        "HOMEPAGE_BASE_URL": "http://localhost:3000",
        "HERMES_API_TOKEN": "your-hermes-token"
      }
    }
  }
}
```

</details>

### 3 · SKILL

- `agent/SKILL.md`：**机器人接入契约**。写清楚 API 地址、鉴权方式、全部端点、请求与返回示例、MCP 启动配置、工具参数、错误处理和标准调用顺序。
- `agent/skill.manifest.json`：同一份契约的机器可读版本，包含 `http.endpoints`、`mcp.tools`、`inputSchema` 和 workflows。
- `agent/HERMES.md`：Agent 的身份、语气和内容边界。

推荐机器人按这个顺序工作：

1. 读取 `GET /api/agent/manifest`
2. 能用 MCP 就调用 MCP 工具，不能用就调用对应 HTTP API
3. 写操作带 `Authorization: Bearer $HERMES_API_TOKEN`
4. 按 manifest 里的 schemas 校验参数

## <img src="docs/readme/sprout.svg" width="20" alt="" /> 常用命令

| 命令 | 用途 |
|------|------|
| `npm run dev` | 开发 |
| `npm run build` | 生产构建 |
| `npm run start` | 生产运行 |
| `npm run mcp` | 启动 MCP Server |
| `npm run generate:media` | 重新生成占位抽象图 |
| `npm run build:regions` | 重建行政区划边界数据 |
| `npm run setup:faces` | 拷贝人脸识别模型到 `public/models/` |

## <img src="docs/readme/sprout.svg" width="20" alt="" /> 目录结构

```text
src/
  app/                  Next.js 页面与 API
  components/           导航、图标、地图、相册等共享组件
  lib/                  类型、存储、鉴权、校验、地区反查与人脸聚类
data/                   JSON 数据
mcp/                    MCP Server
agent/                  Hermes 身份、SKILL 与机器清单
docs/                   API 与 MCP 文档
public/photos/          抽象占位图，可直接替换为自己的照片
```

## <img src="docs/readme/sprout.svg" width="20" alt="" /> 部署提醒

- JSON 文件存储适合个人服务器和本地；部署到 Vercel 等无状态平台时请换成数据库 / 对象存储。
- `public/uploads` 在无状态平台上同样需要替换为 S3、R2 或 OSS。
- 生产环境必须修改 `HOMEPAGE_ADMIN_TOKEN`、`HOMEPAGE_SESSION_SECRET`、`HOMEPAGE_ADMIN_SLUG` 和 `HERMES_API_TOKEN`。
- `HOMEPAGE_ADMIN_SLUG` 只配置在服务端，不会出现在前端构建或页面链接中。

---

<div align="center">
  <img src="docs/readme/divider.svg" alt="" width="360" />
  <br/>
  <sub>疏影渡 · 误入藕花深处，惊起一滩可爱 ✦</sub>
</div>
