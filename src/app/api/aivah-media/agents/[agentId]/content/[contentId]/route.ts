import { getAivahServerConfig } from "@/lib/server/aivah";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContentRecord = {
  id?: number;
  chat_bot_content_id?: number;
  chatBotContentId?: number;
  storageUrl?: string;
  file_path?: string;
};

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ agentId: string; contentId: string }>;
  },
) {
  const config = getAivahServerConfig();
  if (!config.ok) {
    return NextResponse.json(
      { error: { code: "CONFIG_MISSING", message: config.message } },
      { status: 503 },
    );
  }
  const { agentId, contentId } = await params;
  if (!/^\d+$/.test(agentId) || !/^\d+$/.test(contentId)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const agentResponse = await fetch(`${config.baseUrl}/agents/${agentId}`, {
      headers: {
        accept: "application/json",
        AIVAH_API_KEY: config.apiKey,
      },
      cache: "no-store",
    });
    if (!agentResponse.ok) {
      return new NextResponse("Not found", { status: agentResponse.status });
    }
    const payload = await agentResponse.json();
    const agent = payload?.results ?? payload;
    const content = [
      ...(Array.isArray(agent?.content) ? agent.content : []),
      ...(Array.isArray(agent?.contents) ? agent.contents : []),
      ...(Array.isArray(agent?.chatBotContents) ? agent.chatBotContents : []),
    ].find(
      (entry: ContentRecord) =>
        String(
          entry.chatBotContentId ?? entry.chat_bot_content_id ?? entry.id ?? "",
        ) === contentId,
    ) as ContentRecord | undefined;
    const storageUrl = content?.storageUrl || content?.file_path;
    if (!storageUrl) return new NextResponse("Not found", { status: 404 });

    const parsed = new URL(storageUrl);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "storage.googleapis.com"
    ) {
      return new NextResponse("Unsupported media location", { status: 400 });
    }
    const headers = new Headers({
      accept: request.headers.get("accept") || "*/*",
    });
    const range = request.headers.get("range");
    if (range) headers.set("range", range);
    const mediaResponse = await fetch(parsed, {
      headers,
      cache: "no-store",
    });
    const responseHeaders = new Headers();
    for (const name of [
      "accept-ranges",
      "content-length",
      "content-range",
      "content-type",
      "etag",
      "last-modified",
    ]) {
      const value = mediaResponse.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set("cache-control", "private, no-store");
    return new NextResponse(mediaResponse.body, {
      status: mediaResponse.status,
      headers: responseHeaders,
    });
  } catch {
    return new NextResponse("Media unavailable", { status: 502 });
  }
}
