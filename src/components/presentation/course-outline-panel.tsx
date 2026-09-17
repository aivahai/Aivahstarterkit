"use client";

import { FileText, HelpCircle, PlayCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type CourseLesson,
  useCourseOutlineStore,
} from "@/store/course-outline";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelectLesson: (contentId: number) => void;
  onSelectQuiz: (lesson: CourseLesson) => void;
};

function lessonIcon(contentType: string) {
  if (contentType === "multimedia") {
    return <PlayCircle className="h-4 w-4 shrink-0 text-sky-600" />;
  }
  return <FileText className="h-4 w-4 shrink-0 text-amber-700" />;
}

export default function CourseOutlinePanel({
  open,
  onClose,
  onSelectLesson,
  onSelectQuiz,
}: Props) {
  const lessons = useCourseOutlineStore((s) => s.lessons);
  const activeContentId = useCourseOutlineStore((s) => s.activeContentId);
  const lessonProgress = useCourseOutlineStore((s) => s.lessonProgress);
  const progress = useCourseOutlineStore((s) => s.progress);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-start">
      <button
        type="button"
        aria-label="Close lessons panel"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside
        className={cn(
          "relative z-10 flex h-full w-[min(100vw,20rem)] flex-col border-r border-border/60 bg-background shadow-xl",
          "animate-in slide-in-from-left duration-200",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Course
            </p>
            <h2 className="mt-0.5 text-sm font-semibold text-foreground">
              Lessons & quizzes
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 cursor-pointer"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {!lessons.length ? (
            <p className="px-2.5 py-4 text-sm text-muted-foreground">
              No lessons available yet.
            </p>
          ) : (
            <ol className="space-y-1">
              {lessons.map((lesson, index) => {
                const active = lesson.contentId === activeContentId;
                const pct = lessonProgress[lesson.contentId] ?? 0;
                const isLive =
                  active &&
                  progress?.active &&
                  progress.contentId === lesson.contentId;
                return (
                  <li key={lesson.contentId}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectLesson(lesson.contentId);
                        onClose();
                      }}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
                        active
                          ? "bg-foreground/[0.07] text-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold tabular-nums text-muted-foreground">
                        {index + 1}
                      </span>
                      <span className="mt-0.5">
                        {lessonIcon(lesson.contentType)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium leading-snug">
                          {lesson.title}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>
                            {lesson.contentType === "multimedia"
                              ? "Video"
                              : "Slides"}
                          </span>
                          {isLive ? (
                            <span className="rounded-full bg-emerald-500/15 px-1.5 py-px text-emerald-700 dark:text-emerald-400">
                              {progress?.paused ? "Paused" : "Live"}
                            </span>
                          ) : pct > 0 ? (
                            <span className="tabular-nums">{pct}%</span>
                          ) : null}
                        </span>
                        {pct > 0 ? (
                          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted">
                            <span
                              className="block h-full rounded-full bg-foreground/70"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </span>
                        ) : null}
                      </span>
                    </button>

                    {lesson.hasQuiz && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectQuiz(lesson);
                          onClose();
                        }}
                        className="mt-0.5 mb-1 ml-8 flex w-[calc(100%-2rem)] items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                      >
                        <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Quiz · {lesson.title}</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </nav>
      </aside>
    </div>
  );
}
