-- GSA: idempotency keys + RLS audit fixes
-- Aligns stripe_webhook_events with live schema (processed_at, not created_at)
-- Ensures agent_chunks is service-only and ready for pgvector (optional embedding)

-- ─── Idempotency table (safe on existing deployments) ─────────────────────
create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  session_id text,
  processed_at timestamptz not null default now(),
  license_key text,
  metadata jsonb not null default '{}'::jsonb
);

-- Prefer processed_at if table was created with created_at only
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stripe_webhook_events'
      and column_name = 'created_at'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stripe_webhook_events'
      and column_name = 'processed_at'
  ) then
    alter table public.stripe_webhook_events rename column created_at to processed_at;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stripe_webhook_events'
      and column_name = 'processed_at'
  ) then
    alter table public.stripe_webhook_events
      add column processed_at timestamptz not null default now();
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'stripe_webhook_events'
      and column_name = 'metadata'
  ) then
    alter table public.stripe_webhook_events
      add column metadata jsonb not null default '{}'::jsonb;
  end if;
end $$;

-- Secondary idempotency: one fulfillment row per Checkout session when set
create unique index if not exists stripe_webhook_events_session_id_uidx
  on public.stripe_webhook_events (session_id)
  where session_id is not null;

create index if not exists stripe_webhook_events_processed_at_idx
  on public.stripe_webhook_events (processed_at desc);

create index if not exists stripe_webhook_events_license_key_idx
  on public.stripe_webhook_events (license_key)
  where license_key is not null;

alter table public.stripe_webhook_events enable row level security;

-- Drop any accidental open policies (service_role bypasses RLS; anon gets nothing)
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'stripe_webhook_events'
  loop
    execute format('drop policy if exists %I on public.stripe_webhook_events', r.policyname);
  end loop;
end $$;

comment on table public.stripe_webhook_events is
  'Idempotency: PK=event.id. Unique session_id when fulfilled. RLS ON, no public policies.';

-- ─── agent_chunks (Phase 2 RAG) ───────────────────────────────────────────
create extension if not exists vector with schema extensions;

create table if not exists public.agent_chunks (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  worker_id text,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- embedding optional until embed pipeline is on
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agent_chunks'
      and column_name = 'embedding'
  ) then
    alter table public.agent_chunks
      add column embedding extensions.vector(384);
  end if;
end $$;

create index if not exists agent_chunks_source_idx on public.agent_chunks (source);
create index if not exists agent_chunks_worker_id_idx on public.agent_chunks (worker_id)
  where worker_id is not null;

-- IVFFlat only when there is data; create if missing (may warn if empty)
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'agent_chunks_embedding_ivfflat'
  ) then
    begin
      create index agent_chunks_embedding_ivfflat
        on public.agent_chunks
        using ivfflat (embedding extensions.vector_cosine_ops)
        with (lists = 100);
    exception when others then
      -- Empty table or too few rows: skip; recreate after bulk load
      raise notice 'agent_chunks IVFFlat skipped: %', SQLERRM;
    end;
  end if;
end $$;

alter table public.agent_chunks enable row level security;

do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'agent_chunks'
  loop
    execute format('drop policy if exists %I on public.agent_chunks', r.policyname);
  end loop;
end $$;

comment on table public.agent_chunks is
  'GSA Phase 2 RAG chunks. RLS ON, service_role only. embedding vector(384).';

-- Match RPC for retrieval (service_role / secret)
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

-- ─── Thread policy audit fixes (tautology m.thread_id = m.thread_id) ───────
-- Replace broken EXISTS policies if present
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages'
      and policyname = 'messages_select_thread_members'
  ) then
    drop policy messages_select_thread_members on public.messages;
    create policy messages_select_thread_members on public.messages
      for select to authenticated
      using (
        exists (
          select 1 from public.thread_members m
          where m.thread_id = messages.thread_id
            and m.user_id = (select auth.uid())
        )
      );
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages'
      and policyname = 'messages_insert_sender_in_thread'
  ) then
    drop policy messages_insert_sender_in_thread on public.messages;
    create policy messages_insert_sender_in_thread on public.messages
      for insert to authenticated
      with check (
        sender_id = (select auth.uid())
        and exists (
          select 1 from public.thread_members m
          where m.thread_id = messages.thread_id
            and m.user_id = (select auth.uid())
        )
      );
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'thread_summaries'
      and policyname = 'thread_summaries_select_thread_members'
  ) then
    drop policy thread_summaries_select_thread_members on public.thread_summaries;
    create policy thread_summaries_select_thread_members on public.thread_summaries
      for select to authenticated
      using (
        exists (
          select 1 from public.thread_members m
          where m.thread_id = thread_summaries.thread_id
            and m.user_id = (select auth.uid())
        )
      );
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'thread_summaries'
      and policyname = 'thread_summaries_insert_creator'
  ) then
    drop policy thread_summaries_insert_creator on public.thread_summaries;
    create policy thread_summaries_insert_creator on public.thread_summaries
      for insert to authenticated
      with check (
        created_by = (select auth.uid())
        and exists (
          select 1 from public.thread_members m
          where m.thread_id = thread_summaries.thread_id
            and m.user_id = (select auth.uid())
        )
      );
  end if;
end $$;
