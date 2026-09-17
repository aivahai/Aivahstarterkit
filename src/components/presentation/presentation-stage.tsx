"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { MonitorIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CourseWidget } from "@/store/course-outline";

import WidgetRenderer from "./widget-renderer";

const STAGE_WIDTH = 1600;
const STAGE_HEIGHT = 900;

export function PresentationStage({
  widget,
  className,
}: {
  widget?: CourseWidget | null;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const recalc = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { clientWidth, clientHeight } = el;
    if (!clientWidth || !clientHeight) return;
    setScale(Math.min(clientWidth / STAGE_WIDTH, clientHeight / STAGE_HEIGHT));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    recalc();
    const observer = new ResizeObserver(recalc);
    observer.observe(el);
    return () => observer.disconnect();
  }, [recalc]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex size-full items-center justify-center",
        className,
      )}
    >
      {widget?.url ? (
        <div
          style={{ width: STAGE_WIDTH * scale, height: STAGE_HEIGHT * scale }}
          className="relative overflow-hidden"
        >
          <div
            style={{
              width: STAGE_WIDTH,
              height: STAGE_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <WidgetRenderer url={widget.url} type={widget.type} hideFullscreen />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-white/50">
          <MonitorIcon className="size-12 opacity-40" />
          <p className="text-sm">Waiting for presentation…</p>
        </div>
      )}
    </div>
  );
}

export default PresentationStage;
