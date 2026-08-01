/**
 * GSA Stripe webhook — @supabase/server
 *
 * Idempotency keys:
 *   1. event.id  → stripe_webhook_events.event_id (PK claim)
 *   2. session.id → unique partial index after fulfill
 *   3. license_key → stored on same row
 *
 * Stripe cannot send Supabase API keys → auth: 'none' + signature verify.
 * verify_JWT must be false (supabase/config.toml).
 */
import { withSupabase } from "npm:@supabase/server";
import Stripe from "npm:stripe@14.21.0";

const NOTION_DATABASE_ID = "6585e86d623b446eb6e7273721a8bb9e";
const GSA_AMOUNT_CENTS = 9700;

type IdempotencyClaim =
  | { status: "claimed" }
  | { status: "duplicate" }
  | { status: "error"; detail: string };

function generateLicenseKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let key = "GSA-";
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 4; j++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (i < 2) key += "-";
  }
  return key;
}

function metric(fields: Record<string, string | number | boolean>) {
  const parts = Object.entries(fields)
    .map(([k, v]) => `${k}=${typeof v === "string" ? JSON.stringify(v) : v}`)
    .join(" ");
  console.log(`metric ${parts}`);
}

function isDuplicateError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const code = err.code || "";
  const msg = (err.message || "").toLowerCase();
  return code === "23505" || msg.includes("duplicate") || msg.includes("unique");
}

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    if (req.method === "GET") {
      return Response.json({
        ok: true,
        service: "gsa-stripe-webhook",
        idempotency: ["event_id PK", "session_id unique", "license_key"],
        events: [
          "checkout.session.completed",
          "checkout.session.async_payment_succeeded",
        ],
      });
    }

    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
    if (!stripeKey || !webhookSecret) {
      metric({ name: "webhook", status: "misconfigured", reason: "missing_stripe_secrets" });
      return Response.json({ error: "Webhook not configured" }, { status: 500 });
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Raw body — never JSON.parse before verify
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      metric({ name: "webhook", status: "bad_request", reason: "missing_signature" });
      return new Response("Missing stripe-signature", { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "invalid signature";
      metric({
        name: "webhook",
        status: "sig_failed",
        error: message.slice(0, 120),
      });
      return new Response(`Webhook Error: ${message}`, { status: 400 });
    }

    // ── Idempotency key #1: Stripe event.id ─────────────────────────────
    const claim = await claimEvent(ctx.supabaseAdmin, event.id, event.type);
    if (claim.status === "duplicate") {
      metric({ name: "idempotency", status: "duplicate", event_id: event.id });
      return Response.json({ received: true, duplicate: true, event_id: event.id });
    }
    if (claim.status === "error") {
      metric({ name: "idempotency", status: "error", detail: claim.detail.slice(0, 120) });
      // Fail open: prefer double-fulfill over permanent Stripe retry death
    } else {
      metric({ name: "idempotency", status: "claimed", event_id: event.id });
    }

    metric({
      name: "webhook",
      status: "received",
      event_type: event.type,
      event_id: event.id,
    });

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const isOurProduct =
        session.metadata?.product === "grok-super-agent" ||
        session.amount_total === GSA_AMOUNT_CENTS;

      if (!isOurProduct) {
        metric({
          name: "fulfillment",
          status: "skipped",
          reason: "not_gsa_product",
          amount: session.amount_total ?? 0,
        });
        return Response.json({ received: true, event_id: event.id, skipped: true });
      }

      // ── Idempotency key #2+#3: session + license on same row ──────────
      const licenseKey = generateLicenseKey();
      const customerEmail =
        session.customer_details?.email || session.customer_email || "";
      const customerName = session.customer_details?.name || "";

      metric({
        name: "fulfillment",
        status: "start",
        session_id: session.id,
        amount: session.amount_total ?? 0,
      });

      const { error: fulfillErr } = await ctx.supabaseAdmin
        .from("stripe_webhook_events")
        .update({
          session_id: session.id,
          license_key: licenseKey,
          metadata: {
            fulfilled: true,
            email: customerEmail,
            name: customerName,
            amount_total: session.amount_total,
            currency: session.currency,
          },
        })
        .eq("event_id", event.id);

      if (fulfillErr && isDuplicateError(fulfillErr)) {
        // session_id unique: another event already fulfilled this session
        metric({
          name: "idempotency",
          status: "session_duplicate",
          session_id: session.id,
        });
        return Response.json({
          received: true,
          duplicate: true,
          reason: "session_id",
          event_id: event.id,
        });
      }

      try {
        await writeNotion(session, licenseKey, event.id);
      } catch (e) {
        metric({
          name: "fulfillment",
          status: "notion_failed",
          error: String((e as Error).message).slice(0, 120),
        });
      }

      if (customerEmail) {
        try {
          await sendLicenseEmail(customerEmail, customerName, licenseKey);
        } catch (e) {
          metric({
            name: "fulfillment",
            status: "email_failed",
            error: String((e as Error).message).slice(0, 120),
          });
        }
      }

      metric({
        name: "fulfillment",
        status: "done",
        license_prefix: licenseKey.slice(0, 8),
        session_id: session.id,
      });
    }

    return Response.json({ received: true, event_id: event.id });
  }),
};

async function claimEvent(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  eventId: string,
  eventType: string,
): Promise<IdempotencyClaim> {
  const { error } = await supabaseAdmin.from("stripe_webhook_events").insert({
    event_id: eventId,
    event_type: eventType,
  });

  if (!error) return { status: "claimed" };
  if (isDuplicateError(error)) return { status: "duplicate" };
  return {
    status: "error",
    detail: `${error.code || ""} ${error.message || "unknown"}`.trim(),
  };
}

async function writeNotion(
  session: Stripe.Checkout.Session,
  licenseKey: string,
  eventId: string,
): Promise<void> {
  const token = Deno.env.get("NOTION_TOKEN") || "";
  if (!token) {
    metric({ name: "fulfillment", status: "notion_skipped", reason: "no_token" });
    return;
  }

  const customerEmail = session.customer_details?.email || session.customer_email || "";
  const customerName = session.customer_details?.name || "";

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { database_id: NOTION_DATABASE_ID },
      properties: {
        Name: {
          title: [{ text: { content: customerName || customerEmail || "Customer" } }],
        },
        Email: { email: customerEmail || null },
        Amount: { number: (session.amount_total || 0) / 100 },
        Currency: { select: { name: "AUD" } },
        "Payment Status": { select: { name: "Succeeded" } },
        "Stripe Session ID": { rich_text: [{ text: { content: session.id } }] },
        Product: {
          rich_text: [{ text: { content: "Grok Super Agent — Precision Workers" } }],
        },
        "License Key": { rich_text: [{ text: { content: licenseKey } }] },
        "Paid At": { date: { start: new Date().toISOString() } },
        "Customer Name": { rich_text: [{ text: { content: customerName } }] },
        Notes: {
          rich_text: [{ text: { content: `event=${eventId}; idempotency=event_id+session_id` } }],
        },
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Notion HTTP ${res.status}: ${await res.text()}`);
  }
}

async function sendLicenseEmail(to: string, name: string, licenseKey: string): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const from = Deno.env.get("FROM_EMAIL") || "licenses@keyforagents.com";
  if (!apiKey) {
    metric({ name: "fulfillment", status: "email_skipped", reason: "no_key" });
    return;
  }

  const html = `<div style="font-family:sans-serif;max-width:560px;padding:24px">
    <h1>Your Grok Super Agent License</h1>
    <p>Thanks${name ? ", " + name : ""}.</p>
    <p style="font-family:monospace;font-size:20px;font-weight:600">${licenseKey}</p>
    <pre style="background:#111;color:#ddd;padding:12px">export GROK_API_KEY=...
export GROK_LICENSE=${licenseKey}
python3 gsa run</pre>
    <p style="color:#999">— Key for Agents</p></div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Your Grok Super Agent License Key — ${licenseKey}`,
      html,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend HTTP ${res.status}: ${await res.text()}`);
  }
}
