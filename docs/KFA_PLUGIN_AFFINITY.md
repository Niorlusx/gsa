# KFA-Swarm as GSA domain plugins

GSA is the spine. `Niorlusx/kfa-swarm` agents attach by **affinity** — they do not replace workers 1–8.

| Worker | Job | KFA plugin |
|--------|-----|------------|
| 1 | Lead Researcher | re-ops-bridge |
| 2 | Outbound Writer | growth-agent |
| 3 | Content Repurposer | content-playbook |
| 4 | Competitor Watcher | — |
| 5 | Proposal Builder | re-ops-bridge |
| 6 | Offer Architect | store-architect |
| 7 | SOP Writer | delivery-vault (docs) |
| 8 | Super Strategist | route only |

BLAST (`artistsmusic`) is a **separate desk**. Do not load BLAST workers into this CLI.

Full map: see kfa-swarm `agents/GSA_AFFINITY_MAP.md`.
Cron host: `agent-swarm-hub` `.github/workflows/gsa-daily.yml` only.
