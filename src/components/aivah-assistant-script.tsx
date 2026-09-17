"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    AivahAssistant?: {
      mount: (options?: { sessionUrl?: string, configUrl?: string }) => void;
    };
    __AIVAH_NAVIGATE?: (path: string) => void;
  }
}

const SESSION_URL = "/api/realtime/ai-assistant";
const CONFIG_URL = "/aivah-assistant/assistant.json";

export function AivahAssistantScript() {
  const router = useRouter();

  useEffect(() => {
    window.__AIVAH_NAVIGATE = (path: string) => {
      router.push(path);
    };
    return () => {
      delete window.__AIVAH_NAVIGATE;
    };
  }, [router]);

  return (
    <Script
      src="/aivah-assistant.js"
      // src="https://storage.googleapis.com/aivah-share/aivah-assistant.js"
      strategy="afterInteractive"
      data-session={SESSION_URL}
      data-config={CONFIG_URL}
      onLoad={() => {
        window.AivahAssistant?.mount({
          sessionUrl: SESSION_URL,
          configUrl: CONFIG_URL,
        });
      }}
    />
  );
}
