"use client";

import { ApiError } from "@/components/api-error";
import { ConfigureGenerationDialog } from "@/components/productivity/configure-generation-dialog";
import {
  DEFAULT_PODCAST_EXPERT_VOICE,
  DEFAULT_PODCAST_HOST_VOICE,
  DEFAULT_PODCAST_LENGTH,
  DEFAULT_SLIDE_LENGTH,
  DEFAULT_SLIDE_STYLE,
  type PodcastConfig,
  type SlideConfig,
} from "@/components/productivity/defaults";
import { MindmapOverlay } from "@/components/productivity/mindmap-overlay";
import { PodcastPlayerDialog } from "@/components/productivity/podcast-player-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { aivahFetch, asArray } from "@/lib/api";
import type {
  Agent,
  GeneratedContent,
  GeneratedContentsPage,
  GenerationType,
  Paginated,
} from "@/lib/api-types";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Headphones,
  Loader2,
  Network,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 20;
const POLL_MS = 5000;

const GENERATION_OPTIONS: Array<{
  value: GenerationType;
  label: string;
  description: string;
  Icon: typeof FileText;
}> = [
  {
    value: "slides",
    label: "Slides",
    description: "Visual deck",
    Icon: FileText,
  },
  {
    value: "podcast",
    label: "Podcast",
    description: "Two-voice episode",
    Icon: Headphones,
  },
  {
    value: "mindmap",
    label: "Mind map",
    description: "Branching overview",
    Icon: Network,
  },
];

type TypeFilter = "all" | GenerationType;

function agentIdOf(agent: Agent) {
  return Number(agent.chatBotId ?? agent.chat_bot_id ?? 0);
}

function agentNameOf(agent: Agent) {
  return String(agent.knowledgeBaseName || agent.name || `Agent ${agentIdOf(agent)}`);
}

export default function ProductivityPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [generationType, setGenerationType] =
    useState<GenerationType>("slides");
  const [slideConfig, setSlideConfig] = useState<SlideConfig>({
    style: DEFAULT_SLIDE_STYLE,
    length: DEFAULT_SLIDE_LENGTH,
  });
  const [podcastConfig, setPodcastConfig] = useState<PodcastConfig>({
    length: DEFAULT_PODCAST_LENGTH,
    hostVoice: DEFAULT_PODCAST_HOST_VOICE,
    expertVoice: DEFAULT_PODCAST_EXPERT_VOICE,
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [items, setItems] = useState<GeneratedContent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<GeneratedContent | null>(
    null,
  );
  const [mindmapItem, setMindmapItem] = useState<GeneratedContent | null>(null);
  const [podcastItem, setPodcastItem] = useState<GeneratedContent | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      const result = await aivahFetch<Paginated<Agent>>("agents?limit=50");
      const list = asArray<Agent>(result);
      setAgents(list);
      setSelectedAgentId((current) => {
        if (current) return current;
        const first = list[0];
        return first ? String(agentIdOf(first)) : "";
      });
    } catch {
      // Gallery can still load even if agents fail.
    }
  }, []);

  const loadGallery = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (!opts?.soft) setLoading(true);
      else setRefreshing(true);
      setError("");
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        if (typeFilter !== "all") params.set("type", typeFilter);
        const result = await aivahFetch<GeneratedContentsPage>(
          `productivity/generated-contents?${params}`,
        );
        setItems(asArray<GeneratedContent>(result, ["files"]));
        setTotalCount(Number(result?.totalCount ?? 0));
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Generated contents could not be loaded.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, typeFilter],
  );

  useEffect(() => {
    void loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    void loadGallery();
  }, [loadGallery]);

  const hasPending = useMemo(
    () => items.some((item) => item.status === "pending"),
    [items],
  );

  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => void loadGallery({ soft: true }), POLL_MS);
    return () => clearInterval(timer);
  }, [hasPending, loadGallery]);

  const settingsSummary = useMemo(() => {
    if (generationType === "slides") {
      return `${slideConfig.length}`;
    }
    if (generationType === "podcast") {
      const length =
        podcastConfig.length === "short"
          ? "Short"
          : podcastConfig.length === "longer"
            ? "Longer"
            : "Default";
      return `${length} · ${podcastConfig.hostVoice} + ${podcastConfig.expertVoice}`;
    }
    return "From selected agent knowledge";
  }, [generationType, slideConfig, podcastConfig]);

  const generate = async () => {
    if (!selectedAgentId) {
      toast.error("Select an agent first");
      return;
    }
    setGenerating(true);
    try {
      if (generationType === "slides") {
        await aivahFetch(`agents/${selectedAgentId}/slide`, {
          method: "POST",
          body: JSON.stringify({
            style: slideConfig.style,
            length: slideConfig.length,
          }),
        });
        toast.success("Slide generation started");
      } else if (generationType === "podcast") {
        await aivahFetch(`agents/${selectedAgentId}/podcast`, {
          method: "POST",
          body: JSON.stringify({
            length: podcastConfig.length,
            hostVoice: podcastConfig.hostVoice,
            expertVoice: podcastConfig.expertVoice,
            ...(podcastConfig.focus ? { focus: podcastConfig.focus } : {}),
          }),
        });
        toast.success("Podcast generation started");
      } else {
        await aivahFetch(`agents/${selectedAgentId}/mindmap`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        toast.success("Mind map generation started");
      }
      setTypeFilter("all");
      setPage(1);
      await loadGallery({ soft: true });
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Generation failed to start",
      );
    } finally {
      setGenerating(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      await aivahFetch(
        `productivity/generated-contents/${pendingDelete.id}`,
        { method: "DELETE" },
      );
      toast.success("Deleted");
      setPendingDelete(null);
      await loadGallery({ soft: true });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Delete failed");
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const openItem = (item: GeneratedContent) => {
    if (item.status !== "completed" || !item.url) return;
    if (item.generatedContentType === "mindmap") {
      setMindmapItem(item);
      return;
    }
    if (item.generatedContentType === "podcast") {
      setPodcastItem(item);
      return;
    }
    window.open(item.url, "_blank", "noopener,noreferrer");
  };

  return (
    <main className="aivah-page flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Productivity</h1>
        <p className="text-muted-foreground text-sm">
          Generate slide decks, podcasts, and mind maps from trained agents.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Agent</label>
                <Select
                  open={agentMenuOpen}
                  onOpenChange={setAgentMenuOpen}
                  value={selectedAgentId}
                  onValueChange={setSelectedAgentId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((agent) => {
                      const id = String(agentIdOf(agent));
                      return (
                        <SelectItem key={id} value={id}>
                          {agentNameOf(agent)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Output</label>
                <div className="grid grid-cols-3 gap-2">
                  {GENERATION_OPTIONS.map(
                    ({ value, label, description, Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setGenerationType(value)}
                        className={cn(
                          "rounded-lg border px-2.5 py-2.5 text-left transition-colors",
                          generationType === value
                            ? "border-foreground bg-muted"
                            : "hover:bg-muted/60",
                        )}
                      >
                        <Icon className="mb-1.5 size-4" />
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-muted-foreground hidden text-[11px] sm:block">
                          {description}
                        </p>
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {generationType !== "mindmap" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Pencil className="size-4" />
                  Settings
                </Button>
              )}
              <Button
                type="button"
                onClick={() => void generate()}
                disabled={!selectedAgentId || generating}
              >
                {generating ? (
                  <Spinner className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
                {generating ? "Starting..." : "Generate"}
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground text-xs">{settingsSummary}</p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["slides", "Slides"],
              ["podcast", "Podcasts"],
              ["mindmap", "Mind maps"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={typeFilter === value ? "default" : "outline"}
              onClick={() => {
                setTypeFilter(value);
                setPage(1);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Refresh gallery"
          onClick={() => void loadGallery({ soft: true })}
          disabled={refreshing}
        >
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
        </Button>
      </div>

      {error ? <ApiError error={error} onRetry={() => void loadGallery()} /> : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[4/3] rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Network className="text-muted-foreground size-8" />
            <div>
              <p className="font-medium">No generated assets yet</p>
              <p className="text-muted-foreground text-sm">
                Pick an agent and generate slides, a podcast, or a mind map.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => {
              const pending = item.status === "pending";
              const failed = item.status === "failed";
              const title = pending
                ? item.generatedContentType === "podcast"
                  ? "Generating podcast..."
                  : item.generatedContentType === "mindmap"
                    ? "Generating mind map..."
                    : "Generating slides..."
                : item.name;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "bg-card group relative flex flex-col overflow-hidden rounded-xl border",
                    failed && "border-destructive/50",
                  )}
                >
                  <button
                    type="button"
                    disabled={pending || failed || !item.url}
                    onClick={() => openItem(item)}
                    className="flex flex-col text-left disabled:cursor-not-allowed"
                  >
                    <div className="bg-muted relative flex aspect-[4/3] items-center justify-center overflow-hidden">
                      {pending ? (
                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                          <Loader2 className="size-8 animate-spin" />
                          <span className="text-xs">Generating...</span>
                        </div>
                      ) : failed ? (
                        <div className="text-destructive flex flex-col items-center gap-2">
                          <AlertTriangle className="size-8" />
                          <span className="text-xs font-medium">Failed</span>
                        </div>
                      ) : item.coverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.coverImage}
                          alt={title}
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : item.generatedContentType === "podcast" ? (
                        <Headphones className="text-muted-foreground size-10" />
                      ) : item.generatedContentType === "mindmap" ? (
                        <Network className="text-muted-foreground size-10" />
                      ) : (
                        <FileText className="text-muted-foreground size-10" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2 p-3">
                      <p className="line-clamp-2 text-sm font-medium">{title}</p>
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="capitalize">
                          {item.generatedContentType}
                        </Badge>
                        <span className="text-muted-foreground truncate text-[11px]">
                          {item.chatbotName || "Agent"}
                        </span>
                      </div>
                    </div>
                  </button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute top-2 right-2 size-8 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Delete"
                    onClick={() => setPendingDelete(item)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-muted-foreground text-sm">
                Page {page} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((value) => Math.min(totalPages, value + 1))
                }
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <ConfigureGenerationDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        type={generationType}
        slideConfig={slideConfig}
        podcastConfig={podcastConfig}
        onSaveSlide={setSlideConfig}
        onSavePodcast={setPodcastConfig}
      />

      {mindmapItem?.url ? (
        <MindmapOverlay
          title={mindmapItem.name}
          mindmapUrl={mindmapItem.url}
          onClose={() => setMindmapItem(null)}
        />
      ) : null}

      {podcastItem?.url ? (
        <PodcastPlayerDialog
          open={Boolean(podcastItem)}
          onOpenChange={(open) => {
            if (!open) setPodcastItem(null);
          }}
          title={podcastItem.name}
          audioUrl={podcastItem.url}
        />
      ) : null}

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete generated content?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes{" "}
              <span className="font-medium text-foreground">
                {pendingDelete?.name}
              </span>{" "}
              permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
