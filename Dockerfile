FROM node:26-alpine AS base
WORKDIR /app

RUN npm install -g pnpm

# --- 1. Dependencies Stage ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- 2. Builder Stage (Build the App) ---
FROM base AS builder

COPY . .
RUN mkdir -p public
COPY --from=deps /app/node_modules ./node_modules
RUN pnpm build

# --- 3. Production Runner Stage (Final, Small Image) ---
FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Pass AIVAH_API_BASE_URL / AIVAH_API_KEY at runtime via -e / compose — do not bake secrets.
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

EXPOSE 3000
USER node
CMD ["node", "server.js"]
