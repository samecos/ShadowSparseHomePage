# MCP Server

`mcp/hermes-server.mjs` 是一个 stdio 传输的 MCP Server，把主页 API 封装成 Agent 可直接调用的工具。

## 启动

```bash
HOMEPAGE_BASE_URL=http://localhost:3000 \
HERMES_API_TOKEN=local-hermes \
npm run mcp
```

## 宿主配置

```json
{
  "mcpServers": {
    "homepage": {
      "command": "node",
      "args": ["/path/to/HomePage/mcp/hermes-server.mjs"],
      "env": {
        "HOMEPAGE_BASE_URL": "http://localhost:3000",
        "HERMES_API_TOKEN": "local-hermes"
      }
    }
  }
}
```

## 工具

| 工具 | 说明 |
| --- | --- |
| `collect_item` | 收藏一条链接、图像、句子、声音或文件 |
| `collect_batch` | 批量收藏，最多 50 条 |
| `list_collections` | 按状态、类型、标签、关键词检索 |
| `update_collection` | 更新标题、标签、摘要、状态和精选 |
| `archive_collection` | 归档收藏 |
| `create_post` | 发布日常说说 |
| `list_map_stories` | 读取地图故事 |
| `annotate_map_story` | 修改地图故事的标题与文字标注 |
| `move_map_photo` | 移动地图照片坐标 |
| `upload_media` | 上传本地图片或 PDF |
| `daily_digest` | 获取收件箱摘要与策展上下文 |

## 资源

- `homepage://profile`：站点定位、语气与边界
- `homepage://collections/recent`：最近 10 条收藏

## Prompt

- `hermes_curator`：生成一次完整的策展流程，可传入 `focus` 参数，例如「注意力」「排版」。

## 与 SKILL 的关系

- `agent/SKILL.md`：机器人执行手册，包含 HTTP API、MCP 工具参数、错误处理和调用顺序。
- `agent/skill.manifest.json`：同一份契约的机器可读版本。
- 运行时优先读取 `GET /api/agent/manifest`，它会返回最新的端点和 MCP 配置。
