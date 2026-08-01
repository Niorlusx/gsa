// Hand-written Env until you run `npm run types` after binding real resources.
interface Env {
  IDEMPOTENCY: KVNamespace;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  RESEND_API_KEY?: string;
  NOTION_TOKEN?: string;
  NOTION_DATABASE_ID: string;
  LICENSE_EMAIL_FROM: string;
  PRODUCT_NAME: string;
}
