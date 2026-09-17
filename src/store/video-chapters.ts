import { create } from "zustand";

export type VideoChapter = {
  id: number;
  title: string;
  slideOrder: number;
  transcript?: string;
};

type VideoChaptersStore = {
  chapters: VideoChapter[];
  setChapters: (chapters: VideoChapter[]) => void;
  reset: () => void;
};

export const useVideoChaptersStore = create<VideoChaptersStore>((set) => ({
  chapters: [],
  setChapters: (chapters) => set({ chapters }),
  reset: () => set({ chapters: [] }),
}));

export const useVideoChapters = () => useVideoChaptersStore((s) => s.chapters);
