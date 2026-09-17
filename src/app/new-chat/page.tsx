"use client";

import { ApiError } from "@/components/api-error";
import {
  CharacterBackgroundPicker,
  ComposerPicker,
  VoicePicker,
  type ComposerPickerItem,
} from "@/components/chat/composer-picker";
import { useAivahRoom } from "@/components/providers/livekit-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { aivahFetch, asArray } from "@/lib/api";
import type {
  Agent,
  Background,
  Character,
  ConversationConfig,
  LlmModelGroup,
  Paginated,
  SessionBundle,
  SessionTokenRequest,
  Voice,
} from "@/lib/api-types";
import {
  agentIdOf,
  agentNameOf,
  modelIdOf,
  modelIsRealtime,
  modelNameOf,
  normalizeEnvironment,
  voiceIdOf,
  voiceNameOf,
  type VoiceGroupResponse,
} from "@/lib/chat-selectors";
import { Bot, BrainCircuit, PresentationIcon, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export default function NewChatPage() {
  const router = useRouter();
  const room = useAivahRoom();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [modelGroups, setModelGroups] = useState<LlmModelGroup[]>([]);
  const [voiceGroups, setVoiceGroups] = useState<Record<string, Voice[]>>({});
  const [characters, setCharacters] = useState<Character[]>([]);
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [agentId, setAgentId] = useState("");
  const [llmId, setLlmId] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [characterId, setCharacterId] = useState("none");
  const [backgroundId, setBackgroundId] = useState("none");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

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
    (model) => String(modelIdOf(model)) === llmId,
  );
  const selectedAgent = agents.find(
    (agent) => String(agentIdOf(agent)) === agentId,
  );

  const isPresentationAgent = Boolean(
    selectedAgent?.is_presentation_agent || selectedAgent?.isPresentationAgent,
  );
  const availableVoices = useMemo(() => {
    if (!modelIsRealtime(selectedModel)) return voices;
    const environment = normalizeEnvironment(selectedModel?.environment);
    return voices.filter(
      ({ group, voice }) =>
        normalizeEnvironment(voice.voiceEnvironment || group) === environment,
    );
  }, [selectedModel, voices]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        agentResult,
        modelResult,
        voiceResult,
        characterResult,
        backgroundResult,
      ] = await Promise.all([
        aivahFetch<Paginated<Agent>>("agents?limit=50"),
        aivahFetch<LlmModelGroup[]>("llm-models"),
        aivahFetch<VoiceGroupResponse>("voices"),
        aivahFetch<Paginated<Character>>("characters?limit=50&avatarType=all"),
        aivahFetch<Paginated<Background>>(
          "backgrounds?limit=50&avatarType=all",
        ),
      ]);
      const loadedAgents = asArray<Agent>(agentResult);
      const loadedGroups = Array.isArray(modelResult) ? modelResult : [];
      const loadedVoices = voiceResult.groups || {};
      const firstModel = loadedGroups[0]?.options?.[0];
      const allVoices = Object.entries(loadedVoices).flatMap(
        ([group, entries]) => entries.map((voice) => ({ group, voice })),
      );
      const firstVoice =
        allVoices.find(({ group }) => group.toLowerCase() === "elevenlabs")
          ?.voice ??
        allVoices.find(({ group }) => group.toLowerCase() === "clone")?.voice ??
        allVoices[0]?.voice;

      setAgents(loadedAgents);
      setModelGroups(loadedGroups);
      setVoiceGroups(loadedVoices);
      setCharacters(asArray<Character>(characterResult, ["avatars"]));
      setBackgrounds(asArray<Background>(backgroundResult, ["backgrounds"]));
      if (loadedAgents[0]) setAgentId(String(agentIdOf(loadedAgents[0])));
      if (firstModel) setLlmId(String(modelIdOf(firstModel)));
      if (firstVoice) setVoiceId(String(voiceIdOf(firstVoice)));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Chat configuration could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (
      !availableVoices.length ||
      availableVoices.some(({ voice }) => String(voiceIdOf(voice)) === voiceId)
    )
      return;
    setVoiceId(String(voiceIdOf(availableVoices[0].voice)));
  }, [availableVoices, voiceId]);

  const agentItems: ComposerPickerItem[] = agents.map((agent) => ({
    value: String(agentIdOf(agent)),
    label: agentNameOf(agent),
    group: agent.is_presentation_agent ? "Presentation" : "Standard",
  }));
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

  const start = async () => {
    if (!agentId || !llmId || !voiceId) {
      toast.error("Choose an agent, model, and compatible voice.");
      return;
    }
    setStarting(true);
    try {
      const userMessage = isPresentationAgent ? "" : message.trim();
      const request: SessionTokenRequest = {
        agentId: Number(agentId),
        llmId: Number(llmId),
        voiceId: Number(voiceId),
        characterId: characterId === "none" ? undefined : Number(characterId),
        backgroundId:
          backgroundId === "none" ? undefined : Number(backgroundId),
        userMessage: userMessage || undefined,
      };
      const bundle = await aivahFetch<SessionBundle>("sessions/token", {
        method: "POST",
        body: JSON.stringify(request),
      });
      const agent = agents.find(
        (entry) => agentIdOf(entry) === request.agentId,
      );
      const model = models.find((entry) => modelIdOf(entry) === request.llmId);
      const voiceEntry = voices.find(
        ({ voice }) => voiceIdOf(voice) === request.voiceId,
      )?.voice;
      const character =
        characters.find((entry) => entry.id === request.characterId) ||
        undefined;
      const background =
        backgrounds.find((entry) => entry.id === request.backgroundId) ||
        undefined;
      const config: ConversationConfig = {
        conversationName: agent ? agentNameOf(agent) : "Conversation",
        agentId: request.agentId,
        llmId: request.llmId,
        voiceId: request.voiceId,
        characterId: request.characterId,
        backgroundId: request.backgroundId,
        agent: agent
          ? {
              id: request.agentId,
              name: agentNameOf(agent),
              isPresentationAgent: Boolean(
                agent.is_presentation_agent || agent.isPresentationAgent,
              ),
              trainingStatus: agent.trainingStatus,
            }
          : undefined,
        character: character
          ? {
              id: character.id,
              name: character.avatar_name,
              url: character.url,
              avatarType: character.avatarType ?? character.avatar_type,
              agentPrompt: character.agent_prompt,
              agentIdlePrompt: character.agent_idle_prompt,
              aspectRatio: character.aspect_ratio,
            }
          : undefined,
        background: background
          ? {
              id: background.id,
              name: background.avatar_name,
              url: background.url,
              avatarType: background.avatarType ?? background.avatar_type,
            }
          : undefined,
        llmModel: model
          ? {
              id: request.llmId,
              name: modelNameOf(model),
              model: model.llmModel || modelNameOf(model),
              environment: model.environment,
            }
          : undefined,
        voice: voiceEntry
          ? {
              id: request.voiceId,
              name: voiceNameOf(voiceEntry),
              environment: voiceEntry.voiceEnvironment,
              type: voiceEntry.voiceType,
            }
          : undefined,
      };
      try {
        await room.connect(bundle, config, request);
      } catch {
        // Session config is already stored; chat shows the connection error + retry.
      }
      if (userMessage) {
        room.setHistory([
          {
            id: `initial-${Date.now()}`,
            role: "user",
            content: userMessage,
            createdAt: new Date().toISOString(),
            pending: true,
          },
        ]);
      }
      router.push("/chat");
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "The conversation could not start.",
      );
    } finally {
      setStarting(false);
    }
  };

  return (
    <main className="relative flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden px-4 py-10 lg:min-h-dvh">
      <div className="aivah-grid pointer-events-none absolute inset-0 opacity-65" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-background to-transparent" />
      <section className="relative w-full max-w-[880px]">
        {error ? (
          <ApiError error={error} onRetry={() => void load()} />
        ) : loading ? (
          <div className="flex flex-col items-center gap-7">
            <Skeleton className="h-12 w-96 max-w-full" />
            <Skeleton className="h-32 w-full rounded-[2rem]" />
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void start();
            }}
            className="flex flex-col gap-6"
          >
            <h1 className="text-center text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              How can I help you today?
            </h1>
            <div className="aivah-surface overflow-hidden rounded-[2rem] bg-card/94 p-3 backdrop-blur-xl sm:p-4">
              <label htmlFor="message" className="sr-only">
                Opening message
              </label>
              {isPresentationAgent ? (
                <div className="flex min-h-14 items-center px-2 py-2 sm:px-3">
                  <p className="text-[15px] font-[450] tracking-tight text-muted-foreground/70">
                    Click start presentation to begin
                  </p>
                </div>
              ) : (
                <Textarea
                  id="message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={2}
                  placeholder="Ask anything"
                  className="field-sizing-fixed min-h-14 max-h-28 resize-none border-0 bg-transparent px-2 py-2 text-base shadow-none focus-visible:ring-0 sm:px-3"
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
              )}
              <div className="flex items-end justify-between gap-2 border-t border-border/70 pt-2">
                <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto pb-0.5">
                  <ComposerPicker
                    pickerId="agent"
                    ariaLabel="Choose agent"
                    icon={Bot}
                    placeholder="Agent"
                    searchPlaceholder="Search agents…"
                    items={agentItems}
                    value={agentId}
                    onValueChange={setAgentId}
                  />
                  <CharacterBackgroundPicker
                    characters={characters}
                    backgrounds={backgrounds}
                    characterId={characterId}
                    backgroundId={backgroundId}
                    onSave={(nextCharacter, nextBackground) => {
                      setCharacterId(nextCharacter);
                      setBackgroundId(nextBackground);
                    }}
                  />
                  <ComposerPicker
                    pickerId="model"
                    ariaLabel="Choose model"
                    icon={BrainCircuit}
                    placeholder="Model"
                    searchPlaceholder="Search models…"
                    items={modelItems}
                    value={llmId}
                    onValueChange={setLlmId}
                  />
                  <VoicePicker
                    items={voiceItems}
                    value={voiceId}
                    onValueChange={setVoiceId}
                  />
                </div>
                <Button
                  type="submit"
                  size="icon-lg"
                  className="size-11 shrink-0 rounded-full"
                  disabled={
                    starting ||
                    !agents.length ||
                    !voiceItems.length ||
                    (!isPresentationAgent && !message.trim())
                  }
                  aria-label={
                    starting
                      ? "Starting conversation"
                      : isPresentationAgent
                        ? "Start presentation"
                        : "Start conversation"
                  }
                >
                  {starting ? (
                    <Sparkles className="animate-pulse motion-reduce:animate-none" />
                  ) : isPresentationAgent ? (
                    <PresentationIcon />
                  ) : (
                    <Send />
                  )}
                </Button>
              </div>
            </div>
            {!agents.length && (
              <p className="text-center text-sm text-muted-foreground">
                Create an agent before starting a conversation.
              </p>
            )}
            {modelIsRealtime(selectedModel) && !voiceItems.length && (
              <p className="text-center text-sm text-destructive">
                This realtime model does not have a compatible voice.
              </p>
            )}
          </form>
        )}
      </section>
    </main>
  );
}
