import { site } from './site';

export function createHomepageManifest(origin: string) {
  const base = origin.replace(/\/$/, '');
  return {
    name: '个人主页 · Agent 接入契约',
    version: '2.0.0',
    description: '给个人机器人使用的 HTTP API 与 MCP Server 发现清单。',
    baseUrl: base,
    auth: {
      type: 'bearer',
      header: 'Authorization: Bearer <HERMES_API_TOKEN>',
      tokenEnv: 'HERMES_API_TOKEN'
    },
    usage: {
      firstStep: 'GET /api/agent/manifest',
      secondStep: 'MCP 可用时优先调用 MCP 工具；否则调用 HTTP API。',
      responseEnvelope: {
        success: '{ ok: true, data: any }',
        error: '{ ok: false, error: string }'
      }
    },
    endpoints: [
      { method: 'GET', path: '/api/health', auth: false, description: '检查站点可用性与内容统计。' },
      { method: 'GET', path: '/api/agent/manifest', auth: false, description: '读取本契约：端点、schemas 与 MCP 工具清单。' },
      { method: 'GET', path: '/api/agent/digest', auth: false, description: '读取收件箱统计与最近需要整理的内容。' },
      { method: 'GET', path: '/api/collectibles', auth: false, query: ['status', 'type', 'tag', 'q', 'limit', 'offset'], description: '检索和筛选你的收藏。' },
      { method: 'POST', path: '/api/agent/collect', auth: true, description: '单条或批量写入收藏，支持按 URL 去重，默认放入收件箱。' },
      { method: 'POST', path: '/api/agent/collect/batch', auth: true, description: '批量写入收藏，最多 50 条。' },
      { method: 'PATCH', path: '/api/collectibles/:id', auth: true, description: '修改收藏内容、标签、状态或特色标记。' },
      { method: 'DELETE', path: '/api/collectibles/:id', auth: true, description: '删除一条收藏。' },
      { method: 'POST', path: '/api/upload', auth: true, contentType: 'multipart/form-data', description: '上传图片或 PDF，返回可公开访问的 URL。' },
      { method: 'GET', path: '/api/posts', auth: false, query: ['mood', 'limit'], description: '读取日常说说。' },
      { method: 'POST', path: '/api/posts', auth: true, description: '以站长身份发布一条日常说说。' },
      { method: 'PATCH', path: '/api/posts/:id', auth: true, description: '修改一条日常说说。' },
      { method: 'DELETE', path: '/api/posts/:id', auth: true, description: '删除一条日常说说。' },
      { method: 'GET', path: '/api/map-stories', auth: false, query: ['q', 'tag'], description: '读取地图故事。' },
      { method: 'POST', path: '/api/map-stories', auth: true, description: '创建一段地图故事。' },
      { method: 'PATCH', path: '/api/map-stories/:id', auth: true, description: '更新地图标注，或移动某张照片的坐标。' },
      { method: 'DELETE', path: '/api/map-stories/:id', auth: true, description: '删除一段地图故事。' },
      { method: 'GET', path: '/api/photos', auth: false, query: ['q', 'tag', 'favorite'], description: '读取照片库；访客只返回公开且未删除的照片。' },
      { method: 'POST', path: '/api/photos', auth: true, description: '登记一张照片，url 需先通过 /api/upload 获得。' },
      { method: 'PATCH', path: '/api/photos/:id', auth: true, description: '修改照片标题、时间、地点、坐标、标签、收藏或可见性。lat/lng 传 null 可清除坐标。' },
      { method: 'DELETE', path: '/api/photos/:id', auth: true, description: '两段式删除：第一次进入回收站，回收站内再删则彻底清除。' },
      { method: 'POST', path: '/api/photos/batch', auth: true, description: '批量收藏、取消收藏、回收、恢复或彻底删除，body 为 { action, ids }。' },
      { method: 'GET', path: '/api/works', auth: false, description: '读取工作展示数据。' }
    ],
    schemas: {
      Collectible: {
        type: 'object',
        required: ['title', 'type', 'tags', 'collectedBy', 'status'],
        properties: {
          title: { type: 'string', maxLength: 140 },
          type: { type: 'string', enum: ['link', 'image', 'quote', 'moment', 'file'] },
          url: { type: 'string', format: 'uri' },
          image: { type: 'string' },
          quote: { type: 'string', maxLength: 2000 },
          description: { type: 'string', maxLength: 3000 },
          agentSummary: { type: 'string', maxLength: 1000 },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 12 },
          source: { type: 'string', maxLength: 120 },
          collectedBy: { type: 'string', enum: ['me', 'hermes', 'unknown'] },
          status: { type: 'string', enum: ['inbox', 'curated', 'archived'] },
          featured: { type: 'boolean' }
        }
      },
      CollectBatch: {
        type: 'object',
        required: ['items'],
        properties: {
          items: { type: 'array', minItems: 1, maxItems: 50, items: { $ref: '#/schemas/Collectible' } }
        }
      },
      MapStoryPatch: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          note: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          locationName: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          photos: { type: 'array', items: { type: 'object' } },
          photo: {
            type: 'object',
            required: ['id', 'lat', 'lng'],
            properties: {
              id: { type: 'string' },
              lat: { type: 'number', minimum: -90, maximum: 90 },
              lng: { type: 'number', minimum: -180, maximum: 180 }
            }
          }
        }
      },
      PostCreate: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string' },
          mood: { type: 'string' },
          location: { type: 'string' },
          images: { type: 'array', items: { type: 'string' } },
          visibility: { type: 'string', enum: ['public', 'private'] },
          pinned: { type: 'boolean' }
        }
      },
      PhotoCreate: {
        type: 'object',
        required: ['url', 'date'],
        properties: {
          url: { type: 'string', description: '/api/upload 返回的图片地址' },
          title: { type: 'string', maxLength: 120 },
          date: { type: 'string', description: '拍摄时间，ISO 8601' },
          locationName: { type: 'string', maxLength: 120 },
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lng: { type: 'number', minimum: -180, maximum: 180 },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 12 },
          favorite: { type: 'boolean' },
          visibility: { type: 'string', enum: ['public', 'private'] },
          width: { type: 'number' },
          height: { type: 'number' },
          size: { type: 'number' },
          mimeType: { type: 'string' }
        }
      },
      PhotoBatch: {
        type: 'object',
        required: ['action', 'ids'],
        properties: {
          action: { type: 'string', enum: ['favorite', 'unfavorite', 'trash', 'restore', 'purge'] },
          ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 500 }
        }
      }
    },
    mcp: {
      server: 'mcp/hermes-server.mjs',
      transport: 'stdio',
      command: 'node',
      args: ['/absolute/path/to/HomePage/mcp/hermes-server.mjs'],
      env: {
        HOMEPAGE_BASE_URL: base,
        HERMES_API_TOKEN: '<HERMES_API_TOKEN>'
      },
      hostConfig: {
        mcpServers: {
          homepage: {
            command: 'node',
            args: ['/absolute/path/to/HomePage/mcp/hermes-server.mjs'],
            env: {
              HOMEPAGE_BASE_URL: base,
              HERMES_API_TOKEN: '<HERMES_API_TOKEN>'
            }
          }
        }
      },
      lifecycle: ['initialize', 'notifications/initialized', 'tools/list', 'tools/call'],
      tools: [
        { name: 'collect_item', http: 'POST /api/agent/collect', description: '收藏一条内容，默认进入 inbox。' },
        { name: 'collect_batch', http: 'POST /api/agent/collect/batch', description: '批量收藏，最多 50 条。' },
        { name: 'list_collections', http: 'GET /api/collectibles', description: '检索收藏。' },
        { name: 'update_collection', http: 'PATCH /api/collectibles/:id', description: '更新收藏字段。' },
        { name: 'archive_collection', http: 'PATCH /api/collectibles/:id', description: '归档收藏。' },
        { name: 'create_post', http: 'POST /api/posts', description: '发布日常说说。' },
        { name: 'list_map_stories', http: 'GET /api/map-stories', description: '读取地图故事。' },
        { name: 'annotate_map_story', http: 'PATCH /api/map-stories/:id', description: '修改地图文字标注。' },
        { name: 'move_map_photo', http: 'PATCH /api/map-stories/:id', description: '移动地图照片坐标。' },
        { name: 'upload_media', http: 'POST /api/upload', description: '上传本机图片或 PDF。' },
        { name: 'daily_digest', http: 'GET /api/agent/digest', description: '读取收件箱策展摘要。' }
      ],
      resources: ['homepage://profile', 'homepage://collections/recent'],
      prompts: ['hermes_curator']
    },
    skill: {
      name: 'hermes-homepage-api-mcp',
      version: '2.0.0',
      path: 'agent/SKILL.md',
      identity: 'agent/HERMES.md',
      manifest: 'agent/skill.manifest.json',
      purpose: '让机器人知道主页 HTTP API 和 MCP Server 的发现、鉴权与调用方式。',
      useWhen: ['需要写入收藏', '需要整理收件箱', '需要发布说说', '需要修改地图标注'],
      steps: [
        '读取 GET /api/agent/manifest',
        'MCP 可用时优先调用同名工具；否则调用对应 HTTP 端点',
        '写操作携带 Authorization: Bearer <HERMES_API_TOKEN>',
        '按 schemas 校验字段，默认 status=inbox、collectedBy=hermes'
      ]
    },
    site: {
      name: site.name,
      owner: site.role,
      collection: `${base}/collection`,
      hermesConsole: `${base}/collection/hermes`
    }
  };
}
