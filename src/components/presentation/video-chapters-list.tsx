"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Room } from "livekit-client";
import { ListVideoIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useLiveKitRoom } from "@/store/livekit-room";
import { usePresentationVideoStore } from "@/store/presentation";
import { useVideoChapters } from "@/store/video-chapters";

const JUMP_TO_CHAPTER = "jump_to_chapter";

const formatMmSs = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const publishJump = (room: Room | null, slideOrder: number) => {
  if (!room?.localParticipant) return;
  try {
    const payload = new TextEncoder().encode(
      JSON.stringify({ event: JUMP_TO_CHAPTER, slideOrder })
    );
    room.localParticipant.publishData(payload, { reliable: true });
  } catch {
    /* network drop -> the next click can retry */
  }
};

export default function VideoChaptersList() {
  const chapters = useVideoChapters();
  const timeFrame = usePresentationVideoStore((s) => s.timeFrame);
  const room = useLiveKitRoom();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeChapterId = useMemo(() => {
    if (!chapters.length) return null;
    let active = chapters[0];
    for (const c of chapters) {
      if (c.slideOrder <= timeFrame) active = c;
      else break;
    }
    return active.id;
  }, [chapters, timeFrame]);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!chapters.length) return null;

  return (
    <div ref={panelRef} className="pointer-events-auto absolute top-3 right-3 z-20">
      <button
        type="button"
        aria-label="Open chapters"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium",
          "border border-white/20 bg-black/55 text-white shadow-md backdrop-blur-md",
          "transition-colors hover:bg-black/70",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        )}
      >
        <ListVideoIcon className="h-4 w-4" />
        <span>Chapters</span>
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 mt-2 w-96 overflow-hidden rounded-xl",
            "border border-border/60 bg-popover text-popover-foreground shadow-lg"
          )}
        >
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Chapters ({chapters.length})
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
          <ul className="max-h-[22rem] overflow-y-auto py-1">
            {chapters.map((chapter) => {
              const isActive = chapter.id === activeChapterId;
              return (
                <li key={chapter.id}>
                  <button
                    type="button"
                    onClick={() => {
                      publishJump(room, chapter.slideOrder);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-start gap-3.5 px-4 py-2.5 text-left text-base transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isActive && "bg-accent/60 font-medium"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 inline-flex min-w-[52px] justify-center rounded px-2 py-0.5 text-xs font-mono tabular-nums",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {formatMmSs(chapter.slideOrder)}
                    </span>
                    <span className="flex-1 leading-snug">
                      {chapter.title || `Chapter ${chapter.slideOrder}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
