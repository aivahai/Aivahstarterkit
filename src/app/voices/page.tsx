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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { aivahFetch } from "@/lib/api";
import { isCustomVoice, previewUrlOf } from "@/lib/chat-selectors";
import { validateUpload } from "@/lib/validation";
import {
  Mic2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Square,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type CatalogVoice = {
  voiceId: number;
  voiceName: string;
  voiceEnvironment?: string;
  voiceType?: string;
  voiceGender?: string;
  voiceUrl?: string;
  preview_url?: string;
  sample_url?: string;
};

export default function VoicesPage() {
  const [groups, setGroups] = useState<Record<string, CatalogVoice[]>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playing, setPlaying] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CatalogVoice | null>(null);
  const [voiceName, setVoiceName] = useState("");
  const [language, setLanguage] = useState("en");
  const [voiceGender, setVoiceGender] = useState("Female");
  const [description, setDescription] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const discardRecordingRef = useRef(false);

  const samplePreviewUrl = useMemo(
    () => (sampleFile ? URL.createObjectURL(sampleFile) : ""),
    [sampleFile],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await aivahFetch<{
        groups: Record<string, CatalogVoice[]>;
      }>("voices");
      setGroups(result.groups || {});
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Voices could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      audioRef.current?.pause();
      discardRecordingRef.current = true;
      if (
        recorderRef.current &&
        recorderRef.current.state !== "inactive"
      ) {
        recorderRef.current.stop();
      }
      recordingStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());
      if (recordingTimerRef.current)
        clearInterval(recordingTimerRef.current);
    };
  }, [load]);

  useEffect(
    () => () => {
      if (samplePreviewUrl) URL.revokeObjectURL(samplePreviewUrl);
    },
    [samplePreviewUrl],
  );

  const resetCloneForm = () => {
    setVoiceName("");
    setLanguage("en");
    setVoiceGender("Female");
    setDescription("");
    setSampleFile(null);
    setRecordingSeconds(0);
  };

  const filtered = useMemo<Record<string, CatalogVoice[]>>(
    () =>
      Object.fromEntries(
        Object.entries(groups)
          .map(([name, voices]) => [
            name,
            voices.filter((voice) =>
              voice.voiceName.toLowerCase().includes(search.toLowerCase()),
            ),
          ])
          .filter(([, voices]) => (voices as CatalogVoice[]).length),
      ) as Record<string, CatalogVoice[]>,
    [groups, search],
  );

  const preview = (voice: CatalogVoice, options?: { toggle?: boolean }) => {
    const url = previewUrlOf(voice);
    if (!url) {
      toast.info("No preview is available for this voice.");
      return;
    }
    if (options?.toggle !== false && playing === voice.voiceId) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setPlaying(null);
    void audio
      .play()
      .then(() => setPlaying(voice.voiceId))
      .catch(() =>
        toast.info(
          `Scrolled to ${voice.voiceName}. Tap Preview if the sample did not start.`,
        ),
      );
  };

  const clone = async () => {
    setSaving(true);
    try {
      const file = sampleFile;
      if (!(file instanceof File) || !file.size)
        throw new Error("Choose an audio sample.");
      const validation = validateUpload(file, "voice");
      if (validation) throw new Error(validation);
      const payload = new FormData();
      payload.set("voiceName", voiceName.trim());
      payload.set("language", language.trim() || "en");
      payload.set("voiceGender", voiceGender);
      payload.set("description", description.trim());
      payload.set("file", file);
      await aivahFetch("voices/clone", { method: "POST", body: payload });
      setDialogOpen(false);
      resetCloneForm();
      toast.success("Voice clone created");
      await load();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Voice clone failed",
      );
    } finally {
      setSaving(false);
    }
  };

  const stopRecording = (discard = false) => {
    discardRecordingRef.current = discard;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    setRecording(false);
  };

  const startRecording = async () => {
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      toast.error("Voice recording is not supported by this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      recordingStreamRef.current = stream;
      const preferredType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = preferredType
        ? new MediaRecorder(stream, { mimeType: preferredType })
        : new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recorderRef.current = recorder;
      discardRecordingRef.current = false;
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        if (!discardRecordingRef.current && recordingChunksRef.current.length) {
          const type = recorder.mimeType || preferredType || "audio/webm";
          const blob = new Blob(recordingChunksRef.current, { type });
          const extension = type.includes("mp4") ? "m4a" : "webm";
          setSampleFile(
            new File([blob], `voice-sample-${Date.now()}.${extension}`, {
              type: type.split(";")[0],
            }),
          );
        }
        recordingChunksRef.current = [];
        recorderRef.current = null;
      };
      recorder.start(250);
      setSampleFile(null);
      setRecordingSeconds(0);
      setRecording(true);
      recordingTimerRef.current = setInterval(
        () => setRecordingSeconds((seconds) => seconds + 1),
        1000,
      );
    } catch (cause) {
      streamErrorCleanup();
      toast.error(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Microphone permission is required to record a sample."
          : "The microphone could not be started.",
      );
    }
  };

  const streamErrorCleanup = () => {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
  };

  const closeCloneDialog = () => {
    stopRecording(true);
    resetCloneForm();
    setDialogOpen(false);
  };

  const remove = async () => {
    if (!pendingDelete) return;
    try {
      await aivahFetch(`voices/${pendingDelete.voiceId}`, {
        method: "DELETE",
      });
      toast.success("Voice deleted");
      setPendingDelete(null);
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Delete failed");
    }
  };

  return (
    <main className="aivah-page flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.035em]">Voices</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preview system voices or clone a customer-owned voice.
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              stopRecording(true);
              resetCloneForm();
            }
            setDialogOpen(open);
          }}
        >
          <DialogTrigger asChild>
            <Button className="h-11 rounded-full px-5">
              <Plus data-icon="inline-start" />
              Clone voice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void clone();
              }}
            >
              <DialogHeader>
                <DialogTitle className="text-xl">Clone a voice</DialogTitle>
              </DialogHeader>
              <div className="aivah-dialog-tip mt-5">
                Upload a clean sample with one speaker, minimal background
                noise, and a natural speaking pace.
              </div>
              <FieldGroup className="py-5">
                <Field>
                  <FieldLabel htmlFor="voice-name">Name</FieldLabel>
                  <Input
                    id="voice-name"
                    name="voiceName"
                    value={voiceName}
                    onChange={(event) => setVoiceName(event.target.value)}
                    required
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="language">Language</FieldLabel>
                    <Input
                      id="language"
                      name="language"
                      value={language}
                      onChange={(event) => setLanguage(event.target.value)}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="gender">Voice</FieldLabel>
                    <Select
                      name="voiceGender"
                      value={voiceGender}
                      onValueChange={setVoiceGender}
                    >
                      <SelectTrigger id="gender">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Male">Male</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea
                    id="description"
                    name="description"
                    rows={2}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="sample">Audio sample</FieldLabel>
                  <Input
                    id="sample"
                    name="file"
                    type="file"
                    accept="audio/*"
                    disabled={recording}
                    onChange={(event) =>
                      setSampleFile(event.target.files?.[0] || null)
                    }
                  />
                  <FieldDescription>
                    Use a clear sample with one speaker, up to 25 MB.
                  </FieldDescription>
                </Field>
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  or record
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant={recording ? "secondary" : "outline"}
                      className="min-h-11 rounded-full"
                      onClick={() =>
                        recording ? stopRecording() : void startRecording()
                      }
                    >
                      {recording ? (
                        <Square
                          data-icon="inline-start"
                          className="fill-current"
                        />
                      ) : (
                        <Mic2 data-icon="inline-start" />
                      )}
                      {recording ? "Stop recording" : "Record voice"}
                    </Button>
                    {recording && (
                      <span
                        className="font-mono text-sm text-muted-foreground"
                        aria-live="polite"
                      >
                        {String(Math.floor(recordingSeconds / 60)).padStart(
                          2,
                          "0",
                        )}
                        :
                        {String(recordingSeconds % 60).padStart(2, "0")}
                      </span>
                    )}
                    {sampleFile && !recording && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="min-h-11"
                        onClick={() => void startRecording()}
                      >
                        <RotateCcw data-icon="inline-start" />
                        Record again
                      </Button>
                    )}
                  </div>
                  {samplePreviewUrl && !recording && (
                    <audio
                      controls
                      src={samplePreviewUrl}
                      className="mt-4 h-11 w-full"
                      aria-label="Recorded voice sample"
                    />
                  )}
                </div>
              </FieldGroup>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeCloneDialog}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Spinner data-icon="inline-start" />}
                  {saving ? "Cloning…" : "Clone voice"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="relative max-w-3xl">
        <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-12 rounded-xl pl-12"
          placeholder="Search"
          aria-label="Search voices"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {error ? (
        <ApiError error={error} onRetry={() => void load()} />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : Object.keys(filtered).length === 0 ? (
        <Card>
          <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
            <Mic2 className="size-8 text-muted-foreground" />
            <p className="font-medium">No voices found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {Object.entries(filtered).map(([group, voices]) => (
            <section key={group} aria-labelledby={`voice-${group}`}>
              <div className="mb-3 flex items-center gap-2">
                <h2 id={`voice-${group}`} className="text-sm font-semibold">
                  {group}
                </h2>
                <Badge variant="secondary">{voices.length}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {voices.map((voice) => {
                  const custom = isCustomVoice({ ...voice, group });
                  return (
                    <Card
                      id={`voice-card-${voice.voiceId}`}
                      key={voice.voiceId}
                      className="scroll-mt-24 transition-colors hover:border-foreground/30"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-base">
                              {voice.voiceName}
                            </CardTitle>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {voice.voiceEnvironment || group}
                              {voice.voiceGender
                                ? ` · ${voice.voiceGender}`
                                : ""}
                            </p>
                          </div>
                          <Badge variant={custom ? "default" : "secondary"}>
                            {custom ? "Custom" : "System"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="flex items-center justify-between">
                        <Button
                          variant="outline"
                          className="h-11"
                          onClick={() => preview(voice)}
                        >
                          {playing === voice.voiceId ? <Pause /> : <Play />}{" "}
                          Preview
                        </Button>
                        {custom && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-11 text-destructive"
                            onClick={() => setPendingDelete(voice)}
                          >
                            <Trash2 />
                            <span className="sr-only">
                              Delete {voice.voiceName}
                            </span>
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete custom voice?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.voiceName}” will no longer be available for new
              conversations. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void remove()}
            >
              Delete voice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
