import { describe, expect, it } from "vitest";
import {
  characterDataEvent,
  extractChatMessageMedia,
  isAgentOutputActive,
  isConversationChatPath,
  isTransientMessage,
  mergeMessages,
  normalizeChatMessage,
} from "@/lib/livekit-state";

describe("LiveKit conversation state", () => {
  it("deduplicates overlapping persisted and optimistic messages", () => {
    const merged = mergeMessages(
      [{ id: "local", role: "user", content: "Hello", pending: true }],
      [{ id: "db", role: "user", content: "Hello" }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].pending).toBe(false);
  });

  it("keeps separate media-only events and normalizes generated artifacts", () => {
    const image = extractChatMessageMedia({
      image_url: "https://cdn.example.com/image.png",
      additional_data: JSON.stringify({
        file_url: "https://cdn.example.com/image.pdf",
        file_name: "report.pdf",
      }),
    });
    expect(image).toEqual({
      type: "image",
      mediaUrl: "https://cdn.example.com/image.png",
      fileUrl: "https://cdn.example.com/image.pdf",
      fileName: "report.pdf",
    });
    expect(
      normalizeChatMessage({
        id: "document",
        role: "assistant",
        content: "",
        file_url: "https://cdn.example.com/report.pdf",
        file_name: "report.pdf",
      } as never),
    ).toMatchObject({
      type: "document",
      mediaUrl: "https://cdn.example.com/report.pdf",
      fileName: "report.pdf",
    });
    expect(
      mergeMessages(
        [
          {
            id: "image",
            role: "assistant",
            content: "",
            mediaUrl: "https://cdn.example.com/image.png",
          },
        ],
        [
          {
            id: "video",
            role: "assistant",
            content: "",
            mediaUrl: "https://cdn.example.com/video.mp4",
          },
        ],
      ),
    ).toHaveLength(2);
  });

  it("filters transient agent status messages", () => {
    expect(isTransientMessage("Thinking…")).toBe(true);
    expect(isTransientMessage("Checking credits...")).toBe(true);
    expect(isTransientMessage("Initializing conversation...")).toBe(true);
    expect(isTransientMessage("Processing your message...")).toBe(true);
    expect(isTransientMessage("Searching knowledgebase...")).toBe(true);
    expect(isTransientMessage("Presentation paused")).toBe(true);
    expect(isTransientMessage("Loading course...")).toBe(true);
    expect(isTransientMessage("Loading course")).toBe(true);
    expect(isTransientMessage("Presentation completed")).toBe(true);
    expect(isTransientMessage("Here is the answer.")).toBe(false);
  });

  it("matches the admin character event protocol for Hero and Basic", () => {
    expect(
      characterDataEvent({
        imageUrl: "https://cdn.example.com/maya.png",
        avatarName: "Maya",
        avatarType: "hero",
        characterId: 8,
        agentPrompt: "Speak warmly",
        agentIdlePrompt: "Listen attentively",
        aspectRatio: "2x3",
      }),
    ).toEqual({
      topic: "character-change",
      payload: {
        imageUrl: "https://cdn.example.com/maya.png",
        avatarName: "Maya",
        avatarType: "hero",
        characterId: 8,
        agentPrompt: "Speak warmly",
        agentIdlePrompt: "Listen attentively",
        aspectRatio: "2x3",
      },
    });
    expect(
      characterDataEvent({
        imageUrl: "https://cdn.example.com/basic.png",
        avatarName: "Alex",
        avatarType: "basic",
        characterId: "alex_worklet",
        backgroundId: "office_bg",
        backgroundAvatarType: "basic",
      }),
    ).toEqual({
      topic: "character-change",
      payload: {
        imageUrl: "https://cdn.example.com/basic.png",
        avatarName: "Alex",
        avatarType: "basic",
        characterId: "alex_worklet",
        backgroundId: "office_bg",
        backgroundAvatarType: "basic",
      },
    });
    expect(characterDataEvent(null)).toEqual({
      topic: "character-unselect",
      payload: {},
    });
  });

  it("detects when navigation leaves a conversation route", () => {
    expect(isConversationChatPath("/chat")).toBe(true);
    expect(isConversationChatPath("/chat/")).toBe(true);
    expect(isConversationChatPath("/0/chat")).toBe(false);
    expect(isConversationChatPath("/75272/chat")).toBe(false);
    expect(isConversationChatPath("/new-chat")).toBe(false);
    expect(isConversationChatPath("/characters")).toBe(false);
  });

  it("reflects whether the agent is currently producing output", () => {
    expect(
      isAgentOutputActive({
        loadingMessage: null,
        transcription: "",
        agentSpeaking: true,
      }),
    ).toBe(true);
    expect(
      isAgentOutputActive({
        loadingMessage: null,
        transcription: "",
        agentSpeaking: false,
      }),
    ).toBe(false);
  });
});
