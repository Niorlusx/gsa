/**
 * Meberunning music-hub — edge gateway only.
 * No engagement bots. No stream-push. No Grok SDK.
 */

export interface Env {
  ARTIST: string;
  LABEL: string;
  HUB_VERSION: string;
  SYNC_TOKEN?: string;
  YOUTUBE_HUB_SECRET?: string;
  SOUNDCLOUD_WEBHOOK_SECRET?: string;
  SUPABASE_URL?: string;
  SUPABASE_KEY?: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "GET" && (path === "/" || path === "/health")) {
      return json({
        ok: true,
        label: env.LABEL,
        artist: env.ARTIST,
        version: env.HUB_VERSION,
        routes: [
          "GET /health",
          "GET|POST /webhooks/youtube",
          "POST /webhooks/soundcloud",
          "POST /webhooks/sync-catalog",
        ],
      });
    }

    if (path === "/webhooks/youtube") {
      if (request.method === "GET") {
        const mode = url.searchParams.get("hub.mode");
        const challenge = url.searchParams.get("hub.challenge");
        if (mode === "subscribe" && challenge) {
          return new Response(challenge, { status: 200 });
        }
        return json({ error: "missing hub.challenge" }, 400);
      }
      if (request.method === "POST") {
        const body = await request.text();
        const header = request.headers.get("x-hub-signature-256") ?? "";
        if (env.YOUTUBE_HUB_SECRET) {
          const expected = `sha256=${await hmacHex(env.YOUTUBE_HUB_SECRET, body)}`;
          if (!timingSafeEqual(expected, header)) {
            return json({ error: "bad signature" }, 401);
          }
        }
        return json({ accepted: true, source: "youtube", bytes: body.length });
      }
    }

    if (path === "/webhooks/soundcloud" && request.method === "POST") {
      const body = await request.text();
      const header = request.headers.get("x-soundcloud-signature") ?? request.headers.get("x-signature") ?? "";
      if (env.SOUNDCLOUD_WEBHOOK_SECRET) {
        const expected = await hmacHex(env.SOUNDCLOUD_WEBHOOK_SECRET, body);
        if (header && !timingSafeEqual(expected, header.replace(/^sha256=/, ""))) {
          return json({ error: "bad signature" }, 401);
        }
      }
      return json({ accepted: true, source: "soundcloud", bytes: body.length });
    }

    if (path === "/webhooks/sync-catalog" && request.method === "POST") {
      const auth = request.headers.get("authorization") ?? "";
      const token = env.SYNC_TOKEN;
      if (!token || auth !== `Bearer ${token}`) {
        return json({ error: "unauthorized" }, 401);
      }
      let payload: unknown = null;
      try {
        payload = await request.json();
      } catch {
        return json({ error: "invalid json" }, 400);
      }
      return json({
        accepted: true,
        source: "sync-catalog",
        note: "Row write happens after wrangler secret put SUPABASE_URL / SUPABASE_KEY",
        received: payload !== null,
      });
    }

    return json({ error: "not found" }, 404);
  },
};
