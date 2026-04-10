# ── Frontend Dockerfile ───────────────────────────────────────────────────────
# Stage 1: build the Vite/React app
# Stage 2: serve with Nginx (proxies /api → backend container)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy root workspace manifest + lockfile
COPY package.json bun.lock ./

# Copy workspace members needed by the client
COPY packages/core/package.json ./packages/core/package.json
COPY client/package.json         ./client/package.json

# Install deps
RUN bun install --frozen-lockfile

# Copy source
COPY packages/core ./packages/core
COPY client        ./client

# Build — pass backend API URL so Vite can embed it if needed
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN cd client && bun run build

# ── Stage 2: serve with Nginx ─────────────────────────────────────────────────
FROM nginx:alpine AS runner

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our template (uses envsubst to inject BACKEND_URL at startup)
COPY client/nginx.conf /etc/nginx/templates/default.conf.template

# Copy built static files
COPY --from=builder /app/client/dist /usr/share/nginx/html

EXPOSE 80

# envsubst replaces ${BACKEND_URL} in the nginx template at container start
CMD ["/bin/sh", "-c", \
  "envsubst '${BACKEND_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
