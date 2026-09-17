"use client";

import { AvatarBackgroundLayer } from "@/components/chat/avatar-background-layer";
import { AvatarTrackVideo } from "@/components/chat/avatar-track-video";
import { ChromaKeyVideo } from "@/components/chat/chroma-key-video";
import { Skeleton } from "@/components/ui/skeleton";
import {
  cssAspectRatio,
  getDefaultAvatarWidth,
  parseAspectRatio,
  panelHeightFromWidth,
  resolveDisplayAspect,
  type AvatarStageSize,
} from "@/lib/avatar-aspect";
import {
  DEFAULT_AVATAR_CATALOG,
  isHeroAvatarCatalog,
  toAvatarCatalog,
} from "@/lib/avatar-catalog";
import { cn } from "@/lib/utils";
import type { RemoteTrack } from "livekit-client";
import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/**
 * Conversation avatar stage — mirrors customer-admin AvatarVideoPanel:
 * - Hero + background → FE chroma composite over background layer
 * - Hero without background / Basic → plain LiveKit track (stream as-is)
 * - Panel aspect 9×5 with background, character preset otherwise
 */
export function AvatarStage({
  track,
  backgroundUrl,
  avatarType,
  aspectRatio,
  size = "chat",
  className,
}: {
  track: RemoteTrack | null;
  backgroundUrl?: string;
  avatarType?: string | null;
  aspectRatio?: string | null;
  size?: AvatarStageSize;
  className?: string;
}) {
  const [hasVideoFrame, setHasVideoFrame] = useState(false);
  const catalog = toAvatarCatalog(avatarType) ?? DEFAULT_AVATAR_CATALOG;
  const isHero = isHeroAvatarCatalog(catalog);
  const hasBackground = Boolean(backgroundUrl?.trim());
  // Same as customer-admin: chroma only for Hero when a background is selected.
  const useFrontendComposite = isHero && hasBackground;

  const displayAspect = useMemo(
    () => resolveDisplayAspect(aspectRatio, hasBackground),
    [aspectRatio, hasBackground],
  );
  const panelWidth = useMemo(
    () => getDefaultAvatarWidth({ size, hasBackground }),
    [size, hasBackground],
  );
  const panelHeight = useMemo(
    () => panelHeightFromWidth(panelWidth, displayAspect),
    [panelWidth, displayAspect],
  );

  // When compositing, size the character layer to the character aspect inside
  // the landscape panel (same fit logic as customer-admin).
  const characterAspect = useMemo(
    () => parseAspectRatio(aspectRatio?.trim() || "2x3"),
    [aspectRatio],
  );
  const { avatarWidth, avatarHeight } = useMemo(() => {
    if (!useFrontendComposite) {
      return { avatarWidth: panelWidth, avatarHeight: panelHeight };
    }
    const widthFromHeight = Math.floor(
      (panelHeight * characterAspect.width) / characterAspect.height,
    );
    const heightFromWidth = Math.floor(
      (panelWidth * characterAspect.height) / characterAspect.width,
    );
    if (widthFromHeight <= panelWidth) {
      return { avatarWidth: widthFromHeight, avatarHeight: panelHeight };
    }
    return { avatarWidth: panelWidth, avatarHeight: heightFromWidth };
  }, [useFrontendComposite, panelWidth, panelHeight, characterAspect]);

  useEffect(() => {
    setHasVideoFrame(false);
  }, [track, hasBackground, useFrontendComposite]);

  const waitingForFrame = Boolean(track) && !hasVideoFrame;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-black/5 shadow-2xl select-none transition-[width,height] duration-300",
        className,
      )}
      style={{
        width: panelWidth,
        height: panelHeight,
        maxWidth: "min(46vw, 100%)",
        aspectRatio: cssAspectRatio(displayAspect),
      }}
    >
      {waitingForFrame && (
        <Skeleton className="absolute inset-0 z-20 rounded-none" />
      )}

      {useFrontendComposite && backgroundUrl ? (
        <AvatarBackgroundLayer url={backgroundUrl} />
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center overflow-hidden">
        <div
          className="relative shrink-0 overflow-hidden"
          style={
            useFrontendComposite
              ? { width: avatarWidth, height: avatarHeight }
              : { width: "100%", height: "100%" }
          }
        >
          {useFrontendComposite ? (
            <ChromaKeyVideo
              track={track}
              onFirstFrame={() => setHasVideoFrame(true)}
            />
          ) : (
            <AvatarTrackVideo
              track={track}
              onFirstFrame={() => setHasVideoFrame(true)}
            />
          )}
        </div>
      </div>

      {!track && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-muted to-secondary text-center text-muted-foreground">
          <span className="grid size-12 place-items-center rounded-full bg-background/80">
            <Sparkles className="size-5" />
          </span>
          <p className="text-sm">Waiting for character video</p>
        </div>
      )}
    </div>
  );
}
