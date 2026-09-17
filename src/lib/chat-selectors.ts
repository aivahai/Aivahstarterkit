import type { Agent, LlmModel, Voice } from "@/lib/api-types";

export const agentIdOf = (agent: Agent) =>
  agent.chat_bot_id || agent.chatBotId || 0;

export const agentNameOf = (agent: Agent) =>
  agent.name || agent.knowledgeBaseName || `Agent ${agentIdOf(agent)}`;

export const modelIdOf = (model: LlmModel) =>
  model.value ?? model.llm_model_id ?? model.modelId ?? 0;

export const modelNameOf = (model: LlmModel) =>
  model.label ??
  model.llm_model_name ??
  model.modelName ??
  model.llmModel ??
  `Model ${modelIdOf(model)}`;

export const voiceIdOf = (voice: Voice) => voice.voiceId ?? voice.voice_id ?? 0;

export const voiceNameOf = (voice: Voice) =>
  voice.voiceName ?? voice.voice_name ?? `Voice ${voiceIdOf(voice)}`;

export function isCustomVoice(voice: {
  group?: string;
  voiceType?: string;
  voice_type?: string;
}) {
  const group = String(voice.group || "").toLowerCase();
  const type = String(voice.voiceType || voice.voice_type || "").toLowerCase();
  return (
    group === "clone" ||
    group === "cloned" ||
    group === "custom" ||
    ["clone", "cloned", "custom"].includes(type)
  );
}

export function previewUrlOf(voice: {
  voiceUrl?: string;
  preview_url?: string;
  sample_url?: string;
}) {
  return String(
    voice.voiceUrl || voice.preview_url || voice.sample_url || "",
  ).trim();
}

export const normalizeEnvironment = (value = "") =>
  value.toLowerCase().replace(/[\s_-]+/g, "");

export const modelIsRealtime = (model?: LlmModel) =>
  Boolean(
    model &&
    (model.isRealtime ||
      normalizeEnvironment(model.environment).includes("realtime")),
  );

export type VoiceGroupResponse = { groups: Record<string, Voice[]> };
