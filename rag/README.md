# GSA RAG (Phase 2 reference)

**Not selected by the CLI yet.** Production path remains Phase 1 disk memory → system prompt.

```
Phase 1 (now)
  .grok/project_memory.md ──► system prompt ──► LLM

Phase 2 (this folder)
  memory + POW
       │
       ▼
  chunking.py → embed → agent_chunks (pgvector | LanceDB)
       │
       ▼
  query embed → top-k ──► system prompt
                 │
                 └── semantic_cache.py
```

| Module | Role |
|--------|------|
| `chunking.py` | Fixed + section chunking examples |
| `pgvector_setup.sql` | Table + `match_agent_chunks` |
| `pgvector_retrieve.py` | Embed + RPC retrieve |
| `semantic_cache.py` | Hash + cosine cache |
| `lancedb_example.py` | Local vector store |
| `LANCE_VS_PGVECTOR.md` | Store choice |
| `RLS.md` | `agent_chunks` access |

```bash
python rag/chunking.py          # demo chunk counts
# Phase 2 retrieve needs SUPABASE_* + embeddings API
```
