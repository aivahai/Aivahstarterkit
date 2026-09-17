"use client";

import { useEffect, useRef, useState } from "react";

import type { Room } from "livekit-client";

import {
  useAgentIsSpeaking,
  useAgentSpeakingStore,
} from "@/store/agent-speaking";
import { useLiveKitRoom, useLivekitRoomStore } from "@/store/livekit-room";
import { useCourseOutlineStore } from "@/store/course-outline";
import { usePresentationVideoStore } from "@/store/presentation";

import VideoChaptersList from "./video-chapters-list";

type Props = {
  url: string;
};

const CHAPTER_CHANGE = "chapter_change";
const PAUSE_PRESENTATION = "pause_presentation";
const RESUME_PRESENTATION = "resume_presentation";

const SEEK_TOLERANCE_SECONDS = 0.6;

const publishEvent = (
  room: Room | null,
  event: string,
  extra?: Record<string, unknown>
) => {
  if (!room?.localParticipant) return;
  try {
    const payload = new TextEncoder().encode(
      JSON.stringify({ event, ...(extra ?? {}) })
    );
    room.localParticipant.publishData(payload, { reliable: true });
  } catch {
    /* ignore */
  }
};

const VideoSource = ({ url }: Props) => {
  const playSource = usePresentationVideoStore((s) => s.playSource);
  const timeFrame = usePresentationVideoStore((s) => s.timeFrame);
  const nextTimeFrame = usePresentationVideoStore((s) => s.nextTimeFrame);
  const forcePlayEpoch = usePresentationVideoStore((s) => s.forcePlayEpoch);
  const setPlaySource = usePresentationVideoStore((s) => s.setPlaySource);
  const reset = usePresentationVideoStore((s) => s.reset);
  const presentationPaused = useCourseOutlineStore(
    (s) => Boolean(s.progress?.paused && s.progress?.active)
  );

  // LiveKit room from singleton store (outside Canvas Html portal).
  const room = useLiveKitRoom();

  // pendingPlayRef: play intent pending agent speech or forcePlayEpoch.
  const agentIsSpeaking = useAgentIsSpeaking();
  const pendingPlayRef = useRef(false);
  const [userPlayEpoch, setUserPlayEpoch] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const lastTimeRef = useRef(0);
  // Last applied timeFrame (avoids re-seek loops).
  const lastAppliedTimeRef = useRef<number | null>(null);
  // Latches for programmatic seek/pause/play.
  const programmaticSeekRef = useRef(false);
  const programmaticPauseRef = useRef(false);
  const programmaticPlayRef = useRef(false);
  // Ensures resume_presentation after a pending pause.
  const pendingResumeRef = useRef(false);
  // One-shot latch per chapter window.
  const nextChapterFiredRef = useRef(false);
  const nextTimeFrameRef = useRef<number | null>(nextTimeFrame);
  const boundaryFallbackTimerRef = useRef<number | null>(null);
  const waitingAtBoundaryRef = useRef(false);

  useEffect(() => {
    nextTimeFrameRef.current = nextTimeFrame;
    nextChapterFiredRef.current = false;
    waitingAtBoundaryRef.current = false;
    if (boundaryFallbackTimerRef.current != null) {
      window.clearTimeout(boundaryFallbackTimerRef.current);
      boundaryFallbackTimerRef.current = null;
    }
  }, [nextTimeFrame]);

  // Reset refs on URL change.
  useEffect(() => {
    lastTimeRef.current = 0;
    lastAppliedTimeRef.current = null;
    programmaticSeekRef.current = false;
    programmaticPauseRef.current = false;
    programmaticPlayRef.current = false;
    nextChapterFiredRef.current = false;
    pendingPlayRef.current = false;
  }, [url]);

  // Apply agent-driven seek; arm pendingPlay when playSource is true.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const applySeek = () => {
      const t = timeFrame;
      if (typeof t !== "number" || Number.isNaN(t)) return;

      const isSameTime = lastAppliedTimeRef.current === t;
      const duration = Number.isFinite(video.duration) ? video.duration : t;
      const clamped = Math.max(0, Math.min(t, duration));
      const drifted = Math.abs(video.currentTime - clamped) > 0.45;

      const shouldSeek = !isSameTime || (playSource && drifted);

      if (!shouldSeek) return;

      try {
        programmaticSeekRef.current = true;
        video.currentTime = clamped;
        lastAppliedTimeRef.current = t;
        lastTimeRef.current = clamped;
        nextChapterFiredRef.current = false;
      } catch {
        /* ignore */
      }
    };

    const run = () => {
      applySeek();
      if (!playSource) {
        pendingPlayRef.current = false;
        return;
      }
      pendingPlayRef.current = true;
    };

    if (video.readyState >= 1) {
      run();
      return;
    }

    const onLoaded = () => {
      run();
    };
    video.addEventListener("loadedmetadata", onLoaded, { once: true });
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [playSource, timeFrame, url]);

  // Intentional presentation pause only (user asked / agent pause tool).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !presentationPaused || video.paused) return;
    programmaticPauseRef.current = true;
    try {
      video.pause();
    } catch {
      /* ignore */
    }
  }, [presentationPaused]);

  // Sync gate: play when armed and (agent speaking or forcePlay).
  const gateArmedAtRef = useRef<number | null>(null);
  const lastForceEpochRef = useRef(0);

  useEffect(() => {
    if (!pendingPlayRef.current) return;
    if (presentationPaused) return;

    const video = videoRef.current;
    if (!video) return;

    const forcePlay = forcePlayEpoch > lastForceEpochRef.current;
    if (!video.paused && !forcePlay) {
      pendingPlayRef.current = false;
      gateArmedAtRef.current = null;
      return;
    }
    if (!agentIsSpeaking && !forcePlay) {
      if (gateArmedAtRef.current == null) {
        gateArmedAtRef.current = performance.now();
      }
      return;
    }

    if (video.paused) {
      programmaticPlayRef.current = true;
    }
    const p = video.play();
    if (p && typeof p.then === "function") {
      p.catch(() => {
        programmaticPlayRef.current = false;
      });
    }
    if (forcePlay) {
      lastForceEpochRef.current = forcePlayEpoch;
    }
    pendingPlayRef.current = false;
    gateArmedAtRef.current = null;
  }, [
    agentIsSpeaking,
    playSource,
    timeFrame,
    url,
    userPlayEpoch,
    forcePlayEpoch,
    presentationPaused,
  ]);

  // Chapter advance at nextTimeFrame; retry while agent is still speaking.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const clearBoundaryFallback = () => {
      if (boundaryFallbackTimerRef.current != null) {
        window.clearTimeout(boundaryFallbackTimerRef.current);
        boundaryFallbackTimerRef.current = null;
      }
    };

    const requestChapterAdvance = () => {
      if (!waitingAtBoundaryRef.current) return;
      const agentSpeaking = useAgentSpeakingStore.getState().agentIsSpeaking;
      if (agentSpeaking) {
        clearBoundaryFallback();
        boundaryFallbackTimerRef.current = window.setTimeout(
          requestChapterAdvance,
          800
        );
        return;
      }
      waitingAtBoundaryRef.current = false;
      clearBoundaryFallback();
      publishEvent(room, CHAPTER_CHANGE);
    };

    const onTimeUpdate = () => {
      if (programmaticSeekRef.current) {
        programmaticSeekRef.current = false;
        lastTimeRef.current = video.currentTime;
        return;
      }
      lastTimeRef.current = video.currentTime;

      const ntf = nextTimeFrameRef.current;
      if (
        ntf == null ||
        Number.isNaN(ntf) ||
        nextChapterFiredRef.current
      ) {
        return;
      }

      if (video.currentTime < ntf) {
        return;
      }

      if (Number.isFinite(video.duration) && ntf >= video.duration) {
        nextChapterFiredRef.current = true;
        waitingAtBoundaryRef.current = false;
        clearBoundaryFallback();
        reset();
        publishEvent(room, CHAPTER_CHANGE);
        return;
      }

      nextChapterFiredRef.current = true;
      waitingAtBoundaryRef.current = true;

      clearBoundaryFallback();
      requestChapterAdvance();
    };

    const onEnded = () => {
      if (nextChapterFiredRef.current) return;
      nextChapterFiredRef.current = true;
      waitingAtBoundaryRef.current = true;
      clearBoundaryFallback();
      boundaryFallbackTimerRef.current = window.setTimeout(
        requestChapterAdvance,
        200
      );
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      clearBoundaryFallback();
    };
  }, [reset, room]);

  // User pause/play/seek — ignore programmatic actions.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPause = () => {
      if (programmaticPauseRef.current) {
        programmaticPauseRef.current = false;
        return;
      }
      if (video.ended) return;
      if (usePresentationVideoStore.getState().playSource) {
        setPlaySource(false);
      }
      pendingResumeRef.current = true;
      publishEvent(room, PAUSE_PRESENTATION);
    };

    const onPlay = () => {
      const agentSpeaking = useAgentSpeakingStore.getState().agentIsSpeaking;
      if (programmaticPlayRef.current) {
        programmaticPlayRef.current = false;
        return;
      }
      if (!usePresentationVideoStore.getState().playSource) {
        setPlaySource(true);
      }

      const shouldPublishResume = !agentSpeaking || pendingResumeRef.current;
      if (shouldPublishResume) {
        pendingResumeRef.current = false;
        publishEvent(room, RESUME_PRESENTATION);
      }

      pendingPlayRef.current = true;
      setUserPlayEpoch((n) => n + 1);
    };

    const onSeeking = () => {
      if (programmaticSeekRef.current) return;
      const drift = Math.abs(video.currentTime - lastTimeRef.current);
      if (drift > SEEK_TOLERANCE_SECONDS) {
        programmaticSeekRef.current = true;
        try {
          video.currentTime = lastTimeRef.current;
        } catch {
          /* ignore */
        }
      }
    };

    video.addEventListener("pause", onPause);
    video.addEventListener("play", onPlay);
    video.addEventListener("seeking", onSeeking);
    return () => {
      video.removeEventListener("pause", onPause);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("seeking", onSeeking);
    };
  }, [room, setPlaySource]);

  // Pause on unmount; publish pause on visible SPA route change, not on tab hide.
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (!video) return;

      const wasPlaying = !video.paused;
      const isHidden =
        typeof document !== "undefined" &&
        document.visibilityState === "hidden";

      try {
        programmaticPauseRef.current = true;
        video.pause();
      } catch {
        /* ignore */
      }

      if (isHidden) return;
      if (!wasPlaying) return;

      if (usePresentationVideoStore.getState().playSource) {
        usePresentationVideoStore.getState().setPlaySource(false);
      }
      const liveRoom = useLivekitRoomStore.getState().room;
      publishEvent(liveRoom, PAUSE_PRESENTATION);
    };
  }, []);

  if (!url) {
    return null;
  }

  return (
    <div
      className="relative h-full w-full"
      style={{ width: 1600, height: 900 }}
    >
      {/* Timeline visible but inert (CSS + seeking snap-back). */}
      <style href="video-source-noseek" precedence="default">{`
        video[data-video-source-noseek="true"]::-webkit-media-controls-timeline {
          pointer-events: none !important;
          cursor: default !important;
        }
      `}</style>
      <video
        ref={videoRef}
        data-video-source-noseek="true"
        src={url}
        width={1600}
        height={900}
        controls
        controlsList="nodownload noremoteplayback noplaybackrate"
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        tabIndex={-1}
        onFocus={(e) => e.currentTarget.blur()}
        draggable={false}
        className="block h-full w-full"
      />
      <VideoChaptersList />
    </div>
  );
};

export default VideoSource;
