"use client";

import { isVideoBackgroundUrl } from "@/lib/chroma-key/constants";
import { cn } from "@/lib/utils";

/** Full-bleed image or looping video behind the chroma-keyed Hero avatar. */
export function AvatarBackgroundLayer({
  url,
  className,
}: {
  url: string;
  className?: string;
}) {
  const isVideo = isVideoBackgroundUrl(url);

  return (
    <div
      className={cn("absolute inset-0 z-0 overflow-hidden", className)}
      aria-hidden
    >
      {isVideo ? (
        <video
          className="absolute inset-0 size-full object-cover"
          src={url}
          autoPlay
          loop
          muted
          playsInline
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </div>
  );
}
