# Retry & webhook metrics

`stripe-webhook` emits structured log lines:

```
metric name=retry op=Notion status=success attempts=1 duration_ms=120
metric name=retry op=Resend status=backoff attempts=2 delay_ms=2100
metric name=webhook status=ok event_id=evt_... duration_ms=450
```

## Status values

| name | status | Meaning |
|------|--------|---------|
| retry | success | Op succeeded (after N attempts) |
| retry | attempt_failed | One try failed; may backoff |
| retry | backoff | Sleeping before next try |
| retry | exhausted | All retries failed |
| retry | permanent_error | 4xx (not 429) — no more retries |
| webhook | received / ok / duplicate / sig_failed | Request lifecycle |
| fulfillment | start / done / notion_failed / email_failed | License path |
| alert | exhausted / sent | Exhausted-retry alerting |

## Where to view

1. **Supabase Dashboard** → Edge Functions → `stripe-webhook` → Logs  
2. Filter: `metric name=retry` or `status=exhausted`

## Alerts

Set `ALERT_WEBHOOK_URL` in Supabase Edge secrets for Slack/Discord on exhausted retries.
