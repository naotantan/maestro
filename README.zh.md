# maestro — 让 AI 智能体真正可靠运行的平台

[日本語](./README.md) | [English](./README.en.md) | **中文**

## maestro 是什么？

"我们开始在工作中使用 Claude、Gemini 这样的 AI，但宕机了只能手动重启，回过神来 API 账单已经爆了……"

maestro 是专为解决这些问题而生的开源后端。

它做的事情很简单：自动化 AI 智能体的**启动、监控、停止和成本管理**。可以把它理解为 **AI 智能体的运维管理工具**。

---

## 解决哪些问题？

| 常见痛点 | maestro 的解决方案 |
|---|---|
| AI 宕机无人察觉 | 每 30 秒进行健康检查，宕机后自动重启（最多重试 3 次） |
| API 账单意外飙升 | 设置月度预算上限，超出即刻自动停止智能体 |
| 不知道谁执行了什么 | 所有操作均记录带时间戳的日志（支持审计） |
| 任务分配全靠手动 | 注册任务后自动分配给空闲智能体 |
| 关键操作不敢完全交给 AI | 可为敏感操作设置"需要人工审批"的门控 |
| 想与 Slack 或 GitHub 集成 | 配置 Webhook 即可，无需编写代码 |

---

## 支持的 AI 模型

maestro 通过**适配器**机制支持多种 AI 模型。`packages/adapters/src/` 中提供了以下适配器：

| 适配器 | 说明 |
|---|---|
| `claude-api` | 通过 Anthropic API 使用 Claude |
| `claude-local` | 使用本地 Claude（如 Claude Code） |
| `codex-local` | 本地运行 OpenAI Codex |
| `gemini-local` | 本地运行 Google Gemini |
| `cursor` | 与 Cursor 编辑器集成 |
| `opencode-local` | 本地运行 OpenCode |
| `openclaw-gateway` | 通过 OpenClaw 网关使用 |
| `pi-local` | 本地运行 Pi |

可从 Web 控制台切换模型，无需修改代码。

---

## 系统架构

maestro 采用 Monorepo 结构，分为 7 个包。

```
maestro/
├── packages/
│   ├── api/          ← REST API 服务器（Express.js）★ 主后端
│   │   └── src/
│   │       ├── engine/
│   │       │   ├── heartbeat-engine.ts   … 每 30 秒进行存活检测
│   │       │   ├── crash-recovery.ts     … 检测崩溃 → 自动重启
│   │       │   └── budget-monitor.ts     … 超出预算 → 自动停止
│   │       ├── routes/                   … 16 个 REST 端点
│   │       ├── middleware/               … 认证与请求日志
│   │       └── server.ts                 … Express 应用初始化
│   ├── cli/          ← 命令行工具（17 个命令）
│   ├── ui/           ← Web 控制台（React + Vite）
│   ├── db/           ← 数据库定义与迁移（Drizzle ORM）
│   ├── adapters/     ← AI 模型适配器（8 种）
│   ├── shared/       ← 公共类型定义与工具函数
│   └── i18n/         ← 国际化（日语、英语、中文）
├── docker-compose.yml
└── package.json
```

---

## 三大核心引擎

maestro 的核心位于 `packages/api/src/engine/`。

### 1. 心跳引擎（heartbeat-engine.ts）

**功能：** 每 30 秒向所有启用的智能体发送"你还活着吗？"的检查。

**执行流程：**

1. 从数据库获取所有 `enabled: true` 的智能体列表
2. 通过适配器并行执行健康检查（最多 3 个并发）
3. 有响应 → 更新 `last_heartbeat_at`
4. 无响应 → 将 `agent_runtime_state` 设置为 `crashed`（由崩溃恢复引擎接管）
5. 同时处理待处理的智能体间交接（handoff）

### 补充：智能体交接（handoff）与链式调用

心跳引擎还负责在任务完成时将工作传递给下一个智能体。

- **1 对 1 交接**：智能体 A 完成 → 将输出传递给智能体 B 继续处理
- **链式调用（A→B→C）**：将多个智能体串联成流水线依次执行

设计规范请参阅 `docs/handoff/` 和 `docs/chain/`。

### 2. 崩溃恢复引擎（crash-recovery.ts）

**功能：** 每 60 秒查找崩溃的智能体并自动恢复。

**执行流程：**

1. 在 `agent_runtime_state` 表中查找 `status: crashed` 的记录
2. 重启次数 < 3 → 将状态重置为 `idle`（下次心跳时重新执行）
3. 重启次数达到 3 次 → 禁用并停止该智能体（防止无限循环）

### 3. 预算监控器（budget-monitor.ts）

**功能：** 每 60 秒检查各租户（公司）的当月成本。

**执行流程：**

1. 获取所有预算策略
2. 汇总当月累计成本
3. 超出上限 → 自动停止该公司的所有智能体
4. 在 `budget_incidents` 表中记录事件

---

## CLI 命令一览

`packages/cli/src/commands/` 中实现了 17 个命令（`backup` 包含 `create` 和 `list` 两个子命令）。

| 命令 | 功能 |
|---|---|
| `init` | 项目初始化 |
| `login` | 登录 API 服务器 |
| `register` | 注册新用户 |
| `org` | 管理组织（租户） |
| `project` | 创建和列出项目 |
| `agent` | 添加、列出、启用、禁用智能体 |
| `goal` | 设置目标并跟踪进度 |
| `issue` | 创建和管理问题 |
| `routine` | 设置定期任务 |
| `approval` | 查看、审批、拒绝待处理任务 |
| `costs` | 查看成本历史 |
| `plugin` | 添加和管理插件 |
| `backup create` | 创建 SQL 转储（`--output <path>` 指定保存位置） |
| `backup list` | 列出现有备份 |
| `doctor` | 检查环境健康状态 |
| `update` | 更新 maestro 本身 |
| `uninstall` | 卸载 maestro |
| `ui` | 启动 Web 控制台 |

---

## API 端点一览

REST API 支持 16 个资源（Bearer Token 认证）。

| 端点 | 作用 |
|---|---|
| `/health` | 健康检查（无需认证） |
| `/auth` | 登录与 Token 签发 |
| `/org` | 组织管理 |
| `/companies` | 租户（公司）管理 |
| `/agents` | 智能体 CRUD |
| `/tasks` | 任务创建与分配 |
| `/issues` | 问题管理 |
| `/goals` | 目标管理 |
| `/projects` | 项目管理 |
| `/costs` | 成本数据获取 |
| `/routines` | 定期任务管理 |
| `/approvals` | 审批工作流 |
| `/activity` | 操作日志查看 |
| `/plugins` | 插件管理 |
| `/settings` | 租户设置 |
| `/handoffs` | 智能体间交接 |

---

## 快速开始（新用户指南）

### 环境要求

| 工具 | 版本 | 用途 |
|---|---|---|
| Node.js | 20 以上 | 运行服务器和 CLI |
| pnpm | 9 以上 | 包管理（替代 npm） |
| Docker & Docker Compose | 推荐最新版 | 运行 PostgreSQL 数据库 |

### 步骤

```bash
# 1. 克隆仓库
git clone https://github.com/naotantan/maestro.git
cd maestro

# 2. 安装依赖
pnpm install

# 3. 准备环境变量
cp .env.example .env.development
# → 用编辑器打开 .env.development，确认并修改 DATABASE_URL 等配置

# 4. 通过 Docker 启动 PostgreSQL
docker compose up -d

# 5. 执行数据库迁移
pnpm db:migrate

# 6. 启动 API 服务器（开发模式）
pnpm --filter @maestro/api dev
```

### 验证是否正常运行

```bash
# 健康检查（正常返回 {"status":"ok"}）
curl http://localhost:3000/health
```

### 启动 Web 控制台

```bash
# 在另一个终端启动 UI
pnpm --filter @maestro/ui dev
```

### 同时启动 API 和 UI

```bash
# 使用根目录的 dev 脚本一键启动
pnpm dev
```

### Docker 快捷命令

```bash
pnpm docker:up    # 等同于 docker compose up -d
pnpm docker:down  # 等同于 docker compose down
```

---

## 国际化支持

Web 控制台和 CLI 消息支持日语、英语和中文。通过编辑 `packages/i18n/src/locales/` 下的 JSON 文件可以添加更多语言。

---

## OpenAPI 规范

`docs/openapi.yaml` 包含所有端点的完整规范文档。可使用 Swagger UI 等工具加载，以交互方式探索 API。

---

## 安全机制

源代码中已确认的安全功能：

| 措施 | 实现方式 |
|---|---|
| HTTP 响应头保护 | Helmet.js（含 CSP） |
| 频率限制 | 全局：15 分钟 100 次请求 / 认证：15 分钟 10 次请求 |
| 认证 | Bearer Token 方式 |
| 租户隔离 | 所有查询均应用 `company_id` 过滤 |
| 加密 | AES-256-GCM（存储凭证） |
| SSRF 防护 | Webhook URL 的 DNS 解析 + 私有 IP 段检查 |
| SQL 注入防护 | Drizzle ORM 参数化查询 |
| XSS 防护 | 输入净化 + CSP 响应头 |
| 请求追踪 | 每个请求附加 `X-Request-ID` |

---

## 技术栈

| 分类 | 技术 |
|---|---|
| 语言 | TypeScript（严格模式） |
| API 服务器 | Express.js |
| 数据库 | PostgreSQL 17 |
| ORM | Drizzle ORM |
| 前端 | React + Vite |
| 包管理 | pnpm（Monorepo） |
| 测试 | Vitest |
| 容器 | Docker / Docker Compose |
| 许可证 | MIT |

---

## 参与贡献

详情请参阅 `CONTRIBUTING.md`。简要流程：

1. 从 `main` 分支创建 feature 分支
2. 实现你的修改
3. 运行 `pnpm test` 确认测试通过
4. 运行 `pnpm typecheck` 确认类型检查通过
5. 遵循 Conventional Commits 格式编写提交信息（`feat:`、`fix:`、`docs:` 等）
6. 创建 Pull Request

包的构建顺序：`shared → db → i18n → adapters → api → cli → ui`。完整构建时，`pnpm build` 会自动处理顺序。

---

## 项目简介

maestro 是一个开源平台，用于在生产环境中安全运行 Claude、Gemini、Codex 等 AI 智能体。以三大核心引擎为基础——30 秒间隔健康检查、崩溃自动恢复（最多重试 3 次）、月度预算超出自动停止——同时提供任务自动分配、人工审批门控、智能体间链式交接（handoff chain）、Webhook 集成和完整审计日志等功能。多租户设计支持多个公司和团队共享使用，可通过 REST API、CLI（17 个命令）或 Web 控制台进行操作。
