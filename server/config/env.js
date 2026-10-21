import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, '..');

dotenv.config({ path: path.join(serverRoot, '.env'), quiet: true });

const booleanish = (defaultValue) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value === '') return defaultValue;
      return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
    });

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() !== '' ? value.trim() : ''));

const isTest = process.env.NODE_ENV === 'test';

/**
 * Secrets have throwaway defaults in tests only, so unit tests never need a
 * populated .env file. In every other environment they are required.
 */
const secret = (fallbackForTests) =>
  isTest
    ? z.string().optional().transform((value) => value || fallbackForTests)
    : z
        .string({ error: 'is required' })
        .min(32, 'must be at least 32 characters long');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  SERVER_URL: z.string().default('http://localhost:5000'),

  /**
   * How many proxies sit in front of Express. Render alone is 1 (the default
   * in production). Vercel forwarding to Render is 2, otherwise every visitor
   * would appear to come from Vercel's IP and share one rate-limit bucket.
   */
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((value) => (value === undefined || value.trim() === '' ? undefined : Number(value)))
    .refine(
      (value) => value === undefined || (Number.isInteger(value) && value >= 0 && value <= 5),
      'must be a whole number from 0 to 5',
    ),

  MONGODB_URI: isTest
    ? z.string().optional().transform((v) => v || 'mongodb://127.0.0.1:27017/codehub-test')
    : z.string({ error: 'is required' }).min(1),

  JWT_ACCESS_SECRET: secret('test-access-secret-test-access-secret-0001'),
  JWT_REFRESH_SECRET: secret('test-refresh-secret-test-refresh-secret-01'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  COOKIE_DOMAIN: optionalString,
  COOKIE_SECURE: booleanish(false),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  CODEFORCES_API_BASE: z.string().default('https://codeforces.com/api'),
  CODEFORCES_MIN_INTERVAL_MS: z.coerce.number().int().min(1000).default(2100),
  LEETCODE_GRAPHQL_URL: z.string().default('https://leetcode.com/graphql'),
  CODECHEF_PROFILE_BASE: z.string().default('https://www.codechef.com/users'),

  CLIST_API_BASE: z.string().default('https://clist.by/api/v4'),
  CLIST_USERNAME: optionalString,
  CLIST_API_KEY: optionalString,

  /**
   * Google sign-in. Optional, like every other integration: without these the
   * app still runs and email/password login is unaffected.
   * The redirect URI defaults to CLIENT_URL + /api/auth/google/callback, which
   * keeps the whole flow on the frontend's own origin (first-party cookies).
   */
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_REDIRECT_URI: optionalString,

  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanish(false),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  MAIL_FROM: z.string().default('CodeHub <no-reply@codehub.local>'),

  ENABLE_CRON: booleanish(true),
  PROBLEM_SYNC_CRON: z.string().default('0 */6 * * *'),
  CONTEST_SYNC_CRON: z.string().default('*/15 * * * *'),
  REMINDER_CRON: z.string().default('* * * * *'),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  PROFILE_REFRESH_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(120),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');

   
  console.error(
    `\nCodeHub cannot start: invalid environment configuration.\n${details}\n\n` +
      'Copy server/.env.example to server/.env and fill in the missing values.\n',
  );
  process.exit(1);
}

const raw = parsed.data;

const clientOrigins = raw.CLIENT_URL.split(',')
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter(Boolean);

export const env = Object.freeze({
  ...raw,
  CLIENT_URL: clientOrigins[0] ?? 'http://localhost:5173',
  SERVER_URL: raw.SERVER_URL.replace(/\/$/, ''),
  clientOrigins,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  isDevelopment: raw.NODE_ENV === 'development',
  /** clist.by is optional: contests still work without it (Codeforces + cache). */
  clistEnabled: Boolean(raw.CLIST_API_KEY && raw.CLIST_USERNAME),
  /** Google sign-in is optional; the button reports this cleanly when off. */
  googleEnabled: Boolean(raw.GOOGLE_CLIENT_ID && raw.GOOGLE_CLIENT_SECRET),
  googleRedirectUri:
    raw.GOOGLE_REDIRECT_URI || `${clientOrigins[0] ?? 'http://localhost:5173'}/api/auth/google/callback`,
  /** Without SMTP credentials reminder emails are logged instead of sent. */
  smtpEnabled: Boolean(raw.SMTP_HOST),
});

export default env;
