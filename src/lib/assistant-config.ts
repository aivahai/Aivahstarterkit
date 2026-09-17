export const ASSISTANT_PROVIDERS = [
  "openai-realtime",
  "openai-live",
  "grok-realtime",
  "gemini-live",
] as const;

export type AssistantProvider = (typeof ASSISTANT_PROVIDERS)[number];

export type AssistantEditorConfig = {
  provider: AssistantProvider;
  model: string;
  voice: string;
  instructions: string;
  knowledge: string;
};

export const ASSISTANT_PROVIDER_PRESETS: Record<
  AssistantProvider,
  { label: string; models: string[]; voices: string[]; defaultModel: string; defaultVoice: string }
> = {
  "openai-realtime": {
    label: "OpenAI Realtime",
    models: ["gpt-realtime-2", "gpt-realtime-2.1", "gpt-realtime"],
    voices: [
      "marin",
      "cedar",
      "alloy",
      "ash",
      "ballad",
      "coral",
      "echo",
      "sage",
      "shimmer",
      "verse",
    ],
    defaultModel: "gpt-realtime-2",
    defaultVoice: "marin",
  },
  "openai-live": {
    label: "OpenAI Live",
    models: ["gpt-live-1"],
    voices: [
      "quartz",
      "ripple",
      "vesper",
      "willow",
      "stone",
      "gleam",
      "meridian",
      "bossa",
      "tempo",
      "beacon",
      "delta",
      "cinder",
    ],
    defaultModel: "gpt-live-1",
    defaultVoice: "quartz",
  },
  "grok-realtime": {
    label: "Grok Realtime",
    models: [
      "grok-voice-latest",
      "grok-voice-think-fast-2.0",
      "grok-voice-think-fast-1.0",
    ],
    voices: ["eve", "ara", "leo", "sal", "rex", "mika", "valentin"],
    defaultModel: "grok-voice-latest",
    defaultVoice: "eve",
  },
  "gemini-live": {
    label: "Gemini Live",
    models: ["gemini-2.5-flash-native-audio-preview-12-2025"],
    voices: ["Puck", "Charon", "Kore", "Fenrir", "Aoede"],
    defaultModel: "gemini-2.5-flash-native-audio-preview-12-2025",
    defaultVoice: "Puck",
  },
};

export function isAssistantProvider(value: string): value is AssistantProvider {
  return (ASSISTANT_PROVIDERS as readonly string[]).includes(value);
}
