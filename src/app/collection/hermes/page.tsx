import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckIcon } from '@/components/icons';
import { createHomepageManifest } from '@/lib/manifest';
import { readCollection } from '@/lib/storage';
import type { Collectible } from '@/lib/types';
import styles from './hermes.module.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'HERMES 工作台',
  description: 'API、MCP 与 SKILL：让个人 Agent 接管有趣的搜集。'
};

const mcpConfig = `{
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
}`;

const curlExample = `curl -X POST http://localhost:3000/api/agent/collect \\
  -H "Authorization: Bearer $HERMES_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "一篇值得重读的文章",
    "type": "link",
    "url": "https://example.com/article",
    "description": "为什么静默比通知更稀缺。",
    "tags": ["阅读", "注意力"]
  }'`;

const batchExample = `curl -X POST http://localhost:3000/api/agent/collect/batch \\
  -H "Authorization: Bearer $HERMES_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "items": [
      { "title": "图像 A", "type": "image", "image": "/photos/photo-01.png", "tags": ["雾"] },
      { "title": "句子 B", "type": "quote", "quote": "安静是一种能力。", "tags": ["句子"] }
    ]
  }'`;

export default async function HermesPage() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const manifest = createHomepageManifest(origin);
  const items = await readCollection<Collectible>('collectibles');
  const hermesCount = items.filter((item) => item.collectedBy === 'hermes').length;
  const inboxCount = items.filter((item) => item.status === 'inbox').length;

  const workflow = [
    ['01', 'Capture', '把看到的链接、图、句子或文件丢进收件箱。'],
    ['02', 'Dedupe', '按 URL 与标题去重，避免重复收藏。'],
    ['03', 'Summarize', '阅读内容，写入一句 Agent 摘要。'],
    ['04', 'Tag', '自动生成标签，并与已有收藏建立关联。'],
    ['05', 'Curate', '从收件箱移至已归位，必要时设为精选。'],
    ['06', 'Feature', '在首页或合集里呈现，形成长期可用的知识。']
  ];

  return (
    <main className="main">
      <div className="shell">
        <Link className={styles.back} href="/collection">
          <ArrowRight size={13} style={{ transform: 'rotate(180deg)' }} />
          返回有趣的搜集
        </Link>

        <header className={`${styles.hero} reveal`}>
          <div>
            <p className="eyebrow">Agent workspace</p>
            <h1 className="page-title">HERMES 工作台</h1>
            <p className="page-intro">
              这一块完全交给个人 Agent：HERMES 可以通过 HTTP API 写入、通过 MCP
              调用工具；仓库里的 SKILL 则告诉机器人这些接口分别怎么用。
            </p>
          </div>
          <aside className={styles.heroStatus}>
            <div className={styles.heroStatusItem}>
              <span>Agent 收藏</span>
              <strong>{hermesCount}</strong>
            </div>
            <div className={styles.heroStatusItem}>
              <span>待整理</span>
              <strong>{inboxCount}</strong>
            </div>
            <div className={styles.heroStatusItem}>
              <span>Manifest</span>
              <strong>v{manifest.version}</strong>
            </div>
          </aside>
        </header>

        <section className={styles.capabilities}>
          <article className={styles.capability}>
            <span className={styles.capabilityIndex}>01</span>
            <h2>HTTP API</h2>
            <p>任何能发请求的 Agent 都能接入。所有写操作使用 Bearer Token，读操作保持开放。</p>
          </article>
          <article className={styles.capability}>
            <span className={styles.capabilityIndex}>02</span>
            <h2>MCP Server</h2>
            <p>stdio 传输的 MCP 服务，内置旅行规划工具，可以直接被 Hermes、Claude、Cursor 等宿主加载。</p>
          </article>
          <article className={styles.capability}>
            <span className={styles.capabilityIndex}>03</span>
            <h2>SKILL</h2>
            <p>给机器人看的接口与 MCP 使用手册，包含鉴权、端点、参数、返回结构、错误处理和调用顺序。</p>
          </article>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>API 端点</h2>
          <p className={styles.sectionHint}>Manifest 地址：/api/agent/manifest</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Auth</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {manifest.endpoints.map((endpoint) => (
                  <tr key={`${endpoint.method}-${endpoint.path}`}>
                    <td>{endpoint.method}</td>
                    <td>
                      <code>{endpoint.path}</code>
                    </td>
                    <td>{endpoint.auth ? 'Bearer' : '公开'}</td>
                    <td>{endpoint.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.twoColumns}>
            <div>
              <p className={styles.codeLabel}>Collect one</p>
              <pre className={styles.codeBlock}>{curlExample}</pre>
            </div>
            <div>
              <p className={styles.codeLabel}>Collect batch</p>
              <pre className={styles.codeBlock}>{batchExample}</pre>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>MCP 接入</h2>
          <p className={styles.sectionHint}>在宿主配置中加入：</p>
          <pre className={`${styles.codeBlock}`} style={{ marginTop: 22 }}>{mcpConfig}</pre>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>策展工作流</h2>
          <ul className={styles.workflow}>
            {workflow.map(([index, title, description]) => (
              <li key={index}>
                <span className={styles.workflowIndex}>{index}</span>
                <strong>{title}</strong>
                <p>{description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Agent 文件</h2>
          <p className={styles.sectionHint}>角色、技能和机器可读清单都在仓库中版本管理。</p>
          <div className={styles.fileList}>
            <div className={styles.fileItem}>
              agent/HERMES.md
              <span>Agent 身份、语气、边界与工作原则。</span>
            </div>
            <div className={styles.fileItem}>
              agent/SKILL.md
              <span>API 与 MCP 的完整接入说明书，机器人加载后即可正确调用。</span>
            </div>
            <div className={styles.fileItem}>
              agent/skill.manifest.json
              <span>机器可读的接口、MCP 工具与参数 schema。</span>
            </div>
          </div>
          <p style={{ marginTop: 24, color: 'var(--ink-faint)', fontSize: 12 }}>
            <CheckIcon size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            所有接口的字段结构都写进了 manifest.schemas。接口稳定，存储可替换。
          </p>
        </section>
      </div>
    </main>
  );
}
