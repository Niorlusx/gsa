# GSA server (Supabase)

Uses **`@supabase/server`** for Edge / Node / Workers handlers.

## Env (local / non-Edge)

```bash
# from repo root .env
SUPABASE_URL=https://knqcjedftfgmnhdgjnoo.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_JWKS_URL=https://knqcjedftfgmnhdgjnoo.supabase.co/auth/v1/.well-known/jwks.json
```

On **Supabase Edge Functions** these are injected by the platform (also set secrets for Stripe / Notion / Resend).

## Key map (new vs legacy)

| New (prefer) | Legacy (avoid) |
|--------------|----------------|
| `SUPABASE_PUBLISHABLE_KEY` | `SUPABASE_ANON_KEY` |
| `SUPABASE_SECRET_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |

## Auth modes

| Mode | Use |
|------|-----|
| `user` | End-user JWT |
| `publishable` | Public / publishable key |
| `secret` | Server-to-server (`apikey: sb_secret_…`) |
| `none` | Webhooks (e.g. Stripe) + **provider signature verify inside handler** |

Stripe webhook: `auth: 'none'` + `constructEventAsync` — see `supabase/functions/stripe-webhook/`.

## Install

```bash
npm.cmd install
```
