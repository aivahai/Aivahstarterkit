import type { Room } from "livekit-client";
import { create } from "zustand";

type LivekitRoomState = {
  room: Room | null;
  setRoom: (room: Room | null) => void;
};

export const useLivekitRoomStore = create<LivekitRoomState>((set) => ({
  room: null,
  setRoom: (room) => set({ room }),
}));

export const useLiveKitRoom = () => useLivekitRoomStore((s) => s.room);
