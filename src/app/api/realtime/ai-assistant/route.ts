import { getAivahServerConfig } from "@/lib/server/aivah";
import { composeHostInstructions } from "@/lib/server/assistant-config";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlatformEnvelope<T> = {
  results?: T;
  error?: { message?: string; code?: string } | string;
};

function hostInstructions() {
  return composeHostInstructions();
}

async function aivahAssistant(
  method: "GET" | "POST",
  body?: Record<string, unknown>,
) {
  const config = getAivahServerConfig();
  if (!config.ok) {
    return {
      ok: false as const,
      status: 503,
      payload: { error: config.message, code: "CONFIG_MISSING" },
    };
  }
  const response = await fetch(`${config.baseUrl}/assistant/sessions`, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      AIVAH_API_KEY: config.apiKey,
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as PlatformEnvelope<{
    configured?: boolean;
    clientSecret?: string;
    provider?: string;
    model?: string;
  }>;
  return { ok: response.ok, status: response.status, payload };
}

export async function GET() {
  const result = await aivahAssistant("GET");
  if (!result.ok) {
    return NextResponse.json(
      {
        configured: false,
        error:
          typeof result.payload.error === "string"
            ? result.payload.error
            : result.payload.error?.message ||
              "AI Assistant is not configured on Aivah.",
        code:
          typeof result.payload.error === "object"
            ? result.payload.error?.code
            : "ASSISTANT_UNAVAILABLE",
      },
      { status: result.status === 401 ? 401 : 200 },
    );
  }
  return NextResponse.json({
    configured: Boolean(result.payload.results?.configured),
  });
}

export async function POST(request: Request) {
  const client = (await request.json().catch(() => ({}))) as {
    provider?: string;
    model?: string;
    voice?: string;
    sessionId?: string;
    sdp?: string;
  };

  // OpenAI WebRTC: exchange browser SDP offer for answer (after mint).
  if (client.sessionId?.trim() && client.sdp?.trim()) {
    const config = getAivahServerConfig();
    if (!config.ok) {
      return NextResponse.json(
        { error: config.message, code: "CONFIG_MISSING" },
        { status: 503 },
      );
    }
    const response = await fetch(`${config.baseUrl}/assistant/realtime/calls`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        AIVAH_API_KEY: config.apiKey,
      },
      body: JSON.stringify({
        sessionId: client.sessionId.trim(),
        sdp: client.sdp,
      }),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as PlatformEnvelope<{
      sdp?: string;
      callId?: string | null;
    }>;
    if (!response.ok) {
      const message =
        typeof payload.error === "string"
          ? payload.error
          : payload.error?.message || "Unable to start realtime call.";
      return NextResponse.json(
        { error: message, code: "ASSISTANT_CALL_FAILED" },
        { status: response.status || 502 },
      );
    }
    return NextResponse.json({
      sdp: payload.results?.sdp,
      callId: payload.results?.callId ?? null,
    });
  }

  const provider = client.provider?.trim();
  const model = client.model?.trim();
  const voice = client.voice?.trim();
  if (!provider || !model) {
    return NextResponse.json(
      {
        error:
          "provider and model are required (set them in public/aivah-assistant/assistant.json).",
        code: "ASSISTANT_CONFIG_INVALID",
      },
      { status: 400 },
    );
  }
  const hostInstructionsText = hostInstructions();
  const result = await aivahAssistant("POST", {
    hostInstructions: hostInstructionsText,
    provider,
    model,
    ...(voice ? { voice } : {}),
  });
  if (!result.ok) {
    const message =
      typeof result.payload.error === "string"
        ? result.payload.error
        : result.payload.error?.message || "Unable to start AI Assistant.";
    return NextResponse.json(
      { error: message, code: "ASSISTANT_SESSION_FAILED" },
      { status: result.status || 502 },
    );
  }
  const minted = result.payload.results || {};
  return NextResponse.json(minted);
}
