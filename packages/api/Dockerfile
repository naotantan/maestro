FROM node:20-alpine AS builder
WORKDIR /app

# pnpm インストール
RUN npm install -g pnpm

# 依存関係コピー
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/api/package.json ./packages/api/

# 依存インストール
RUN pnpm install --frozen-lockfile

# ソースコードコピー
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY packages/api ./packages/api
COPY tsconfig.base.json ./

# ビルド
RUN pnpm --filter @company/shared build
RUN pnpm --filter @company/db build
RUN pnpm --filter @company/api build

# 本番イメージ
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/node_modules ./node_modules
COPY --from=builder /app/node_modules ./../node_modules

EXPOSE 3000
CMD ["node", "dist/index.js"]
