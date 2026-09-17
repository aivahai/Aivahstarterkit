"use client";

import { ApiError } from "@/components/api-error";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { AvatarStage } from "@/components/chat/avatar-stage";
import { MessageMedia } from "@/components/chat/message-media";
import {
  CharacterBackgroundPicker,
  ComposerPicker,
  VoicePicker,
  type ComposerPickerItem,
} from "@/components/chat/composer-picker";
import CourseOutlinePanel from "@/components/presentation/course-outline-panel";
import { PresentationStage } from "@/components/presentation/presentation-stage";
import { QuizOverlay } from "@/components/presentation/quiz-overlay";
import { useAivahRoom } from "@/components/providers/livekit-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { aivahFetch, asArray } from "@/lib/api";
import type {
  Background,
  Character,
  ConversationConfig,
  LlmModelGroup,
  Paginated,
  Voice,
} from "@/lib/api-types";
import {
  modelIdOf,
  modelIsRealtime,
  modelNameOf,
  normalizeEnvironment,
  voiceIdOf,
  voiceNameOf,
  type VoiceGroupResponse,
} from "@/lib/chat-selectors";
import {
  avatarTypeOf,
  isBasicAvatarCatalog,
  toAvatarCatalog,
} from "@/lib/avatar-catalog";
import { isAgentOutputActive } from "@/lib/livekit-state";
import { hydratePresentationFromAgent } from "@/lib/presentation-lessons";
import { cn } from "@/lib/utils";
import {
  chaptersFromLessonSlides,
  type CourseLesson,
  useCourseOutlineStore,
} from "@/store/course-outline";
import { useVideoChaptersStore } from "@/store/video-chapters";
import {
  AlertCircle,
  BookOpen,
  Bot,
  BrainCircuit,
  Mic,
  MicOff,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function ConnectionBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    idle: "Idle",
    connecting: "Connecting",
    connected: "Live",
    reconnecting: "Reconnecting",
    disconnected: "Disconnected",
    "credit-error": "Credit error",
    error: "Connection error",
  };
  return (
    <Badge
      variant={
        status === "connected"
          ? "default"
          : status.includes("error")
            ? "destructive"
            : "secondary"
      }
    >
      <span
        className={cn(
          "mr-1.5 size-1.5 rounded-full bg-current",
          status === "connected" && "animate-pulse motion-reduce:animate-none",
        )}
      />
      {labels[status] || status}
    </Badge>
  );
}

export default function ConversationPage() {
  const router = useRouter();
  const room = useAivahRoom();
  const config = room.sessionConfig;
  const setSessionConfig = room.setSessionConfig;
  const reconnectSession = room.reconnectSession;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [modelGroups, setModelGroups] = useState<LlmModelGroup[]>([]);
  const [voiceGroups, setVoiceGroups] = useState<Record<string, Voice[]>>({});
  const [characters, setCharacters] = useState<Character[]>([]);
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [updatingConfiguration, setUpdatingConfiguration] = useState(false);
  const [transcriptionPanelOpen, setTranscriptionPanelOpen] = useState(true);
  const [lessonsPanelOpen, setLessonsPanelOpen] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<
    Parameters<typeof QuizOverlay>[0]["questions"]
  >([]);
  const [quizOpen, setQuizOpen] = useState(false);

  const lessons = useCourseOutlineStore((state) => state.lessons);
  const activeWidget = useCourseOutlineStore((state) => state.activeWidget);
  const selectLessonLocally = useCourseOutlineStore(
    (state) => state.selectLessonLocally,
  );

  const load = useCallback(async () => {
    if (!config) {
      router.replace("/new-chat");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [modelResult, voiceResult, characterResult, backgroundResult] =
        await Promise.all([
          aivahFetch<LlmModelGroup[]>("llm-models"),
          aivahFetch<VoiceGroupResponse>("voices"),
          aivahFetch<Paginated<Character>>(
            "characters?limit=50&avatarType=all",
          ),
          aivahFetch<Paginated<Background>>(
            "backgrounds?limit=50&avatarType=all",
          ),
        ]);
      setModelGroups(Array.isArray(modelResult) ? modelResult : []);
      setVoiceGroups(voiceResult.groups || {});
      setCharacters(asArray<Character>(characterResult, ["avatars"]));
      setBackgrounds(asArray<Background>(backgroundResult, ["backgrounds"]));
      if (config.agent?.isPresentationAgent) {
        await hydratePresentationFromAgent(config.agentId).catch(
          () => undefined,
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Conversation could not be opened.",
      );
    } finally {
      setLoading(false);
    }
    // Only re-bootstrap pickers / presentation when the session agent changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [config?.agentId, config?.agent?.isPresentationAgent, router]);
  useEffect(() => {
    void load();
  }, [load]);

  const send = async ({ text }: { text: string }) => {
    const content = text.trim();
    if (!content) return;
    setDraft("");
    await room
      .sendMessage(content)
      .catch(() => toast.error("Message could not be sent."));
  };
  const models = useMemo(
    () => modelGroups.flatMap((group) => group.options || []),
    [modelGroups],
  );
  const voices = useMemo(
    () =>
      Object.entries(voiceGroups).flatMap(([group, entries]) =>
        entries.map((voice) => ({ group, voice })),
      ),
    [voiceGroups],
  );
  const selectedModel = models.find(
    (model) => modelIdOf(model) === config?.llmId,
  );
  const availableVoices = useMemo(() => {
    if (!modelIsRealtime(selectedModel)) return voices;
    const environment = normalizeEnvironment(selectedModel?.environment);
    return voices.filter(
      ({ group, voice }) =>
        normalizeEnvironment(voice.voiceEnvironment || group) === environment,
    );
  }, [selectedModel, voices]);
  const modelItems: ComposerPickerItem[] = modelGroups.flatMap((group) =>
    (group.options || []).map((model) => ({
      value: String(modelIdOf(model)),
      label: modelNameOf(model),
      group: group.label,
      description: model.environment || group.label,
    })),
  );
  const voiceItems: ComposerPickerItem[] = availableVoices.map(
    ({ group, voice }) => ({
      value: String(voiceIdOf(voice)),
      label: voiceNameOf(voice),
      group,
      description: String(voice.voiceGender || voice.voiceType || group),
      previewUrl:
        voice.voiceUrl || voice.preview_url || voice.sample_url || undefined,
    }),
  );

  const updateConfiguration = async (
    patch: {
      llmId?: number;
      voiceId?: number;
      characterId?: number | null;
      backgroundId?: number | null;
    },
    successMessage: string,
    options: {
      reconnect?: boolean;
      afterUpdate?: (updated: ConversationConfig) => Promise<void> | void;
    } = {},
  ) => {
    if (!config || updatingConfiguration) return;
    setUpdatingConfiguration(true);
    try {
      const nextCharacterId =
        "characterId" in patch ? patch.characterId : config.characterId;
      const nextBackgroundId =
        "backgroundId" in patch ? patch.backgroundId : config.backgroundId;
      const nextCharacter =
        characters.find((character) => character.id === nextCharacterId) ||
        null;
      const nextBackground =
        backgrounds.find((background) => background.id === nextBackgroundId) ||
        null;
      const nextModel =
        models.find((model) => modelIdOf(model) === (patch.llmId ?? config.llmId)) ||
        null;
      const nextVoice =
        voices.find(
          ({ voice }) => voiceIdOf(voice) === (patch.voiceId ?? config.voiceId),
        )?.voice || null;

      const updated: ConversationConfig = {
        ...config,
        llmId: patch.llmId ?? config.llmId,
        voiceId: patch.voiceId ?? config.voiceId,
        characterId: nextCharacterId ?? undefined,
        backgroundId: nextBackgroundId ?? undefined,
        character: nextCharacter
          ? {
              id: nextCharacter.id,
              name: nextCharacter.avatar_name,
              url: nextCharacter.url,
              avatarType:
                nextCharacter.avatarType ?? nextCharacter.avatar_type,
              agentPrompt: nextCharacter.agent_prompt,
              agentIdlePrompt: nextCharacter.agent_idle_prompt,
              aspectRatio: nextCharacter.aspect_ratio,
            }
          : undefined,
        background: nextBackground
          ? {
              id: nextBackground.id,
              name: nextBackground.avatar_name,
              url: nextBackground.url,
              avatarType:
                nextBackground.avatarType ?? nextBackground.avatar_type,
            }
          : undefined,
        llmModel: nextModel
          ? {
              id: patch.llmId ?? config.llmId,
              name: modelNameOf(nextModel),
              model: nextModel.llmModel || modelNameOf(nextModel),
              environment: nextModel.environment,
            }
          : config.llmModel,
        voice: nextVoice
          ? {
              id: patch.voiceId ?? config.voiceId,
              name: voiceNameOf(nextVoice),
              environment: nextVoice.voiceEnvironment,
              type: nextVoice.voiceType,
            }
          : config.voice,
      };
      setSessionConfig(updated);
      await options.afterUpdate?.(updated);
      if (options.reconnect !== false) {
        await reconnectSession(
          {
            llmId: updated.llmId,
            voiceId: updated.voiceId,
            characterId: updated.characterId ?? null,
            backgroundId: updated.backgroundId ?? null,
          },
          updated,
        );
      }
      toast.success(successMessage);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Conversation settings could not be updated.",
      );
    } finally {
      setUpdatingConfiguration(false);
    }
  };

  const changeModel = async (value: string) => {
    const llmId = Number(value);
    if (!llmId || !config || llmId === config.llmId) return;
    const nextModel = models.find((model) => modelIdOf(model) === llmId);
    let voiceId: number | undefined = config.voiceId;
    if (modelIsRealtime(nextModel)) {
      const environment = normalizeEnvironment(nextModel?.environment);
      const compatible = voices.filter(
        ({ group, voice }) =>
          normalizeEnvironment(voice.voiceEnvironment || group) === environment,
      );
      if (
        !compatible.some(({ voice }) => voiceIdOf(voice) === config.voiceId)
      ) {
        voiceId = compatible[0] ? voiceIdOf(compatible[0].voice) : undefined;
      }
    }
    if (!voiceId) {
      toast.error("This model does not have a compatible voice.");
      return;
    }
    await updateConfiguration(
      {
        llmId,
        ...(voiceId !== config.voiceId ? { voiceId } : {}),
      },
      "Model updated. The conversation has reconnected.",
    );
  };

  const isPresentation = Boolean(config?.agent?.isPresentationAgent);

  const publishPresentationEvent = useCallback(
    (event: string, extra?: Record<string, unknown>) => {
      if (room.status !== "connected") return;
      void room.room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ event, ...extra })),
        { reliable: true },
      );
    },
    [room],
  );

  const handleSelectLesson = useCallback(
    (contentId: number) => {
      selectLessonLocally(contentId);
      const lesson = useCourseOutlineStore
        .getState()
        .lessons.find((entry) => entry.contentId === contentId);
      useVideoChaptersStore
        .getState()
        .setChapters(chaptersFromLessonSlides(lesson?.slides));
      publishPresentationEvent("select_lesson", { contentId });
    },
    [publishPresentationEvent, selectLessonLocally],
  );

  const handleSelectQuiz = useCallback(
    (lesson: CourseLesson) => {
      const questions = Array.isArray(lesson.questions) ? lesson.questions : [];
      if (!questions.length) {
        toast.error("No quiz questions are available for this lesson.");
        return;
      }
      publishPresentationEvent("pause_presentation");
      setQuizQuestions(questions);
      setQuizOpen(true);
    },
    [publishPresentationEvent],
  );

  const openLessonsPanel = useCallback(() => {
    publishPresentationEvent("pause_presentation");
    setLessonsPanelOpen(true);
  }, [publishPresentationEvent]);

  if (loading)
    return (
      <div className="grid min-h-[calc(100dvh-4rem)] gap-4 p-4 lg:grid-cols-2 lg:p-6">
        <Skeleton className="min-h-80 rounded-xl" />
        <Skeleton className="min-h-80 rounded-xl" />
      </div>
    );
  if (error || !config)
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-8">
        <ApiError
          error={error || "Conversation not found"}
          onRetry={() => void load()}
        />
      </div>
    );

  const connectionAlert =
    room.error ||
    ["disconnected", "error", "credit-error"].includes(room.status) ? (
      <Alert variant="destructive" className="m-3 w-auto">
        <AlertCircle />
        <AlertTitle>
          {room.status === "credit-error"
            ? "Credits unavailable"
            : "Connection interrupted"}
        </AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-3">
          <span>{room.error || "Reconnect to continue."}</span>
          {room.status !== "credit-error" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void room.retry()}
            >
              <RefreshCw /> Retry
            </Button>
          )}
        </AlertDescription>
      </Alert>
    ) : null;

  const renderTimeline = (compact = false) => (
    <>
      {room.messages.length === 0 &&
      !room.transcription &&
      !room.loadingMessage ? (
        <ConversationEmptyState
          className={compact ? "min-h-52" : undefined}
          icon={<Bot className="size-7" />}
          title="Conversation ready"
          description={
            compact
              ? "The live transcription will appear here."
              : "Ask the agent anything using text or your microphone."
          }
        />
      ) : (
        room.messages.map((message) => (
          <Message key={message.id} from={message.role}>
            <MessageContent
              className={
                message.mediaUrl || message.fileUrl
                  ? "w-full max-w-xl"
                  : undefined
              }
            >
              {message.content && (
                <p className="whitespace-pre-wrap leading-6">
                  {message.content}
                </p>
              )}
              <MessageMedia message={message} />
            </MessageContent>
          </Message>
        ))
      )}
      {room.transcription && (
        <Message from="assistant">
          <MessageContent>
            <p className="whitespace-pre-wrap leading-6 text-muted-foreground">
              {room.transcription}
            </p>
          </MessageContent>
        </Message>
      )}
      {room.loadingMessage && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 px-1 text-sm text-muted-foreground"
        >
          <Sparkles className="size-4 animate-pulse motion-reduce:animate-none" />
          <span>{room.loadingMessage}</span>
        </div>
      )}
    </>
  );

  const composer = (
    <PromptInput
      onSubmit={send}
      className="aivah-surface mx-auto max-w-3xl rounded-[1.75rem] bg-card/94 p-1 backdrop-blur-xl [&_[data-slot=input-group]]:border-0 [&_[data-slot=input-group]]:bg-transparent [&_[data-slot=input-group]]:shadow-none [&_[data-slot=input-group]]:ring-0"
    >
      <PromptInputBody>
        <PromptInputTextarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask anything"
          className="min-h-12 px-3 pb-1 pt-3"
          disabled={room.status !== "connected"}
        />
      </PromptInputBody>
      <PromptInputFooter className="gap-2">
        <PromptInputTools className="min-w-0 flex-1 gap-0.5 overflow-x-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                aria-disabled="true"
                className="h-9 min-w-0 max-w-40 shrink cursor-default px-2.5 text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
              >
                <Bot className="size-4 shrink-0" />
                <span className="max-w-24 truncate">
                  {config.agent?.name || "Agent"}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              The agent is fixed for this conversation
            </TooltipContent>
          </Tooltip>
          <CharacterBackgroundPicker
            characters={characters}
            backgrounds={backgrounds}
            characterId={
              config.characterId ? String(config.characterId) : "none"
            }
            backgroundId={
              config.backgroundId ? String(config.backgroundId) : "none"
            }
            disabled={updatingConfiguration}
            onSave={(characterId, backgroundId) => {
              const nextCharacterId =
                characterId === "none" ? null : Number(characterId);
              let nextBackgroundId =
                backgroundId === "none" ? null : Number(backgroundId);
              const characterChanged =
                nextCharacterId !== (config.characterId ?? null);
              const backgroundChanged =
                nextBackgroundId !== (config.backgroundId ?? null);
              if (!characterChanged && !backgroundChanged) return;

              const nextCharacter =
                characters.find(
                  (character) => character.id === nextCharacterId,
                ) || null;
              const previousCatalog = toAvatarCatalog(
                config.character?.avatarType,
              );
              const nextCatalog =
                toAvatarCatalog(avatarTypeOf(nextCharacter)) ??
                previousCatalog;
              const isBasic = isBasicAvatarCatalog(nextCatalog);
              // Match customer-admin: clearing bg when switching Basic ↔ Hero.
              if (
                characterChanged &&
                previousCatalog &&
                nextCatalog &&
                previousCatalog !== nextCatalog
              ) {
                nextBackgroundId = null;
              }
              // Hero backgrounds are FE-composited; only Basic/character changes
              // need a LiveKit character-change event.
              const shouldPublish =
                characterChanged || (isBasic && backgroundChanged);

              void updateConfiguration(
                {
        characterId: nextCharacterId ?? undefined,
        backgroundId: nextBackgroundId ?? undefined,
                },
                "Character settings updated.",
                {
                  reconnect: false,
                  afterUpdate: shouldPublish
                    ? () =>
                        room.changeCharacter({
                          characterId: nextCharacterId,
                          // Basic only: agent needs background artifact stem.
                          backgroundId: isBasic ? nextBackgroundId : null,
                        })
                    : undefined,
                },
              );
            }}
          />
          <ComposerPicker
            pickerId="model"
            ariaLabel="Choose model"
            icon={BrainCircuit}
            placeholder={config.llmModel?.name || "Model"}
            searchPlaceholder="Search models…"
            items={modelItems}
            value={String(config.llmId)}
            disabled={updatingConfiguration}
            onValueChange={(value) => void changeModel(value)}
          />
          <VoicePicker
            pickerId="voice"
            items={voiceItems}
            value={String(config.voiceId)}
            disabled={updatingConfiguration}
            onValueChange={(value) => {
              const voiceId = Number(value);
              if (!voiceId || voiceId === config.voiceId) return;
              void updateConfiguration(
                { voiceId },
                "Voice updated. The conversation has reconnected.",
              );
            }}
          />
        </PromptInputTools>
        <div className="flex shrink-0 items-center gap-2">
          {isPresentation && (
            <PromptInputButton
              tooltip={
                transcriptionPanelOpen
                  ? "Hide transcription"
                  : "Show transcription"
              }
              aria-label={
                transcriptionPanelOpen
                  ? "Hide transcription panel"
                  : "Show transcription panel"
              }
              aria-pressed={transcriptionPanelOpen}
              onClick={() =>
                setTranscriptionPanelOpen((current) => !current)
              }
              className="size-11 rounded-full"
            >
              {transcriptionPanelOpen ? (
                <PanelRightClose />
              ) : (
                <PanelRightOpen />
              )}
            </PromptInputButton>
          )}
          <PromptInputButton
            tooltip={
              room.microphoneEnabled
                ? "Turn off microphone"
                : "Turn on microphone"
            }
            onClick={() => void room.toggleMicrophone()}
            className={cn(
              "size-11 rounded-full",
              room.microphoneEnabled &&
                "bg-accent text-accent-foreground ring-1 ring-border hover:bg-accent/80",
            )}
          >
            {room.microphoneEnabled ? <Mic /> : <MicOff />}
            <span className="sr-only">Toggle microphone</span>
          </PromptInputButton>
          <PromptInputSubmit
            className="size-11 rounded-full"
            disabled={room.status !== "connected"}
            status={
              isAgentOutputActive({
                loadingMessage: room.loadingMessage,
                transcription: room.transcription,
                agentSpeaking: room.agentSpeaking,
              })
                ? "streaming"
                : "ready"
            }
            onStop={() => void room.stop()}
          />
        </div>
      </PromptInputFooter>
    </PromptInput>
  );

  if (isPresentation) {
    return (
      <div className="flex h-[calc(100dvh-4rem)] min-h-[560px] flex-col overflow-hidden bg-background lg:h-dvh">
        <CourseOutlinePanel
          open={lessonsPanelOpen}
          onClose={() => setLessonsPanelOpen(false)}
          onSelectLesson={(contentId) => {
            handleSelectLesson(contentId);
            setLessonsPanelOpen(false);
          }}
          onSelectQuiz={handleSelectQuiz}
        />
        {quizOpen && quizQuestions.length > 0 && (
          <QuizOverlay
            questions={quizQuestions}
            onClose={() => {
              setQuizOpen(false);
              setQuizQuestions([]);
            }}
          />
        )}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          <main
            data-testid="presentation-scene"
            className="flex min-h-[55dvh] min-w-0 flex-1 flex-col bg-neutral-950 md:min-h-0"
          >
            <div className="relative min-h-0 flex-1 p-3 sm:p-4">
              <section
                data-testid="presentation-stage"
                className="relative size-full overflow-hidden rounded-2xl border border-white/10 bg-black"
              >
                <PresentationStage widget={activeWidget} />
                {lessons.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="absolute left-3 top-3 z-20 rounded-full bg-background/85 shadow-lg backdrop-blur hover:bg-background"
                    onClick={openLessonsPanel}
                  >
                    <BookOpen /> Lessons
                  </Button>
                )}
                {config.character && (
                  <AvatarStage
                    track={room.remoteVideoTrack}
                    backgroundUrl={config.background?.url}
                    avatarType={config.character.avatarType}
                    aspectRatio={
                      config.character.aspectRatio ??
                      characters.find(
                        (character) => character.id === config.character?.id,
                      )?.aspect_ratio
                    }
                    size="presentation"
                    className="absolute bottom-4 right-4"
                  />
                )}
              </section>
            </div>
            <div
              data-testid="presentation-composer"
              className="shrink-0 border-t border-white/10 bg-background px-3 py-3 sm:px-5 sm:py-4"
            >
              {composer}
            </div>
          </main>
          {transcriptionPanelOpen && (
            <aside
              aria-label="Transcription panel"
              data-testid="transcription-panel"
              className="flex max-h-[38dvh] min-h-0 shrink-0 flex-col border-t bg-background md:h-full md:max-h-none md:w-[360px] md:border-l md:border-t-0 xl:w-[400px]"
            >
              <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b px-4">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold">
                    Transcription
                  </h2>
                  <p className="truncate text-xs text-muted-foreground">
                    {room.conversationName ||
                      config.conversationName ||
                      config.agent?.name}
                  </p>
                </div>
                <ConnectionBadge status={room.status} />
              </header>
              {connectionAlert}
              <Conversation className="min-h-0 flex-1">
                <ConversationContent className="gap-5 px-4 py-5">
                  {renderTimeline(true)}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
            </aside>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[calc(100dvh-4rem)] min-h-[560px] flex-col overflow-hidden bg-background lg:h-dvh">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_64%,color-mix(in_oklab,var(--foreground)_4%,transparent),transparent_34%)]" />
      {config.character && (
        <AvatarStage
          track={room.remoteVideoTrack}
          backgroundUrl={config.background?.url}
          avatarType={config.character.avatarType}
          aspectRatio={
            config.character.aspectRatio ??
            characters.find(
              (character) => character.id === config.character?.id,
            )?.aspect_ratio
          }
          size="chat"
          className="absolute bottom-56 right-3 sm:right-5 md:bottom-44 md:right-6"
        />
      )}
      <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {room.conversationName ||
                config.conversationName ||
                config.agent?.name ||
                "Conversation"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {config.agent?.name}
            </p>
          </div>
          <ConnectionBadge status={room.status} />
        </header>
        {connectionAlert}
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 pb-48 pt-8 sm:px-6 md:pb-40">
            {renderTimeline()}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/96 to-transparent px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-12 sm:px-6 sm:pb-5">
          <div className="pointer-events-auto">{composer}</div>
        </div>
      </section>
    </div>
  );
}
