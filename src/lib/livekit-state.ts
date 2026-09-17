import type {
  CharacterChangePayload,
  ChatMessage,
} from "@/lib/api-types";

type MessageMedia = {
  type?: "image" | "video" | "document";
  mediaUrl?: string;
  fileUrl?: string;
  fileName?: string;
};

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function additionalData(payload: Record<string, unknown>) {
  const raw = payload.additional_data ?? payload.additionalData;
  if (raw && typeof raw === "object" && !Array.isArray(raw))
    return raw as Record<string, unknown>;
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function extractChatMessageMedia(
  payload: Record<string, unknown>,
): MessageMedia {
  const extra = additionalData(payload);
  const imageUrl = nonEmptyString(payload.image_url ?? payload.imageUrl);
  const rawVideos = payload.video_urls ?? payload.videoUrls;
  const videoUrl =
    (Array.isArray(rawVideos) ? nonEmptyString(rawVideos[0]) : undefined) ??
    nonEmptyString(payload.video_url ?? payload.videoUrl);
  const fileUrl =
    nonEmptyString(payload.file_url ?? payload.fileUrl) ??
    nonEmptyString(extra.file_url ?? extra.fileUrl);
  const fileName =
    nonEmptyString(payload.file_name ?? payload.fileName) ??
    nonEmptyString(extra.file_name ?? extra.fileName);

  if (imageUrl)
    return {
      type: "image",
      mediaUrl: imageUrl,
      fileUrl,
      fileName,
    };
  if (videoUrl)
    return {
      type: "video",
      mediaUrl: videoUrl,
      fileUrl,
      fileName,
    };
  if (fileUrl)
    return {
      type: "document",
      mediaUrl: fileUrl,
      fileName,
    };
  return {};
}

export function normalizeChatMessage(message: ChatMessage): ChatMessage {
  const media = extractChatMessageMedia(
    message as unknown as Record<string, unknown>,
  );
  return {
    ...message,
    content: message.content || "",
    type: message.type || media.type || "normal",
    mediaUrl: message.mediaUrl || media.mediaUrl || null,
    fileUrl: message.fileUrl || media.fileUrl || null,
    fileName: message.fileName || media.fileName || null,
  };
}

export function isConversationChatPath(pathname: string) {
  return pathname === "/chat" || pathname === "/chat/";
}

export function characterDataEvent(payload: CharacterChangePayload | null) {
  if (!payload)
    return {
      topic: "character-unselect",
      payload: {},
    } as const;

  return {
    topic: "character-change",
    payload,
  } as const;
}

const TRANSIENT_STATUS_MESSAGES = new Set([
  "loading",
  "thinking",
  "searching",
  "generating",
  "processing",
  "one moment please",
  "connecting",
  "checking credits",
  "initializing conversation",
  "preparing agent",
  "preparing your workspace",
  "loading presentation",
  "loading course",
  "preparing narration",
  "processing your message",
  "generating greeting",
  "generating image",
  "generating video",
  "searching the web",
  "searching knowledge base",
  "searching knowledgebase",
  "storing info in memory",
  "stopping here",
  "continuing presentation",
  "presentation paused",
  "starting presentation",
  "presentation completed",
  "presentation ended",
]);

const TRANSIENT_STATUS_RE =
  /^(loading|preparing|generating|searching|checking|initializing|connecting|processing)\b.{0,50}$/;

function normalizeTransientText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\u2026/g, "...")
    .replace(/[.…]+$/g, "")
    .trim();
}

export function isTransientMessage(value: string) {
  const normalized = normalizeTransientText(value);
  if (!normalized) return false;
  if (TRANSIENT_STATUS_MESSAGES.has(normalized)) return true;
  if (normalized.length <= 64 && TRANSIENT_STATUS_RE.test(normalized)) {
    return true;
  }
  return (
    normalized.startsWith("continuing presentation") ||
    normalized.startsWith("starting presentation") ||
    normalized.startsWith("loading course") ||
    normalized.startsWith("loading presentation") ||
    normalized.startsWith("presentation paused") ||
    normalized.startsWith("presentation completed") ||
    normalized.startsWith("presentation ended")
  );
}

export function mergeMessages(
  current: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const result = [...current];
  for (const message of incoming) {
    const duplicate = result.findIndex(
      (candidate) =>
        candidate.id === message.id ||
        (candidate.role === message.role &&
          ((message.content.trim() &&
            candidate.content.trim() === message.content.trim()) ||
            (!!message.mediaUrl &&
              candidate.mediaUrl === message.mediaUrl)) &&
          Math.abs(
            new Date(candidate.createdAt || 0).getTime() -
              new Date(message.createdAt || 0).getTime(),
          ) < 5000),
    );
    if (duplicate >= 0) {
      result[duplicate] = { ...result[duplicate], ...message, pending: false };
    } else {
      result.push(message);
    }
  }
  return result.sort(
    (a, b) =>
      new Date(a.createdAt || 0).getTime() -
      new Date(b.createdAt || 0).getTime(),
  );
}

export function isAgentOutputActive({
  loadingMessage,
  transcription,
  agentSpeaking,
}: {
  loadingMessage: string | null;
  transcription: string;
  agentSpeaking: boolean;
}) {
  return Boolean(loadingMessage || transcription.trim() || agentSpeaking);
}
