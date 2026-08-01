# GSA on Cloudflare

| Project | Path | Purpose |
|---------|------|---------|
| **Stripe webhook** | [`stripe-webhook/`](./stripe-webhook/) | Checkout → license key (Workers + KV) |
| **Sandbox** | [`sandbox/`](./sandbox/) | Isolated code execution (Sandbox SDK) |

## Stripe sandbox objects (test mode)

Account: **stripe-sandbox-rose-mountain** (`acct_1Tsd41RWjaTwhNZf`)

| Object | Value |
|--------|--------|
| Customer | `cus_Uzag0buBabgk22` — GSA Test Customer |
| Card | Visa •••• **4242** (`card_1TzbVTRWjaTwhNZf3kZ2XCsP`) |
| Payment Link | https://buy.stripe.com/test_7sY4gB69VdlO6R62Db3gk01 |
| Product / Price | `prod_UzQ9pBxVJC3cl0` / `price_1TzRJRRWjaTwhNZfC0vt16iP` (A$97) |

## Deploy order

1. Create KV + secrets for `stripe-webhook` → deploy → point Stripe webhook URL at Worker  
2. Install Docker → `sandbox` deploy when Containers enabled  

See each project README for commands.
