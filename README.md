# GSA — Grok Super Agent CLI

> Eight role-locked workers in one Python CLI. One job each. Proof out, fluff out.

_TODO: add a terminal GIF of `gsa run` picking a worker and printing a result_

## What it is

GSA is a small command-line agent runner for sales and ops work. You pick one of eight workers (lead research, outbound, content, competitor gaps, proposals, offers, SOPs, strategy), give a task, and get a short actionable result — not a general chatbot monologue.

The weird bit: the LLM client is pure stdlib `urllib`. No OpenAI package required. Config lives in `gsa.config.json`; keys live in env only.

**Python 3.11+** (3.12 in CI). Entry point: the `gsa` script at repo root.

## Install & run

```bash
git clone https://github.com/Niorlusx/gsa.git
cd gsa
cp .env.example .env
# fill GROK_API_KEY (or XAI_API_KEY) and GROK_LICENSE offline — never commit .env

# optional if you want edge/webhook tooling later
# pip install -r requirements.txt

export GROK_API_KEY=          # from https://console.x.ai/
export GROK_LICENSE=GSA-DEMO-2026-LIVE

python3 gsa doctor
python3 gsa smoke
python3 gsa run
```

Env names only (see [`.env.example`](.env.example)): `GROK_API_KEY`, `XAI_API_KEY`, `GROK_LICENSE`, optional `GROQ_API_KEY` / `OPENAI_API_KEY` / etc. when you switch provider.

Demo licenses accepted by the CLI: `GSA-DEMO-2026-LIVE`, `GSA-FULL-ACCESS-2026`.

## Usage

Shortest path to value — one worker, one task:

```bash
python3 gsa worker 2 "Cold email to a Melbourne agency that needs AI outbound"
```

Workers (1–8):

1. Lead Researcher · 2. Outbound Writer · 3. Content Repurposer · 4. Competitor Watcher  
5. Proposal Builder · 6. Offer Architect · 7. SOP Writer · 8. Super Strategist

Everyday commands:

```bash
python3 gsa run                    # menu of all 8
python3 gsa supervisor             # keep workers restarting
python3 gsa keywords --yours "a,b" --theirs "c,d"   # local keyword gaps (no API)
python3 gsa keywords --llm --yours "…" --theirs "…" # gaps + Competitor Watcher write-up
python3 gsa version && python3 gsa help
```

Switch LLM without a new repo — in `gsa.config.json`:

```json
"connectors": {
  "llm": { "provider": "groq" }
}
```

```bash
export GROQ_API_KEY=
python3 gsa run
```

Presets: `xai` (default) · `groq` · `together` · `openrouter` · `deepseek` · `mistral` · `openai`. Details: [`docs/LLM_CONNECTOR.md`](docs/LLM_CONNECTOR.md).

Loading flags (optional): `--loading system|prepend_user|off` · `--no-memory` · [`docs/LOADING.md`](docs/LOADING.md).

## What's new

**v1.5.1** — stdlib LLM connector, loading options, local keyword-gap tool, ASA research notes. (No `CHANGELOG.md` in-repo yet; version is `VERSION` in `gsa`.)

## Why I built this

I got tired of “agent platforms” that are twelve workers with one soft job. GSA locks the role in the CLI, keeps the dependency surface tiny, and puts secrets in env — not in git.

## License

MIT — see [`LICENSE`](./LICENSE).

## See also

- [`AGENTS.md`](./AGENTS.md) — worker jobs at a glance
- [`LAUNCH.md`](./LAUNCH.md) · [`WEBHOOKS.md`](./WEBHOOKS.md) — ship + Stripe path
- [`docs/KFA_PLUGIN_AFFINITY.md`](docs/KFA_PLUGIN_AFFINITY.md) — how kfa-swarm plugs in as domain plugins (not a second runtime)
- Daily smoke: `.github/workflows/gsa-daily.yml` (also mirrored from `agent-swarm-hub`)
