"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Background, Character } from "@/lib/api-types";
import {
  type AvatarCatalog,
  DEFAULT_AVATAR_CATALOG,
  avatarTypeOf,
  catalogLabel,
  toAvatarCatalog,
} from "@/lib/avatar-catalog";
import { cn } from "@/lib/utils";
import {
  AudioLines,
  Check,
  ChevronDown,
  Drama,
  ImageIcon,
  Pause,
  Play,
  Search,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

export type ComposerPickerItem = {
  value: string;
  label: string;
  group: string;
  description?: string;
  previewUrl?: string;
};

export function ComposerPicker({
  ariaLabel,
  icon: Icon,
  placeholder,
  searchPlaceholder,
  items,
  value,
  onValueChange,
  align = "start",
  renderItem,
  disabled = false,
  pickerId,
}: {
  ariaLabel: string;
  icon: LucideIcon;
  placeholder: string;
  searchPlaceholder: string;
  items: ComposerPickerItem[];
  value: string;
  onValueChange: (value: string) => void;
  align?: "start" | "center" | "end";
  renderItem?: (item: ComposerPickerItem) => ReactNode;
  disabled?: boolean;
  pickerId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const groups = useMemo(
    () => Array.from(new Set(items.map((item) => item.group))),
    [items],
  );
  const selected = items.find((item) => item.value === value);
  const selectedGroup = selected?.group ?? groups[0] ?? "";
  const [activeGroup, setActiveGroup] = useState(selectedGroup);
  const filtered = items.filter(
    (item) =>
      (!activeGroup || item.group === activeGroup) &&
      `${item.label} ${item.description || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  useEffect(() => {
    if (open) setActiveGroup(selectedGroup);
  }, [open, selectedGroup]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          aria-label={ariaLabel}
          className="h-9 min-w-0 max-w-44 shrink px-2.5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground sm:max-w-48"
        >
          <Icon className="size-4 shrink-0" />
          <span className="max-w-28 truncate">
            {selected?.label || placeholder}
          </span>
          <ChevronDown className="size-3.5 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align={align}
        sideOffset={10}
        collisionPadding={12}
        className="w-[min(365px,calc(100vw-1rem))] overflow-hidden rounded-3xl p-0 shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
        {groups.length > 1 && (
          <div className="flex gap-2 overflow-x-auto border-b px-3 py-2">
            {groups.map((group) => (
              <button
                key={group}
                type="button"
                onClick={() => setActiveGroup(group)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  activeGroup === group
                    ? "border-foreground/20 bg-foreground/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {group}
              </button>
            ))}
          </div>
        )}
        <div className="max-h-[320px] overflow-y-auto p-3">
          <p className="mb-2 px-2 text-xs font-semibold text-muted-foreground">
            {activeGroup || "Options"}
          </p>
          {filtered.length ? (
            <div className="space-y-1">
              {filtered.map((item) => {
                const isSelected = item.value === value;
                return (
                  <div
                    id={`picker-${pickerId || "item"}-${item.value}`}
                    key={`${item.group}-${item.value}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onValueChange(item.value);
                      setOpen(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onValueChange(item.value);
                        setOpen(false);
                      }
                    }}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected && "bg-muted",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      {renderItem ? (
                        renderItem(item)
                      ) : (
                        <>
                          <span className="block truncate text-sm font-medium">
                            {item.label}
                          </span>
                          {item.description && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {item.description}
                            </span>
                          )}
                        </>
                      )}
                    </span>
                    {isSelected && <Check className="size-4 shrink-0" />}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No matching options.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function VoicePicker({
  items,
  value,
  onValueChange,
  disabled = false,
  pickerId = "voice",
}: {
  items: ComposerPickerItem[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  pickerId?: string;
}) {
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePreview = (item: ComposerPickerItem) => {
    if (!item.previewUrl) return;
    if (playing === item.value) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(item.previewUrl);
    audioRef.current = audio;
    audio.onended = () => setPlaying(null);
    audio.onerror = () => setPlaying(null);
    setPlaying(item.value);
    void audio.play().catch(() => setPlaying(null));
  };

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    [],
  );

  return (
    <ComposerPicker
      ariaLabel="Choose voice"
      icon={AudioLines}
      placeholder="Voice"
      searchPlaceholder="Search voices…"
      items={items}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      pickerId={pickerId}
      align="end"
      renderItem={(item) => (
        <span className="flex min-w-0 items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {item.label}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {item.group}
            </span>
          </span>
          {item.previewUrl && (
            <button
              type="button"
              aria-label={`${playing === item.value ? "Pause" : "Preview"} ${item.label}`}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-background hover:bg-accent"
              onClick={(event) => {
                event.stopPropagation();
                togglePreview(item);
              }}
            >
              {playing === item.value ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4 fill-current" />
              )}
            </button>
          )}
        </span>
      )}
    />
  );
}

function MediaThumb({
  url,
  label,
  video = false,
}: {
  url: string;
  label: string;
  video?: boolean;
}) {
  if (video) {
    return (
      <video
        src={url}
        muted
        playsInline
        className="size-full object-cover"
        aria-label={label}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={label}
      className="block size-full bg-cover bg-center"
      style={{ backgroundImage: `url("${url.replaceAll('"', "%22")}")` }}
    />
  );
}

function resourceCatalog(resource: {
  avatarType?: string;
  avatar_type?: string;
}): AvatarCatalog {
  return toAvatarCatalog(avatarTypeOf(resource)) ?? DEFAULT_AVATAR_CATALOG;
}

export function CharacterBackgroundPicker({
  characters,
  backgrounds,
  characterId,
  backgroundId,
  onSave,
  disabled = false,
  pickerId = "character",
}: {
  characters: Character[];
  backgrounds: Background[];
  characterId: string;
  backgroundId: string;
  onSave: (characterId: string, backgroundId: string) => void;
  disabled?: boolean;
  pickerId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("characters");
  const [draftCharacter, setDraftCharacter] = useState(characterId);
  const [draftBackground, setDraftBackground] = useState(backgroundId);
  const selected = characters.find(
    (character) => String(character.id) === characterId,
  );
  const selectedCatalog =
    (selected ? resourceCatalog(selected) : null) ??
    (backgroundId !== "none"
      ? resourceCatalog(
          backgrounds.find((item) => String(item.id) === backgroundId) || {},
        )
      : DEFAULT_AVATAR_CATALOG);
  const [catalog, setCatalog] = useState<AvatarCatalog>(selectedCatalog);

  const filteredCharacters = characters.filter(
    (character) => resourceCatalog(character) === catalog,
  );
  const filteredBackgrounds = backgrounds.filter(
    (background) => resourceCatalog(background) === catalog,
  );

  const reset = () => {
    setDraftCharacter(characterId);
    setDraftBackground(backgroundId);
    setCatalog(selectedCatalog);
  };

  const selectCharacter = (nextId: string) => {
    const next =
      nextId === "none"
        ? null
        : characters.find((character) => String(character.id) === nextId);
    const nextCatalog = next ? resourceCatalog(next) : catalog;
    setDraftCharacter(nextId);
    if (next && nextCatalog !== catalog) {
      setCatalog(nextCatalog);
      setDraftBackground("none");
      return;
    }
    if (nextId !== "none") {
      const currentBackground = backgrounds.find(
        (item) => String(item.id) === draftBackground,
      );
      if (
        currentBackground &&
        resourceCatalog(currentBackground) !== nextCatalog
      ) {
        setDraftBackground("none");
      }
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className={cn(
          "h-9 min-w-0 max-w-40 shrink px-2.5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
          selected && "bg-foreground/5 text-foreground",
        )}
      >
        <Drama className="size-4 shrink-0" />
        <span className="max-w-24 truncate">
          {selected?.avatar_name || "Character"}
        </span>
        {selected && (
          <X
            className="size-3.5 shrink-0"
            onClick={(event) => {
              event.stopPropagation();
              onSave("none", "none");
            }}
          />
        )}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) reset();
          setOpen(next);
        }}
      >
        <DialogContent className="flex h-[min(90dvh,640px)] max-w-2xl flex-col gap-3 overflow-hidden sm:max-w-2xl">
          <DialogHeader className="shrink-0">
            <DialogTitle>Character &amp; Background</DialogTitle>
          </DialogHeader>
          <div
            className="inline-flex w-fit shrink-0 items-center gap-0.5 rounded-full bg-muted/55 p-0.5"
            role="group"
            aria-label="Character catalog"
          >
            {(["hero", "basic"] as AvatarCatalog[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  if (option === catalog) return;
                  setCatalog(option);
                  setDraftCharacter("none");
                  setDraftBackground("none");
                }}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  catalog === option
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {catalogLabel(option)}
              </button>
            ))}
          </div>
          <Tabs
            value={tab}
            onValueChange={setTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="mb-3 h-9 w-fit shrink-0">
              <TabsTrigger value="characters">Characters</TabsTrigger>
              <TabsTrigger value="backgrounds">Backgrounds</TabsTrigger>
            </TabsList>
            <TabsContent
              value="characters"
              className="mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
              {filteredCharacters.length ? (
                <div className="grid grid-cols-2 gap-3 pr-1 sm:grid-cols-3 md:grid-cols-4">
                  {filteredCharacters.map((character) => {
                    const isSelected = draftCharacter === String(character.id);
                    return (
                      <button
                        id={`picker-${pickerId}-${character.id}`}
                        key={character.id}
                        type="button"
                        onClick={() =>
                          selectCharacter(
                            isSelected ? "none" : String(character.id),
                          )
                        }
                        className={cn(
                          "group overflow-hidden rounded-2xl border-2 text-left transition-colors",
                          isSelected
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-transparent hover:border-border",
                        )}
                      >
                        <span className="block aspect-square overflow-hidden bg-muted">
                          <MediaThumb
                            url={character.url}
                            label={character.avatar_name}
                          />
                        </span>
                        <span className="block truncate px-2 py-2 text-xs font-medium">
                          {character.avatar_name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No {catalogLabel(catalog).toLowerCase()} characters available.
                </p>
              )}
            </TabsContent>
            <TabsContent
              value="backgrounds"
              className="mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain"
            >
              {filteredBackgrounds.length ? (
                <div className="grid grid-cols-1 gap-3 pr-1 sm:grid-cols-2 md:grid-cols-3">
                  {filteredBackgrounds.map((background) => {
                    const isSelected =
                      draftBackground === String(background.id);
                    const isVideo =
                      background.mediaType === "video" ||
                      /\.(mp4|webm|mov)(\?|#|$)/i.test(background.url);
                    return (
                      <button
                        id={`picker-${pickerId}-${background.id}`}
                        key={background.id}
                        type="button"
                        onClick={() =>
                          setDraftBackground(
                            isSelected ? "none" : String(background.id),
                          )
                        }
                        className={cn(
                          "group overflow-hidden rounded-xl border-2 text-left transition-colors",
                          isSelected
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-transparent hover:border-border",
                        )}
                      >
                        <span className="relative block aspect-[9/5] overflow-hidden bg-muted">
                          <MediaThumb
                            url={background.url}
                            label={background.avatar_name}
                            video={isVideo}
                          />
                          {isVideo && (
                            <span
                              className="absolute left-2 top-2 grid size-8 place-items-center rounded-full border border-white/15 bg-black/65 text-white shadow-sm backdrop-blur"
                              aria-label="Video background"
                            >
                              <Video className="size-4" />
                            </span>
                          )}
                          {isSelected && (
                            <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                              <Check className="size-3" />
                            </span>
                          )}
                        </span>
                        <span className="block truncate px-2 py-2 text-xs font-medium">
                          {background.avatar_name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
                  <ImageIcon className="size-6" />
                  No {catalogLabel(catalog).toLowerCase()} backgrounds
                  available.
                </div>
              )}
            </TabsContent>
          </Tabs>
          <DialogFooter className="shrink-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                onSave(draftCharacter, draftBackground);
                setOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
