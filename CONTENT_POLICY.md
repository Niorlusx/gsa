# GSA Content & Open-Source Policy

## License

- **Code:** MIT — see `LICENSE`
- **Product license keys:** commercial (`GROK_LICENSE`) for paid Precision Workers path
- **Repos:** https://github.com/Niorlusx/gsa · hub https://github.com/Niorlusx/agent-swarm-hub

## Content rules for agents

1. **Role lock** — each worker stays on its single job (skills enforce MUST / MUST NOT).
2. **Proof-of-work** — outputs must be concrete and usable, not vague advice.
3. **No secrets in content** — never echo API keys, tokens, card data, or private customer PII into logs/PoW beyond what the brief requires.
4. **No fabricated citations** — if sources are unknown, say so.
5. **Open-source friendly** — prefer reproducible steps; stdlib-first; document env vars in `.env.example` only as placeholders.

## Machine learning / A/B

| Track | Provider | Typical model | When |
|-------|----------|---------------|------|
| A | xai | grok-4.5 | Product default, strategy |
| B | deepseek | deepseek-chat | Cost / OSS path |
| C | mistral | mistral-small-latest | Routine / token save |
| D | gemini | gemini-2.5-flash | Google Workspace / Spark collaboration |

Selection: `GSA_PROVIDER` + `GSA_MODEL` (see `scripts/gsa-full.sh ab-a|ab-b|ab-c|ab-d`).

## MCP feeds

- Supabase MCP is for **docs/ops**, not secret storage.
- Never put `STRIPE_*`, `NOTION_TOKEN`, or API keys in MCP client JSON.

## Programs covered

- CLI workers + skills pack
- Stripe → Supabase webhook license delivery
- Web hub control panel
- CI smoke pipeline
- Optional Cloudflare worker cutover
- Gemini / Workspace add-on collaboration path

## Prohibited in project content

- Real payment card data in repo or chat commits
- Hardcoded production secrets
- Instructions for illegal activity or malware
