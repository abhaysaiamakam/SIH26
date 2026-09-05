# Development image: installs the whole workspace and runs Next.js dev
# server against a bind-mounted source tree. See docs/ARCHITECTURE.md.
FROM node:22-bookworm-slim

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/web ./apps/web
COPY apps/api/package.json ./apps/api/package.json
COPY data/synthetic/package.json ./data/synthetic/package.json

RUN pnpm install --frozen-lockfile=false

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "run", "dev"]
