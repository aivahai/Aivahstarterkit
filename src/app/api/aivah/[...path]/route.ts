import { getAivahServerConfig } from "@/lib/server/aivah";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTES: Array<{ methods: string[]; pattern: RegExp }> = [
  { methods: ["GET"], pattern: /^voices(?:\/custom)?$/ },
  { methods: ["POST"], pattern: /^voices\/clone$/ },
  { methods: ["DELETE"], pattern: /^voices\/\d+$/ },
  { methods: ["GET", "POST"], pattern: /^characters$/ },
  { methods: ["PATCH", "DELETE"], pattern: /^characters\/\d+$/ },
  { methods: ["GET", "POST"], pattern: /^backgrounds$/ },
  { methods: ["PATCH", "DELETE"], pattern: /^backgrounds\/\d+$/ },
  { methods: ["GET", "POST"], pattern: /^agents$/ },
  { methods: ["GET", "PATCH", "DELETE"], pattern: /^agents\/\d+$/ },
  { methods: ["POST"], pattern: /^agents\/\d+\/retry$/ },
  { methods: ["POST", "DELETE"], pattern: /^agents\/\d+\/content$/ },
  { methods: ["GET"], pattern: /^llm-models(?:\/all)?$/ },
  { methods: ["GET"], pattern: /^scenes$/ },
  { methods: ["POST"], pattern: /^sessions\/token$/ },
  { methods: ["GET", "POST"], pattern: /^assistant\/sessions$/ },
  { methods: ["POST"], pattern: /^sessions\/resolve-character-change$/ },
  { methods: ["GET"], pattern: /^conversations\/\d+$/ },
  {
    methods: ["PATCH"],
    pattern: /^conversations\/\d+\/configuration$/,
  },
  { methods: ["GET"], pattern: /^productivity\/generated-contents$/ },
  {
    methods: ["DELETE"],
    pattern: /^productivity\/generated-contents\/\d+$/,
  },
  { methods: ["POST"], pattern: /^agents\/\d+\/slide$/ },
  { methods: ["POST"], pattern: /^agents\/\d+\/podcast$/ },
  { methods: ["POST"], pattern: /^agents\/\d+\/mindmap$/ },
];

function isAllowed(path: string, method: string) {
  return ROUTES.some(
    (route) => route.methods.includes(method) && route.pattern.test(path),
  );
}

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const path = (await context.params).path.join("/");
  if (!isAllowed(path, request.method)) {
    return NextResponse.json(
      { error: { code: "ROUTE_NOT_ALLOWED", message: "Route not allowed." } },
      { status: 404 },
    );
  }
  const config = getAivahServerConfig();
  if (!config.ok) {
    return NextResponse.json(
      { error: { code: "CONFIG_MISSING", message: config.message } },
      { status: 503 },
    );
  }

  const upstreamUrl = new URL(`${config.baseUrl}/${path}`);
  request.nextUrl.searchParams.forEach((value, key) =>
    upstreamUrl.searchParams.append(key, value),
  );
  const headers = new Headers({
    accept: request.headers.get("accept") || "application/json",
    AIVAH_API_KEY: config.apiKey,
  });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
      cache: "no-store",
      // Required by Node when streaming a request body.
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    const responseHeaders = new Headers();
    responseHeaders.set(
      "content-type",
      upstream.headers.get("content-type") || "application/json",
    );
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "The Aivah API is unavailable. Try again shortly.",
        },
      },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
