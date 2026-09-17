import "server-only";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type AssistantEditorConfig,
  type AssistantProvider,
  isAssistantProvider,
} from "@/lib/assistant-config";

export const ASSISTANT_PUBLIC_DIR = join(
  process.cwd(),
  "public",
  "aivah-assistant",
);

function readOptional(path: string) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

export function readAssistantEditorConfig(): AssistantEditorConfig {
  let provider: AssistantProvider = "gemini-live";
  let model = "";
  let voice = "";

  try {
    const raw = readFileSync(
      join(ASSISTANT_PUBLIC_DIR, "assistant.json"),
      "utf8",
    );
    const data = JSON.parse(raw) as {
      provider?: string;
      model?: string;
      voice?: string;
    };
    if (data.provider && isAssistantProvider(data.provider)) {
      provider = data.provider;
    }
    model = typeof data.model === "string" ? data.model.trim() : "";
    voice = typeof data.voice === "string" ? data.voice.trim() : "";
  } catch {
    // use defaults above
  }

  return {
    provider,
    model,
    voice,
    instructions: readOptional(join(ASSISTANT_PUBLIC_DIR, "instructions.md")),
    knowledge: readOptional(join(ASSISTANT_PUBLIC_DIR, "knowledge.md")),
  };
}

/** Combined host brief sent to Aivah at mint (instructions + knowledge). */
export function composeHostInstructions() {
  const { instructions, knowledge } = readAssistantEditorConfig();
  const fromFiles = [instructions.trim(), knowledge.trim()]
    .filter(Boolean)
    .join("\n\n");
  if (fromFiles) return fromFiles;
  return "You are the assistant for this website. Help users with what they see on the page.";
}

export function writeAssistantEditorConfig(config: AssistantEditorConfig) {
  mkdirSync(ASSISTANT_PUBLIC_DIR, { recursive: true });

  const json = {
    provider: config.provider,
    model: config.model.trim(),
    ...(config.voice.trim() ? { voice: config.voice.trim() } : {}),
  };

  writeFileSync(
    join(ASSISTANT_PUBLIC_DIR, "assistant.json"),
    `${JSON.stringify(json, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    join(ASSISTANT_PUBLIC_DIR, "instructions.md"),
    config.instructions,
    "utf8",
  );
  writeFileSync(
    join(ASSISTANT_PUBLIC_DIR, "knowledge.md"),
    config.knowledge,
    "utf8",
  );
}
