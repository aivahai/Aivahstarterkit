"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ArrowLeftIcon, ArrowRightIcon, MaximizeIcon } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLiveKitRoom, useLivekitRoomStore } from "@/store/livekit-room";
import {
  usePresentationFullScreen,
  usePresentationStore,
} from "@/store/presentation";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface PDFViewerPros {
  url: string;
  hideFullscreen?: boolean;
}

function publishPageChange(
  room: ReturnType<typeof useLivekitRoomStore.getState>["room"],
  pageNumber: number
) {
  if (!room?.localParticipant) return;
  try {
    const payload = new TextEncoder().encode(
      JSON.stringify({ event: "page_change", pageNumber })
    );
    room.localParticipant.publishData(payload, { reliable: true });
  } catch {
    /* ignore */
  }
}

export default function PDFViewer({ url, hideFullscreen }: PDFViewerPros) {
  const [fileBlob, setFileBlob] = useState<Blob | null>(null);
  const { currentPage, setCurrentPage, totalPages, setTotalPages } =
    usePresentationStore();
  const room = useLiveKitRoom();
  const [visiblePage, setVisiblePage] = useState(() => currentPage);
  const [preloadPage, setPreloadPage] = useState<number | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [snapshotVisible, setSnapshotVisible] = useState(false);
  const [outgoing, setOutgoing] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const abortRef = useRef<AbortController | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const releaseSnapshotTimerRef = useRef<number | null>(null);
  const toggleFullScreen = usePresentationFullScreen(
    (state) => state.toggleFullScreen
  );

  const clearTimers = useCallback(() => {
    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (releaseSnapshotTimerRef.current) {
      window.clearTimeout(releaseSnapshotTimerRef.current);
      releaseSnapshotTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    window.queueMicrotask(() => {
      if (!controller.signal.aborted) setFileBlob(null);
    });

    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });

        if (!res.ok) {
          return;
        }

        const ct = res.headers.get("content-type");
        if (ct?.includes("xml")) {
          return;
        }

        const blob = await res.blob();
        if (!controller.signal.aborted) {
          setFileBlob(blob);
          const restoredPage = usePresentationStore.getState().currentPage;
          setVisiblePage(restoredPage);
          setPreloadPage(null);
          setSnapshotUrl(null);
          setSnapshotVisible(false);
          setOutgoing(false);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    })();

    return () => {
      controller.abort();
      clearTimers();
    };
  }, [clearTimers, url]);

  useEffect(() => {
    if (currentPage === visiblePage) return;
    clearTimers();
    const timer = window.setTimeout(() => {
      setDirection(currentPage > visiblePage ? 1 : -1);
      setSnapshotUrl(null);
      setSnapshotVisible(false);
      setOutgoing(false);
      setPreloadPage(currentPage);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [clearTimers, currentPage, visiblePage]);

  const handlePreloadRender = useCallback(() => {
    if (preloadPage == null) return;
    const preloadCanvas = document.querySelector<HTMLCanvasElement>(
      `[data-pdf-preload-page="${preloadPage}"] canvas`
    );
    if (!preloadCanvas) return;

    try {
      setSnapshotUrl(preloadCanvas.toDataURL("image/png"));
      window.requestAnimationFrame(() => {
        setSnapshotVisible(true);
        setOutgoing(true);
      });

      transitionTimerRef.current = window.setTimeout(() => {
        setVisiblePage(preloadPage);
        setPreloadPage(null);
        setOutgoing(false);

        releaseSnapshotTimerRef.current = window.setTimeout(() => {
          setSnapshotVisible(false);
          setSnapshotUrl(null);
          releaseSnapshotTimerRef.current = null;
        }, 180);
        transitionTimerRef.current = null;
      }, 320);
    } catch {
      setVisiblePage(preloadPage);
      setPreloadPage(null);
      setSnapshotUrl(null);
      setSnapshotVisible(false);
      setOutgoing(false);
    }
  }, [preloadPage]);

  const pdfWidth = 1600;
  const pdfHeight = 900;
  const incomingOffset =
    direction === 1 ? "translate-x-[0.75%]" : "-translate-x-[0.75%]";

  return (
    <div
      className={cn("flex-center group relative flex-col bg-white")}
      style={{ width: pdfWidth, height: pdfHeight }}
    >
      {fileBlob ? (
        <Document
          key={url}
          file={fileBlob}
          onLoadSuccess={({ numPages }) => {
            setTotalPages(numPages);
          }}
          loading={<div className="text-xl font-semibold">Loading…</div>}
          error={
            <div className="text-xl font-semibold text-red-500">
              Failed to load PDF.
            </div>
          }
        >
          <div
            className="relative overflow-hidden bg-white"
            style={{ height: pdfHeight, width: pdfWidth }}
          >
            <Page
              key={`visible-${visiblePage}`}
              pageNumber={visiblePage}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              width={pdfWidth}
              loading={
                <div className="text-xl font-semibold">Loading Page…</div>
              }
              className={cn(
                "transition-opacity duration-300 ease-in-out",
                outgoing ? "opacity-95" : "opacity-100"
              )}
            />
            {preloadPage != null && (
              <div
                data-pdf-preload-page={preloadPage}
                className="pointer-events-none absolute inset-0 opacity-0"
                aria-hidden="true"
              >
                <Page
                  key={`preload-${preloadPage}`}
                  pageNumber={preloadPage}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  width={pdfWidth}
                  loading={null}
                  onRenderSuccess={handlePreloadRender}
                />
              </div>
            )}
            {snapshotUrl && (
              <img
                src={snapshotUrl}
                alt=""
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-0 h-full w-full object-contain transition-all duration-300 ease-in-out",
                  snapshotVisible
                    ? "translate-x-0 opacity-100"
                    : `opacity-0 ${incomingOffset}`
                )}
              />
            )}
          </div>
        </Document>
      ) : (
        <div className="text-xl font-semibold">Loading…</div>
      )}

      {totalPages > 1 && (
        <div className="absolute bottom-6 flex w-full items-center justify-center gap-6 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <Button
            size="icon-sm"
            disabled={currentPage === 1}
            className="cursor-pointer"
            onClick={() => {
              const next = currentPage - 1;
              setCurrentPage(next);
              publishPageChange(room, next);
            }}
          >
            <ArrowLeftIcon />
          </Button>

          <span className="bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground rounded-full px-6 py-2 text-xl font-semibold">
            {currentPage} / {totalPages}
          </span>

          <Button
            size="icon-sm"
            className="cursor-pointer"
            disabled={currentPage === totalPages}
            onClick={() => {
              const next = currentPage + 1;
              setCurrentPage(next);
              publishPageChange(room, next);
            }}
          >
            <ArrowRightIcon />
          </Button>

          {!hideFullscreen && (
            <Button
              size="icon-sm"
              className="absolute right-10 cursor-pointer"
              onClick={toggleFullScreen}
            >
              <MaximizeIcon />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
