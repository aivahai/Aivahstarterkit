# Aivah Starter Kit

A ready-to-deploy Next.js app for building on the [Aivah](https://aivah.ai) platform. Clone it, add your API key, and you get:

- **Live avatar conversations** — talk to an Aivah agent by text or voice, with a real-time video character rendered over LiveKit.
- **Interactive presentations** — agents that teach from PDF slides or chaptered video, with the agent driving page turns and playback.
- **Management screens** for your characters, backgrounds, voices, and agents.
- **A voice assistant button** — an embeddable widget that can see and operate the page it's on, powered by OpenAI, Grok, or Gemini live-audio models via Aivah.
- **Productivity generators** — turn an agent's knowledge into slides, a podcast, or a mind map.

Your Aivah API key stays on the server. The browser only ever talks to this app's own API routes, which proxy to Aivah.

---

## Quick start

**Requirements**

- Node.js 22 or newer
- [pnpm](https://pnpm.io) 11 or newer
- An active Aivah API key (`sk_aivah_…`) from your Aivah dashboard

**Run it**

```bash
git clone https://github.com/aivahai/Aivahstarterkit.git
cd Aivahstarterkit
cp .env.example .env.local
# open .env.local and set AIVAH_API_KEY
pnpm install
pnpm dev
```

Open http://localhost:3000. You'll land on **Chat**.

If the key is missing or invalid, the UI shows a safe "deployment not configured" message instead of exposing the key or the raw error.

---

## Configuration

All settings are server-side environment variables. Put them in `.env.local` for development or pass them to your host / container in production.

| Variable | Required | Description |
|---|---|---|
| `AIVAH_API_KEY` | Yes | Your customer-scoped Aivah API key. Never expose it to the browser. |
| `AIVAH_API_BASE_URL` | Yes | Aivah platform base URL. Default: `https://api.aivah.ai/v1/platform` |

> Do **not** rename these to `NEXT_PUBLIC_*`. That would ship the key to every visitor.

---

## Using the app

The sidebar has two groups: **Experience** (Chat) and **Platform** (everything you manage).

### Chat

Start a conversation with any of your agents.

1. Pick an agent (Standard or Presentation).
2. Choose an LLM model and a compatible voice.
3. Optionally pick a character and background for the avatar.
4. Type a message and **Start conversation** — or **Start presentation** for a presentation agent.

Once live, you can talk by text or toggle the microphone. The avatar's video is streamed over LiveKit and chroma-keyed onto your chosen background.

**Presentation agents** get a stage instead of a plain chat: a PDF viewer or video player that the agent controls (page cues, chapter seeks, play/pause), a lessons panel, chapter list, quiz overlay, and a collapsible transcription panel. The protocol between agent and client is documented in [presentation-implementation-guide.md](./presentation-implementation-guide.md).

### Characters

Browse and manage the avatars your agents can appear as, plus the image/video **Backgrounds** they sit in front of.

### Voices

List available voices, and **clone** a new one from an uploaded audio sample or a recording made right in the browser.

### Agents

Create, inspect, retry, and delete agents. When creating one you can set a name, persona, agent prompt, text knowledge, URLs, and upload files. Presentation agents can have PDF or video content attached.

### Assistant

Configure the voice assistant widget without touching code: choose a provider, model, and voice, and edit the assistant's instructions and knowledge. Saving writes to the files under `public/aivah-assistant/` (see next section).

### Productivity

Generate **slides**, a **podcast**, or a **mind map** from an agent's knowledge, then view, play, or delete the results.

---

## The voice assistant widget

The floating assistant button on every page is `public/aivah-assistant.js`. It reads the current page, can click and navigate on the user's behalf, and talks through a live-audio model. This starter kit already wires it up; you can also drop it into any other site.

### Configure it

`public/aivah-assistant/assistant.json` picks the speech provider:

```json
{
  "provider": "openai-live",
  "model": "gpt-live-1",
  "voice": "quartz"
}
```

| Provider | Example models | Example voices |
|---|---|---|
| `openai-live` | `gpt-live-1` | `quartz`, `ripple`, `vesper`, `willow`, … |
| `openai-realtime` | `gpt-realtime-2`, `gpt-realtime` | `marin`, `cedar`, `alloy`, … |
| `grok-realtime` | `grok-voice-latest` | `eve`, `ara`, `leo`, … |
| `gemini-live` | `gemini-2.5-flash-native-audio-preview-12-2025` | `Puck`, `Charon`, `Kore`, … |

The full preset list lives in [src/lib/assistant-config.ts](./src/lib/assistant-config.ts). Provider API keys (OpenAI, xAI, Google) are held by Aivah — you only need your Aivah key.

Give it context with two optional Markdown files:

- `public/aivah-assistant/instructions.md` — who the assistant is, what your site does, do's and don'ts.
- `public/aivah-assistant/knowledge.md` — product facts it may quote.

Both are combined and sent to Aivah when a session starts. Aivah appends its own safety and tool rules server-side; those cannot be overridden from the host.

You can edit all of this from the **Assistant** page in the app instead of by hand.

### Add it to another website

See [ai-fab-integration-instruction.md](./ai-fab-integration-instruction.md). In short: include the script tag, add one server route that mints a session with your Aivah key, and point the script at that route. A minimal Next.js route is included in that guide.

[ai-fab-architecture.md](./ai-fab-architecture.md) explains how the transports (WebRTC vs. WebSocket proxy) work per provider, if you want to go deeper.

---

## Project structure

```
src/
├── app/
│   ├── new-chat/           Pick agent, model, voice, character → start
│   ├── chat/               Live conversation / presentation stage
│   ├── characters/         Characters and backgrounds
│   ├── voices/             Voice list and cloning
│   ├── agents/             Agent list, detail, create
│   ├── assistant/          Voice assistant settings editor
│   ├── productivity/       Slides / podcast / mindmap generation
│   └── api/
│       ├── aivah/[...path]/          Allow-listed proxy to the Aivah API
│       ├── aivah-media/…             Streams agent content (PDF/video) for the stage
│       ├── realtime/ai-assistant/    Mints assistant sessions + OpenAI SDP exchange
│       └── aivah-assistant/config/   Reads/writes the assistant config files
├── components/
│   ├── chat/               Avatar stage, chroma-key video, composer pickers
│   ├── presentation/       PDF viewer, video source, chapters, quiz, outline
│   ├── productivity/       Generation dialogs, mindmap viewer, podcast player
│   ├── ai-elements/        Conversation, message, prompt input
│   └── ui/                 shadcn/ui primitives
├── lib/
│   ├── api.ts              Browser-side fetch helper (talks to /api/aivah)
│   ├── api-types.ts        Types for agents, characters, voices, sessions, …
│   ├── server/aivah.ts     Reads and validates AIVAH_* env vars
│   └── presentation-*.ts   Presentation data + lesson handling
└── store/                  Zustand stores (LiveKit room, presentation, chapters)
public/
├── aivah-assistant.js      The voice assistant widget
└── aivah-assistant/        assistant.json, instructions.md, knowledge.md
```

### How requests reach Aivah

The browser never calls Aivah directly. Every call goes to `/api/aivah/<path>`, which:

1. Checks the method + path against an explicit allow-list ([route.ts](./src/app/api/aivah/[...path]/route.ts)) — anything else returns `404 ROUTE_NOT_ALLOWED`.
2. Attaches `AIVAH_API_KEY` from the server environment.
3. Streams the upstream response back unchanged.

If the environment is missing, the proxy returns `503 CONFIG_MISSING`; if Aivah is unreachable, `502 UPSTREAM_UNAVAILABLE`. The UI renders both as friendly errors.

To add a new Aivah endpoint to the app, add its method and path pattern to the `ROUTES` list in that file.

---

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server on port 3000 |
| `pnpm build` | Production build (standalone output) |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript, no emit |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:watch` | Unit tests in watch mode |
| `pnpm test:e2e` | End-to-end tests (Playwright) |

Run the full quality gate before shipping:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium   # first time only
pnpm test:e2e
```

The e2e suite mocks the Aivah API, so it runs without a real key.

---

## Deploying

### Docker

```bash
docker build -t aivah-starter-kit .
docker run --rm -p 3000:3000 \
  -e AIVAH_API_BASE_URL=https://api.aivah.ai/v1/platform \
  -e AIVAH_API_KEY=sk_aivah_replace_me \
  aivah-starter-kit
```

The image is a multi-stage build that ends in a small `node:alpine` runner with Next.js standalone output. Secrets are passed at runtime, never baked in.

### Any Node host

`pnpm build` produces a standalone server in `.next/standalone`. Run it with `node server.js` and the two `AIVAH_*` environment variables set. Vercel and similar platforms work out of the box — just add the env vars in their dashboard.

### Things to know in production

- **Serve over HTTPS.** The microphone and WebRTC require a secure origin.
- **The Assistant settings page writes to disk** (`public/aivah-assistant/`). On an immutable or multi-instance deployment those edits won't persist — commit the files to your repo instead, or treat the page as dev-only.
- **`allowedDevOrigins`** in `next.config.ts` lists origins permitted in development (e.g. an ngrok tunnel). Update or remove them for your setup.

---

## Customising

- **Branding and navigation** — [src/components/app-shell.tsx](./src/components/app-shell.tsx)
- **Theme and colours** — [src/app/globals.css](./src/app/globals.css) (Tailwind v4 + shadcn tokens, light/dark via `next-themes`)
- **Assistant persona** — `public/aivah-assistant/instructions.md` and `knowledge.md`
- **Assistant provider / voice** — `public/aivah-assistant/assistant.json`
- **Allowed Aivah endpoints** — `ROUTES` in [src/app/api/aivah/[...path]/route.ts](./src/app/api/aivah/[...path]/route.ts)

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "This deployment is not configured" | `AIVAH_API_KEY` or `AIVAH_API_BASE_URL` not set on the server. Restart after editing `.env.local`. |
| Key-related error from Aivah | The key is disabled, revoked, expired, or belongs to another customer. Check your Aivah dashboard. |
| Assistant button does nothing / no mic prompt | Page not served over HTTPS (or `localhost`). Browsers block the mic on insecure origins. |
| `404 ROUTE_NOT_ALLOWED` in the network tab | The endpoint isn't in the proxy allow-list — add it to `ROUTES`. |
| Assistant says "provider and model are required" | `assistant.json` is missing or malformed. |

---

## Further reading

- [ai-fab-integration-instruction.md](./ai-fab-integration-instruction.md) — embed the voice assistant in any site
- [ai-fab-architecture.md](./ai-fab-architecture.md) — how the assistant's sessions and transports work
- [presentation-implementation-guide.md](./presentation-implementation-guide.md) — the agent ↔ client protocol for slide and video lessons
