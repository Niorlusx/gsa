/**
 * GSA Stripe webhook — @supabase/server migration target
 *
 * External provider (Stripe) cannot send Supabase API keys.
 * → auth: 'none' + verify Stripe signature on raw body
 * → use ctx.supabaseAdmin for elevated DB writes (idempotency / fulfill)
 *
 * Deploy secrets (Edge):
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 *   NOTION_TOKEN, RESEND_API_KEY, FROM_EMAIL (optional)
 *
 * Platform: verify_jwt = false (see supabase/config.toml)
 */
import { withSupabase } from "npm:@supabase/server";
import Stripe from "npm:stripe@14.21.0";

const NOTION_DATABASE_ID = "6585e86d623b446eb6e7273721a8bb9e";

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

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    if (req.method === "GET") {
      return Response.json({
        ok: true,
        service: "gsa-stripe-webhook",
        note: "POST only — Stripe deliveries",
      });
    }

    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
    if (!stripeKey || !webhookSecret) {
      console.log('metric name="webhook" status="misconfigured"');
      return Response.json({ error: "Webhook not configured" }, { status: 500 });
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Raw body required for signature verification — never JSON.parse first
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      console.log('metric name="webhook" status="bad_request" reason="missing_signature"');
      return new Response("Missing stripe-signature", { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "invalid signature";
      console.log(
        `metric name="webhook" status="sig_failed" error=${JSON.stringify(message.slice(0, 120))}`,
      );
      return new Response(`Webhook Error: ${message}`, { status: 400 });
    }

    // Durable idempotency via admin client (service/secret privileges)
    const { error: claimErr } = await ctx.supabaseAdmin
      .from("stripe_webhook_events")
      .insert({ event_id: event.id, event_type: event.type });

    if (claimErr) {
      const msg = claimErr.message || "";
      const code = (claimErr as { code?: string }).code || "";
      if (code === "23505" || msg.toLowerCase().includes("duplicate")) {
        console.log(
          `metric name="idempotency" status="duplicate" event_id=${JSON.stringify(event.id)}`,
        );
        return Response.json({ received: true, duplicate: true });
      }
      console.error("idempotency claim error:", claimErr);
      // Fail open so Stripe retries are not blocked forever
    }

    console.log(
      `metric name="webhook" status="received" event_type=${JSON.stringify(event.type)} event_id=${JSON.stringify(event.id)}`,
    );

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const isOurProduct =
        session.metadata?.product === "grok-super-agent" || session.amount_total === 9700;

      if (isOurProduct) {
        const licenseKey = generateLicenseKey();
        const customerEmail =
          session.customer_details?.email || session.customer_email || "";
        const customerName = session.customer_details?.name || "";

        await fulfillNotion(session, licenseKey, event.id);
        if (customerEmail) {
          await fulfillEmail(customerEmail, customerName, licenseKey);
        }

        await ctx.supabaseAdmin
          .from("stripe_webhook_events")
          .update({
            session_id: session.id,
            license_key: licenseKey,
            metadata: { fulfilled: true },
          })
          .eq("event_id", event.id);

        console.log(
          `metric name="fulfillment" status="done" license_prefix=${JSON.stringify(licenseKey.slice(0, 8))}`,
        );
      } else {
        console.log(
          `metric name="fulfillment" status="skipped" reason="not_gsa_product" amount=${session.amount_total ?? 0}`,
        );
      }
    }

    return Response.json({ received: true, event_id: event.id });
  }),
};

async function fulfillNotion(
  session: Stripe.Checkout.Session,
  licenseKey: string,
  eventId: string,
): Promise<void> {
  const token = Deno.env.get("NOTION_TOKEN") || "";
  if (!token) return;

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
        Notes: { rich_text: [{ text: { content: `event=${eventId}` } }] },
      },
    }),
  });

  if (!res.ok) {
    console.error("Notion error", res.status, await res.text());
  }
}

async function fulfillEmail(to: string, name: string, licenseKey: string): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  const from = Deno.env.get("FROM_EMAIL") || "licenses@keyforagents.com";
  if (!apiKey) return;

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
    console.error("Resend error", res.status, await res.text());
  }
}
