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
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { aivahFetch, asArray } from "@/lib/api";
import type { Agent, Paginated } from "@/lib/api-types";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  FileSliders,
  Pencil,
  RefreshCw,
  MoreHorizontal,
  Plus,
  Presentation,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE = 10;

function trainingVariant(status = "") {
  const normalized = status.toLowerCase();
  if (["failed", "error"].includes(normalized)) return "destructive" as const;
  if (["completed", "trained", "ready"].includes(normalized))
    return "default" as const;
  return "secondary" as const;
}

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<Agent | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const result = await aivahFetch<Paginated<Agent>>(
        `agents?search=${encodeURIComponent(search)}&limit=50`,
      );
      setAgents(asArray<Agent>(result));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Agents could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [search]);
  useEffect(() => {
    setLoading(true);
    setPage(1);
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);
  const polling = useMemo(
    () =>
      agents.some((agent) =>
        ["pending", "processing", "training", "in_progress"].includes(
          (agent.training_status || "").toLowerCase(),
        ),
      ),
    [agents],
  );
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load, polling]);
  const pageSize = PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(agents.length / pageSize));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const visibleAgents = agents.slice((page - 1) * pageSize, page * pageSize);
  const retry = async (agent: Agent) => {
    try {
      await aivahFetch(`agents/${agent.chat_bot_id}/retry`, {
        method: "POST",
        body: "{}",
      });
      toast.success(`Training retry submitted for ${agent.name}.`);
      await load();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Retry failed");
    }
  };
  const remove = async () => {
    if (!pendingDelete) return;
    try {
      await aivahFetch(`agents/${pendingDelete.chat_bot_id}`, {
        method: "DELETE",
      });
      toast.success(`${pendingDelete.name} deleted.`);
      setPendingDelete(null);
      await load();
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
  const openAgent = (agent: Agent) => {
    router.push(`/agents/${agent.chat_bot_id}`);
  };

  return (
    <main className="aivah-page flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <div className="relative max-w-3xl flex-1">
          <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-12 rounded-xl pl-12"
            placeholder="Search"
            aria-label="Search agents"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="size-12 shrink-0 rounded-full"
          aria-label="Refresh agents"
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          {refreshing ? <Spinner /> : <RefreshCw />}
        </Button>
        <Button
          asChild
          size="icon-lg"
          className="size-12 shrink-0 rounded-full"
        >
          <Link href="/agents/create" aria-label="Create agent">
            <Plus />
          </Link>
        </Button>
      </div>
      {error ? (
        <ApiError error={error} onRetry={() => void load()} />
      ) : loading ? (
        <Skeleton className="min-h-[520px] rounded-2xl" />
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
            <Bot className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No agents found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create an agent to start a live conversation.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="hidden min-h-[520px] overflow-hidden rounded-2xl border md:block">
            <Table>
              <TableHeader className="bg-muted/55">
                <TableRow className="hover:bg-muted/55">
                  <TableHead className="h-12 px-6 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Name
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Type
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Capabilities
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleAgents.map((agent) => {
                  const status = agent.training_status || "Ready";
                  const active = [
                    "pending",
                    "processing",
                    "training",
                    "in_progress",
                  ].includes(status.toLowerCase());
                  return (
                    <TableRow
                      key={agent.chat_bot_id}
                      role="link"
                      tabIndex={0}
                      aria-label={`View ${agent.name}`}
                      className="h-[68px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      onClick={() => openAgent(agent)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openAgent(agent);
                        }
                      }}
                    >
                      <TableCell className="px-6 font-medium">
                        {agent.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Realtime</Badge>
                      </TableCell>
                      <TableCell>
                        {agent.is_presentation_agent ? (
                          <Badge variant="outline">
                            <Presentation data-icon="inline-start" />
                            Presenter
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          <Badge
                            className="w-fit capitalize"
                            variant={trainingVariant(status)}
                          >
                            {status.replaceAll("_", " ")}
                          </Badge>
                          {active && <Progress className="h-1 w-28" />}
                        </div>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-11"
                              aria-label={`Actions for ${agent.name}`}
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem asChild>
                              <Link href={`/agents/${agent.chat_bot_id}`}>
                                <Pencil /> Edit agent
                              </Link>
                            </DropdownMenuItem>
                            {status.toLowerCase().includes("fail") && (
                              <DropdownMenuItem
                                onSelect={() => void retry(agent)}
                              >
                                <RefreshCw /> Retry training
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setPendingDelete(agent)}
                            >
                              <Trash2 /> Delete agent
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {pageCount > 1 && (
            <div className="hidden items-center justify-between px-1 text-sm text-muted-foreground md:flex">
              <span>
                {(page - 1) * pageSize + 1}–
                {Math.min(page * pageSize, agents.length)} of {agents.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  disabled={page === 1}
                  onClick={() => setPage((value) => value - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft />
                </Button>
                {Array.from({ length: pageCount }, (_, index) => index + 1)
                  .slice(Math.max(0, page - 3), Math.max(5, page + 2))
                  .map((pageNumber) => (
                    <Button
                      key={pageNumber}
                      variant={pageNumber === page ? "default" : "ghost"}
                      size="icon"
                      className="size-11"
                      onClick={() => setPage(pageNumber)}
                      aria-label={`Page ${pageNumber}`}
                      aria-current={pageNumber === page ? "page" : undefined}
                    >
                      {pageNumber}
                    </Button>
                  ))}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  disabled={page === pageCount}
                  onClick={() => setPage((value) => value + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-3 md:hidden">
            {visibleAgents.map((agent) => {
              const status = agent.training_status || "Ready";
              return (
                <Card
                  key={agent.chat_bot_id}
                  role="link"
                  tabIndex={0}
                  aria-label={`View ${agent.name}`}
                  className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => openAgent(agent)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openAgent(agent);
                    }
                  }}
                >
                  <CardHeader className="flex-row items-start justify-between">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">
                        {agent.name}
                      </CardTitle>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {agent.persona ||
                          agent.agent_prompt ||
                          "Realtime agent"}
                      </p>
                    </div>
                    <Badge variant={trainingVariant(status)}>
                      {status.replaceAll("_", " ")}
                    </Badge>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <Badge variant="outline">
                      {agent.is_presentation_agent
                        ? "Presentation"
                        : "Standard"}
                    </Badge>
                    <Button
                      asChild
                      variant="ghost"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Link href={`/agents/${agent.chat_bot_id}`}>
                        <FileSliders data-icon="inline-start" />
                        Manage
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {pageCount > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground md:hidden">
              <span>
                Page {page} of {pageCount}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11"
                  disabled={page === 1}
                  onClick={() => setPage((value) => value - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11"
                  disabled={page === pageCount}
                  onClick={() => setPage((value) => value + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete agent?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name}”, its training content, and its
              conversations will be permanently deleted. This cannot be undone.
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
