const CHARACTER_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const BACKGROUND_TYPES = new Set([
  ...CHARACTER_TYPES,
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
]);
const STANDARD_AGENT_EXTENSIONS = new Set([
  "html",
  "htm",
  "json",
  "jsonl",
  "ndjson",
  "md",
  "markdown",
  "pptx",
  "docx",
  "pdf",
  "txt",
  "css",
  "csv",
  "js",
  "rtf",
  "xml",
  "bmp",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "mp4",
  "mpeg",
  "mpg",
  "mov",
  "avi",
  "flv",
  "webm",
  "wmv",
  "3gp",
  "3gpp",
  "wav",
  "mp3",
  "aiff",
  "aif",
  "aac",
  "ogg",
  "flac",
]);
const PRESENTATION_AGENT_EXTENSIONS = new Set([
  "pdf",
  "mp4",
  "mpeg",
  "mpg",
  "mov",
  "avi",
  "flv",
  "webm",
  "wmv",
  "3gp",
  "3gpp",
]);

export const STANDARD_AGENT_ACCEPT = [
  ".html",
  ".json",
  ".md",
  ".pptx",
  ".docx",
  ".pdf",
  ".txt",
  ".css",
  ".csv",
  ".js",
  ".rtf",
  ".xml",
  ".bmp",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".mp4",
  ".mpeg",
  ".mov",
  ".avi",
  ".webm",
  ".wav",
  ".mp3",
  ".aiff",
  ".aac",
  ".ogg",
  ".flac",
].join(",");

export const PRESENTATION_AGENT_ACCEPT =
  ".pdf,.mp4,.mpeg,.mpg,.mov,.avi,.flv,.webm,.wmv,.3gp,.3gpp";

export function validateUpload(
  file: File,
  kind: "character" | "background" | "voice",
): string | null {
  const allowed =
    kind === "character"
      ? CHARACTER_TYPES
      : kind === "background"
        ? BACKGROUND_TYPES
        : AUDIO_TYPES;
  const max =
    kind === "background" && file.type.startsWith("video/")
      ? 50 * 1024 * 1024
      : kind === "voice"
        ? 25 * 1024 * 1024
        : 15 * 1024 * 1024;
  if (!allowed.has(file.type)) return `Unsupported ${kind} file type.`;
  if (file.size > max) return `File is larger than ${max / 1024 / 1024} MB.`;
  return null;
}

export function validateAgentFiles(
  files: File[],
  presentation: boolean,
): string | null {
  const allowed = presentation
    ? PRESENTATION_AGENT_EXTENSIONS
    : STANDARD_AGENT_EXTENSIONS;
  const unsupported = files.find((file) => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    return !allowed.has(extension);
  });
  if (unsupported) {
    return presentation
      ? `${unsupported.name} cannot be used for presentations. Upload a PDF or video.`
      : `${unsupported.name} is not a supported knowledge file.`;
  }
  if (files.some((file) => file.size > 100 * 1024 * 1024)) {
    return "Each file must be 100 MB or smaller.";
  }
  return null;
}
