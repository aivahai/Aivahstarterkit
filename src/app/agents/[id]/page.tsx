"use client";

import { ApiError } from "@/components/api-error";
import { AgentFilePicker } from "@/components/agents/agent-file-picker";
import { PageHeading } from "@/components/page-heading";
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
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { aivahFetch } from "@/lib/api";
import type { Agent, AgentContent } from "@/lib/api-types";
import {
  PRESENTATION_AGENT_ACCEPT,
  STANDARD_AGENT_ACCEPT,
  validateAgentFiles,
} from "@/lib/validation";
import { ArrowLeft, File, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function contentFrom(agent: Agent): AgentContent[] {
  for (const key of [
    "chatBotContents",
    "contents",
    "content",
    "knowledgeBaseContents",
  ]) {
    const value = agent[key];
    if (Array.isArray(value)) return value as AgentContent[];
  }
  return [];
}

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [pendingContent, setPendingContent] = useState<AgentContent | null>(
    null,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState("");
  const [agentPrompt, setAgentPrompt] = useState("");
  const [persona, setPersona] = useState("");
  const [contentUrls, setContentUrls] = useState("");
  const [contentText, setContentText] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await aivahFetch<Agent>(`agents/${id}`);
      const normalized = {
        ...result,
        chat_bot_id: result.chat_bot_id || result.chatBotId || Number(id),
        name: result.name || result.knowledgeBaseName || `Agent ${id}`,
        is_presentation_agent:
          result.is_presentation_agent ?? result.isPresentationAgent,
        agent_prompt: result.agent_prompt ?? result.agentPrompt,
        training_status: result.training_status ?? result.trainingStatus,
      };
      setAgent(normalized);
      setName(normalized.name || "");
      setAgentPrompt(normalized.agent_prompt || "");
      setPersona(normalized.persona || "");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Agent could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  const contents = useMemo(() => (agent ? contentFrom(agent) : []), [agent]);

  const update = useCallback(async () => {
    setSaving(true);
    try {
      await aivahFetch(`agents/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          agentPrompt,
          persona,
        }),
      });
      toast.success("Agent updated");
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }, [agentPrompt, id, load, name, persona]);

  const addContent = useCallback(async () => {
    setAdding(true);
    try {
      const presentation = Boolean(agent?.is_presentation_agent);
      const validation = validateAgentFiles(newFiles, presentation);
      if (validation) throw new Error(validation);
      const payload = new FormData();
      newFiles.forEach((file) => payload.append("contents", file));
      const urls = contentUrls
        .split(/\n|,/)
        .map((value) => value.trim())
        .filter(Boolean)
        .map((websiteUrl) => ({ websiteUrl, noOfPages: 10 }));
      payload.set("urls", JSON.stringify(presentation ? [] : urls));
      payload.set(
        "textContent",
        presentation ? "" : contentText.trim(),
      );
      if (
        !newFiles.length &&
        !urls.length &&
        !contentText.trim()
      ) {
        throw new Error("Choose a file or add a URL or text source.");
      }
      await aivahFetch(`agents/${id}/content`, {
        method: "POST",
        body: payload,
      });
      toast.success("Content added");
      setNewFiles([]);
      setContentUrls("");
      setContentText("");
      await load();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Content could not be added",
      );
    } finally {
      setAdding(false);
    }
  }, [agent, contentText, contentUrls, id, load, newFiles]);

  const deleteContent = async () => {
    if (!pendingContent) return;
    const contentId = Number(
      pendingContent.chatBotContentId ||
        pendingContent.chat_bot_content_id ||
        pendingContent.id,
    );
    try {
      await aivahFetch(`agents/${id}/content?contentId=${contentId}`, {
        method: "DELETE",
      });
      toast.success("Content removed");
      setPendingContent(null);
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Delete failed");
    }
  };
  const retry = async () => {
    try {
      await aivahFetch(`agents/${id}/retry`, { method: "POST", body: "{}" });
      toast.success("Training retry submitted");
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Retry failed");
    }
  };
  const remove = async () => {
    try {
      await aivahFetch(`agents/${id}`, { method: "DELETE" });
      toast.success("Agent deleted");
      router.push("/agents");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Delete failed");
    }
  };
  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading)
    return (
      <div className="aivah-page mx-auto flex max-w-5xl flex-col gap-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  if (error || !agent)
    return (
      <div className="mx-auto max-w-5xl p-4 sm:p-8">
        <ApiError
          error={error || "Agent not found"}
          onRetry={() => void load()}
        />
      </div>
    );
  const failed = (agent.training_status || "").toLowerCase().includes("fail");
  return (
    <main className="aivah-page mx-auto flex w-full max-w-5xl flex-col gap-8">
      <Button asChild variant="ghost" className="-ml-3 h-11">
        <Link href="/agents">
          <ArrowLeft data-icon="inline-start" /> Back to agents
        </Link>
      </Button>
      <PageHeading
        title={agent.name}
        description="Edit behavior, manage knowledge, and monitor training."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge
              variant={agent.is_presentation_agent ? "default" : "secondary"}
            >
              {agent.is_presentation_agent ? "Presentation" : "Standard"}
            </Badge>
            <Badge variant={failed ? "destructive" : "secondary"}>
              {agent.training_status || "Ready"}
            </Badge>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full"
              disabled={refreshing}
              onClick={() => void refresh()}
            >
              {refreshing ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              Refresh
            </Button>
          </div>
        }
      />
      {failed && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-start justify-between gap-4 py-5 sm:flex-row sm:items-center">
            <div>
              <p className="font-medium">Training needs attention</p>
              <p className="text-sm text-muted-foreground">
                Retry all failed content after correcting the source.
              </p>
            </div>
            <Button variant="outline" onClick={() => void retry()}>
              <RefreshCw data-icon="inline-start" /> Retry training
            </Button>
          </CardContent>
        </Card>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void update();
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input
                  id="name"
                  name="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="prompt">Prompt</FieldLabel>
                <Textarea
                  id="prompt"
                  name="agentPrompt"
                  value={agentPrompt}
                  onChange={(event) => setAgentPrompt(event.target.value)}
                  rows={6}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="persona">Persona</FieldLabel>
                <Textarea
                  id="persona"
                  name="persona"
                  value={persona}
                  onChange={(event) => setPersona(event.target.value)}
                  rows={4}
                />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={saving}>
              <Save data-icon="inline-start" />{" "}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </CardFooter>
        </Card>
      </form>
      <Card>
        <CardHeader>
          <CardTitle>Knowledge & presentation content</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {contents.length ? (
            contents.map((content) => {
              const contentId = Number(
                content.chatBotContentId ||
                  content.chat_bot_content_id ||
                  content.id,
              );
              return (
                <div
                  key={contentId}
                  className="flex min-h-16 items-center gap-3 rounded-lg border p-3"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted">
                    <File className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {String(
                        content.file_name ||
                          content.url ||
                          `Content ${contentId}`,
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {String(
                        content.ingestionStatus ||
                          content.ingestion_status ||
                          content.chatBotContentType ||
                          content.content_type ||
                          "Content",
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 text-destructive"
                    onClick={() => setPendingContent(content)}
                  >
                    <Trash2 />
                    <span className="sr-only">Remove content</span>
                  </Button>
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No content has been added.
            </div>
          )}
        </CardContent>
      </Card>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void addContent();
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Add content</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-files">Files</FieldLabel>
                <AgentFilePicker
                  files={newFiles}
                  onChange={setNewFiles}
                  presentation={Boolean(agent.is_presentation_agent)}
                  accept={
                    agent.is_presentation_agent
                      ? PRESENTATION_AGENT_ACCEPT
                      : STANDARD_AGENT_ACCEPT
                  }
                />
              </Field>
              {!agent.is_presentation_agent && (
                <>
                  <Field>
                    <FieldLabel htmlFor="new-urls">URLs</FieldLabel>
                    <Textarea
                      id="new-urls"
                      name="urls"
                      rows={2}
                      value={contentUrls}
                      onChange={(event) => setContentUrls(event.target.value)}
                    />
                    <FieldDescription>One URL per line.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="new-text">Text</FieldLabel>
                    <Textarea
                      id="new-text"
                      name="textContent"
                      rows={3}
                      value={contentText}
                      onChange={(event) => setContentText(event.target.value)}
                    />
                  </Field>
                </>
              )}
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={adding}>
              <Upload data-icon="inline-start" />{" "}
              {adding ? "Adding…" : "Add content"}
            </Button>
          </CardFooter>
        </Card>
      </form>
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Delete agent</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Permanently removes the agent, its content, and associated
            conversations.
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 data-icon="inline-start" /> Delete agent
          </Button>
        </CardFooter>
      </Card>
      <AlertDialog
        open={Boolean(pendingContent)}
        onOpenChange={(open) => {
          if (!open) setPendingContent(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove training content?</AlertDialogTitle>
            <AlertDialogDescription>
              “
              {String(
                pendingContent?.file_name ||
                  pendingContent?.url ||
                  "This content",
              )}
              ” will be removed from {agent.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void deleteContent()}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete agent?</AlertDialogTitle>
            <AlertDialogDescription>
              “{agent.name}”, its training content, and its conversations will
              be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void remove()}
            >
              Delete agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
