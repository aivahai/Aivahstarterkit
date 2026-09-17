"use client";

import type { ChatMessage } from "@/lib/api-types";
import { ExternalLink, FileText } from "lucide-react";

function fileLabel(url: string, explicitName?: string | null) {
  if (explicitName?.trim()) return explicitName.trim();
  try {
    const tail = new URL(url).pathname.split("/").pop();
    if (tail) return decodeURIComponent(tail);
  } catch {
    const tail = url.split("?")[0]?.split("/").pop();
    if (tail) return decodeURIComponent(tail);
  }
  return "Generated document";
}

function DocumentArtifact({
  url,
  name,
}: {
  url: string;
  name?: string | null;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-16 w-full max-w-xl items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Open ${fileLabel(url, name)}`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <FileText />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {fileLabel(url, name)}
        </span>
        <span className="block text-xs text-muted-foreground">Document</span>
      </span>
      <ExternalLink className="shrink-0 text-muted-foreground" />
    </a>
  );
}

export function MessageMedia({ message }: { message: ChatMessage }) {
  const mediaUrl = message.mediaUrl || "";
  const supportingFile =
    message.fileUrl && message.fileUrl !== mediaUrl ? message.fileUrl : "";

  if (!mediaUrl && !supportingFile) return null;

  return (
    <div className="flex w-full max-w-xl flex-col gap-2">
      {message.type === "image" && mediaUrl && (
        <a
          href={mediaUrl}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-xl border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open generated image"
        >
          {/* Generated media URLs are dynamic and may be signed. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt="Generated image"
            className="max-h-[30rem] w-full object-contain"
          />
        </a>
      )}
      {message.type === "video" && mediaUrl && (
        <video
          src={mediaUrl}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full rounded-xl border bg-black object-contain"
          aria-label="Generated video"
        />
      )}
      {message.type === "document" && mediaUrl && (
        <DocumentArtifact url={mediaUrl} name={message.fileName} />
      )}
      {supportingFile && (
        <DocumentArtifact url={supportingFile} name={message.fileName} />
      )}
    </div>
  );
}
