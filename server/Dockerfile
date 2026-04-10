# ── Backend Dockerfile ────────────────────────────────────────────────────────
# Bun monorepo: copies server/ + packages/core so workspace imports resolve.
# ─────────────────────────────────────────────────────────────────────────────

FROM oven/bun:1 AS base
WORKDIR /app

# ── Stage 1: install dependencies ─────────────────────────────────────────────
FROM base AS deps

# Copy root workspace manifest + lockfile
COPY package.json bun.lock ./

# Copy workspace members needed by the server
COPY packages/core/package.json ./packages/core/package.json
COPY server/package.json         ./server/package.json

# Install all workspace deps (hoisted into root node_modules)
RUN bun install --frozen-lockfile

# ── Stage 2: generate Prisma client ───────────────────────────────────────────
FROM deps AS prisma

COPY packages/core ./packages/core
COPY server/prisma ./server/prisma

RUN cd server && bunx prisma generate

# ── Stage 3: production image ─────────────────────────────────────────────────
FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy installed node_modules (includes generated Prisma client)
COPY --from=prisma /app/node_modules        ./node_modules
COPY --from=prisma /app/server/node_modules ./server/node_modules 2>/dev/null || true

# Copy source
COPY packages/core ./packages/core
COPY server        ./server

# Uploads directory (will be mounted as a volume in production)
RUN mkdir -p /app/server/uploads

EXPOSE 4000

CMD ["bun", "run", "/app/server/src/index.ts"]
