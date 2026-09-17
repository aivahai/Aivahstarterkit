import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/realtime/ai-assistant": ["./public/aivah-assistant/**/*"],
    "/api/aivah-assistant/config": ["./public/aivah-assistant/**/*"],
  },
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
  allowedDevOrigins: ["http://localhost:3001", "zechariah-sticket-unyouthfully.ngrok-free.dev"],
};

export default nextConfig;
