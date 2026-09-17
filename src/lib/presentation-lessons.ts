import { aivahFetch } from "@/lib/api";
import type { Agent, AgentContent } from "@/lib/api-types";
import {
  chaptersFromLessonSlides,
  titleFromLessonPath,
  useCourseOutlineStore,
  type CourseLesson,
} from "@/store/course-outline";
import { useVideoChaptersStore } from "@/store/video-chapters";

function contentIdOf(item: AgentContent) {
  return Number(item.chatBotContentId ?? item.chat_bot_content_id ?? item.id ?? 0);
}

const MULTIMEDIA_EXTENSIONS = new Set([
  "mp4",
  "webm",
  "mov",
  "m4v",
  "avi",
  "mkv",
  "ogv",
]);

function extensionOf(path: string) {
  const match = path.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
  return match?.[1]?.toLowerCase() ?? "";
}

function contentTypeOf(item: AgentContent) {
  const explicit = item.chatBotContentType || item.content_type;
  if (explicit === "multimedia" || explicit === "attachment") return explicit;

  const path = String(
    item.storagePath || item.storageUrl || item.url || item.file_path || "",
  );
  if (MULTIMEDIA_EXTENSIONS.has(extensionOf(path))) return "multimedia";
  return "attachment";
}

function slidesOf(item: AgentContent) {
  const slides = item.chatBotContentSlides;
  if (!Array.isArray(slides)) return undefined;
  return slides
    .filter((slide) => typeof slide.slideOrder === "number")
    .map((slide) => ({
      id: slide.chatBotContentSlideId ?? slide.slideOrder,
      slideOrder: slide.slideOrder,
      transcript: slide.transcript,
      context: slide.context,
    }));
}

function questionsOf(item: AgentContent) {
  const raw =
    item.chatBotContentQuestions ??
    item.questions ??
    item.chat_bot_content_questions;
  return Array.isArray(raw) ? raw : [];
}

export function lessonsFromAgent(agentId: number, agent: Agent): CourseLesson[] {
  const content: AgentContent[] = [
    ...(Array.isArray(agent.content) ? agent.content : []),
    ...(Array.isArray(agent.contents) ? agent.contents : []),
    ...(Array.isArray(agent.chatBotContents) ? agent.chatBotContents : []),
  ];

  const seen = new Set<number>();

  return content
    .filter((item) => {
      const type = contentTypeOf(item);
      return type === "attachment" || type === "multimedia";
    })
    .map((item) => {
      const contentId = contentIdOf(item);
      const proxyUrl = `/api/aivah-media/agents/${agentId}/content/${contentId}`;
      const questions = questionsOf(item);
      return {
        contentId,
        contentType: contentTypeOf(item),
        title: titleFromLessonPath({
          storagePath: item.storagePath,
          url: item.url,
          contentId,
        }),
        url: proxyUrl,
        storagePath: item.storagePath ?? null,
        storageUrl: proxyUrl,
        hasQuiz: questions.length > 0,
        questions,
        slides: slidesOf(item),
      } satisfies CourseLesson;
    })
    .filter((lesson) => {
      if (!lesson.contentId || seen.has(lesson.contentId)) return false;
      seen.add(lesson.contentId);
      return true;
    });
}

export async function hydratePresentationFromAgent(agentId: number) {
  const agent = await aivahFetch<Agent>(`agents/${agentId}`);
  const lessons = lessonsFromAgent(agentId, agent);
  useCourseOutlineStore.getState().setLessons(lessons);

  const activeContentId = useCourseOutlineStore.getState().activeContentId;
  const activeLesson =
    lessons.find((lesson) => lesson.contentId === activeContentId) ?? lessons[0];
  useVideoChaptersStore
    .getState()
    .setChapters(chaptersFromLessonSlides(activeLesson?.slides));

  return lessons;
}
