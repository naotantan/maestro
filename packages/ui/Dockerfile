FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

# 依存関係コピー
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml .env.example* ./
COPY scripts ./scripts
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/i18n/package.json ./packages/i18n/
COPY packages/ui/package.json ./packages/ui/

RUN mkdir -p packages/api && pnpm install --frozen-lockfile

# ソースコードコピー
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY packages/i18n ./packages/i18n
COPY packages/ui ./packages/ui
COPY tsconfig.base.json ./

# ビルド
RUN pnpm --filter @maestro/shared build
RUN pnpm --filter @maestro/db build
RUN pnpm --filter @maestro/i18n build
RUN pnpm --filter @maestro/ui build

# 本番イメージ (nginx)
FROM nginx:alpine
COPY --from=builder /app/packages/ui/dist /usr/share/nginx/html
COPY packages/ui/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
