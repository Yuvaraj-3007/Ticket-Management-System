# ── Backend Dockerfile ────────────────────────────────────────────────────────
# Bun monorepo: copies server/ + packages/core so workspace imports resolve.
# Dependencies are installed fresh in the runner stage to avoid Bun symlink
# issues when copying node_modules between Docker stages on Linux.
# ─────────────────────────────────────────────────────────────────────────────

FROM oven/bun:1 AS base
WORKDIR /app

# ── Stage 1: generate Prisma client ───────────────────────────────────────────
FROM base AS prisma

# Copy root workspace manifest + lockfile
COPY package.json bun.lock ./

# Copy workspace members so Bun can resolve all workspaces
COPY packages/core/package.json ./packages/core/package.json
COPY server/package.json         ./server/package.json
COPY client/package.json         ./client/package.json

# Install all workspace deps
RUN bun install --frozen-lockfile

COPY packages/core ./packages/core
COPY server/prisma ./server/prisma

RUN cd server && bunx prisma generate

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install dependencies fresh (avoids Bun symlink/hardlink issues on Linux
# when copying node_modules between Docker stages)
COPY package.json bun.lock ./
COPY packages/core/package.json ./packages/core/package.json
COPY server/package.json         ./server/package.json
COPY client/package.json         ./client/package.json
RUN bun install --frozen-lockfile

# Copy source
COPY packages/core ./packages/core
COPY server        ./server

# Copy generated Prisma client from build stage
COPY --from=prisma /app/server/src/generated ./server/src/generated

# Uploads directory (will be mounted as a volume in production)
RUN mkdir -p /app/server/uploads

# Startup script: runs migrations + seed + server
COPY server/start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 3000

CMD ["/app/start.sh"]
