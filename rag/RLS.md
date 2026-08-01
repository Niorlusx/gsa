# RLS — `agent_chunks`

| Setting | Value |
|---------|--------|
| RLS | **ON** |
| Policies for `anon` / `authenticated` | **none** |
| Writers / readers | `service_role` / secret key only |
| Match RPC | `match_agent_chunks` — `SECURITY DEFINER`, execute → `service_role` |

Never expose `agent_chunks` with a publishable/anon key without policies.  
Embeddings and POW logs may contain customer-sensitive content.

See also: `docs/RLS_AUDIT.md`.
