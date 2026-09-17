"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Headphones, X } from "lucide-react";

export function PodcastPlayerDialog({
  open,
  onOpenChange,
  title,
  audioUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  audioUrl: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="truncate">{title || "Podcast"}</DialogTitle>
              <DialogDescription>
                Generated two-host episode from your agent knowledge.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close podcast"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="bg-muted flex aspect-[16/7] items-center justify-center rounded-xl">
            <Headphones className="text-muted-foreground size-10" />
          </div>
          <audio
            controls
            className="w-full"
            src={audioUrl}
            preload="metadata"
            aria-label={title || "Podcast"}
          >
            Your browser does not support audio playback.
          </audio>
        </div>
      </DialogContent>
    </Dialog>
  );
}
