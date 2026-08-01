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

| Key | Store |
|-----|--------|
| `event.id` | `stripe_webhook_events.event_id` PK |
| `session.id` | fulfill PATCH |
| `license_key` | fulfill PATCH |

## RLS

`stripe_webhook_events` + `agent_chunks`: RLS ON, no public policies (service_role only).
