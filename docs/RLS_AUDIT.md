# Supabase RLS audit — GSA

**Audited against live project (MCP)** · tables with `relrowsecurity = true`.

## Summary

| Table | RLS | Public policies | Verdict |
|-------|-----|-----------------|---------|
| `stripe_webhook_events` | ON | **none** | ✅ service_role only (idempotency) |
| `agent_chunks` | ON | **none** | ✅ service_role only (RAG Phase 2) |
| `profiles` | ON | own-row authenticated | ✅ OK |
| `threads` | ON | member/creator | ✅ OK |
| `thread_members` | ON | self/creator | ✅ OK |
| `messages` | ON | member/sender | ⚠️ had tautology bug (fixed in migration) |
| `thread_summaries` | ON | member/creator | ⚠️ had tautology bug (fixed in migration) |

## GSA-critical tables

### `stripe_webhook_events`

**Purpose:** Idempotency keys for Stripe webhooks.

| Key | Column | Constraint |
|-----|--------|------------|
| Stripe `event.id` | `event_id` | **PRIMARY KEY** |
| Checkout `session.id` | `session_id` | **UNIQUE** (partial, where not null) |
| Issued license | `license_key` | indexed (lookup) |

**Access model:** RLS enabled, **zero** policies for `anon` / `authenticated`.  
Only `service_role` / secret key (bypasses RLS) may insert/update.

**Claim pattern:**

```sql
-- first delivery wins
insert into stripe_webhook_events (event_id, event_type)
values ($1, $2);
-- 23505 unique_violation → duplicate delivery, return 200
```

### `agent_chunks`

**Purpose:** Phase 2 RAG chunks (+ optional `embedding vector(384)`).

| Column | Notes |
|--------|--------|
| `source` | `memory` \| `pow` \| `other` |
| `worker_id` | optional worker id |
| `content` | chunk text |
| `embedding` | `vector(384)` cosine via IVFFlat |
| `metadata` | jsonb |

**Access model:** same as webhook events — no public policies.

**Retrieval:** `match_agent_chunks(query_embedding, match_count, filter_source, filter_worker_id)`  
`SECURITY DEFINER`, execute granted to `service_role` only.

## Bugs found (thread stack)

Several policies used:

```sql
EXISTS (
  SELECT 1 FROM thread_members m
  WHERE m.thread_id = m.thread_id   -- always true!
    AND m.user_id = auth.uid()
)
```

That grants access if the user is a member of **any** thread, not the row’s thread.

**Fix** (in `20260801120000_idempotency_and_rls_audit.sql`):

```sql
WHERE m.thread_id = messages.thread_id
  AND m.user_id = (SELECT auth.uid())
```

## Checklist after deploy

```sql
-- Expect: relrowsecurity true, zero policies for GSA tables
select c.relname, c.relrowsecurity,
  (select count(*) from pg_policies p where p.tablename = c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('stripe_webhook_events', 'agent_chunks');

-- Expect: no rows for anon
set role anon;
select * from stripe_webhook_events;  -- should error / empty
reset role;
```

## Related

- Migration: `supabase/migrations/20260801120000_idempotency_and_rls_audit.sql`
- Webhook: `supabase/functions/stripe-webhook/`
- RAG: `rag/LANCE_VS_PGVECTOR.md`, `rag/pgvector_retrieve.py`
