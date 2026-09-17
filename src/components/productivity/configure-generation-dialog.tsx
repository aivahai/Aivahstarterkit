"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PODCAST_EXPERT_VOICE,
  DEFAULT_PODCAST_HOST_VOICE,
  DEFAULT_PODCAST_LENGTH,
  DEFAULT_SLIDE_LENGTH,
  DEFAULT_SLIDE_STYLE,
  PODCAST_LENGTH_OPTIONS,
  PODCAST_VOICE_OPTIONS,
  SLIDE_LENGTH_OPTIONS,
  type PodcastConfig,
  type PodcastVoiceName,
  type SlideConfig,
} from "./defaults";
import type { GenerationType } from "@/lib/api-types";
import { useEffect, useState } from "react";

export function ConfigureGenerationDialog({
  open,
  onOpenChange,
  type,
  slideConfig,
  podcastConfig,
  onSaveSlide,
  onSavePodcast,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: GenerationType;
  slideConfig: SlideConfig;
  podcastConfig: PodcastConfig;
  onSaveSlide: (config: SlideConfig) => void;
  onSavePodcast: (config: PodcastConfig) => void;
}) {
  const [slideDraft, setSlideDraft] = useState(slideConfig);
  const [podcastDraft, setPodcastDraft] = useState(podcastConfig);

  useEffect(() => {
    if (!open) return;
    setSlideDraft(slideConfig);
    setPodcastDraft(podcastConfig);
  }, [open, slideConfig, podcastConfig]);

  if (type === "mindmap") return null;

  const save = () => {
    if (type === "slides") {
      onSaveSlide({
        style: slideDraft.style.trim() || DEFAULT_SLIDE_STYLE,
        length: slideDraft.length || DEFAULT_SLIDE_LENGTH,
      });
    } else {
      const host = podcastDraft.hostVoice || DEFAULT_PODCAST_HOST_VOICE;
      let expert = podcastDraft.expertVoice || DEFAULT_PODCAST_EXPERT_VOICE;
      if (expert === host) {
        expert =
          PODCAST_VOICE_OPTIONS.find((voice) => voice !== host) ||
          DEFAULT_PODCAST_EXPERT_VOICE;
      }
      onSavePodcast({
        length: podcastDraft.length || DEFAULT_PODCAST_LENGTH,
        focus: podcastDraft.focus?.trim() || undefined,
        hostVoice: host,
        expertVoice: expert,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {type === "slides" ? "Slide settings" : "Podcast settings"}
          </DialogTitle>
          <DialogDescription>
            {type === "slides"
              ? "Choose deck length and optional style notes."
              : "Choose episode length, voices, and optional focus."}
          </DialogDescription>
        </DialogHeader>

        {type === "slides" ? (
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel>Deck length</FieldLabel>
              <div className="grid gap-2 sm:grid-cols-3">
                {SLIDE_LENGTH_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setSlideDraft((prev) => ({
                        ...prev,
                        length: option.value,
                      }))
                    }
                    className={cn(
                      "rounded-lg border px-3 py-3 text-left transition-colors",
                      slideDraft.length === option.value
                        ? "border-foreground bg-muted"
                        : "hover:bg-muted/60",
                    )}
                  >
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-muted-foreground text-xs">
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="slide-style">Style notes</FieldLabel>
              <FieldDescription>
                Short guidance for tone and layout. Leave blank for the default.
              </FieldDescription>
              <Textarea
                id="slide-style"
                value={slideDraft.style}
                onChange={(event) =>
                  setSlideDraft((prev) => ({
                    ...prev,
                    style: event.target.value,
                  }))
                }
                rows={5}
                maxLength={800}
              />
            </Field>
          </FieldGroup>
        ) : (
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel>Episode length</FieldLabel>
              <div className="grid gap-2 sm:grid-cols-3">
                {PODCAST_LENGTH_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() =>
                      setPodcastDraft((prev) => ({
                        ...prev,
                        length: option.key,
                      }))
                    }
                    className={cn(
                      "rounded-lg border px-3 py-3 text-left transition-colors",
                      podcastDraft.length === option.key
                        ? "border-foreground bg-muted"
                        : "hover:bg-muted/60",
                    )}
                  >
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-muted-foreground text-xs">
                      {option.subtitle}
                    </p>
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Host voice</FieldLabel>
                <Select
                  value={podcastDraft.hostVoice}
                  onValueChange={(value) =>
                    setPodcastDraft((prev) => ({
                      ...prev,
                      hostVoice: value as PodcastVoiceName,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PODCAST_VOICE_OPTIONS.map((voice) => (
                      <SelectItem key={voice} value={voice}>
                        {voice}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Expert voice</FieldLabel>
                <Select
                  value={podcastDraft.expertVoice}
                  onValueChange={(value) =>
                    setPodcastDraft((prev) => ({
                      ...prev,
                      expertVoice: value as PodcastVoiceName,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PODCAST_VOICE_OPTIONS.map((voice) => (
                      <SelectItem key={voice} value={voice}>
                        {voice}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="podcast-focus">Focus (optional)</FieldLabel>
              <FieldDescription>
                What the episode should emphasize.
              </FieldDescription>
              <Textarea
                id="podcast-focus"
                value={podcastDraft.focus || ""}
                onChange={(event) =>
                  setPodcastDraft((prev) => ({
                    ...prev,
                    focus: event.target.value,
                  }))
                }
                rows={4}
                maxLength={500}
                placeholder="Summarize the key takeaways for a general audience"
              />
            </Field>
          </FieldGroup>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save}>
            Save settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
