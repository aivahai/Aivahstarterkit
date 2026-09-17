"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef } from "react";

function FileIcon({ file }: { file: File }) {
  if (file.type.startsWith("image/")) return <FileImage />;
  if (file.type.startsWith("audio/")) return <FileAudio />;
  if (file.type.startsWith("video/")) return <FileVideo />;
  return <FileText />;
}

function fileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function AgentFilePicker({
  files,
  onChange,
  accept,
  presentation,
  className,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  accept: string;
  presentation: boolean;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const addFiles = (incoming: File[]) => {
    const keys = new Set(files.map((file) => `${file.name}-${file.size}`));
    onChange([
      ...files,
      ...incoming.filter((file) => !keys.has(`${file.name}-${file.size}`)),
    ]);
  };

  return (
    <div className={cn("space-y-3", className)}>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          addFiles(Array.from(event.target.files || []));
          event.currentTarget.value = "";
        }}
      />
      {!files.length ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-44 w-full flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 px-6 text-center transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="mb-3 grid size-11 place-items-center rounded-xl bg-muted">
            <Upload className="size-5 text-muted-foreground" />
          </span>
          <span className="text-sm font-medium">
            Click to attach{" "}
            {presentation ? "PDF or video lessons" : "training files"}
          </span>
          <span className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">
            {presentation
              ? "Upload one or more PDFs or videos. Each file becomes a lesson."
              : "Documents, images, audio, and video. File limits depend on type, up to 100 MB."}
          </span>
        </button>
      ) : (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${file.size}`}
              className="flex min-h-16 items-center gap-3 rounded-xl border px-3"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&>svg]:size-4">
                <FileIcon file={file} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {file.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {fileSize(file.size)}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 text-destructive"
                onClick={() =>
                  onChange(files.filter((_, fileIndex) => fileIndex !== index))
                }
              >
                <Trash2 />
                <span className="sr-only">Remove {file.name}</span>
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => inputRef.current?.click()}
          >
            <Plus /> Add more files
          </Button>
        </div>
      )}
    </div>
  );
}
