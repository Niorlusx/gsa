-- GSA Phase 2 — pgvector schema (reference + migrations)
-- Prefer applying via supabase/migrations; this file is the readable copy.

create extension if not exists vector with schema extensions;

create table if not exists public.agent_chunks (
  id uuid primary key default gen_random_uuid(),
  source text not null,              -- memory | pow | other
  worker_id text,
  content text not null,
  embedding extensions.vector(384),  -- e.g. MiniLM all-MiniLM-L6-v2
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_chunks_source_idx on public.agent_chunks (source);

-- After bulk load (~1000+ rows), create IVFFlat:
-- create index agent_chunks_embedding_ivfflat
--   on public.agent_chunks
--   using ivfflat (embedding extensions.vector_cosine_ops)
--   with (lists = 100);  -- ~rows/1000

alter table public.agent_chunks enable row level security;
-- no public policies → service_role only

create or replace function public.match_agent_chunks(
  query_embedding extensions.vector(384),
  match_count int default 6,
  filter_source text default null,
  filter_worker_id text default null
)
returns table (
  id uuid,
  source text,
  worker_id text,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    c.id,
    c.source,
    c.worker_id,
    c.content,
    c.metadata,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  from public.agent_chunks c
  where c.embedding is not null
    and (filter_source is null or c.source = filter_source)
    and (filter_worker_id is null or c.worker_id = filter_worker_id)
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

revoke all on function public.match_agent_chunks(extensions.vector, int, text, text) from public;
grant execute on function public.match_agent_chunks(extensions.vector, int, text, text) to service_role;
