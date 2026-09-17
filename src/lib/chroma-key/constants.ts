import { hexToKeyColor } from "./createChromaKeyRenderer";

/** Hero greenscreen background — match reference image / stream. */
export const CHROMA_KEY_HEX = "#50A954";

/** WebGL chroma key tuning. */
export const CHROMA_KEY_OPTIONS = {
  keyColor: hexToKeyColor(CHROMA_KEY_HEX),
  similarity: 0.22,
  smoothness: 0.06,
  spillMin: 0.025,
  spillMax: 0.085,
  edgeFeatherPx: 1,
};

const VIDEO_EXT_RE = /\.(mp4|webm|mov)(\?|#|$)/i;

/** Infer video vs image background from URL path. */
export function isVideoBackgroundUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const path = new URL(url, "https://local.invalid").pathname;
    return VIDEO_EXT_RE.test(path);
  } catch {
    return VIDEO_EXT_RE.test(url);
  }
}
