# maestro — The platform for running AI agents properly

[日本語](./README.md) | **English** | [中文](./README.zh.md)

## What is maestro?

"We started using AI like Claude or Gemini at work, but when it crashes someone has to restart it manually, and before we know it the API bill has exploded…"

maestro is an open-source backend that solves exactly these problems.

What it does is simple: it automates the **start, monitor, stop, and cost management** of AI agents. Think of it as an **operations management tool for AI agents**.

---

## What problems does it solve?

| Common pain point | What maestro does |
|---|---|
| AI crashes go unnoticed | Health check every 30 seconds; auto-restart on failure (up to 3 times) |
| API bills balloon unexpectedly | Set a monthly budget cap; agents auto-stop the moment it's exceeded |
| No visibility into who ran what | All operations are logged with timestamps (audit-ready) |
| Task assignment is manual | Register a task and it's automatically assigned to an available agent |
| Can't fully delegate critical actions to AI | Set a "human approval required" gate for sensitive operations |
| Want to integrate with Slack or GitHub | Configure with Webhooks — no code needed |

---

## Supported AI models

maestro supports multiple AI models through an **adapter** system. The following adapters are available in `packages/adapters/src/`:

| Adapter | Description |
|---|---|
| `claude-api` | Claude via Anthropic API |
| `claude-local` | Local Claude (e.g. Claude Code) |
| `codex-local` | OpenAI Codex locally |
| `gemini-local` | Google Gemini locally |
| `cursor` | Cursor editor integration |
| `opencode-local` | OpenCode locally |
| `openclaw-gateway` | Via OpenClaw gateway |
| `pi-local` | Pi locally |

Switch models from the Web dashboard — no code changes required.

---

## Architecture overview

maestro is a monorepo split into 7 packages.

```
maestro/
├── packages/
│   ├── api/          ← REST API server (Express.js) ★ main backend
│   │   └── src/
│   │       ├── engine/
│   │       │   ├── heartbeat-engine.ts   … health check every 30s
│   │       │   ├── crash-recovery.ts     … detect crash → auto-restart
│   │       │   └── budget-monitor.ts     … budget exceeded → auto-stop
│   │       ├── routes/                   … 16 REST endpoints
│   │       ├── middleware/               … auth & request logging
│   │       └── server.ts                 … Express app init
│   ├── cli/          ← CLI tool (17 commands)
│   ├── ui/           ← Web dashboard (React + Vite)
│   ├── db/           ← Database schema & migrations (Drizzle ORM)
│   ├── adapters/     ← AI model adapters (8 types)
│   ├── shared/       ← Shared types & utilities
│   └── i18n/         ← Internationalization (Japanese, English, Chinese)
├── docker-compose.yml
└── package.json
```

---

## How the 3 core engines work

The heart of maestro lives in `packages/api/src/engine/`.

### 1. Heartbeat Engine (heartbeat-engine.ts)

**What it does:** Every 30 seconds, asks every enabled agent "are you alive?"

**Flow:**

1. Fetch all agents with `enabled: true` from the database
2. Run health checks via adapters (up to 3 in parallel)
3. If responsive → update `last_heartbeat_at`
4. If unresponsive → set `agent_runtime_state` to `crashed` (picked up by the crash recovery engine)
5. Also processes any pending agent-to-agent handoffs

### Note: Agent handoffs and chains

The heartbeat engine also handles passing work to the next agent when a task completes.

- **1-to-1 handoff**: Agent A finishes → passes output to Agent B to continue
- **Chain (A→B→C)**: Connect multiple agents in sequence to run as a pipeline

See `docs/handoff/` and `docs/chain/` for design specs.

### 2. Crash Recovery Engine (crash-recovery.ts)

**What it does:** Every 60 seconds, finds crashed agents and automatically recovers them.

**Flow:**

1. Find entries with `status: crashed` in `agent_runtime_state`
2. If restart count < 3 → reset status to `idle` (re-executed on next heartbeat)
3. If restart count reaches 3 → disable and stop the agent (prevents infinite loops)

### 3. Budget Monitor (budget-monitor.ts)

**What it does:** Every 60 seconds, checks the current month's cost for each tenant.

**Flow:**

1. Fetch all budget policies
2. Aggregate cumulative costs for the current month
3. If limit exceeded → auto-stop all agents for that company
4. Record the incident in `budget_incidents`

---

## CLI commands

17 commands are implemented in `packages/cli/src/commands/` (`backup` has two subcommands: `create` and `list`).

| Command | What it does |
|---|---|
| `init` | Initial project setup |
| `login` | Log in to the API server |
| `register` | Register a new user |
| `org` | Manage your organization (tenant) |
| `project` | Create and list projects |
| `agent` | Add, list, enable, and disable agents |
| `goal` | Set goals and track progress |
| `issue` | Create and manage issues |
| `routine` | Schedule recurring tasks |
| `approval` | Review, approve, and reject pending tasks |
| `costs` | View cost history |
| `plugin` | Add and manage plugins |
| `backup create` | Create a SQL dump (`--output <path>` to specify destination) |
| `backup list` | List existing backups |
| `doctor` | Check environment health |
| `update` | Update maestro itself |
| `uninstall` | Uninstall maestro |
| `ui` | Launch the Web dashboard |

---

## API endpoints

The REST API covers 16 resources (Bearer token authentication).

| Endpoint | Role |
|---|---|
| `/health` | Health check (no auth required) |
| `/auth` | Login & token issuance |
| `/org` | Organization management |
| `/companies` | Tenant management |
| `/agents` | Agent CRUD |
| `/tasks` | Task creation & assignment |
| `/issues` | Issue management |
| `/goals` | Goal management |
| `/projects` | Project management |
| `/costs` | Cost data |
| `/routines` | Recurring task management |
| `/approvals` | Approval workflow |
| `/activity` | Operation log |
| `/plugins` | Plugin management |
| `/settings` | Tenant settings |
| `/handoffs` | Agent-to-agent handoffs |

---

## Setup (for first-time users)

### Requirements

| Tool | Version | Purpose |
|---|---|---|
| Node.js | 20+ | Run the server and CLI |
| pnpm | 9+ | Package management (instead of npm) |
| Docker & Docker Compose | Latest recommended | Run PostgreSQL |

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/naotantan/maestro.git
cd maestro

# 2. Install dependencies
pnpm install

# 3. Prepare environment variables
cp .env.example .env.development
# → Open .env.development and edit DATABASE_URL etc.

# 4. Start PostgreSQL via Docker
docker compose up -d

# 5. Run database migrations
pnpm db:migrate

# 6. Start the API server (development mode)
pnpm --filter @maestro/api dev
```

### Verify it's working

```bash
# Health check (returns {"status":"ok"} if healthy)
curl http://localhost:3000/health
```

### Start the Web dashboard

```bash
# Start the UI in a separate terminal
pnpm --filter @maestro/ui dev
```

### Start API and UI together

```bash
# Start both with the root dev script
pnpm dev
```

### Docker shortcuts

```bash
pnpm docker:up    # equivalent to docker compose up -d
pnpm docker:down  # equivalent to docker compose down
```

---

## Internationalization

The Web dashboard and CLI messages support Japanese, English, and Chinese. Add more languages by editing the JSON files in `packages/i18n/src/locales/`.

---

## OpenAPI specification

`docs/openapi.yaml` contains the full API specification. Load it into Swagger UI or any compatible tool to explore the API interactively.

---

## Security

Security features confirmed in the source code:

| Measure | Implementation |
|---|---|
| HTTP header protection | Helmet.js (including CSP) |
| Rate limiting | Global: 100 req / 15 min / Auth: 10 req / 15 min |
| Authentication | Bearer token |
| Tenant isolation | `company_id` filter applied to every query |
| Encryption | AES-256-GCM (for stored credentials) |
| SSRF protection | DNS resolution + private IP range check on Webhook URLs |
| SQL injection protection | Parameterized queries via Drizzle ORM |
| XSS protection | Input sanitization + CSP headers |
| Request tracing | `X-Request-ID` attached to every request |

---

## Tech stack

| Category | Technology |
|---|---|
| Language | TypeScript (strict mode) |
| API server | Express.js |
| Database | PostgreSQL 17 |
| ORM | Drizzle ORM |
| Frontend | React + Vite |
| Package manager | pnpm (monorepo) |
| Testing | Vitest |
| Container | Docker / Docker Compose |
| License | MIT |

---

## Contributing

See `CONTRIBUTING.md` for full details. The short version:

1. Branch off `main` into a feature branch
2. Implement your changes
3. Run `pnpm test` to confirm tests pass
4. Run `pnpm typecheck` to confirm type checks pass
5. Follow Conventional Commits for commit messages (`feat:`, `fix:`, `docs:`, etc.)
6. Open a pull request

Package build order: `shared → db → i18n → adapters → api → cli → ui`. For a full build, `pnpm build` resolves this automatically.

---

## Summary

maestro is an open-source platform for safely running AI agents like Claude, Gemini, and Codex in production. Built around three core engines — 30-second health checks, automatic crash recovery (up to 3 retries), and auto-stop on monthly budget overrun — it also provides automatic task assignment, human approval gates, agent-to-agent handoff chains, Webhook integration, and full audit logging. Its multi-tenant design supports sharing across multiple companies and teams. Operate via REST API, CLI (17 commands), or Web dashboard.
