"use client";

import { useEffect, useState } from "react";

import { AlertTriangle, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { MindmapDocument, MindmapNode } from "@/lib/api-types";
import { MindmapViewer } from "./mindmap-viewer";

export function MindmapOverlay({
  title,
  mindmapUrl,
  onClose,
  onNodeQuestion,
  variant = "modal",
}: {
  title: string;
  mindmapUrl: string;
  onClose: () => void;
  onNodeQuestion?: (question: string, node: MindmapNode) => void | Promise<void>;
  variant?: "modal" | "side-panel" | "inline-panel";
}) {
  const [document, setDocument] = useState<MindmapDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadMindmap = async () => {
      setIsLoading(true);
      setErrorText(null);
      setDocument(null);

      try {
        const response = await fetch(mindmapUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch mind map (${response.status})`);
        }
        const data = (await response.json()) as MindmapDocument;
        if (cancelled) return;
        if (!data?.root?.title) {
          throw new Error("Mind map JSON is missing a root node");
        }
        setDocument(data);
      } catch (err) {
        if (cancelled) return;
        setErrorText(
          err instanceof Error ? err.message : "Unable to load mind map",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadMindmap();

    return () => {
      cancelled = true;
    };
  }, [mindmapUrl]);

  const isSidePanel = variant === "side-panel";
  const isInlinePanel = variant === "inline-panel";

  return (
    <div
      className={cn(
        isInlinePanel
          ? "relative flex h-full items-stretch justify-start bg-transparent"
          : "fixed inset-0 z-[2000] flex bg-black/40 backdrop-blur-[1px]",
        !isInlinePanel &&
          (isSidePanel
            ? "items-stretch justify-end p-0"
            : "items-center justify-center bg-black/70 p-3 backdrop-blur-sm"),
      )}
      role={isInlinePanel ? undefined : "dialog"}
      aria-modal={isInlinePanel ? undefined : true}
      aria-label={document?.title || title || "Mind map"}
    >
      <div
        className={cn(
          "bg-background flex flex-col overflow-hidden border shadow-2xl",
          isInlinePanel
            ? "h-full w-full rounded-none border-y-0 border-l-0 shadow-none"
            : isSidePanel
              ? "h-full w-full rounded-none sm:w-[42vw] sm:min-w-[35vw] sm:max-w-[50vw] sm:border-y-0 sm:border-r-0"
              : "h-[min(820px,94vh)] w-[min(1180px,96vw)] rounded-2xl",
        )}
      >
        <div className="border-border flex items-center gap-3 border-b px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">
              {document?.title || title || "Mind Map"}
            </p>
            <p className="text-muted-foreground text-xs">
              Interactive branching map generated from your sources
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close mind map"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1">
          {isLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="size-8 animate-spin" />
              <p className="text-sm">Loading mind map...</p>
            </div>
          ) : errorText ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-red-500">
              <AlertTriangle className="size-8" />
              <p className="text-sm font-medium">{errorText}</p>
            </div>
          ) : document ? (
            <MindmapViewer
              document={document}
              onNodeQuestion={onNodeQuestion}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
