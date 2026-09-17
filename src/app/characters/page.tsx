"use client";

import { ApiError } from "@/components/api-error";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { aivahFetch, asArray } from "@/lib/api";
import type { Background, Character, Paginated } from "@/lib/api-types";
import {
  type AvatarCatalog,
  DEFAULT_AVATAR_CATALOG,
  catalogLabel,
  resourceNameOf,
} from "@/lib/avatar-catalog";
import { cn } from "@/lib/utils";
import { validateUpload } from "@/lib/validation";
import {
  Pencil,
  Plus,
  Search,
  Trash2,
  UsersRound,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type Resource = Character | Background;

const CATALOG_OPTIONS: { value: AvatarCatalog; label: string }[] = [
  { value: "hero", label: "Hero" },
  { value: "basic", label: "Basic" },
];

export default function CharactersPage() {
  const [tab, setTab] = useState("characters");
  const [catalog, setCatalog] = useState<AvatarCatalog>(DEFAULT_AVATAR_CATALOG);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Resource | null>(null);
  const [preview, setPreview] = useState<{
    url: string;
    video: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentIdlePrompt, setAgentIdlePrompt] = useState("");
  const [formFile, setFormFile] = useState<File | null>(null);

  const isBasic = catalog === "basic";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await aivahFetch<Paginated<Resource>>(
        `${tab}?search=${encodeURIComponent(search)}&limit=48&avatarType=${catalog}`,
      );
      setItems(
        asArray<Resource>(
          result,
          tab === "characters" ? ["avatars"] : ["backgrounds"],
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Resources could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [catalog, search, tab]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );

  const resetForm = () => {
    setFormName("");
    setAgentPrompt("");
    setAgentIdlePrompt("");
    setFormFile(null);
    setPreview(null);
  };

  const closeEditor = () => {
    setDialogOpen(false);
    setEditing(null);
    resetForm();
  };

  const openEditor = (item: Resource | null) => {
    setEditing(item);
    setFormName(item ? resourceNameOf(item) : "");
    setAgentPrompt((item as Character | null)?.agent_prompt || "");
    setAgentIdlePrompt((item as Character | null)?.agent_idle_prompt || "");
    setFormFile(null);
    setPreview(null);
    setDialogOpen(true);
  };

  const remove = async () => {
    if (!pendingDelete || isBasic) return;
    try {
      await aivahFetch(`${tab}/${pendingDelete.id}`, { method: "DELETE" });
      toast.success(
        `${tab === "characters" ? "Character" : "Background"} deleted`,
      );
      setPendingDelete(null);
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Delete failed");
    }
  };

  const save = async () => {
    if (isBasic) return;
    setSaving(true);
    try {
      const name = formName.trim();
      if (!name) throw new Error("Name is required.");
      if (editing) {
        const body =
          tab === "characters"
            ? {
                avatarName: name,
                agentPrompt,
                agentIdlePrompt,
              }
            : { backgroundName: name };
        await aivahFetch(`${tab}/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        const file = formFile;
        if (!(file instanceof File) || !file.size)
          throw new Error("Choose a file.");
        const validation = validateUpload(
          file,
          tab === "characters" ? "character" : "background",
        );
        if (validation) throw new Error(validation);
        const payload = new FormData();
        payload.set("file", file);
        payload.set(
          tab === "characters" ? "avatarName" : "backgroundName",
          name,
        );
        if (tab === "characters") {
          payload.set("agentPrompt", agentPrompt);
          payload.set("agentIdlePrompt", agentIdlePrompt);
        }
        await aivahFetch(tab, { method: "POST", body: payload });
      }
      toast.success(
        editing
          ? "Changes saved"
          : `${tab === "characters" ? "Character" : "Background"} uploaded`,
      );
      setDialogOpen(false);
      setEditing(null);
      resetForm();
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="aivah-page flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.035em]">
            Characters
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isBasic
              ? "Browse Basic characters and backgrounds available in chat."
              : "Upload Hero characters and backgrounds for AI chat and voice."}
          </p>
        </div>
        {!isBasic ? (
          <Button
            className="h-11 rounded-full px-5"
            onClick={() => openEditor(null)}
          >
            <Plus data-icon="inline-start" />
            Create
          </Button>
        ) : null}
      </div>
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (open) setDialogOpen(true);
          else closeEditor();
        }}
      >
            <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void save();
                }}
              >
                <DialogHeader>
                  <DialogTitle className="text-xl">
                    {editing
                      ? "Edit"
                      : tab === "characters"
                        ? "Create"
                        : "Upload"}{" "}
                    {tab === "characters"
                      ? "Character"
                      : "Character Background"}
                  </DialogTitle>
                </DialogHeader>
                {!editing && (
                  <div className="aivah-dialog-tip mt-5">
                    <p className="font-medium text-foreground">
                      {tab === "characters"
                        ? "Image tips"
                        : "Character background tips"}
                    </p>
                    <ul className="mt-2 list-disc pl-5">
                      {tab === "characters" ? (
                        <>
                          <li>Use a large face with a neutral expression.</li>
                          <li>
                            Keep eyes facing the camera and mouth slightly open.
                          </li>
                          <li>
                            For compositing, use chroma green #50A954 around the
                            subject.
                          </li>
                        </>
                      ) : (
                        <>
                          <li>Landscape 9:5 works best behind a character.</li>
                          <li>Images are cropped; videos remain full-frame.</li>
                          <li>Use short, muted looping videos up to 50 MB.</li>
                        </>
                      )}
                    </ul>
                  </div>
                )}
                <FieldGroup className="py-5">
                  <Field>
                    <FieldLabel htmlFor="resource-name">Name</FieldLabel>
                    <Input
                      id="resource-name"
                      name="name"
                      value={formName}
                      onChange={(event) => setFormName(event.target.value)}
                      required
                    />
                  </Field>
                  {!editing && (
                    <Field>
                      <FieldLabel htmlFor="resource-file">File</FieldLabel>
                      <Input
                        id="resource-file"
                        name="file"
                        type="file"
                        accept={
                          tab === "characters"
                            ? "image/png,image/jpeg,image/webp"
                            : "image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
                        }
                        required
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          setFormFile(file);
                          setPreview(
                            file
                              ? {
                                  url: URL.createObjectURL(file),
                                  video: file.type.startsWith("video/"),
                                }
                              : null,
                          );
                        }}
                      />
                      <FieldDescription>
                        {tab === "characters"
                          ? "PNG, JPEG, or WebP up to 15 MB."
                          : "Images up to 15 MB or video up to 50 MB."}
                      </FieldDescription>
                    </Field>
                  )}
                  {!editing && preview && (
                    <div
                      className={
                        tab === "characters"
                          ? "mx-auto aspect-[2/3] w-full max-w-xs overflow-hidden rounded-xl border bg-muted"
                          : "aspect-[9/5] overflow-hidden rounded-xl border bg-muted"
                      }
                    >
                      {preview.video ? (
                        <video
                          src={preview.url}
                          controls
                          muted
                          playsInline
                          className="size-full object-cover"
                        />
                      ) : (
                        <div
                          role="img"
                          aria-label="Upload preview"
                          className="size-full bg-cover bg-center"
                          style={{
                            backgroundImage: `url("${preview.url}")`,
                          }}
                        />
                      )}
                    </div>
                  )}
                  {tab === "characters" && (
                    <>
                      <Field>
                        <FieldLabel htmlFor="agent-prompt">
                          Character prompt
                        </FieldLabel>
                        <Textarea
                          id="agent-prompt"
                          name="agentPrompt"
                          value={agentPrompt}
                          onChange={(event) => setAgentPrompt(event.target.value)}
                          rows={4}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="idle-prompt">
                          Idle prompt
                        </FieldLabel>
                        <Textarea
                          id="idle-prompt"
                          name="agentIdlePrompt"
                          value={agentIdlePrompt}
                          onChange={(event) =>
                            setAgentIdlePrompt(event.target.value)
                          }
                          rows={3}
                        />
                      </Field>
                    </>
                  )}
                </FieldGroup>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
      </Dialog>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          setItems([]);
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <TabsList className="min-h-11 bg-muted/55">
              <TabsTrigger value="characters" className="min-h-11">
                Characters
              </TabsTrigger>
              <TabsTrigger value="backgrounds" className="min-h-11">
                Backgrounds
              </TabsTrigger>
            </TabsList>
            <div
              className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-muted/55 p-0.5"
              role="group"
              aria-label="Character catalog"
            >
              {CATALOG_OPTIONS.map((option) => {
                const isActive = catalog === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-label={`${option.label} characters`}
                    aria-pressed={isActive}
                    onClick={() => {
                      setCatalog(option.value);
                      setItems([]);
                    }}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                      isActive
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${catalogLabel(catalog).toLowerCase()} ${tab}`}
              className="h-11 pl-9"
            />
          </div>
        </div>
        {["characters", "backgrounds"].map((value) => (
          <TabsContent key={value} value={value} className="mt-6">
            {error ? (
              <ApiError error={error} onRetry={() => void load()} />
            ) : loading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 6 }, (_, index) => (
                  <Skeleton
                    key={index}
                    className={
                      tab === "characters"
                        ? "aspect-[2/3] rounded-xl"
                        : "aspect-[9/5] rounded-xl"
                    }
                  />
                ))}
              </div>
            ) : items.length === 0 ? (
              <Card>
                <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
                  <UsersRound className="size-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      No {catalogLabel(catalog).toLowerCase()} {tab} found
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isBasic
                        ? "Basic catalog items will appear here once available."
                        : "Add one to make it available in new chat."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {items.map((item) => {
                  const isVideo =
                    "mediaType" in item &&
                    (item.mediaType === "video" ||
                      /\.(mp4|webm|mov)(\?|$)/i.test(item.url));
                  return (
                    <Card
                      id={`character-card-${item.id}`}
                      key={item.id}
                      className="group overflow-hidden py-0 transition-colors hover:border-foreground/30"
                    >
                      <div
                        className={
                          tab === "characters"
                            ? "relative aspect-[2/3] overflow-hidden bg-muted"
                            : "relative aspect-[9/5] overflow-hidden bg-muted"
                        }
                      >
                        {isVideo ? (
                          <video
                            src={item.url}
                            className="size-full object-cover"
                            muted
                            loop
                            playsInline
                            onMouseEnter={(e) => void e.currentTarget.play()}
                            onMouseLeave={(e) => e.currentTarget.pause()}
                          />
                        ) : (
                          <div
                            role="img"
                            aria-label={item.avatar_name}
                            className="size-full bg-cover bg-center"
                            style={{ backgroundImage: `url("${item.url}")` }}
                          />
                        )}
                        {tab === "backgrounds" && isVideo && (
                          <span
                            className="absolute left-3 top-3 grid size-9 place-items-center rounded-full border border-white/15 bg-black/65 text-white shadow-sm backdrop-blur"
                            aria-label="Video background"
                          >
                            <Video className="size-4" />
                          </span>
                        )}
                      </div>
                      <CardContent className="flex min-h-14 items-center justify-between gap-3 bg-background/70 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {item.avatar_name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {catalogLabel(catalog)}
                          </p>
                        </div>
                        {!isBasic ? (
                          <div className="flex">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-11"
                              onClick={() => openEditor(item)}
                            >
                              <Pencil />
                              <span className="sr-only">
                                Edit {item.avatar_name}
                              </span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-11 text-destructive"
                              onClick={() => setPendingDelete(item)}
                            >
                              <Trash2 />
                              <span className="sr-only">
                                Delete {item.avatar_name}
                              </span>
                            </Button>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {tab === "characters" ? "character" : "background"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.avatar_name}” will be removed permanently. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void remove()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
