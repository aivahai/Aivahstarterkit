"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  Minus,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { MindmapDocument, MindmapNode } from "@/lib/api-types";

type PositionedNode = {
  node: MindmapNode;
  depth: number;
  x: number;
  y: number;
  parentId?: string;
  hasChildren: boolean;
  collapsed: boolean;
};

const NODE_WIDTH = 210;
const NODE_HEIGHT = 78;
const X_GAP = 250;
const Y_GAP = 118;

function cloneCollapsed(value: Set<string>) {
  return new Set(Array.from(value));
}

function wrapNodeTitle(title: string, maxChars = 22) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    // Long single words are rare for generated mind-map titles, but chunk
    // them instead of falling back to ellipses.
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let i = 0; i < word.length; i += maxChars) {
        lines.push(word.slice(i, i + maxChars));
      }
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [title];
}

function layoutMindmap(
  root: MindmapNode,
  collapsed: Set<string>
): {
  nodes: PositionedNode[];
  links: Array<{ from: PositionedNode; to: PositionedNode }>;
  width: number;
  height: number;
} {
  const nodes: PositionedNode[] = [];
  let leafIndex = 0;

  const walk = (
    node: MindmapNode,
    depth: number,
    parentId?: string
  ): PositionedNode => {
    const children = node.children ?? [];
    const isCollapsed = collapsed.has(node.id);
    const visibleChildren = isCollapsed ? [] : children;
    const childPositions = visibleChildren.map((child) =>
      walk(child, depth + 1, node.id)
    );

    const y =
      childPositions.length > 0
        ? (childPositions[0].y + childPositions[childPositions.length - 1].y) /
          2
        : leafIndex++ * Y_GAP;

    const positioned: PositionedNode = {
      node,
      depth,
      x: depth * X_GAP,
      y,
      parentId,
      hasChildren: children.length > 0,
      collapsed: isCollapsed,
    };
    nodes.push(positioned);
    return positioned;
  };

  walk(root, 0);

  const byId = new Map(nodes.map((n) => [n.node.id, n]));
  const links = nodes
    .filter((node) => node.parentId && byId.has(node.parentId))
    .map((node) => ({ from: byId.get(node.parentId!)!, to: node }));

  const maxX = Math.max(...nodes.map((n) => n.x), 0);
  const maxY = Math.max(...nodes.map((n) => n.y), 0);
  return {
    nodes,
    links,
    width: maxX + NODE_WIDTH + 180,
    height: maxY + NODE_HEIGHT + 160,
  };
}

export function MindmapViewer({
  document,
  onNodeQuestion,
  className,
}: {
  document: MindmapDocument;
  onNodeQuestion?: (
    question: string,
    node: MindmapNode
  ) => void | Promise<void>;
  className?: string;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 80, y: 80 });
  const [dragStart, setDragStart] = useState<{
    pointerId: number;
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const layout = useMemo(
    () => layoutMindmap(document.root, collapsed),
    [document.root, collapsed]
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.08 : 0.08;
      setScale((value) => Math.min(2.4, Math.max(0.45, value + delta)));
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, []);

  const toggleNode = (node: MindmapNode) => {
    setCollapsed((prev) => {
      const next = cloneCollapsed(prev);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else if ((node.children ?? []).length > 0) {
        next.add(node.id);
      }
      return next;
    });
  };

  const handleNodeClick = (node: MindmapNode) => {
    if (onNodeQuestion && node.question) {
      void onNodeQuestion(node.question, node);
    }
  };

  const expandAll = () => setCollapsed(new Set());

  const collapseAll = () => {
    const next = new Set<string>();
    const collect = (node: MindmapNode) => {
      if ((node.children ?? []).length > 0) {
        next.add(node.id);
      }
      (node.children ?? []).forEach(collect);
    };
    collect(document.root);
    setCollapsed(next);
  };

  const resetView = () => {
    setScale(1);
    setPan({ x: 80, y: 80 });
  };

  const downloadSvg = () => {
    const svg = svgRef.current;
    if (!svg) return;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(layout.width));
    clone.setAttribute("height", String(layout.height));
    clone.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
    const graph = clone.querySelector("[data-mindmap-graph]");
    if (graph) {
      graph.setAttribute("transform", "translate(80 80) scale(1)");
    }

    const source = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement("a");
    link.href = url;
    link.download = `${document.title || "mind-map"}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="border-border bg-background/80 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">
            Use arrows to expand or collapse.{" "}
            {onNodeQuestion ? "Click a node to ask the agent." : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={expandAll}>
            Expand all
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={collapseAll}
          >
            Collapse all
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Zoom out"
            onClick={() => setScale((v) => Math.max(0.45, v - 0.12))}
          >
            <Minus className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Zoom in"
            onClick={() => setScale((v) => Math.min(2.4, v + 0.12))}
          >
            <Plus className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Reset view"
            onClick={resetView}
          >
            <Maximize2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={downloadSvg}
          >
            <Download className="mr-1.5 size-4" />
            Download
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-slate-100 dark:bg-slate-900">
        <svg
          ref={svgRef}
          role="img"
          aria-label={document.title}
          className="h-full w-full cursor-grab touch-none bg-slate-100 active:cursor-grabbing dark:bg-slate-900"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            (event.currentTarget as SVGSVGElement).setPointerCapture(
              event.pointerId
            );
            setDragStart({
              pointerId: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              panX: pan.x,
              panY: pan.y,
            });
          }}
          onPointerMove={(event) => {
            if (!dragStart || dragStart.pointerId !== event.pointerId) return;
            setPan({
              x: dragStart.panX + event.clientX - dragStart.x,
              y: dragStart.panY + event.clientY - dragStart.y,
            });
          }}
          onPointerUp={() => setDragStart(null)}
          onPointerCancel={() => setDragStart(null)}
        >
          <rect
            width="100%"
            height="100%"
            className="fill-slate-100 dark:fill-slate-900"
          />
          <g
            data-mindmap-graph
            transform={`translate(${pan.x} ${pan.y}) scale(${scale})`}
          >
            {layout.links.map((link) => {
              const startX = link.from.x + NODE_WIDTH;
              const startY = link.from.y + NODE_HEIGHT / 2;
              const endX = link.to.x;
              const endY = link.to.y + NODE_HEIGHT / 2;
              const mid = (endX - startX) * 0.55;
              return (
                <path
                  key={`${link.from.node.id}-${link.to.node.id}`}
                  d={`M ${startX} ${startY} C ${startX + mid} ${startY}, ${endX - mid} ${endY}, ${endX} ${endY}`}
                  fill="none"
                  stroke="#6366f1"
                  strokeOpacity="0.55"
                  strokeWidth="2"
                />
              );
            })}

            {layout.nodes.map((positioned) => {
              const titleLines = wrapNodeTitle(positioned.node.title);
              const hasBranchLabel =
                (positioned.node.children ?? []).length > 0;
              const titleLineHeight = 14;
              const contentHeight =
                titleLines.length * titleLineHeight + (hasBranchLabel ? 16 : 0);
              const titleStartY =
                (NODE_HEIGHT - contentHeight) / 2 + titleLineHeight - 2;
              const branchLabelY =
                titleStartY + titleLines.length * titleLineHeight + 7;

              return (
                <g
                  key={positioned.node.id}
                  transform={`translate(${positioned.x} ${positioned.y})`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={
                    onNodeQuestion
                      ? () => handleNodeClick(positioned.node)
                      : undefined
                  }
                  className={onNodeQuestion ? "cursor-pointer" : undefined}
                >
                  <rect
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx="14"
                    fill={positioned.depth === 0 ? "#312e81" : "#1f2937"}
                    stroke={positioned.depth === 0 ? "#a5b4fc" : "#4b5563"}
                    strokeWidth="1.5"
                  />
                  <text
                    x={NODE_WIDTH / 2}
                    y={titleStartY}
                    fill="#f9fafb"
                    fontSize="13"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {titleLines.map((line, index) => (
                      <tspan
                        key={`${positioned.node.id}-title-${index}`}
                        x={NODE_WIDTH / 2}
                        dy={index === 0 ? 0 : titleLineHeight}
                      >
                        {line}
                      </tspan>
                    ))}
                  </text>
                  {hasBranchLabel && (
                    <text
                      x={NODE_WIDTH / 2}
                      y={branchLabelY}
                      fill="#cbd5e1"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      {positioned.collapsed
                        ? `${positioned.node.children?.length ?? 0} hidden branches`
                        : `${positioned.node.children?.length ?? 0} branches`}
                    </text>
                  )}
                  {positioned.hasChildren && (
                    <foreignObject
                      x={NODE_WIDTH - 34}
                      y={(NODE_HEIGHT - 24) / 2}
                      width="24"
                      height="24"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleNode(positioned.node);
                      }}
                    >
                      <div className="flex size-6 items-center justify-center rounded-full bg-white/10 text-white">
                        {positioned.collapsed ? (
                          <ChevronRight className="size-4" />
                        ) : (
                          <ChevronLeft className="size-4" />
                        )}
                      </div>
                    </foreignObject>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
