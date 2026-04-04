# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-04

### Added
- Multi-adapter support: Claude, GPT-4, Gemini, OpenCode
- AI agent management with heartbeat monitoring (30s interval)
- Budget monitoring with auto-stop and alert thresholds
- Multi-tenant architecture with strict maestro isolation
- Project and goal management with workspace support
- Issue tracker with priority, status, and label support
- Approval workflow for agent tasks
- Routine scheduling with cron expression support
- Activity logging and audit trail
- Plugin system with webhook support
- i18n support (Japanese / English, 460 keys each)
- CLI tool for org management, agent control, and DB backup
- Docker Compose support for quick local setup
- JWT-based authentication with role management

### Security
- SSRF protection on webhook URLs (DNS resolution + private IP range check)
- AES-256-GCM encryption for agent API keys in DB
- Tenant isolation enforced on all cross-tenant endpoints
- Rate limiting (100 req/15min in production)
- Helmet.js security headers (CSP, HSTS, XSS protection)
- Input sanitization against stored XSS across all text fields
- Race condition prevention in issue identifier assignment (db.transaction + MAX)

### Fixed
- Numeric overflow in budget policy creation (parseBudgetDecimal)
- UI i18n raw key display after i18n package rebuild
- CLI org members endpoint URL (/api/org/members)
- Heartbeat engine now calls real adapter instead of stub
