-- GSA: durable Stripe webhook idempotency
-- Project: knqcjedftfgmnhdgjnoo

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  session_id text,
  license_key text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists stripe_webhook_events_created_at_idx
  on public.stripe_webhook_events (created_at desc);

alter table public.stripe_webhook_events enable row level security;

-- No public policies: service_role / secret only (bypasses RLS)
comment on table public.stripe_webhook_events is
  'GSA Stripe webhook idempotency + fulfillment audit. RLS on, no anon policies.';
