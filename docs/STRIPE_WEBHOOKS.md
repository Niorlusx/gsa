# Stripe webhooks — GSA configuration

## Live endpoint (test mode)

| Field | Value |
|--------|--------|
| **ID** | `we_1TzUJdRWjaTwhNZfn6S9XAkU` |
| **URL** | `https://havdtpnbhvufsvckgaiu.supabase.co/functions/v1/stripe-webhook` |
| **Status** | enabled |
| **Mode** | test (`livemode: false`) |
| **Events** | `checkout.session.completed`, `checkout.session.async_payment_succeeded` |
| **Product filter** | `metadata.product=grok-super-agent` **or** `amount_total=9700` (A$97) |

## Secrets (Edge)

```bash
# Dashboard → Edge Functions → Secrets  OR  supabase secrets set
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...   # Reveal on THIS endpoint only
NOTION_TOKEN=...
RESEND_API_KEY=...
FROM_EMAIL=licenses@keyforagents.com
# Platform injects SUPABASE_URL + service role / secret for @supabase/server
```

**Do not mix** CLI `stripe listen` secret with Dashboard deliveries.

## Handler contract

| Step | Behavior |
|------|----------|
| 1 | `auth: 'none'` (Stripe has no Supabase JWT) |
| 2 | `verify_jwt = false` in `supabase/config.toml` |
| 3 | Raw body + `constructEventAsync` → 400 on fail |
| 4 | Claim `event.id` insert → duplicate 200 |
| 5 | Fulfill → set `session_id` + `license_key` |
| 6 | Notion + Resend (best-effort) |

## Idempotency keys

| Key | Store | On conflict |
|-----|--------|-------------|
| `event.id` | `stripe_webhook_events.event_id` PK | return `{ duplicate: true }` |
| `session.id` | unique partial index | skip second license |
| `license_key` | column on same row | support lookup |

## Configure new endpoint (checklist)

1. Deploy: `supabase functions deploy stripe-webhook --project-ref <ref>`
2. Stripe Dashboard → Webhooks → Add endpoint → function URL
3. Select only the two checkout events (not `*`)
4. Reveal `whsec_` → set `STRIPE_WEBHOOK_SECRET`
5. Test: Payment Link + `4242…` → delivery **200**
6. Logs: `status=received` / `idempotency=claimed` — not `sig_failed`

## Payment Link

https://buy.stripe.com/test_7sY4gB69VdlO6R62Db3gk01  

Card: `4242 4242 4242 4242` · any future expiry · any CVC

## Cloudflare alternative

`cloudflare/stripe-webhook/` — same verify + KV idempotency.  
New Worker URL ⇒ **new** Stripe endpoint + new `whsec_`.

## Related

- `WEBHOOKS.md` — launch architecture + live test
- `docs/RLS_AUDIT.md` — table access model
- `supabase/functions/stripe-webhook/index.ts` — source
