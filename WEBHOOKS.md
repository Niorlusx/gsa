# Webhooks — Full Connect (Launch)

## Architecture

```
Stripe Checkout (Payment Link)
        │
        │  checkout.session.completed
        ▼
Supabase Edge Function: stripe-webhook
        │
        ├── verify stripe-signature  (STRIPE_WEBHOOK_SECRET)
        ├── idempotency claim (event.id → stripe_webhook_events)
        ├── generate license GSA-XXXX-XXXX-XXXX
        ├── write row → Notion (Playbook AI Sales)
        └── email license → Resend (RESEND_API_KEY)
```

## Stripe

| Item | Value |
|------|--------|
| Product | `prod_UzQ9pBxVJC3cl0` |
| Price | `price_1TzRJRRWjaTwhNZfC0vt16iP` — A$97 |
| Payment Link (test) | https://buy.stripe.com/test_7sY4gB69VdlO6R62Db3gk01 |
| Webhook endpoint ID | `we_1TzUJdRWjaTwhNZfn6S9XAkU` |
| Events | `checkout.session.completed`, `checkout.session.async_payment_succeeded` |

### Endpoint URL

`https://havdtpnbhvufsvckgaiu.supabase.co/functions/v1/stripe-webhook`

## Supabase secrets

```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NOTION_TOKEN
RESEND_API_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ALERT_WEBHOOK_URL   # optional
```

## Signature verification

`stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET)` — raw body required.
