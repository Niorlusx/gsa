/**
 * GSA Stripe webhook Worker
 *
 * Flow:
 *   Stripe Checkout (Payment Link)
 *     → POST /  (this Worker)
 *     → verify stripe-signature
 *     → KV idempotency claim (event.id)
 *     → generate license GSA-XXXX-XXXX-XXXX
 *     → optional Notion row + Resend email
 *
 * Secrets: wrangler secret put STRIPE_SECRET_KEY | STRIPE_WEBHOOK_SECRET | ...
 */
import Stripe from "stripe";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return Response.json({
        ok: true,
        service: "gsa-stripe-webhook",
        events: ["checkout.session.completed", "checkout.session.async_payment_succeeded"],
      });
    }

    if (request.method === "POST" && (url.pathname === "/" || url.pathname === "/webhook")) {
      return handleStripeWebhook(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function handleStripeWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    console.error(JSON.stringify({ level: "error", msg: "missing_stripe_secrets" }));
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    // Pin matches installed stripe package default if types complain — override after upgrade.
    httpClient: Stripe.createFetchHttpClient(),
  });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    console.error(JSON.stringify({ level: "error", msg: "signature_failed", message }));
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: claim event.id in KV (24h TTL)
  const claimed = await claimEvent(env.IDEMPOTENCY, event.id);
  if (!claimed) {
    return Response.json({ ok: true, duplicate: true });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const work = fulfillCheckout(env, session, event.id);
    // Acknowledge quickly; finish side-effects after response
    ctx.waitUntil(
      work.catch((e) => {
        console.error(
          JSON.stringify({
            level: "error",
            msg: "fulfill_failed",
            eventId: event.id,
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      }),
    );
  }

  return Response.json({ ok: true, received: event.type });
}

async function claimEvent(kv: KVNamespace, eventId: string): Promise<boolean> {
  const key = `stripe:event:${eventId}`;
  const existing = await kv.get(key);
  if (existing) return false;
  await kv.put(key, new Date().toISOString(), { expirationTtl: 60 * 60 * 24 });
  return true;
}

function generateLicense(): string {
  const part = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(2));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  };
  return `GSA-${part()}-${part()}-${part()}`;
}

async function fulfillCheckout(
  env: Env,
  session: Stripe.Checkout.Session,
  eventId: string,
): Promise<void> {
  const email =
    session.customer_details?.email ||
    session.customer_email ||
    undefined;
  const name = session.customer_details?.name || undefined;
  const license = generateLicense();
  const amountTotal = session.amount_total;
  const currency = session.currency?.toUpperCase() || "AUD";

  console.log(
    JSON.stringify({
      level: "info",
      msg: "license_issued",
      eventId,
      sessionId: session.id,
      email,
      license,
      amountTotal,
      currency,
    }),
  );

  // Persist license next to event for debugging / support
  await env.IDEMPOTENCY.put(
    `stripe:license:${session.id}`,
    JSON.stringify({ license, email, name, eventId, at: new Date().toISOString() }),
    { expirationTtl: 60 * 60 * 24 * 90 },
  );

  if (env.NOTION_TOKEN && env.NOTION_DATABASE_ID) {
    await writeNotionSale(env, {
      license,
      email: email || "",
      name: name || "",
      sessionId: session.id,
      amountTotal,
      currency,
    });
  }

  if (env.RESEND_API_KEY && email) {
    await emailLicense(env, { to: email, name, license });
  }
}

async function writeNotionSale(
  env: Env,
  data: {
    license: string;
    email: string;
    name: string;
    sessionId: string;
    amountTotal: number | null;
    currency: string;
  },
): Promise<void> {
  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { database_id: env.NOTION_DATABASE_ID },
      properties: {
        Name: {
          title: [{ text: { content: data.name || data.email || "GSA Sale" } }],
        },
        Email: data.email ? { email: data.email } : undefined,
        License: {
          rich_text: [{ text: { content: data.license } }],
        },
        "Stripe Session ID": {
          rich_text: [{ text: { content: data.sessionId } }],
        },
        Amount: data.amountTotal != null ? { number: data.amountTotal / 100 } : undefined,
        Currency: {
          rich_text: [{ text: { content: data.currency } }],
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Notion error ${res.status}: ${body}`);
  }
}

async function emailLicense(
  env: Env,
  data: { to: string; name?: string; license: string },
): Promise<void> {
  const product = env.PRODUCT_NAME || "GSA";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.LICENSE_EMAIL_FROM,
      to: [data.to],
      subject: `Your ${product} license key`,
      text: [
        data.name ? `Hi ${data.name},` : "Hi,",
        "",
        `Thanks for purchasing ${product}.`,
        "",
        `License key: ${data.license}`,
        "",
        "Set it as GROK_LICENSE when running the GSA CLI.",
        "",
        "— GSA",
      ].join("\n"),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}
