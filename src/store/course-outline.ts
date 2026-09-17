import { create } from "zustand";

export type CourseLessonType = "attachment" | "multimedia" | string;

export type CourseLesson = {
  contentId: number;
  contentType: CourseLessonType;
  title: string;
  url?: string | null;
  storagePath?: string | null;
  storageUrl?: string | null;
  hasQuiz: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  questions?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slides?: any[];
  bookmark?: {
    contentId: number;
    index: number;
    spokenCharOffset: number;
    contentType?: string;
  } | null;
};

export type CourseWidget = {
  type: "attachment" | "multimedia" | "image" | "iframe" | "youtubeurl" | "video";
  url: string;
};

export type PresentationProgress = {
  contentId: number | null;
  title: string | null;
  contentType: string | null;
  index: number;
  total: number;
  displayIndex: number;
  percent: number;
  paused: boolean;
  active: boolean;
  mode: "presenting" | "qa" | "idle" | string;
  topic: string | null;
  label: string | null;
  spokenCharOffset: number;
};

type CourseOutlineState = {
  lessons: CourseLesson[];
  activeContentId: number | null;
  activeWidget: CourseWidget | null;
  progress: PresentationProgress | null;
  lessonProgress: Record<number, number>;
  setLessons: (lessons: CourseLesson[]) => void;
  setActiveContentId: (contentId: number | null) => void;
  setActiveWidget: (widget: CourseWidget | null) => void;
  selectLessonLocally: (contentId: number) => void;
  setProgress: (progress: PresentationProgress | null) => void;
  reset: () => void;
};

const init = {
  lessons: [] as CourseLesson[],
  activeContentId: null as number | null,
  activeWidget: null as CourseWidget | null,
  progress: null as PresentationProgress | null,
  lessonProgress: {} as Record<number, number>,
};

export function resolveLessonMediaUrl(
  lesson:
    | Pick<CourseLesson, "storageUrl" | "url" | "storagePath">
    | null
    | undefined,
): string {
  if (!lesson) return "";
  for (const candidate of [lesson.storageUrl, lesson.url, lesson.storagePath]) {
    const value = (candidate || "").trim();
    if (!value) continue;
    if (/^https?:\/\//i.test(value) || value.startsWith("/")) return value;
  }
  return "";
}

export function widgetFromLesson(
  lesson: CourseLesson | undefined,
): CourseWidget | null {
  if (!lesson) return null;
  const url = resolveLessonMediaUrl(lesson);
  if (!url) return null;
  return {
    type: lesson.contentType === "multimedia" ? "multimedia" : "attachment",
    url,
  };
}

export function chaptersFromLessonSlides(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slides: any[] | undefined,
) {
  if (!Array.isArray(slides)) return [];
  return slides
    .filter(
      (
        s,
      ): s is {
        id: number;
        context: string;
        transcript?: string;
        slideOrder: number;
      } => s != null && typeof s.slideOrder === "number",
    )
    .map((s) => ({
      id: s.id,
      title: s.context ?? "",
      slideOrder: s.slideOrder,
      transcript: s.transcript,
    }));
}

export function titleFromLessonPath(item: {
  storagePath?: string | null;
  url?: string | null;
  textContent?: string | null;
  contentId?: number;
  chatBotContentId?: number;
}): string {
  const path = (item.storagePath || item.url || "").trim();
  let name = path.includes("/") ? path.split("/").pop() || "" : path;
  name = name.split("?")[0];
  for (const ext of [".pdf", ".mp4", ".webm", ".mov", ".mkv", ".m4v"]) {
    if (name.toLowerCase().endsWith(ext)) {
      name = name.slice(0, -ext.length);
      break;
    }
  }
  name = name
    .replace(/^(ssvid\.net|y2mate|savefrom|youtube|youtu\.be)\s+/i, "")
    .replace(/\s+\d{3,4}p\b/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (name) return name;
  const text = (item.textContent || "").trim();
  if (text) return text.slice(0, 60);
  return `Lesson ${item.contentId ?? item.chatBotContentId ?? ""}`;
}

export const useCourseOutlineStore = create<CourseOutlineState>((set, get) => ({
  ...init,
  setLessons: (lessons) => {
    const currentId = get().activeContentId;
    const nextActive =
      currentId != null && lessons.some((l) => l.contentId === currentId)
        ? currentId
        : (lessons[0]?.contentId ?? null);
    const lesson = lessons.find((l) => l.contentId === nextActive);
    const lessonProgress = { ...get().lessonProgress };
    for (const l of lessons) {
      if (l.bookmark && typeof l.bookmark.index === "number") {
        lessonProgress[l.contentId] = Math.max(
          lessonProgress[l.contentId] ?? 0,
          Math.min(99, (l.bookmark.index + 1) * 5),
        );
      }
    }
    set({
      lessons,
      activeContentId: nextActive,
      activeWidget: widgetFromLesson(lesson) ?? get().activeWidget,
      lessonProgress,
    });
  },
  setActiveContentId: (contentId) => set({ activeContentId: contentId }),
  setActiveWidget: (widget) => set({ activeWidget: widget }),
  selectLessonLocally: (contentId) => {
    const lesson = get().lessons.find((l) => l.contentId === contentId);
    const widget = widgetFromLesson(lesson);
    set({
      activeContentId: contentId,
      ...(widget ? { activeWidget: widget } : {}),
    });
  },
  setProgress: (progress) => {
    if (!progress) {
      set({ progress: null });
      return;
    }
    const lessonProgress = { ...get().lessonProgress };
    if (progress.contentId != null && progress.active) {
      lessonProgress[progress.contentId] = Math.max(
        0,
        Math.min(100, progress.percent),
      );
    }
    set({ progress, lessonProgress });
  },
  reset: () => set({ ...init }),
}));
