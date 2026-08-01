# GSA — Grok Super Agent CLI

**Precision Workers Edition** — single-job agents, hard role constraints, proof-of-work output.

**v1.5.1** — stdlib LLM connector · loading options · keyword gaps · ASA research.

```bash
export GROK_API_KEY=xai-...
export GROK_LICENSE=GSA-DEMO-2026-LIVE
python3 gsa smoke && python3 gsa run
```

## Commands

| Command | Description |
|---------|-------------|
| `gsa run` | Interactive menu (8 workers) |
| `gsa worker <id>` | Single worker (1–8) |
| `gsa supervisor` | Always-on + auto-restart |
| `gsa status` / `gsa smoke` / `gsa doctor` | Health checks |
| `gsa config` / `gsa roadmap` / `gsa schema` | Config & schema (JSON map) |
| `gsa keywords --yours … --theirs …` | Competitor keyword gaps (local JSON) |
| `gsa keywords --llm …` | Gaps + Competitor Watcher narrative |
| `gsa loading` / `gsa asa` | Loading resolution / Apple Search Ads notes |
| `gsa license` / `gsa version` / `gsa help` | Meta |

Loading flags: `--loading system|prepend_user|off` · `--no-memory` · see **[docs/LOADING.md](docs/LOADING.md)**.

## Workers

1. Lead Researcher · 2. Outbound Writer · 3. Content Repurposer · 4. Competitor Watcher  
5. Proposal Builder · 6. Offer Architect · 7. SOP Writer · 8. Super Strategist  

## LLM connector

Configure under `connectors.llm` in `gsa.config.json`. Switch provider with a preset:

```json
"llm": { "provider": "groq" }
```

```bash
export GROQ_API_KEY=...
python3 gsa run
```

Presets: `xai` · `openrouter` · `groq` · `together` · `deepseek` · `mistral` · `openai`  
Legacy `connectors.xai` still works. Full docs: **[docs/LLM_CONNECTOR.md](docs/LLM_CONNECTOR.md)**.

## Stack

- **CLI** `gsa` + `gsa.config.json` (multi-env, no secrets in file)  
- **LLM** stdlib `urllib` OpenAI-compatible client  
- **Stripe** A$97 lifetime · webhook → license  
- **Supabase** `stripe-webhook` Edge Function  
- **Notion** Playbook AI Sales  
- **Resend** license email  
- **RAG** Phase 1 memory injection · Phase 2 reference under [`rag/`](rag/) (chunking, pgvector, LanceDB)  
- **Idempotency** Stripe `event.id` PK + `session_id` unique · see `docs/STRIPE_WEBHOOKS.md`  
- **RLS audit** `docs/RLS_AUDIT.md`  
- **CI** `.github/workflows/gsa-ci.yml`  

## Launch

See **[LAUNCH.md](LAUNCH.md)** and **[WEBHOOKS.md](WEBHOOKS.md)**.  
Env template: **[.env.example](.env.example)**  
Grok API: **[docs/GROK_API.md](docs/GROK_API.md)**

## License keys

- `GSA-DEMO-2026-LIVE` — demo  
- `GSA-FULL-ACCESS-2026` — full  
- Purchase (test): https://buy.stripe.com/test_7sY4gB69VdlO6R62Db3gk01  

Secrets: environment variables only — never commit keys.
