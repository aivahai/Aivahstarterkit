# Aivah Starter Kit

A private-deployment Next.js application for live Aivah conversations and focused management of characters, backgrounds, voices, and agents.

## Requirements

- Node.js 22+
- pnpm 11+
- An active customer-scoped Aivah API key

## Configure and run

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

set `AIVAH_API_KEY` to an active `sk_aivah_…` key.
The voice assistant uses that same Aivah key. Edit `public/aivah-assistant/instructions.md` to change its brief. To add it to another site, see `ai-fab-integration-instruction.md`.

If the configuration is missing or malformed, the UI displays a deployment configuration error. Disabled, revoked, expired, or invalid keys are reported using the backend’s safe platform error response.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

## Docker

```bash
docker build -t aivah-starter-kit .
docker run --rm -p 3000:3000 \
  -e AIVAH_API_BASE_URL=https://api.aivah.ai/v1/platform \
  -e AIVAH_API_KEY=sk_aivah_replace_me \
  aivah-starter-kit
```
