export type Env = {
  NEXT_PUBLIC_APP_ENV?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_PRICE_SILVER_ID?: string;
  STRIPE_PRICE_GOLD_ID?: string;
  STRIPE_PRICE_PLATINUM_ID?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  AIRTABLE_API_KEY?: string;
  AIRTABLE_BASE_ID?: string;
  N8N_WEBHOOK_URL?: string;
  N8N_API_KEY?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM_NUMBER?: string;
  TWILIO_OPERATOR_NUMBER?: string;
  TWILIO_PROXY_SERVICE_SID?: string;
  AUTH0_DOMAIN?: string;
  AUTH0_CLIENT_ID?: string;
  AUTH0_CLIENT_SECRET?: string;
  NEXTAUTH_SECRET?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
  POSTHOG_API_KEY?: string;
  MIXPANEL_TOKEN?: string;
  PUBLIC_BASE_URL?: string;
  ENCRYPTION_KEY?: string;
  DATABASE_URL?: string;
  DISCORD_WEBHOOK_URL?: string;
};

// Only enforce the minimal env required for core server operations.
// Feature-specific routes (e.g., Stripe billing) should validate their own required envs.
const requiredInProd: Array<keyof Env> = [
  'AIRTABLE_API_KEY',
  'AIRTABLE_BASE_ID',
];

export function getEnv(): Env {
  const env: Env = {
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PRICE_SILVER_ID: process.env.STRIPE_PRICE_SILVER_ID,
    STRIPE_PRICE_GOLD_ID: process.env.STRIPE_PRICE_GOLD_ID,
    STRIPE_PRICE_PLATINUM_ID: process.env.STRIPE_PRICE_PLATINUM_ID,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY,
    AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID,
    N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL,
    N8N_API_KEY: process.env.N8N_API_KEY,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,
    TWILIO_OPERATOR_NUMBER: process.env.TWILIO_OPERATOR_NUMBER,
    TWILIO_PROXY_SERVICE_SID: process.env.TWILIO_PROXY_SERVICE_SID,
    AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
    AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
    MIXPANEL_TOKEN: process.env.MIXPANEL_TOKEN,
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
  };

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    const missing = requiredInProd.filter((key) => !env[key]);
    if (missing.length > 0) {
      // Throwing early helps catch misconfigurations in CI/deploys
      throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
    }
  }

  return env;
}


