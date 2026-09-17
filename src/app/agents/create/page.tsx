"use client";

import { AgentFilePicker } from "@/components/agents/agent-file-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { aivahFetch } from "@/lib/api";
import {
  PRESENTATION_AGENT_ACCEPT,
  STANDARD_AGENT_ACCEPT,
  validateAgentFiles,
} from "@/lib/validation";
import { ArrowLeft, BotMessageSquare, Presentation, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export default function CreateAgentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [agentPrompt, setAgentPrompt] = useState("");
  const [persona, setPersona] = useState("");
  const [urls, setUrls] = useState("");
  const [textContent, setTextContent] = useState("");
  const [presentation, setPresentation] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const submit = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const validation = validateAgentFiles(files, presentation);
      if (validation) throw new Error(validation);
      const parsedUrls = presentation
        ? []
        : urls
            .split(/\n|,/)
            .map((value) => value.trim())
            .filter(Boolean)
            .map((websiteUrl) => ({ websiteUrl, noOfPages: 10 }));
      const trimmedText = presentation ? "" : textContent.trim();
      if (presentation && !files.length) {
        throw new Error(
          "Presentation agents require at least one PDF or video.",
        );
      }
      if (!presentation && !files.length && !parsedUrls.length && !trimmedText) {
        throw new Error("Add at least one file, URL, or text source.");
      }

      const payload = new FormData();
      payload.set("name", name.trim());
      payload.set("agentPrompt", agentPrompt.trim());
      payload.set("persona", persona.trim());
      payload.set("isPresentationAgent", String(presentation));
      payload.set("urls", JSON.stringify(parsedUrls));
      payload.set("textContent", trimmedText);
      files.forEach((file) => payload.append("contents", file));
      await aivahFetch("agents", {
        method: "POST",
        body: payload,
      });
      toast.success("Agent created. Training has started.");
      router.push("/agents");
      router.refresh();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Agent could not be created",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [
    agentPrompt,
    files,
    name,
    persona,
    presentation,
    router,
    textContent,
    urls,
  ]);

  return (
    <main className="aivah-page">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-7">
        <Button asChild variant="ghost" className="-ml-3 h-11 w-fit">
          <Link href="/agents">
            <ArrowLeft /> Back to agents
          </Link>
        </Button>
        <form
          className="space-y-9"
          aria-busy={saving}
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Field>
            <FieldLabel
              htmlFor="name"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Name
            </FieldLabel>
            <Input
              id="name"
              name="name"
              placeholder="Name your agent"
              required
              maxLength={255}
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-auto border-0 bg-transparent px-0 py-2 text-4xl font-semibold tracking-[-0.04em] shadow-none focus-visible:ring-0 sm:text-5xl"
            />
          </Field>

          <section className="space-y-3">
            <div>
              <h2 className="font-semibold">Agent capabilities</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a standard knowledge agent or a synchronized presenter.
              </p>
            </div>
            <Card className="py-0">
              <CardContent className="flex min-h-24 items-center gap-4 p-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted">
                  {presentation ? (
                    <Presentation className="size-5" />
                  ) : (
                    <BotMessageSquare className="size-5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Presenter</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Enable synchronized PDF pages or video chapters.
                  </span>
                </span>
                <Switch
                  aria-label="Presentation mode"
                  checked={presentation}
                  onCheckedChange={(checked) => {
                    setPresentation(checked);
                    setFiles([]);
                  }}
                />
              </CardContent>
            </Card>
          </section>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="prompt">Agent prompt</FieldLabel>
              <FieldDescription>
                Explain the role, rules, and outcomes expected from this agent.
              </FieldDescription>
              <Textarea
                id="prompt"
                name="agentPrompt"
                rows={9}
                placeholder="You are a concise and helpful support agent…"
                className="field-sizing-fixed resize-y rounded-xl bg-muted/15 p-4"
                value={agentPrompt}
                onChange={(event) => setAgentPrompt(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="persona">Persona</FieldLabel>
              <FieldDescription>
                Define the tone and working style.
              </FieldDescription>
              <Input
                id="persona"
                name="persona"
                placeholder="Warm, direct, expert, and concise"
                className="h-12"
                value={persona}
                onChange={(event) => setPersona(event.target.value)}
              />
            </Field>
          </FieldGroup>

          <section className="space-y-4">
            <div>
              <h2 className="font-semibold">
                {presentation ? "Presentation content" : "Training content"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {presentation
                  ? "Attach one or more PDFs or videos. Each file becomes a lesson; slide and chapter metadata is generated during training."
                  : "Attach documents, images, audio, or video, and optionally add URLs or text."}
              </p>
            </div>
            <AgentFilePicker
              files={files}
              onChange={setFiles}
              presentation={presentation}
              accept={
                presentation ? PRESENTATION_AGENT_ACCEPT : STANDARD_AGENT_ACCEPT
              }
            />
            {!presentation && (
              <div className="grid gap-5 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="urls">URLs</FieldLabel>
                  <Textarea
                    id="urls"
                    name="urls"
                    rows={5}
                    placeholder={
                      "https://example.com/docs\nhttps://example.com/help"
                    }
                    className="field-sizing-fixed"
                    value={urls}
                    onChange={(event) => setUrls(event.target.value)}
                  />
                  <FieldDescription>One URL per line.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="text">Text knowledge</FieldLabel>
                  <Textarea
                    id="text"
                    name="textContent"
                    rows={5}
                    maxLength={1000}
                    placeholder="Paste focused knowledge here…"
                    className="field-sizing-fixed"
                    value={textContent}
                    onChange={(event) => setTextContent(event.target.value)}
                  />
                </Field>
              </div>
            )}
          </section>

          <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-3 border-t bg-background/90 px-4 py-3 backdrop-blur sm:flex-row sm:justify-end">
            <Button
              asChild
              type="button"
              variant="outline"
              className="rounded-full"
            >
              <Link href="/agents">Cancel</Link>
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="rounded-full px-6"
            >
              {saving ? <Spinner data-icon="inline-start" /> : <Save />}
              {saving ? "Creating agent…" : "Create agent"}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
