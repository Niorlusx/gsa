# Webhooks — Full Connect (Launch)

## Architecture

```
Stripe Checkout (Payment Link)
        │
        │  checkout.session.completed
        ▼
Supabase Edge Function: stripe-webhook   ← current path (v7)
   OR
Cloudflare Worker: gsa-stripe-webhook    ← scaffold: cloudflare/stripe-webhook/
        │
        ├── verify stripe-signature  (STRIPE_WEBHOOK_SECRET)
        ├── idempotency claim (event.id → stripe_webhook_events | KV)
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

Stripe signs each delivery with HMAC-SHA256. Verify with **three** inputs:

| Input | Source |
|--------|--------|
| **Raw body** | Exact bytes Stripe sent (`await req.text()` — **not** re-parsed JSON) |
| **`Stripe-Signature` header** | Form `t=…,v1=…` |
| **Endpoint signing secret** | `whsec_…` for **this** endpoint only |

```ts
event = await stripe.webhooks.constructEventAsync(
  rawBody,           // string from req.text()
  signatureHeader,   // Stripe-Signature
  endpointSecret     // STRIPE_WEBHOOK_SECRET
)
// On failure → HTTP 400 (do not process)
```

| Failure | Likely cause |
|---------|----------------|
| `No signatures found matching…` | Wrong `whsec_`, body mutated, test/live mix, CLI secret vs Dashboard event |
| Missing signature → 400 | Browser **GET** to the function URL (does not test Checkout) |

Live handler (Edge **v7**): `constructEventAsync` on raw body · `verify_jwt: false` · fail → 400 + `sig_failed` metric.

### Secrets checklist

1. Dashboard → Webhooks → **`we_1TzUJdRWjaTwhNZfn6S9XAkU`** → **Reveal** → `whsec_…`
2. Supabase Edge Secrets → **`STRIPE_WEBHOOK_SECRET`** = that exact value
3. Also: `STRIPE_SECRET_KEY` (test), `NOTION_TOKEN`, `RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
4. `stripe listen` secret is **only** for CLI-forwarded events — do not mix with Dashboard deliveries

---

## Live test payment (proves signature verify)

**Test mode only.** Use a real Stripe **POST** from Checkout — not a browser GET.

### 1. Confirm secret

As above (Reveal `whsec_` → Edge `STRIPE_WEBHOOK_SECRET`).

### 2. Pay with test Checkout

https://buy.stripe.com/test_7sY4gB69VdlO6R62Db3gk01

| Field | Use |
|--------|-----|
| Card | `4242 4242 4242 4242` |
| Expiry | any future date |
| CVC | any 3 digits |
| Email | an inbox you can read |

### 3. What success looks like

| Place | Expect |
|--------|--------|
| Stripe → Webhooks → this endpoint → attempts | **200** (not 400) |
| Supabase → `stripe-webhook` logs | `status=received` / `status=ok` — **not** `sig_failed` |
| Notion Playbook AI Sales | new row + **License Key** |
| Email (Resend) | license key |

If **400** + `sig_failed` → secret mismatch (wrong `whsec_`, or CLI vs Dashboard).

### 4. Use the license

```bash
export GROK_API_KEY=xai-...
export GROK_LICENSE=<key from email or Notion>
python3 gsa smoke
python3 gsa run
```

### Optional: CLI trigger only

Uses the **CLI** signing secret, not the Dashboard one:

```bash
stripe listen --forward-to https://havdtpnbhvufsvckgaiu.supabase.co/functions/v1/stripe-webhook
# other terminal:
stripe trigger checkout.session.completed
```

For full GSA proof (Notion + email + A$97 product filter), prefer the **Payment Link** path.

### Cloudflare Worker alternative

Scaffold: `cloudflare/stripe-webhook/` — same verify contract; after deploy, create a **new** Stripe endpoint (new URL = new `whsec_`).
