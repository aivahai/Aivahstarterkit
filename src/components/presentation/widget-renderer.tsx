"use client";

import dynamic from "next/dynamic";

import type { CourseWidget } from "@/store/course-outline";

import UniversalIframe from "./universal-iframe";
import VideoSource from "./video-source";

const PdfViewer = dynamic(() => import("./pdf-viewer"), { ssr: false });

export default function WidgetRenderer({
  url,
  type,
  hideFullscreen,
}: {
  url?: string;
  type?: CourseWidget["type"] | string;
  hideFullscreen?: boolean;
}) {
  if (!url) return null;

  if (type === "multimedia" || type === "video") {
    return <VideoSource url={url} />;
  }

  if (type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={1600}
        height={900}
        className="block h-full w-full object-contain"
      />
    );
  }

  if (type === "attachment") {
    return <PdfViewer url={url} hideFullscreen={hideFullscreen} />;
  }

  return <UniversalIframe url={url} />;
}
