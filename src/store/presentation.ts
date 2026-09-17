import { create } from "zustand";

type PresentationStateProps = {
  totalPages: number;
  currentPage: number;
  setTotalPages: (totalPages: number) => void;
  setCurrentPage: (currentPage: number) => void;
  reset: () => void;
};

const presentationStateInit = {
  totalPages: 0,
  currentPage: 1,
};

export const usePresentationStore = create<PresentationStateProps>((set) => ({
  ...presentationStateInit,
  setTotalPages: (totalPages) => set({ totalPages }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  reset: () => set(presentationStateInit),
}));

type PresentationVideoProps = {
  timeFrame: number;
  nextTimeFrame: number | null;
  playSource: boolean;
  forcePlayEpoch: number;
  setFrame: (
    timeFrame: number,
    nextTimeFrame: number | null,
    play?: boolean,
  ) => void;
  setPlaySource: (playSource: boolean) => void;
  bumpForcePlay: () => void;
  reset: () => void;
};

const presentationVideoInit: Pick<
  PresentationVideoProps,
  "timeFrame" | "nextTimeFrame" | "playSource" | "forcePlayEpoch"
> = {
  timeFrame: 0,
  nextTimeFrame: null,
  playSource: false,
  forcePlayEpoch: 0,
};

export const usePresentationVideoStore = create<PresentationVideoProps>(
  (set) => ({
    ...presentationVideoInit,
    setFrame: (timeFrame, nextTimeFrame, play = false) =>
      set({ timeFrame, nextTimeFrame, playSource: play }),
    setPlaySource: (playSource) => set({ playSource }),
    bumpForcePlay: () =>
      set((s) => ({ forcePlayEpoch: s.forcePlayEpoch + 1 })),
    reset: () => set(presentationVideoInit),
  }),
);

type PresentationFullScreenProps = {
  fullscreen: boolean;
  setFullScreen: (val: boolean) => void;
  toggleFullScreen: () => void;
  reset: () => void;
};

const presentationFullScreenInit = {
  fullscreen: false,
};

export const usePresentationFullScreen = create<PresentationFullScreenProps>(
  (set, get) => ({
    ...presentationFullScreenInit,
    setFullScreen: (val) => set({ fullscreen: val }),
    toggleFullScreen: () => {
      set({ fullscreen: !get().fullscreen });
    },
    reset: () => set(presentationFullScreenInit),
  }),
);
