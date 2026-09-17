import {
  ASSISTANT_PROVIDER_PRESETS,
  type AssistantEditorConfig,
  isAssistantProvider,
} from "@/lib/assistant-config";
import {
  readAssistantEditorConfig,
  writeAssistantEditorConfig,
} from "@/lib/server/assistant-config";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validateConfig(body: unknown): AssistantEditorConfig | string {
  if (!body || typeof body !== "object") return "Invalid request body.";
  const input = body as Record<string, unknown>;
  const provider =
    typeof input.provider === "string" ? input.provider.trim() : "";
  if (!isAssistantProvider(provider)) {
    return "provider must be openai-realtime, openai-live, grok-realtime, or gemini-live.";
  }
  const model = typeof input.model === "string" ? input.model.trim() : "";
  if (!model) return "model is required.";
  if (model.length > 128) return "model is too long.";
  const voice = typeof input.voice === "string" ? input.voice.trim() : "";
  if (voice.length > 64) return "voice is too long.";
  const instructions =
    typeof input.instructions === "string" ? input.instructions : "";
  const knowledge = typeof input.knowledge === "string" ? input.knowledge : "";
  if (instructions.length > 48000) return "instructions are too long.";
  if (knowledge.length > 48000) return "knowledge is too long.";
  return {
    provider,
    model,
    voice,
    instructions,
    knowledge,
  };
}

export async function GET() {
  return NextResponse.json({
    config: readAssistantEditorConfig(),
    presets: ASSISTANT_PROVIDER_PRESETS,
  });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const validated = validateConfig(body);
  if (typeof validated === "string") {
    return NextResponse.json({ error: validated }, { status: 400 });
  }
  writeAssistantEditorConfig(validated);
  return NextResponse.json({ config: validated });
}
