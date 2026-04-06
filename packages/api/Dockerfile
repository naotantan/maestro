FROM node:20-alpine AS builder
WORKDIR /app

# pnpm インストール
RUN npm install -g pnpm

# 依存関係コピー
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY scripts/ ./scripts/
COPY .env.example ./.env.example
COPY packages/shared/package.json ./packages/shared/
COPY packages/adapters/package.json ./packages/adapters/
COPY packages/db/package.json ./packages/db/
COPY packages/api/package.json ./packages/api/
COPY packages/ui/package.json ./packages/ui/

# 依存インストール
RUN pnpm install --frozen-lockfile

# ソースコードコピー
COPY packages/shared ./packages/shared
COPY packages/adapters ./packages/adapters
COPY packages/db ./packages/db
COPY packages/api ./packages/api
COPY tsconfig.base.json ./

# ビルド
RUN pnpm --filter @maestro/shared build
RUN pnpm --filter @maestro/adapters build
RUN pnpm --filter @maestro/db build
RUN pnpm --filter @maestro/api build

# 本番イメージ
FROM node:20-alpine
RUN apk add --no-cache git postgresql-client curl
WORKDIR /app

# ビルダーのモノレポnode_modulesをそのままコピー（pnpmのリンク構造を保持）
COPY --from=builder /app ./

EXPOSE 3000
CMD ["node", "packages/api/dist/index.js"]
