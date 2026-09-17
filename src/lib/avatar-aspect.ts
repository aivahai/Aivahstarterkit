/** Character aspect presets from avatar_gcp / LiveKit payload. */
export const ASPECT_RATIO_PRESETS = ["2x3", "9x16", "1x1"] as const;
export const DEFAULT_AVATAR_ASPECT_RATIO = "2x3";

export const AVATAR_DEFAULT_WIDTH = 320;
export const AVATAR_CHAT_WITH_BACKGROUND_DEFAULT_WIDTH = 580;
export const AVATAR_PRESENTATION_DEFAULT_WIDTH = 280;
export const AVATAR_PRESENTATION_WITH_BACKGROUND_DEFAULT_WIDTH = 440;

export type AspectSize = { width: number; height: number };
export type AvatarStageSize = "chat" | "presentation";

export function parseAspectRatio(value: string): AspectSize {
  const match = value.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/i);
  if (!match) return { width: 2, height: 3 };
  return { width: Number(match[1]), height: Number(match[2]) };
}

/**
 * Panel framing: landscape 9×5 when a background is selected;
 * otherwise the character preset (default 2×3).
 * Same contract as customer-admin-next.
 */
export function resolveDisplayAspect(
  aspectRatio: string | null | undefined,
  hasBackground: boolean,
): AspectSize {
  const active =
    aspectRatio &&
    (ASPECT_RATIO_PRESETS as readonly string[]).includes(aspectRatio)
      ? aspectRatio
      : DEFAULT_AVATAR_ASPECT_RATIO;
  return hasBackground ? { width: 9, height: 5 } : parseAspectRatio(active);
}

export function cssAspectRatio(size: AspectSize): string {
  return `${size.width} / ${size.height}`;
}

export function panelHeightFromWidth(
  width: number,
  displayAspect: AspectSize,
) {
  return Math.max(
    100,
    Math.round((width * displayAspect.height) / displayAspect.width),
  );
}

export function getDefaultAvatarWidth({
  size,
  hasBackground,
}: {
  size: AvatarStageSize;
  hasBackground: boolean;
}) {
  if (size === "presentation") {
    return hasBackground
      ? AVATAR_PRESENTATION_WITH_BACKGROUND_DEFAULT_WIDTH
      : AVATAR_PRESENTATION_DEFAULT_WIDTH;
  }
  return hasBackground
    ? AVATAR_CHAT_WITH_BACKGROUND_DEFAULT_WIDTH
    : AVATAR_DEFAULT_WIDTH;
}
