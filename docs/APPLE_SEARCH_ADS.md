# Apple Search Ads (Apple Ads) API — exploration for GSA

**Status:** research + keyword-gap support in CLI (`gsa keywords`, worker 4).  
**Live OAuth connector:** not implemented yet (roadmap Phase 4).

## Official surface

| Resource | Notes |
|----------|--------|
| Docs hub | https://developer.apple.com/documentation/apple_ads |
| Campaign Management API **v5** | Current; keyword-level reports, suggestedBidAmount |
| Help: API access | https://ads.apple.com/app-store/help/campaigns/0022-use-the-campaign-management-api |
| OAuth | Client credentials flow; org-scoped |
| Base URL | `https://api.searchads.apple.com/api/v5/` |

> Apple has announced a new **Apple Ads Platform API** (expected ~Summer 2026). Plan for migration when it ships.

## Auth model

1. Apple Ads account → API access → create API client (key + secret / cert per docs).  
2. Exchange for **OAuth 2.0 Bearer** token.  
3. Send **`X-AP-Context: orgId=<ORG_ID>`** on every call.  
4. Roles matter (API Account Manager vs read-only).

## Objects useful for keyword strategy

```
Campaign
  └── Ad Group
        ├── Targeting keywords (EXACT | BROAD)
        ├── Negative keywords
        └── Search Match (auto discovery)
```

### Reports (keyword intelligence)

| Endpoint pattern | Use |
|------------------|-----|
| `POST .../reports/campaigns/{id}/keywords` | Keyword-level spend / taps / installs |
| Search term reports | Actual user queries vs bid keywords |
| Impression share / Insights | Competitive pressure (custom-reports flow has been unstable — see forums) |

Typical metrics: impressions, taps, TTR, installs, CPT, CPA, `suggestedBidAmount`.

## Match types (planning)

| Type | Behavior |
|------|----------|
| **EXACT** | Tight control — brand defense, high intent |
| **BROAD** | Expansion — test conquest terms carefully |
| **Search Match** | Apple matches app metadata — discovery, monitor search terms |

## How GSA uses this today

1. **Local gap analysis** (no API key):

```bash
gsa keywords --yours "ai agent cli,sop writer,gsa license" \
  --theirs "lindy ai,crewai,relevance ai agent" \
  --yours-label GSA --theirs-label Competitors
```

Produces: `only_yours` | `only_theirs` | `shared` + ASA campaign sketch.

2. **Narrative** (needs `GROK_API_KEY` + license):

```bash
gsa keywords --llm --yours "..." --theirs "..."
# → Competitor Watcher (worker 4)
```

3. **Future connector** (config sketch):

```json
"connectors": {
  "apple_search_ads": {
    "enabled": false,
    "api_base": "https://api.searchads.apple.com/api/v5",
    "org_id_env": "ASA_ORG_ID",
    "client_id_env": "ASA_CLIENT_ID",
    "client_secret_env": "ASA_CLIENT_SECRET"
  }
}
```

## Competitor keyword gap → ASA playbook

| Gap bucket | ASA action |
|------------|------------|
| **only_yours** | Brand EXACT ad group; protect CPT |
| **only_theirs** | Conquest tests: small budget BROAD → promote winners to EXACT |
| **shared** | Bid + creative differentiation; watch CPT inflation |

## Caveats (2025–2026)

- Custom Reports GET has seen **403** issues while POST still works (community reports) — prefer standard keyword report POSTs.  
- Country dimension can empty keyword reports if mis-filtered.  
- CPT/CPA benchmarks rose industry-wide; treat third-party “average CPT” as directional only.  
- Never commit API client secrets; use env vars only.

## Related

- `gsa keywords` / `gsa gaps` — local set analysis  
- Worker **4 Competitor Watcher** — LLM strategy layer  
- `docs/LOADING.md` — context injection when using `--llm`
