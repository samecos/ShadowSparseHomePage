#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

const BASE_URL = (process.env.HOMEPAGE_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const TOKEN = process.env.HERMES_API_TOKEN ?? '';

const typeEnum = ['link', 'image', 'quote', 'moment', 'file'];
const statusEnum = ['inbox', 'curated', 'archived'];

const toolDefinitions = [
  {
    name: 'collect_item',
    description:
      '把一条新发现收藏进「有趣的搜集」。支持链接、图像、句子、声音/时刻和文件，默认进入收件箱。',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '收藏标题' },
        type: { type: 'string', enum: typeEnum, description: '收藏类型' },
        url: { type: 'string', description: '原始链接，link/file 类型使用' },
        image: { type: 'string', description: '图片地址，image 类型使用' },
        quote: { type: 'string', description: '句子原文，quote 类型使用' },
        description: { type: 'string', description: '人工或 Agent 的说明' },
        agentSummary: { type: 'string', description: '一句话 Agent 摘要' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签' },
        source: { type: 'string', description: '来源名称' },
        status: { type: 'string', enum: statusEnum, description: '默认 inbox' },
        collectedBy: { type: 'string', enum: ['me', 'hermes', 'unknown'], description: '默认 hermes' }
      },
      required: ['title', 'type'],
      additionalProperties: false
    }
  },
  {
    name: 'collect_batch',
    description: '批量收藏 1-50 条内容，自动按 URL 去重。适合一次整理多个链接。',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          minItems: 1,
          maxItems: 50,
          items: { type: 'object' }
        }
      },
      required: ['items'],
      additionalProperties: false
    }
  },
  {
    name: 'list_collections',
    description: '检索收藏。可以按状态、类型、标签或关键词筛选。',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: statusEnum },
        type: { type: 'string', enum: typeEnum },
        tag: { type: 'string' },
        query: { type: 'string' },
        limit: { type: 'number', description: '默认 20，最大 100' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'update_collection',
    description: '更新一条收藏的标题、标签、摘要、状态或精选标记。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        agentSummary: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        status: { type: 'string', enum: statusEnum },
        featured: { type: 'boolean' }
      },
      required: ['id'],
      additionalProperties: false
    }
  },
  {
    name: 'archive_collection',
    description: '把一条收藏归档，保留数据但不再出现在公开列表。',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false
    }
  },
  {
    name: 'create_post',
    description: '以站长身份发布一条日常说说。可用于 Agent 生成日常总结。',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '说说正文' },
        mood: { type: 'string' },
        location: { type: 'string' },
        images: { type: 'array', items: { type: 'string' } }
      },
      required: ['content'],
      additionalProperties: false
    }
  },
  {
    name: 'list_map_stories',
    description: '读取地图故事，可按关键词或标签筛选。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        tag: { type: 'string' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'annotate_map_story',
    description: '修改一段地图故事的文字标注、标题、日期或地点。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        note: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        locationName: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['id'],
      additionalProperties: false
    }
  },
  {
    name: 'move_map_photo',
    description: '移动地图上某张照片的精确位置。',
    inputSchema: {
      type: 'object',
      properties: {
        storyId: { type: 'string' },
        photoId: { type: 'string' },
        lat: { type: 'number' },
        lng: { type: 'number' }
      },
      required: ['storyId', 'photoId', 'lat', 'lng'],
      additionalProperties: false
    }
  },
  {
    name: 'upload_media',
    description: '上传本地图片或 PDF 到主页，返回可访问 URL。需要 MCP 服务与文件在同一台机器。',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: '本地文件的绝对路径或相对路径' }
      },
      required: ['filePath'],
      additionalProperties: false
    }
  },
  {
    name: 'daily_digest',
    description: '读取收件箱统计和最近待整理内容，生成适合继续策展的上下文。',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  }
];

async function apiRequest(endpoint, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.ok === false) {
    const message = payload?.error ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload?.data ?? payload;
}

const mimeTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.pdf': 'application/pdf'
};

async function uploadLocalFile(filePath) {
  const absolute = path.resolve(filePath);
  const extension = path.extname(absolute).toLowerCase();
  const mime = mimeTypes[extension];
  if (!mime) throw new Error('暂不支持这种文件格式。');

  const bytes = await readFile(absolute);
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime }), path.basename(absolute));
  const response = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {},
    body: form
  });
  const payload = await response.json();
  if (response.ok === false) throw new Error(payload.error ?? '上传失败。');
  return payload.data;
}

function textResult(data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: 'text', text }] };
}

async function handleTool(name, args) {
  switch (name) {
    case 'collect_item':
      return apiRequest('/api/agent/collect', { method: 'POST', body: JSON.stringify(args) });
    case 'collect_batch':
      return apiRequest('/api/agent/collect/batch', { method: 'POST', body: JSON.stringify(args) });
    case 'list_collections': {
      const params = new URLSearchParams();
      if (args.status) params.set('status', args.status);
      if (args.type) params.set('type', args.type);
      if (args.tag) params.set('tag', args.tag);
      if (args.query) params.set('q', args.query);
      params.set('limit', String(Math.min(Number(args.limit) || 20, 100)));
      return apiRequest(`/api/collectibles?${params.toString()}`);
    }
    case 'update_collection':
      return apiRequest(`/api/collectibles/${args.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: args.title,
          description: args.description,
          agentSummary: args.agentSummary,
          tags: args.tags,
          status: args.status,
          featured: args.featured
        })
      });
    case 'archive_collection':
      return apiRequest(`/api/collectibles/${args.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'archived' })
      });
    case 'create_post':
      return apiRequest('/api/posts', { method: 'POST', body: JSON.stringify(args) });
    case 'list_map_stories': {
      const params = new URLSearchParams();
      if (args.tag) params.set('tag', args.tag);
      if (args.query) params.set('q', args.query);
      return apiRequest(`/api/map-stories?${params.toString()}`);
    }
    case 'annotate_map_story':
      return apiRequest(`/api/map-stories/${args.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: args.title,
          note: args.note,
          date: args.date,
          locationName: args.locationName,
          tags: args.tags
        })
      });
    case 'move_map_photo':
      return apiRequest(`/api/map-stories/${args.storyId}`, {
        method: 'PATCH',
        body: JSON.stringify({ photo: { id: args.photoId, lat: args.lat, lng: args.lng } })
      });
    case 'upload_media':
      return uploadLocalFile(args.filePath);
    case 'daily_digest': {
      const digest = await apiRequest('/api/agent/digest');
      return {
        ...digest,
        instruction:
          '优先处理 inbox 中的条目：阅读、摘要、打标签，然后决定 archive 或 curated。'
      };
    }
    default:
      throw new Error(`未知工具：${name}`);
  }
}

const server = new Server(
  { name: 'homepage-hermes', version: '1.0.0' },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefinitions }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments ?? {};
  try {
    const result = await handleTool(name, args);
    return textResult(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { isError: true, content: [{ type: 'text', text: `工具执行失败：${message}` }] };
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'homepage://profile',
      name: '个人主页说明',
      description: '站点定位、四个模块和内容边界。',
      mimeType: 'text/markdown'
    },
    {
      uri: 'homepage://collections/recent',
      name: '最近收藏',
      description: '最近 10 条收藏，适合开始一天的策展。',
      mimeType: 'application/json'
    }
  ]
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri === 'homepage://profile') {
    const text = [
      '# 个人主页',
      '',
      '四个长期模块：日常说说、地图故事、工作展示、有趣的搜集。',
      '',
      '语气：清冷、克制、真诚，不使用营销感叹句。',
      '边界：私人照片和未公开内容不主动外传；写操作前确认目标 id。',
      '收藏原则：宁缺毋滥，每条收藏都要能回答「它未来会被用在哪里」。'
    ].join('\n');
    return { contents: [{ uri: request.params.uri, mimeType: 'text/markdown', text }] };
  }

  if (request.params.uri === 'homepage://collections/recent') {
    const data = await apiRequest('/api/collectibles?limit=10');
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2)
        }
      ]
    };
  }

  throw new Error(`未知资源：${request.params.uri}`);
});

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: 'hermes_curator',
      description: '生成一次针对「有趣的搜集」的策展流程。',
      arguments: [
        { name: 'focus', description: '今天的策展主题，例如「安静 / 注意力」', required: false }
      ]
    }
  ]
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const focus = request.params.arguments?.focus ?? '自由主题';
  return {
    description: `HERMES 策展：${focus}`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            `请以 HERMES 的身份，进行一次关于「${focus}」的策展。`,
            '',
            '步骤：',
            '1. 调用 daily_digest 查看收件箱。',
            '2. 对每条内容阅读、去重、写一句 Agent 摘要并打标签。',
            '3. 适合公开的移到 curated，不适合的 archive。',
            '4. 如果发现与旧收藏的关联，在 agentSummary 中说明。',
            '5. 最后用 3 句话汇报本次处理结果，语气保持克制。'
          ].join('\n')
        }
      }
    ]
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
