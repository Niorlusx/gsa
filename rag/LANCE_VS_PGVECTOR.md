# LanceDB vs pgvector — GSA Phase 2

## Decision

| Use case | Prefer |
|----------|--------|
| Single laptop / low volume / offline | **LanceDB** (or stay Phase 1 disk memory) |
| Shared / server / Edge / multi-device | **Supabase pgvector** |
| Production GSA license SaaS | **pgvector** (same DB as webhooks) |

## Comparison

| Dimension | LanceDB | pgvector (Supabase) |
|-----------|---------|---------------------|
| Where it runs | Local files under `.grok/lancedb/` | Postgres (managed) |
| Ops | Zero cloud | Backups, RLS, migrations |
| Auth / multi-tenant | DIY | RLS + service_role RPC |
| Embed dims | Any (we use **384**) | Column type must match (**384**) |
| Index | Lance ANN | IVFFlat / HNSW (extension) |
| Cold start | Fast local | Network + pooler |
| Fits GSA webhook stack | Separate | Same project as `stripe_webhook_events` |
| CLI coupling today | Not wired | Not wired (`rag_phase: 1`) |

## GSA recommendation

1. **Ship / default:** Phase 1 — `project_memory.md` → system prompt (no vectors).  
2. **Solo agent laptop:** LanceDB sketch in `rag/lancedb_example.py`.  
3. **Hosted memory / team:** `agent_chunks` + `match_agent_chunks` on Supabase.

## Knobs (both stores)

| Knob | Typical |
|------|---------|
| Embedding dims | **384** (MiniLM-class) |
| Top-k | 4–8 |
| Max context chars | 2000–3000 |
| Chunk strategy | `sections` 1600 / overlap 150 |
| IVFFlat lists | ~rows/1000 |
| Semantic cache cosine | 0.92 |

## Config sketch (future CLI)

```json
"rag": {
  "phase": 2,
  "store": "pgvector",
  "embedding_dims": 384,
  "top_k": 6,
  "max_context_chars": 3000,
  "chunk": { "strategy": "sections", "max_chars": 1600, "overlap": 150 },
  "cache": { "enabled": true, "cosine_threshold": 0.92 }
}
```

## Files

| File | Role |
|------|------|
| `chunking.py` | fixed + section chunking examples |
| `pgvector_setup.sql` | schema + RPC reference |
| `pgvector_retrieve.py` | embed + match RPC client |
| `semantic_cache.py` | exact + cosine cache |
| `lancedb_example.py` | local store sketch |
| `RLS.md` | access model for `agent_chunks` |
