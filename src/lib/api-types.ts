export type ApiEnvelope<T> = {
  message?: string;
  statusCode?: number;
  results: T;
};

export type Paginated<T> = {
  data?: T[];
  avatars?: T[];
  backgrounds?: T[];
  conversations?: T[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
};

export type Agent = {
  chat_bot_id: number;
  name: string;
  chatBotId?: number;
  knowledgeBaseName?: string;
  is_presentation_agent?: boolean;
  isPresentationAgent?: boolean;
  agent_prompt?: string;
  agentPrompt?: string;
  persona?: string;
  training_status?: string;
  trainingStatus?: string;
  contents?: AgentContent[];
  content?: AgentContent[];
  chatBotContents?: AgentContent[];
  [key: string]: unknown;
};

export type AgentContent = {
  chat_bot_content_id?: number;
  chatBotContentId?: number;
  id?: number;
  file_name?: string;
  file_path?: string;
  storagePath?: string;
  storageUrl?: string;
  url?: string;
  content_type?: string;
  chatBotContentType?: string;
  ingestion_status?: string;
  ingestionStatus?: string;
  chapter_metadata?: unknown;
  chatBotContentSlides?: Array<{
    chatBotContentSlideId?: number;
    slideOrder?: number;
    transcript?: string;
    context?: string;
    startTime?: number;
    endTime?: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

/** Product catalog: basic | hero. */
export type AvatarCatalog = "basic" | "hero";

export type Character = {
  id: number;
  avatar_name: string;
  url: string;
  /** Catalog label from platform (`basic` | `hero`). List rows may also send snake_case. */
  avatarType?: string;
  avatar_type?: string;
  agent_prompt?: string;
  agent_idle_prompt?: string;
  aspect_ratio?: "2x3" | "9x16" | "1x1";
};

export type Background = {
  id: number;
  avatar_name: string;
  url: string;
  avatarType?: string;
  avatar_type?: string;
  mediaType?: "image" | "video";
};

/** LiveKit character-change payload (must match agent AvatarSessionManager). */
export type CharacterChangePayload = {
  imageUrl: string;
  avatarName: string;
  avatarType: AvatarCatalog;
  characterId: string | number;
  agentPrompt?: string;
  agentIdlePrompt?: string;
  aspectRatio?: string;
  /** Basic avatar artifact stem (or "transparent"). */
  backgroundId?: string;
  backgroundAvatarType?: AvatarCatalog;
};

export type Voice = {
  voice_id?: number;
  voice_name?: string;
  voiceId?: number;
  voiceName?: string;
  voiceEnvironment?: string;
  voiceType?: string;
  voiceGender?: "Female" | "Male" | string;
  voiceUrl?: string;
  preview_url?: string;
  sample_url?: string;
  voice_type?: string;
  customer_id?: number;
  [key: string]: unknown;
};

export type LlmModel = {
  llm_model_id?: number;
  llm_model_name?: string;
  modelId?: number;
  modelName?: string;
  value?: number;
  label?: string;
  environment?: string;
  llmModel?: string;
  logo?: string;
  isRealtime?: boolean | number;
  [key: string]: unknown;
};

export type LlmModelGroup = {
  label: string;
  options: LlmModel[];
};

export type SessionBundle = {
  token: string;
  url: string;
  roomName: string;
};

/** Payload used to (re)issue an ephemeral LiveKit session token. */
export type SessionTokenRequest = {
  agentId: number;
  llmId: number;
  voiceId: number;
  characterId?: number;
  backgroundId?: number;
  userMessage?: string;
};

export type ConversationConfig = {
  conversationName: string;
  agentId: number;
  llmId: number;
  voiceId: number;
  characterId?: number;
  backgroundId?: number;
  agent?: {
    id: number;
    name: string;
    isPresentationAgent: boolean;
    trainingStatus?: string;
  };
  character?: {
    id: number;
    name: string;
    url: string;
    avatarType?: AvatarCatalog | string | null;
    agentPrompt?: string;
    agentIdlePrompt?: string;
    aspectRatio?: string;
  };
  background?: {
    id: number;
    name: string;
    url: string;
    avatarType?: AvatarCatalog | string | null;
  };
  llmModel?: {
    id: number;
    name: string;
    model?: string;
    environment?: string;
  };
  voice?: {
    id: number;
    name: string;
    setup?: string;
    environment?: string;
    type?: string;
  };
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "normal" | "image" | "video" | "document";
  mediaUrl?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  createdAt?: string;
  pending?: boolean;
};

export type GenerationType = "slides" | "podcast" | "mindmap";
export type GenerationStatus = "pending" | "failed" | "completed";
export type PodcastLength = "short" | "default" | "longer";

export type GeneratedContent = {
  id: number;
  status: GenerationStatus;
  name: string;
  url: string | null;
  createdAt: string;
  chatbotName?: string;
  coverImage?: string | null;
  generatedContentType: GenerationType;
  chat_bot_id?: number;
};

export type GeneratedContentsPage = {
  files: GeneratedContent[];
  totalCount: number;
};

export type MindmapNode = {
  id: string;
  title: string;
  question: string;
  children?: MindmapNode[];
};

export type MindmapDocument = {
  title: string;
  root: MindmapNode;
};
