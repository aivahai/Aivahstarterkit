"use client";

import { aivahFetch } from "@/lib/api";
import type {
  CharacterChangePayload,
  ChatMessage,
  ConversationConfig,
  SessionBundle,
  SessionTokenRequest,
} from "@/lib/api-types";
import { isAvatarParticipant } from "@/lib/avatar-video";
import {
  characterDataEvent,
  extractChatMessageMedia,
  isConversationChatPath,
  isTransientMessage,
  mergeMessages,
  normalizeChatMessage,
} from "@/lib/livekit-state";
import { applyPresentationData, isPresentationTopic } from "@/lib/presentation-data";
import { useAgentSpeakingStore } from "@/store/agent-speaking";
import { useCourseOutlineStore } from "@/store/course-outline";
import { useLivekitRoomStore } from "@/store/livekit-room";
import { usePresentationStore, usePresentationVideoStore } from "@/store/presentation";
import { useVideoChaptersStore } from "@/store/video-chapters";
import {
  ConnectionState,
  type Participant,
  type RemoteParticipant,
  RemoteTrack,
  Room,
  RoomEvent,
  Track,
  type TranscriptionSegment,
} from "livekit-client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

type Status =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "credit-error"
  | "error";

type LiveKitContextValue = {
  room: Room;
  status: Status;
  error: string | null;
  sessionConfig: ConversationConfig | null;
  messages: ChatMessage[];
  transcription: string;
  loadingMessage: string | null;
  conversationName: string | null;
  remoteVideoTrack: RemoteTrack | null;
  microphoneEnabled: boolean;
  agentConnected: boolean;
  agentSpeaking: boolean;
  connect: (
    bundle: SessionBundle,
    config: ConversationConfig,
    request: SessionTokenRequest,
  ) => Promise<void>;
  setSessionConfig: (
    config:
      | ConversationConfig
      | null
      | ((current: ConversationConfig | null) => ConversationConfig | null),
  ) => void;
  /** Re-issue an ephemeral session token and reconnect (model/voice/etc.). */
  reconnectSession: (
    patch?: Omit<Partial<SessionTokenRequest>, "characterId" | "backgroundId"> & {
      characterId?: number | null;
      backgroundId?: number | null;
    },
    configOverride?: ConversationConfig,
  ) => Promise<void>;
  retry: () => Promise<void>;
  disconnect: () => Promise<void>;
  setHistory: (messages: ChatMessage[], prepend?: boolean) => void;
  sendMessage: (message: string) => Promise<void>;
  stop: () => Promise<void>;
  toggleMicrophone: () => Promise<void>;
  /**
   * Publish a LiveKit character-change / unselect event.
   * Pass null to deselect. Otherwise resolve Hero/Basic payload server-side.
   */
  changeCharacter: (selection: {
    characterId: number | null;
    backgroundId?: number | null;
  }) => Promise<void>;
};

const LiveKitContext = createContext<LiveKitContextValue | null>(null);

function eventId(payload: Record<string, unknown>) {
  return String(
    payload.eventId ||
      payload.id ||
      `${payload.timestamp || Date.now()}-${String(payload.message || "").slice(0, 48)}`,
  );
}


function isMainAgent(participant: RemoteParticipant) {
  return (
    participant.identity.startsWith("agent-") &&
    !isAvatarParticipant(participant)
  );
}

function isUserTranscriptParticipant(room: Room, participant?: Participant) {
  if (!participant) return false;

  const identity = participant.identity?.toLowerCase() ?? "";
  const localIdentity = room.localParticipant.identity?.toLowerCase() ?? "";

  return (
    participant.isLocal ||
    participant.sid === room.localParticipant.sid ||
    (!!localIdentity && identity === localIdentity) ||
    identity.startsWith("user") ||
    identity.startsWith("customer") ||
    identity.startsWith("human") ||
    identity.startsWith("client")
  );
}

function isUserDataMessage(payload: Record<string, unknown>) {
  const sender = String(
    payload.role ||
      payload.sender ||
      payload.messageRole ||
      payload.message_role ||
      "",
  )
    .trim()
    .toLowerCase();
  return ["user", "human", "customer", "client"].includes(sender);
}

export function LiveKitProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [room] = useState(
    () =>
      new Room({
        adaptiveStream: true,
        dynacast: true,
        disconnectOnPageLeave: true,
      }),
  );
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sessionConfig, setSessionConfigState] =
    useState<ConversationConfig | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [transcription, setTranscription] = useState("");
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [conversationName, setConversationName] = useState<string | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<RemoteTrack | null>(
    null,
  );
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [agentConnected, setAgentConnected] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const activeSessionKeyRef = useRef<string | null>(null);
  const lastBundleRef = useRef<SessionBundle | null>(null);
  const lastRequestRef = useRef<SessionTokenRequest | null>(null);
  const assistantTexts = useRef(new Set<string>());
  const remoteVideoTrackRef = useRef<RemoteTrack | null>(null);
  const agentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    useLivekitRoomStore.getState().setRoom(room);
    return () => {
      useLivekitRoomStore.getState().setRoom(null);
    };
  }, [room]);

  useEffect(() => {
    useAgentSpeakingStore.getState().setAgentIsSpeaking(agentSpeaking);
  }, [agentSpeaking]);

  const clearAgentTimeout = useCallback(() => {
    if (agentTimeoutRef.current) clearTimeout(agentTimeoutRef.current);
    agentTimeoutRef.current = null;
  }, []);

  const markAgentConnected = useCallback(() => {
    clearAgentTimeout();
    setAgentConnected(true);
    setStatus("connected");
    setError(null);
  }, [clearAgentTimeout]);

  useEffect(() => {
    const onConnected = () => {
      setError(null);
      void room.startAudio();
      const agentAlreadyPresent = Array.from(
        room.remoteParticipants.values(),
      ).some(isMainAgent);
      if (agentAlreadyPresent) markAgentConnected();
      else {
        setStatus("connecting");
        clearAgentTimeout();
        agentTimeoutRef.current = setTimeout(() => {
          setStatus("error");
          setError(
            "The LiveKit room opened, but the Aivah agent did not join. Retry to request a fresh session.",
          );
        }, 30_000);
      }
    };
    const onReconnecting = () => setStatus("reconnecting");
    const onDisconnected = () => {
      clearAgentTimeout();
      setStatus("disconnected");
      setAgentConnected(false);
      setMicrophoneEnabled(false);
      setAgentSpeaking(false);
      setRemoteVideoTrack(null);
      remoteVideoTrackRef.current = null;
    };
    const onParticipantConnected = (participant: RemoteParticipant) => {
      if (isMainAgent(participant)) markAgentConnected();
    };
    const onParticipantDisconnected = (participant: RemoteParticipant) => {
      if (isMainAgent(participant)) {
        setAgentConnected(false);
        setStatus("reconnecting");
        setError("The Aivah agent left the room. Reconnecting…");
      }
      setAgentSpeaking(
        Array.from(room.remoteParticipants.values()).some(
          (remote) => remote.sid !== participant.sid && remote.isSpeaking,
        ),
      );
    };
    const onActiveSpeakersChanged = (participants: Participant[]) => {
      const remoteSpeaking = participants.some(
        (participant) => !participant.isLocal,
      );
      setAgentSpeaking(remoteSpeaking);
      if (remoteSpeaking) setLoadingMessage(null);
    };
    const onTrack = (
      track: RemoteTrack,
      _publication: unknown,
      participant: RemoteParticipant,
    ) => {
      if (track.kind === Track.Kind.Video && isAvatarParticipant(participant)) {
        remoteVideoTrackRef.current = track;
        setRemoteVideoTrack(track);
      }
      if (track.kind === Track.Kind.Audio) track.attach();
    };
    const onTrackUnsubscribed = (track: RemoteTrack) => {
      track.detach().forEach((element) => element.remove());
      if (track === remoteVideoTrackRef.current) {
        remoteVideoTrackRef.current = null;
        setRemoteVideoTrack(null);
      }
    };
    const onData = (
      bytes: Uint8Array,
      participant?: RemoteParticipant,
      _kind?: unknown,
      receivedTopic?: string,
    ) => {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        return;
      }
      const topic = String(payload.topic || receivedTopic || "");
      if (topic === "credit-error" || topic === "connection-error") {
        setStatus(topic === "credit-error" ? "credit-error" : "error");
        setError(
          String(
            payload.message ||
              (topic === "credit-error"
                ? "Credits are not available for this API key."
                : "The agent reported a connection error."),
          ),
        );
        return;
      }
      if (topic === "loading") {
        setLoadingMessage(String(payload.message || "Aivah is thinking…"));
        return;
      }
      if (topic === "conversation-name" && payload.name) {
        setConversationName(String(payload.name));
        return;
      }
      if (isPresentationTopic(topic)) {
        applyPresentationData({ ...payload, topic });
        return;
      }
      if (topic !== "message") return;
      if (
        isUserDataMessage(payload) ||
        isUserTranscriptParticipant(room, participant)
      )
        return;
      const text = String(payload.message || "").trim();
      const media = extractChatMessageMedia(payload);
      if (!text && !media.mediaUrl) return;
      if (isTransientMessage(text)) {
        setLoadingMessage(text);
        return;
      }
      if (text && assistantTexts.current.has(text) && !media.mediaUrl) return;
      if (text) assistantTexts.current.add(text);
      const message: ChatMessage = {
        id: eventId(payload),
        role: "assistant",
        content: text,
        type: media.type || "normal",
        mediaUrl: media.mediaUrl || null,
        fileUrl: media.fileUrl || null,
        fileName: media.fileName || null,
        createdAt: new Date(
          Number(payload.timestamp) || Date.now(),
        ).toISOString(),
      };
      setMessages((current) => mergeMessages(current, [message]));
      setTranscription("");
      setLoadingMessage(null);
    };
    const onTranscription = (
      segments: TranscriptionSegment[],
      participant?: Participant,
    ) => {
      const latest = segments.at(-1);
      if (!latest) return;

      if (isUserTranscriptParticipant(room, participant)) {
        if (!latest.final || !latest.text.trim()) return;
        const text = latest.text.trim();
        const message: ChatMessage = {
          id: latest.id
            ? `user-transcription-${latest.id}`
            : `user-transcription-${crypto.randomUUID()}`,
          role: "user",
          content: text,
          type: "normal",
          createdAt: new Date().toISOString(),
        };
        setMessages((current) => mergeMessages(current, [message]));
        setLoadingMessage("Aivah is thinking…");
        return;
      }

      const text = latest.text.trim();
      if (!text) {
        setTranscription("");
        return;
      }
      if (isTransientMessage(text)) {
        setLoadingMessage(text);
        setTranscription("");
        return;
      }
      setLoadingMessage(null);
      setTranscription(latest.text);
      if (!latest.final) return;
      if (assistantTexts.current.has(text)) {
        setTranscription("");
        return;
      }
      assistantTexts.current.add(text);
      const message: ChatMessage = {
        id: latest.id || `transcription-${Date.now()}`,
        role: "assistant",
        content: text,
        type: "normal",
        createdAt: new Date().toISOString(),
      };
      setMessages((current) => mergeMessages(current, [message]));
      setTranscription("");
      setLoadingMessage(null);
    };

    room
      .on(RoomEvent.Connected, onConnected)
      .on(RoomEvent.Reconnecting, onReconnecting)
      .on(RoomEvent.Reconnected, onConnected)
      .on(RoomEvent.Disconnected, onDisconnected)
      .on(RoomEvent.ParticipantConnected, onParticipantConnected)
      .on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
      .on(RoomEvent.TrackSubscribed, onTrack)
      .on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
      .on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged)
      .on(RoomEvent.DataReceived, onData)
      .on(RoomEvent.TranscriptionReceived, onTranscription);
    return () => {
      room
        .off(RoomEvent.Connected, onConnected)
        .off(RoomEvent.Reconnecting, onReconnecting)
        .off(RoomEvent.Reconnected, onConnected)
        .off(RoomEvent.Disconnected, onDisconnected)
        .off(RoomEvent.ParticipantConnected, onParticipantConnected)
        .off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
        .off(RoomEvent.TrackSubscribed, onTrack)
        .off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
        .off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged)
        .off(RoomEvent.DataReceived, onData)
        .off(RoomEvent.TranscriptionReceived, onTranscription);
    };
  }, [clearAgentTimeout, markAgentConnected, room]);

  const connect = useCallback(
    async (
      bundle: SessionBundle,
      config: ConversationConfig,
      request: SessionTokenRequest,
    ) => {
      const sessionKey = bundle.roomName || `${request.agentId}-${Date.now()}`;
      if (activeSessionKeyRef.current !== sessionKey) {
        setMessages([]);
        assistantTexts.current.clear();
        setTranscription("");
        setLoadingMessage(null);
        setConversationName(null);
        setAgentSpeaking(false);
        usePresentationStore.getState().reset();
        usePresentationVideoStore.getState().reset();
        useCourseOutlineStore.getState().reset();
        useVideoChaptersStore.getState().reset();
      }
      activeSessionKeyRef.current = sessionKey;
      setSessionConfigState(config);
      setConversationName(config.conversationName || config.agent?.name || null);
      lastBundleRef.current = bundle;
      lastRequestRef.current = request;
      clearAgentTimeout();
      setAgentConnected(false);
      if (room.state !== ConnectionState.Disconnected) {
        await room.disconnect();
      }
      setStatus("connecting");
      setError(null);
      try {
        await room.connect(bundle.url, bundle.token);
      } catch (cause) {
        setStatus("error");
        setError("Could not connect to the LiveKit room.");
        throw cause;
      }
    },
    [clearAgentTimeout, room],
  );

  const setSessionConfig = useCallback(
    (
      config:
        | ConversationConfig
        | null
        | ((current: ConversationConfig | null) => ConversationConfig | null),
    ) => {
      setSessionConfigState((current) => {
        const next = typeof config === "function" ? config(current) : config;
        if (next?.conversationName || next?.agent?.name) {
          setConversationName(
            next.conversationName || next.agent?.name || null,
          );
        }
        return next;
      });
    },
    [],
  );

  const reconnectSession = useCallback(
    async (
      patch: Omit<
        Partial<SessionTokenRequest>,
        "characterId" | "backgroundId"
      > & {
        characterId?: number | null;
        backgroundId?: number | null;
      } = {},
      configOverride?: ConversationConfig,
    ) => {
      const previous = lastRequestRef.current;
      if (!previous) {
        throw new Error("No active session to reconnect.");
      }
      const request: SessionTokenRequest = {
        agentId: patch.agentId ?? previous.agentId,
        llmId: patch.llmId ?? previous.llmId,
        voiceId: patch.voiceId ?? previous.voiceId,
      };
      const nextCharacterId =
        "characterId" in patch ? patch.characterId : previous.characterId;
      const nextBackgroundId =
        "backgroundId" in patch ? patch.backgroundId : previous.backgroundId;
      if (nextCharacterId != null) request.characterId = nextCharacterId;
      if (nextBackgroundId != null) request.backgroundId = nextBackgroundId;

      const bundle = await aivahFetch<SessionBundle>("sessions/token", {
        method: "POST",
        body: JSON.stringify(request),
      });
      const nextConfig: ConversationConfig = {
        ...(configOverride ||
          sessionConfig || {
            conversationName: "Conversation",
            agentId: request.agentId,
            llmId: request.llmId,
            voiceId: request.voiceId,
          }),
        agentId: request.agentId,
        llmId: request.llmId,
        voiceId: request.voiceId,
        characterId: request.characterId,
        backgroundId: request.backgroundId,
      };
      await connect(bundle, nextConfig, request);
    },
    [connect, sessionConfig],
  );

  const retry = useCallback(async () => {
    if (!lastRequestRef.current) return;
    await reconnectSession();
  }, [reconnectSession]);

  const disconnect = useCallback(async () => {
    await room.disconnect();
    clearAgentTimeout();
    activeSessionKeyRef.current = null;
    setSessionConfigState(null);
    lastRequestRef.current = null;
    lastBundleRef.current = null;
    setStatus("idle");
    setAgentConnected(false);
    setAgentSpeaking(false);
  }, [clearAgentTimeout, room]);

  const setHistory = useCallback((history: ChatMessage[], prepend = false) => {
    const visibleHistory = history.map(normalizeChatMessage).filter(
      (message) =>
        message.role === "user" || !isTransientMessage(message.content),
    );
    setMessages((current) => {
      const visibleCurrent = current.filter(
        (message) =>
          message.role === "user" || !isTransientMessage(message.content),
      );
      return prepend
        ? mergeMessages(visibleHistory, visibleCurrent)
        : mergeMessages(visibleCurrent, visibleHistory);
    });
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || room.state !== ConnectionState.Connected) return;
      const message: ChatMessage = {
        id: `local-${crypto.randomUUID()}`,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
        pending: true,
      };
      setMessages((current) => mergeMessages(current, [message]));
      setLoadingMessage("Aivah is thinking…");
      await room.localParticipant.sendText(text, { topic: "lk.chat" });
    },
    [room],
  );

  const stop = useCallback(async () => {
    if (room.state === ConnectionState.Connected) {
      await room.localParticipant.sendText("stop", { topic: "lk.stop" });
      setLoadingMessage(null);
      setAgentSpeaking(false);
    }
  }, [room]);

  const toggleMicrophone = useCallback(async () => {
    const next = !microphoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicrophoneEnabled(next);
  }, [microphoneEnabled, room]);

  const changeCharacter = useCallback(
    async (selection: {
      characterId: number | null;
      backgroundId?: number | null;
    }) => {
      if (room.state !== ConnectionState.Connected) return;

      let resolved: CharacterChangePayload | null = null;
      if (selection.characterId != null) {
        resolved = await aivahFetch<CharacterChangePayload>(
          "sessions/resolve-character-change",
          {
            method: "POST",
            body: JSON.stringify({
              characterId: selection.characterId,
              backgroundId: selection.backgroundId ?? undefined,
            }),
          },
        );
      }

      const { topic, payload } = characterDataEvent(resolved);
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(payload)),
        { topic, reliable: true },
      );
      if (!resolved) {
        remoteVideoTrackRef.current = null;
        setRemoteVideoTrack(null);
      }
    },
    [room],
  );

  const wasChatRouteRef = useRef(isConversationChatPath(pathname));
  useEffect(() => {
    const isChatRoute = isConversationChatPath(pathname);
    const wasChatRoute = wasChatRouteRef.current;
    wasChatRouteRef.current = isChatRoute;
    if (wasChatRoute && !isChatRoute) void disconnect();
  }, [disconnect, pathname]);

  const value = useMemo(
    () => ({
      room,
      status,
      error,
      sessionConfig,
      messages,
      transcription,
      loadingMessage,
      conversationName,
      remoteVideoTrack,
      microphoneEnabled,
      agentConnected,
      agentSpeaking,
      connect,
      setSessionConfig,
      reconnectSession,
      retry,
      disconnect,
      setHistory,
      sendMessage,
      stop,
      toggleMicrophone,
      changeCharacter,
    }),
    [
      agentConnected,
      agentSpeaking,
      connect,
      changeCharacter,
      disconnect,
      error,
      loadingMessage,
      conversationName,
      messages,
      microphoneEnabled,
      reconnectSession,
      remoteVideoTrack,
      retry,
      room,
      sendMessage,
      sessionConfig,
      setHistory,
      setSessionConfig,
      status,
      stop,
      toggleMicrophone,
      transcription,
    ],
  );
  return (
    <LiveKitContext.Provider value={value}>{children}</LiveKitContext.Provider>
  );
}

export function useAivahRoom() {
  const value = useContext(LiveKitContext);
  if (!value)
    throw new Error("useAivahRoom must be used inside LiveKitProvider");
  return value;
}
