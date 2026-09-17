# Add Aivah Assistant to your site

Aivah Assistant is a voice button that can see and use your page. Keep `AIVAH_API_KEY` on your server — never in the browser.

## 1. Add the script

```html
<script
  src="https://storage.googleapis.com/aivah-share/aivah-assistant.js"
  data-session="/api/realtime/ai-assistant"
  data-config="/aivah-assistant/assistant.json"
  async
></script>
```

- `data-session` — same-origin URL that starts a session (your server route).
- `data-config` — public JSON with `provider`, `model`, and `voice`.

You can self-host `aivah-assistant.js` instead of the CDN URL.

## 2. Add a session route

Your route calls Aivah and returns the session to the browser.

**Platform request**

```
POST {AIVAH_API_BASE_URL}/assistant/sessions
Header: AIVAH_API_KEY
Body: {
  "hostInstructions": "...",
  "provider": "gemini-live",
  "model": "...",
  "voice": "..."
}
```

Send **host context only** in `hostInstructions` (site brief, assistant name, do/don't). Aivah appends safety and UI rules server-side and returns `systemInstructions` for the widget.

**Return to the browser** — spread the platform `results` (must include `systemInstructions`, `provider`, `sessionId` for WS providers):

```json
{
  "provider": "gemini-live",
  "model": "...",
  "sessionId": "...",
  "wsTicket": "...",
  "realtimeWsUrl": "...",
  "systemInstructions": "..."
}
```

For **OpenAI Realtime**, the same session route can accept a second POST with `{ "sessionId", "sdp" }` and forward it to `{AIVAH_API_BASE_URL}/assistant/realtime/calls`.

Do not send `tools` — the script registers page tools after connect.

### Minimal example (Next.js)

```ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { provider, model, voice, sessionId, sdp } = await request.json();

  // OpenAI WebRTC: SDP exchange on the same route
  if (sessionId && sdp) {
    const res = await fetch(
      `${process.env.AIVAH_API_BASE_URL}/assistant/realtime/calls`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          AIVAH_API_KEY: process.env.AIVAH_API_KEY!,
        },
        body: JSON.stringify({ sessionId, sdp }),
      },
    );
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: payload.error?.message }, { status: res.status });
    }
    return NextResponse.json(payload.results);
  }

  const hostInstructions = "You are the assistant for this site.";
  const res = await fetch(`${process.env.AIVAH_API_BASE_URL}/assistant/sessions`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      AIVAH_API_KEY: process.env.AIVAH_API_KEY!,
    },
    body: JSON.stringify({ hostInstructions, provider, model, voice }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: payload.error?.message }, { status: res.status });
  }
  return NextResponse.json({
    ...payload.results,
  });
}
```

## 3. Environment

```env
AIVAH_API_BASE_URL=https://api.aivah.ai/v1/platform
AIVAH_API_KEY=sk_aivah_…
```

Serve over HTTPS. The mic is requested when the user opens the assistant.

## 4. Customize

**Voice provider** — `public/aivah-assistant/assistant.json`:

```json
{
  "provider": "gemini-live",
  "model": "gemini-2.5-flash-native-audio-preview-12-2025",
  "voice": "Puck"
}
```

Providers: `openai-realtime`, `openai-live`, `grok-realtime`, `gemini-live`.

`openai-live` is GPT-Live (`gpt-live-1`) over the same host session + SDP route; Aivah talks to `/v1/live/sessions`. Realtime models stay on `openai-realtime`.

**Site copy** (optional, server-side in this starter kit):

- `public/aivah-assistant/instructions.md` — who the assistant is, what the site is about
- `public/aivah-assistant/knowledge.md` — product facts

You can rename the assistant in your host instructions. Vendor, tool, and safety rules are enforced by Aivah and cannot be disabled from the host.

**SPA navigation** (optional) — set `window.__AIVAH_NAVIGATE` to your router `push` so in-app links do not full-reload.
