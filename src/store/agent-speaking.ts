import { create } from "zustand";

type AgentSpeakingStore = {
  agentIsSpeaking: boolean;
  setAgentIsSpeaking: (value: boolean) => void;
};

export const useAgentSpeakingStore = create<AgentSpeakingStore>((set) => ({
  agentIsSpeaking: false,
  setAgentIsSpeaking: (value) => set({ agentIsSpeaking: value }),
}));

export const useAgentIsSpeaking = () =>
  useAgentSpeakingStore((s) => s.agentIsSpeaking);
