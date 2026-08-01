# Integrations sync map

## Endpoints

| Layer | URL / ID |
|-------|----------|
| Frontend (buy) | https://buy.stripe.com/test_7sY4gB69VdlO6R62Db3gk01 |
| Backend webhook (live Edge) | https://havdtpnbhvufsvckgaiu.supabase.co/functions/v1/stripe-webhook |
| Supabase project (config / @supabase/server) | `knqcjedftfgmnhdgjnoo` |
| Stripe endpoint | `we_1TzUJdRWjaTwhNZfn6S9XAkU` |
| CLI | `python3 gsa` |
| Notion | DB `6585e86d623b446eb6e7273721a8bb9e` |

## @supabase/server

| Item | Value |
|------|--------|
| Package | `@supabase/server` (repo root `package.json`) |
| Edge import | `npm:@supabase/server` (no npm install on Edge) |
| Local env | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL` |
| Stripe handler | `supabase/functions/stripe-webhook` → `auth: 'none'` + Stripe sig verify |
| Config | `supabase/config.toml` (`verify_jwt = false` for webhook) |

**Project split:** `gsa.config.json` / new keys → **knqcjedftfgmnhdgjnoo**. Live Stripe webhook v7 is still on **havdtpnbhvufsvckgaiu**. Deploy the new function to the project you intend, then point the Stripe endpoint URL at it.

## Idempotency keys

| Key | Store | On conflict |
|-----|--------|-------------|
| `event.id` | `stripe_webhook_events.event_id` **PK** | HTTP 200 `{ duplicate: true }` |
| `session.id` | unique partial index (where not null) | skip second license |
| `license_key` | column + index | support / Notion audit |

Implemented in `supabase/functions/stripe-webhook` + migration `20260801120000_…`.

## RLS

| Table | RLS | Policies | Notes |
|-------|-----|----------|--------|
| `stripe_webhook_events` | ON | none | service_role only |
| `agent_chunks` | ON | none | service_role + `match_agent_chunks` |
| threads / messages | ON | authenticated | tautology policies **fixed** |

Full audit: **[docs/RLS_AUDIT.md](docs/RLS_AUDIT.md)**  
Stripe config: **[docs/STRIPE_WEBHOOKS.md](docs/STRIPE_WEBHOOKS.md)**  
RAG Phase 2: **[rag/](rag/)**
