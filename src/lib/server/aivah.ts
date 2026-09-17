import "server-only";

export type AivahServerConfig =
  | { ok: true; baseUrl: string; apiKey: string }
  | { ok: false; message: string };

export function getAivahServerConfig(): AivahServerConfig {
  const baseUrl = process.env.AIVAH_API_BASE_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.AIVAH_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    return {
      ok: false,
      message:
        "This deployment is not configured. Set AIVAH_API_BASE_URL and AIVAH_API_KEY on the server.",
    };
  }
  try {
    const parsed = new URL(baseUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
  } catch {
    return { ok: false, message: "AIVAH_API_BASE_URL is invalid." };
  }
  return { ok: true, baseUrl, apiKey };
}
