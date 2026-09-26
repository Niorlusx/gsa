# Meberunning music-hub (Cloudflare Worker)

Edge gateway for Ash Garner / Meberunning Records.

**Does:** health check, YouTube WebSub handshake, signed webhook accept, auth-gated catalog sync stub.

**Does not:** buy streams, fake plays, run Grok as a master agent, post to social, or store secrets in git.

## Deploy (your machine — Cloudflare is not connected to Grok)

```bash
cd cloudflare/music-hub
npm install
npx wrangler login
npx wrangler secret put SYNC_TOKEN
# optional:
npx wrangler secret put YOUTUBE_HUB_SECRET
npx wrangler secret put SOUNDCLOUD_WEBHOOK_SECRET
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
npx wrangler deploy
```

## Routes

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/health` | public |
| GET | `/webhooks/youtube` | WebSub `hub.challenge` |
| POST | `/webhooks/youtube` | `X-Hub-Signature-256` if secret set |
| POST | `/webhooks/soundcloud` | HMAC if secret set |
| POST | `/webhooks/sync-catalog` | `Authorization: Bearer $SYNC_TOKEN` |

Artist name in responses is **Ash Garner** only.
