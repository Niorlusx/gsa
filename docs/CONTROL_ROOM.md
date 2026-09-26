# Meberunning Control Room

Single map for label ops. This is not a live dashboard API.

## Live this session

| Lane | Status |
|------|--------|
| Catalog HQ | `Niorlusx/artistsmusic` (private) |
| Landing | Vercel `ash-garner-meberunning` production READY |
| Worker code | `gsa/cloudflare/music-hub` + `sim/` |
| Drive Officials | 7 full `-v2-noface` MVs |
| Queue | Harder End, Pulse — radio only |

## Connections

| Service | Grok connector | Notes |
|---------|----------------|-------|
| GitHub | yes | Niorlusx |
| Vercel | yes | team ashley-garners-projects |
| Google Drive | yes | folder Meberunning Records |
| Notion | yes | BLAST / Bot Fleet pages |
| Supabase MCP | wired in `gsa/.mcp.json` (`knqcjedftfgmnhdgjnoo`) | list_tables = permission denied from this chat |
| Gemini | **no Grok connector** | `Music.worker/GEMINI.md` is local CLI/API only |
| Cloudflare | **no connector** | wrangler login on your machine |

## Do not

- Upgrade every repo on the account in one push
- Put live keys in git
- Auto-post or fake streams

## Next wiring (you run)

1. Re-auth Supabase MCP if advisors/tables stay 32600
2. `npx wrangler login` then deploy `cloudflare/music-hub`
3. Keep Gemini keys in GitHub Secrets for `Music.worker` Actions only
