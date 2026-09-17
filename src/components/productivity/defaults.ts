import type { PodcastLength } from "@/lib/api-types";

export const SLIDE_LENGTH_OPTIONS = [
  { value: "Short (5-8)", label: "Short", description: "5–8 slides" },
  { value: "Medium (8-12)", label: "Medium", description: "8–12 slides" },
  { value: "Long (12-15)", label: "Long", description: "12–15 slides" },
] as const;

export const PODCAST_LENGTH_OPTIONS: Array<{
  key: PodcastLength;
  label: string;
  subtitle: string;
}> = [
  { key: "short", label: "Short", subtitle: "~6–10 min" },
  { key: "default", label: "Default", subtitle: "~15–22 min" },
  { key: "longer", label: "Longer", subtitle: "~28–40 min" },
];

export const PODCAST_VOICE_OPTIONS = [
  "Achernar",
  "Achird",
  "Algenib",
  "Algieba",
  "Alnilam",
  "Aoede",
  "Autonoe",
  "Callirrhoe",
  "Charon",
  "Despina",
  "Enceladus",
  "Erinome",
  "Fenrir",
  "Gacrux",
  "Iapetus",
  "Kore",
  "Laomedeia",
  "Leda",
  "Orus",
  "Pulcherrima",
  "Puck",
  "Rasalgethi",
  "Sadachbia",
  "Sadaltager",
  "Schedar",
  "Sulafat",
  "Umbriel",
  "Vindemiatrix",
  "Zephyr",
  "Zubenelgenubi",
] as const;

export type PodcastVoiceName = (typeof PODCAST_VOICE_OPTIONS)[number];

export const DEFAULT_SLIDE_STYLE =
  "Create a clear academic slide deck with one idea per slide, restrained typography, and practical visuals.";
export const DEFAULT_SLIDE_LENGTH = "Short (5-8)";
export const DEFAULT_PODCAST_HOST_VOICE: PodcastVoiceName = "Charon";
export const DEFAULT_PODCAST_EXPERT_VOICE: PodcastVoiceName = "Kore";
export const DEFAULT_PODCAST_LENGTH: PodcastLength = "default";

export type SlideConfig = {
  style: string;
  length: string;
};

export type PodcastConfig = {
  length: PodcastLength;
  focus?: string;
  hostVoice: PodcastVoiceName;
  expertVoice: PodcastVoiceName;
};
