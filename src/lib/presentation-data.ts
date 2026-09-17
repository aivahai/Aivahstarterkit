import {
  chaptersFromLessonSlides,
  resolveLessonMediaUrl,
  useCourseOutlineStore,
  type CourseLesson,
  type PresentationProgress,
} from "@/store/course-outline";
import { usePresentationStore, usePresentationVideoStore } from "@/store/presentation";
import { useVideoChaptersStore } from "@/store/video-chapters";

const PRESENTATION_TOPICS = new Set([
  "time-frame",
  "pause-video",
  "play-video",
  "presentation-page-number",
  "active-lesson",
  "course-outline",
  "presentation-progress",
]);

export function isPresentationTopic(topic: string) {
  return PRESENTATION_TOPICS.has(topic);
}

function progressFromPayload(
  payload: Record<string, unknown>,
  contentId: number | null,
  contentType: string | null,
): PresentationProgress {
  return {
    contentId,
    title: typeof payload.title === "string" ? payload.title : null,
    contentType,
    index: Number(payload.index) || 0,
    total: Number(payload.total) || 0,
    displayIndex: Number(payload.displayIndex) || 0,
    percent: Number(payload.percent) || 0,
    paused: Boolean(payload.paused),
    active: Boolean(payload.active),
    mode:
      typeof payload.mode === "string"
        ? payload.mode
        : payload.paused
          ? "qa"
          : payload.active
            ? "presenting"
            : "idle",
    topic: typeof payload.unitTopic === "string" ? payload.unitTopic : null,
    label: typeof payload.label === "string" ? payload.label : null,
    spokenCharOffset: Number(payload.spokenCharOffset) || 0,
  };
}

function applyActiveLesson(payload: Record<string, unknown>) {
  const outline = useCourseOutlineStore.getState();
  const contentIdRaw = Number(payload.contentId);
  const contentId = Number.isFinite(contentIdRaw) ? contentIdRaw : null;
  const prevActiveId = outline.activeContentId;
  const contentType: CourseLesson["contentType"] =
    payload.contentType === "multimedia" || payload.type === "multimedia"
      ? "multimedia"
      : "attachment";

  if (contentId != null) outline.selectLessonLocally(contentId);
  const lesson =
    contentId != null
      ? outline.lessons.find((entry) => entry.contentId === contentId)
      : undefined;

  const payloadUrl =
    (typeof payload.url === "string" && payload.url) ||
    (typeof payload.storagePath === "string" && payload.storagePath) ||
    "";
  const url =
    resolveLessonMediaUrl(lesson) ||
    (/^https?:\/\//i.test(payloadUrl) || payloadUrl.startsWith("/")
      ? payloadUrl
      : "");
  if (url) {
    outline.setActiveWidget({
      type: contentType === "multimedia" ? "multimedia" : "attachment",
      url,
    });
  }
  if (lesson) {
    useVideoChaptersStore.getState().setChapters(chaptersFromLessonSlides(lesson.slides));
  }
  if (contentId != null && prevActiveId != null && prevActiveId !== contentId) {
    usePresentationVideoStore.getState().reset();
    usePresentationStore.getState().reset();
  }
  if (payload.percent != null || payload.active != null || payload.mode != null) {
    outline.setProgress(progressFromPayload(payload, contentId, contentType));
  }
}

function applyCourseOutline(payload: Record<string, unknown>) {
  const incoming = Array.isArray(payload.lessons)
    ? (payload.lessons as Record<string, unknown>[])
    : [];
  if (!incoming.length) return;

  const outline = useCourseOutlineStore.getState();
  const byId = new Map(outline.lessons.map((lesson) => [lesson.contentId, lesson]));
  const isUsableMediaUrl = (value: unknown) =>
    typeof value === "string" &&
    (/^https?:\/\//i.test(value) || value.startsWith("/"));

  const merged: CourseLesson[] = incoming.map((item) => {
    const id = Number(item.contentId);
    const prev = byId.get(id);
    const incomingUrl = item.url as string | undefined;
    const incomingStorageUrl = item.storageUrl as string | undefined;
    return {
      contentId: id,
      contentType:
        (item.contentType as string) || (item.type as string) || prev?.contentType || "attachment",
      title: (item.title as string) || prev?.title || `Lesson ${id}`,
      url: isUsableMediaUrl(incomingUrl)
        ? incomingUrl
        : (prev?.url ?? null),
      storagePath: (item.storagePath as string) ?? prev?.storagePath ?? null,
      storageUrl: isUsableMediaUrl(incomingStorageUrl)
        ? incomingStorageUrl
        : (prev?.storageUrl ?? null),
      hasQuiz: prev?.hasQuiz ?? false,
      questions: prev?.questions,
      slides: prev?.slides,
      bookmark: (item.bookmark as CourseLesson["bookmark"]) ?? prev?.bookmark ?? null,
    };
  });
  outline.setLessons(merged);
}

function applyPresentationProgress(payload: Record<string, unknown>) {
  const contentIdRaw = Number(payload.contentId);
  const contentId = Number.isFinite(contentIdRaw) ? contentIdRaw : null;
  const outline = useCourseOutlineStore.getState();
  const contentType =
    typeof payload.contentType === "string" ? payload.contentType : null;

  outline.setProgress(progressFromPayload(payload, contentId, contentType));

  if (contentId != null && outline.activeContentId !== contentId) {
    outline.selectLessonLocally(contentId);
    const lesson = outline.lessons.find((entry) => entry.contentId === contentId);
    const url = resolveLessonMediaUrl(lesson);
    if (url && lesson) {
      outline.setActiveWidget({
        type: lesson.contentType === "multimedia" ? "multimedia" : "attachment",
        url,
      });
    }
    if (lesson) {
      useVideoChaptersStore.getState().setChapters(chaptersFromLessonSlides(lesson.slides));
    }
  }
}

export function applyPresentationData(payload: Record<string, unknown>) {
  const topic = String(payload.topic || "");
  switch (topic) {
    case "presentation-page-number":
      usePresentationStore.getState().setCurrentPage(Number(payload.pageNumber) || 1);
      return;
    case "time-frame": {
      const nextRaw = payload.nextTimeFrame;
      const nextParsed = nextRaw == null ? null : Number(nextRaw);
      usePresentationVideoStore.getState().setFrame(
        Number(payload.timeFrame) || 0,
        nextParsed != null && Number.isFinite(nextParsed) ? nextParsed : null,
        payload.play !== false,
      );
      return;
    }
    case "play-video":
      usePresentationVideoStore.getState().setPlaySource(true);
      if (payload.force) usePresentationVideoStore.getState().bumpForcePlay();
      return;
    case "pause-video":
      usePresentationVideoStore.getState().setPlaySource(false);
      return;
    case "active-lesson":
      applyActiveLesson(payload);
      return;
    case "course-outline":
      applyCourseOutline(payload);
      return;
    case "presentation-progress":
      applyPresentationProgress(payload);
      return;
    default:
      return;
  }
}
