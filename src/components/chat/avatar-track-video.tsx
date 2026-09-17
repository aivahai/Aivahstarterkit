"use client";

import { cn } from "@/lib/utils";
import type { RemoteTrack } from "livekit-client";
import { useEffect, useRef } from "react";

/** Plain LiveKit track attach — no chroma key (Basic, or Hero without bg). */
export function AvatarTrackVideo({
  track,
  className,
  onFirstFrame,
}: {
  track: RemoteTrack | null;
  className?: string;
  onFirstFrame?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onFirstFrameRef = useRef(onFirstFrame);
  onFirstFrameRef.current = onFirstFrame;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !track) return;

    let reported = false;
    const attachedEls = track.attach(video);
    const source = (
      Array.isArray(attachedEls) ? attachedEls[0] : attachedEls
    ) as HTMLVideoElement | undefined;
    const el = source ?? video;
    el.playsInline = true;
    el.muted = true;
    el.autoplay = true;

    const report = () => {
      if (reported) return;
      if (el.readyState < el.HAVE_CURRENT_DATA || el.videoWidth <= 0) return;
      reported = true;
      onFirstFrameRef.current?.();
    };

    const onReady = () => {
      void el.play().catch(() => {});
      report();
    };

    el.addEventListener("loadeddata", onReady);
    el.addEventListener("playing", onReady);
    void el.play().then(onReady).catch(onReady);

    return () => {
      el.removeEventListener("loadeddata", onReady);
      el.removeEventListener("playing", onReady);
      track.detach(el);
    };
  }, [track]);

  if (!track) return null;

  return (
    <video
      ref={videoRef}
      className={cn(
        "pointer-events-none absolute inset-0 size-full object-cover",
        className,
      )}
      playsInline
      muted
      autoPlay
    />
  );
}
