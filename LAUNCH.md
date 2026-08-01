# GSA — Launch Readiness

## 1. GitHub

```bash
cd artifacts   # or repo root after copy
git init
git add .
git status     # confirm no .env secrets
git commit -m "GSA v1.5.0 — Precision Workers CLI + stdlib LLM connector"
# create repo on GitHub (e.g. Niorlusx/gsa)
git remote add origin git@github.com:Niorlusx/gsa.git
git push -u origin main
```

CI: `.github/workflows/gsa-ci.yml` runs on push (syntax, config, `gsa smoke`).

## 2. Secrets matrix

| Where | Keys |
|-------|------|
| **Local / runner** | `GROK_API_KEY` (or provider key), `GROK_LICENSE` |
| **Supabase Edge** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NOTION_TOKEN`, `RESEND_API_KEY`, `FROM_EMAIL` |
| **Supabase local / Workers** | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL` (`@supabase/server`) |
| **GitHub Actions** | none required for smoke |

Copy `.env.example` → `.env` locally. Never commit `.env`.

## 3. MCP / connectors

| Connector | Role |
|-----------|------|
| Stripe | Product, price, payment link, webhook |
| Supabase | Webhook runtime |
| Notion | Sales ledger |
| Resend | License email |
| LLM (`connectors.llm`) | Worker inference (xAI default; OpenAI-compatible presets) |
| GitHub | CI on push |

## 4. Pre-flight checklist

- [ ] `python3 gsa smoke` → SMOKE PASSED  
- [ ] `python3 gsa doctor` → files + RAG OK  
- [ ] `.env` filled (local)  
- [ ] Supabase secrets set  
- [ ] Stripe webhook endpoint + signing secret  
- [ ] Notion integration on Playbook AI Sales  
- [ ] Test payment → Notion row + email  
- [ ] `gsa run` with issued license  

## 5. Run

```bash
# no pip deps — stdlib LLM connector (v1.5.0+)
export GROK_API_KEY=xai-...
export GROK_LICENSE=GSA-DEMO-2026-LIVE
python3 gsa smoke
python3 gsa status
python3 gsa run
```

LLM docs: **[docs/LLM_CONNECTOR.md](docs/LLM_CONNECTOR.md)**

Payment link (test): https://buy.stripe.com/test_7sY4gB69VdlO6R62Db3gk01
