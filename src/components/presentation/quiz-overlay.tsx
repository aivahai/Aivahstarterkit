"use client";

import { useEffect, useMemo, useState } from "react";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Choice {
  id: number;
  choice: string;
  description?: string;
}

interface Question {
  id: number;
  question: string;
  hint?: string;
  answer_id: number;
  choices: Choice[];
}

interface QuizOverlayProps {
  questions: Question[];
  onClose: () => void;
}

interface Stats {
  right: number;
  wrong: number;
  skipped: number;
  score: string;
}

export function QuizOverlay({ questions, onClose }: QuizOverlayProps) {
  const total = questions?.length || 0;
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Record<number, number | undefined>>(
    {}
  );
  const [showHint, setShowHint] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

  const current: Question | undefined = questions?.[index];

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const stats = useMemo((): Stats => {
    if (!submitted)
      return { right: 0, wrong: 0, skipped: total, score: `0/${total}` };
    let right = 0;
    let wrong = 0;
    questions.forEach((q) => {
      const s = selected[q.id];
      if (s == null) return;
      if (s === q.answer_id) right += 1;
      else wrong += 1;
    });
    const skipped = total - right - wrong;
    return { right, wrong, skipped, score: `${right}/${total}` };
  }, [submitted, questions, selected, total]);

  const reset = () => {
    setIndex(0);
    setSelected({});
    setShowHint(false);
    setSubmitted(false);
    setReviewMode(false);
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const choose = (q: Question, choiceId: number) => {
    if (submitted || reviewMode) return;
    if (selected[q.id] != null) return;
    setSelected((prev) => ({ ...prev, [q.id]: choiceId }));
  };

  const goNext = () => {
    setIndex((i) => Math.min(total - 1, i + 1));
    setShowHint(false);
  };
  const goPrev = () => {
    setIndex((i) => Math.max(0, i - 1));
    setShowHint(false);
  };
  const submit = () => {
    setSubmitted(true);
    setShowHint(false);
  };

  const renderQuestion = () => {
    if (!current)
      return (
        <div className="flex-1 overflow-auto p-5">No questions available.</div>
      );

    const picked = selected[current.id];
    const showDescriptions = picked != null;
    const pickedIsCorrect = picked === current.answer_id;

    return (
      <>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-muted-foreground text-sm font-semibold">
            {index + 1}/{total}
          </div>
        </div>
        <div className="mb-3 text-lg font-semibold">{current.question}</div>
        <div className="grid gap-2.5">
          {current.choices.map((c) => {
            const isSelected = picked === c.id;
            const isCorrect = c.id === current.answer_id;
            let greyOthers = false;
            if (showDescriptions) {
              if (pickedIsCorrect) {
                greyOthers = !isSelected;
              } else {
                greyOthers = !isSelected && !isCorrect;
              }
            }

            const showCorrectTag =
              showDescriptions && isCorrect && (!isSelected || pickedIsCorrect);
            const showIncorrectTag =
              showDescriptions && isSelected && !isCorrect;

            return (
              <div
                key={c.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background",
                  greyOthers && "opacity-50"
                )}
                onClick={() => choose(current, c.id)}
                role="button"
              >
                <div className="pt-0.5">
                  <input
                    type="radio"
                    checked={!!isSelected}
                    readOnly
                    className="accent-primary"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{c.choice}</div>
                    {showCorrectTag && (
                      <span className="ml-auto rounded-full border border-green-500 bg-green-50 px-2 py-0.5 text-xs text-green-600 dark:bg-green-950 dark:text-green-400">
                        Correct
                      </span>
                    )}
                    {showIncorrectTag && (
                      <span className="ml-auto rounded-full border border-red-500 bg-red-50 px-2 py-0.5 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
                        Incorrect
                      </span>
                    )}
                  </div>
                  {showDescriptions && c.description && (
                    <div className="text-muted-foreground mt-1.5 text-sm">
                      {c.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const renderBottomBar = () => {
    if (submitted && !reviewMode) return null;
    if (total === 0) return null;

    const isFirst = index === 0;
    const isLast = index === total - 1;

    return (
      <div className="border-border flex items-center justify-between border-t px-4 py-3">
        <Button variant="outline" size="sm" onClick={() => setShowHint((v) => !v)}>
          Hint
        </Button>
        <div className="flex items-center gap-2">
          {!isFirst && (
            <Button variant="outline" size="sm" onClick={goPrev}>
              Previous
            </Button>
          )}
          {!isLast && (
            <Button size="sm" onClick={goNext}>
              Next
            </Button>
          )}
          {isLast && (
            <Button size="sm" onClick={submit}>
              Submit
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderHint = () => {
    if (!showHint || !current?.hint) return null;
    return (
      <div className="text-muted-foreground border-border mx-3 mb-3 rounded-lg border px-3 py-1.5 text-sm">
        {current.hint}
      </div>
    );
  };

  const renderResults = () => {
    if (!submitted || reviewMode) return null;
    return (
      <div className="py-6 text-center">
        <div className="mb-2 text-xl font-bold">Quiz Complete</div>
        <div className="text-base">Score: {stats.score}</div>
        <div className="mt-3 flex flex-wrap justify-center gap-4">
          <span className="border-border rounded-full border bg-zinc-100 px-3 py-1.5 text-sm font-semibold dark:bg-zinc-800">
            Right: {stats.right}
          </span>
          <span className="border-border rounded-full border bg-zinc-100 px-3 py-1.5 text-sm font-semibold dark:bg-zinc-800">
            Wrong: {stats.wrong}
          </span>
          <span className="border-border rounded-full border bg-zinc-100 px-3 py-1.5 text-sm font-semibold dark:bg-zinc-800">
            Skipped: {stats.skipped}
          </span>
        </div>
        <div className="mt-4 flex justify-center gap-3">
          <Button size="sm" onClick={() => setReviewMode(true)}>
            Review Quiz
          </Button>
          <Button variant="outline" size="sm" onClick={reset}>
            Retake Quiz
          </Button>
        </div>
      </div>
    );
  };

  const renderReview = () => {
    if (!reviewMode) return null;
    return (
      <div className="px-5">
        <div className="mb-3 text-lg font-bold">Review Quiz</div>
        {questions.map((q, qi) => {
          const picked = selected[q.id];
          const correctChoice = q.choices.find((c) => c.id === q.answer_id);
          const pickedChoice = q.choices.find((c) => c.id === picked);
          const correct = picked != null && picked === q.answer_id;
          return (
            <div
              key={q.id}
              className="border-border mb-2.5 rounded-lg border p-3.5"
            >
              <div className="mb-1.5 flex items-center justify-between">
                <div className="text-sm font-semibold">
                  {qi + 1}/{total}
                </div>
                {correct ? (
                  <span className="rounded-full border border-green-500 bg-green-50 px-2 py-0.5 text-xs text-green-600 dark:bg-green-950 dark:text-green-400">
                    Correct
                  </span>
                ) : (
                  <span className="rounded-full border border-red-500 bg-red-50 px-2 py-0.5 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
                    {picked == null ? "Skipped" : "Wrong"}
                  </span>
                )}
              </div>
              <div className="mb-2 font-bold">{q.question}</div>
              <div className="mb-1.5 text-sm">
                Your answer: {pickedChoice ? pickedChoice.choice : "\u2014"}
              </div>
              <div className="text-sm">
                Correct answer: {correctChoice?.choice}
              </div>
            </div>
          );
        })}
        <div className="mt-3 flex gap-2 pb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReviewMode(false)}
          >
            Back to Results
          </Button>
          <Button size="sm" onClick={reset}>
            Retake Quiz
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/60">
      <div className="bg-background flex max-h-full w-[min(900px,92vw)] flex-col overflow-hidden rounded-xl shadow-xl">
        {/* Header */}
        <div className="border-border flex items-center border-b px-4 py-3.5">
          <div className="text-base font-bold">Quiz</div>
          <div className="flex-1" />
          <button
            aria-label="Close"
            className="hover:bg-muted rounded-md p-1 transition-colors"
            onClick={handleClose}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5">
          {!submitted && !reviewMode && renderQuestion()}
          {submitted && !reviewMode && renderResults()}
          {reviewMode && renderReview()}
        </div>

        {/* Bottom bar / hint */}
        {!submitted && !reviewMode && (
          <>
            {renderBottomBar()}
            {renderHint()}
          </>
        )}
      </div>
    </div>
  );
}
