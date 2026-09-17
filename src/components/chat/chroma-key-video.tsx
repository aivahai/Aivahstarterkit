"use client";

import { CHROMA_KEY_OPTIONS } from "@/lib/chroma-key/constants";
import { createChromaKeyRenderer } from "@/lib/chroma-key/createChromaKeyRenderer";
import { cn } from "@/lib/utils";
import type { RemoteTrack } from "livekit-client";
import { useEffect, useRef } from "react";

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

function hasUsableFrame(video: HTMLVideoElement) {
  return (
    video.readyState >= video.HAVE_CURRENT_DATA &&
    video.videoWidth > 0 &&
    video.videoHeight > 0
  );
}

/**
 * LiveKit track → full-size opacity-0 video → WebGL chroma canvas.
 * Source video must stay laid out at real size — `display:none` / 1×1px
 * elements are often not decoded.
 */
export function ChromaKeyVideo({
  track,
  className,
  onFirstFrame,
}: {
  track: RemoteTrack | null;
  className?: string;
  onFirstFrame?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const onFirstFrameRef = useRef(onFirstFrame);
  onFirstFrameRef.current = onFirstFrame;

  useEffect(() => {
    const video = videoRef.current as VideoWithFrameCallback | null;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!video || !canvas || !container || !track) return;

    let renderer: ReturnType<typeof createChromaKeyRenderer> | null = null;
    let ro: ResizeObserver | null = null;
    let cancelled = false;
    let sized = false;
    let reportedFirstFrame = false;
    let rafId: number | null = null;
    let frameCallbackId: number | null = null;

    const attachedEls = track.attach(video);
    const attachedVideo = (
      Array.isArray(attachedEls) ? attachedEls[0] : attachedEls
    ) as HTMLVideoElement | undefined;
    const source = (attachedVideo ?? video) as VideoWithFrameCallback;
    source.playsInline = true;
    source.muted = true;
    source.autoplay = true;

    const ensureRenderer = () => {
      if (cancelled) return null;
      if (renderer) return renderer;
      try {
        renderer = createChromaKeyRenderer(canvas, CHROMA_KEY_OPTIONS);
      } catch (err) {
        console.error("Chroma key init failed:", err);
        return null;
      }
      return renderer;
    };

    const syncSize = () => {
      if (cancelled) return;
      const { width, height } = container.getBoundingClientRect();
      if (width <= 0 || height <= 0) {
        sized = false;
        return;
      }
      const active = ensureRenderer();
      if (!active) return;
      active.resize(width, height);
      sized = true;
      if (hasUsableFrame(source)) {
        active.render(source);
        if (!reportedFirstFrame) {
          reportedFirstFrame = true;
          onFirstFrameRef.current?.();
        }
      }
    };

    const draw = () => {
      if (cancelled) return;
      if (!sized) syncSize();
      if (renderer && sized && hasUsableFrame(source)) {
        renderer.render(source);
        if (!reportedFirstFrame) {
          reportedFirstFrame = true;
          onFirstFrameRef.current?.();
        }
      }
    };

    const schedule = () => {
      if (cancelled) return;
      draw();
      if (typeof source.requestVideoFrameCallback === "function") {
        frameCallbackId = source.requestVideoFrameCallback(() => {
          frameCallbackId = null;
          schedule();
        });
        return;
      }
      rafId = requestAnimationFrame(() => {
        rafId = null;
        schedule();
      });
    };

    const onMediaReady = () => {
      syncSize();
      void source.play().catch(() => {});
      draw();
    };

    source.addEventListener("loadedmetadata", onMediaReady);
    source.addEventListener("loadeddata", onMediaReady);
    source.addEventListener("resize", onMediaReady);
    source.addEventListener("playing", onMediaReady);
    source.addEventListener("emptied", onMediaReady);

    ro = new ResizeObserver(() => {
      syncSize();
      draw();
    });
    ro.observe(container);

    syncSize();
    schedule();
    void source.play().then(onMediaReady).catch(onMediaReady);

    const retryTimers = [200, 600, 1500].map((ms) =>
      window.setTimeout(() => {
        if (cancelled) return;
        void source.play().catch(() => {});
        syncSize();
        draw();
      }, ms),
    );

    return () => {
      cancelled = true;
      source.removeEventListener("loadedmetadata", onMediaReady);
      source.removeEventListener("loadeddata", onMediaReady);
      source.removeEventListener("resize", onMediaReady);
      source.removeEventListener("playing", onMediaReady);
      source.removeEventListener("emptied", onMediaReady);
      ro?.disconnect();
      if (rafId != null) cancelAnimationFrame(rafId);
      if (
        frameCallbackId != null &&
        typeof source.cancelVideoFrameCallback === "function"
      ) {
        source.cancelVideoFrameCallback(frameCallbackId);
      }
      retryTimers.forEach((id) => window.clearTimeout(id));
      renderer?.destroy();
      track.detach(source);
    };
  }, [track]);

  if (!track) return null;

  return (
    <div ref={containerRef} className={cn("absolute inset-0 z-[1]", className)}>
      <video
        ref={videoRef}
        className="pointer-events-none absolute inset-0 size-full object-cover opacity-0"
        playsInline
        muted
        autoPlay
      />
      <canvas
        ref={canvasRef}
        className="relative size-full bg-transparent"
      />
    </div>
  );
}
