# Competitor keyword gaps

## Offline analysis (no API keys)

```bash
python gsa keywords \
  --yours "ai agent,gsa cli,sop writer,precision workers" \
  --theirs "lindy,crewai,relevance ai,gumloop agent" \
  --yours-label GSA \
  --theirs-label Category
```

Output JSON:

| Block | Meaning |
|-------|---------|
| `only_yours` | Keywords you bid/seed that they lack — defend |
| `only_theirs` | Competitor terms you miss — conquest tests |
| `shared` | Overlap — bid wars / creative |
| `asa_campaign_sketch` | Suggested brand / conquest / category lists |

Each row: `intent`, `words`, `asa_hint`.

## With Competitor Watcher

```bash
export GROK_LICENSE=GSA-DEMO-2026-LIVE
export GROK_API_KEY=xai-...
python gsa keywords --llm --yours "..." --theirs "..." --loading system
```

## Files

| Path | Role |
|------|------|
| `gsa` → `analyze_keyword_gaps` | Core set logic |
| `docs/APPLE_SEARCH_ADS.md` | Live API exploration |
| Worker 4 system prompt | Gap-aware instructions |
