# GSA Stripe Webhook (Cloudflare Workers)

Edge replacement for the Supabase `stripe-webhook` Edge Function.

```
Stripe Checkout (Payment Link)
        │  checkout.session.completed
        ▼
Workers: gsa-stripe-webhook
        ├── verify stripe-signature
        ├── KV idempotency (event.id)
        ├── generate license GSA-XXXX-XXXX-XXXX
        ├── optional Notion page
        └── optional Resend email
```

## Setup

```bash
cd cloudflare/stripe-webhook
npm.cmd install

# Create KV for idempotency + license storage
npx.cmd wrangler kv namespace create gsa-stripe-idempotency
npx.cmd wrangler kv namespace create gsa-stripe-idempotency --preview
# Paste the IDs into wrangler.jsonc → kv_namespaces

# Secrets (test mode keys from stripe-sandbox-rose-mountain)
npx.cmd wrangler secret put STRIPE_SECRET_KEY
npx.cmd wrangler secret put STRIPE_WEBHOOK_SECRET
# optional:
npx.cmd wrangler secret put RESEND_API_KEY
npx.cmd wrangler secret put NOTION_TOKEN

# Deploy
npx.cmd wrangler deploy
```

## Stripe Dashboard

1. Developers → Webhooks → Add endpoint  
2. URL: `https://gsa-stripe-webhook.<your-subdomain>.workers.dev/webhook`  
3. Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`  
4. Copy signing secret → `STRIPE_WEBHOOK_SECRET`

## Local dev

```bash
npx.cmd wrangler dev
# In another terminal (Stripe CLI):
stripe listen --forward-to localhost:8787/webhook
stripe trigger checkout.session.completed
```

## Test payment

Payment Link (test): https://buy.stripe.com/test_7sY4gB69VdlO6R62Db3gk01  

Card: `4242 4242 4242 4242` · any future expiry · any CVC

## Related sandbox objects

| Object | ID |
|--------|-----|
| Customer | `cus_Uzag0buBabgk22` |
| Card | `card_1TzbVTRWjaTwhNZf3kZ2XCsP` (Visa •••• 4242) |
| Product | `prod_UzQ9pBxVJC3cl0` |
| Price | `price_1TzRJRRWjaTwhNZfC0vt16iP` (A$97) |
