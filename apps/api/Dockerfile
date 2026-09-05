# Development image: installs the whole workspace and runs the Nest API
# in watch mode against a bind-mounted source tree. Not a production
# multi-stage build - this is a hackathon prototype, see docs/ARCHITECTURE.md.
FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recursive python3 python3-pip python3-venv openssl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app

COPY pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/web/package.json ./apps/web/package.json
COPY data/synthetic ./data/synthetic
COPY services ./services

RUN pnpm install --frozen-lockfile=false

RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r services/optimizer/requirements.txt \
    && /opt/venv/bin/pip install --no-cache-dir -r services/simulator/requirements.txt
ENV PATH="/opt/venv/bin:${PATH}"
ENV PYTHON_BIN="/opt/venv/bin/python3"

WORKDIR /app/apps/api
RUN pnpm run prisma:generate

EXPOSE 4000
CMD ["pnpm", "run", "start:dev"]
