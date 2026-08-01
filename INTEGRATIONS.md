# Integrations sync map

## Endpoints

| Layer | URL / ID |
|-------|----------|
| Frontend (buy) | https://buy.stripe.com/test_7sY4gB69VdlO6R62Db3gk01 |
| Backend webhook | https://havdtpnbhvufsvckgaiu.supabase.co/functions/v1/stripe-webhook |
| Stripe endpoint | `we_1TzUJdRWjaTwhNZfn6S9XAkU` |
| CLI | `python3 gsa` |
| Notion | DB `6585e86d623b446eb6e7273721a8bb9e` |

## Idempotency keys

| Key | Store |
|-----|--------|
| `event.id` | `stripe_webhook_events.event_id` PK |
| `session.id` | fulfill PATCH |
| `license_key` | fulfill PATCH |

## RLS

`stripe_webhook_events` + `agent_chunks`: RLS ON, no public policies (service_role only).
