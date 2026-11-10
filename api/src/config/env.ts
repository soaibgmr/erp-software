import "./load-env";
import { z } from "zod";
import { isValidTimeZone } from "../utils/time";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),

    // Runtime connection (may point at a pooler such as PgBouncer).
    DATABASE_URL: z.url(),
    // Direct connection used only by the Prisma CLI for migrations (prisma.config.ts reads it from
    // process.env). The running app never uses it, so serverless hosts like Vercel can leave it unset.
    DIRECT_URL: z.url().optional(),

    DB_POOL_MAX: z.coerce.number().int().positive().default(10),
    DB_IDLE_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(30_000),
    DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(5_000),
    DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(15_000),

    JWT_SECRET: z.string().min(32),
    // Short-lived: an access token stays valid until expiry even after logout.
    JWT_EXPIRES_IN: z.string().default("15m"),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

    // Expected value of the `clientid` header on /api routes. Optional outside production (check skipped).
    CLIENT_ID: z.string().optional(),

    // Serve Swagger UI at /docs. Defaults to on outside production.
    SWAGGER_ENABLED: z.stringbool().optional(),

    // IANA timezone the app works in (financial year, day boundaries). Clients read it from GET /api/v1/health.
    APP_TIMEZONE: z.string().default("Asia/Kolkata").refine(isValidTimeZone, { message: "Unknown IANA timezone" }),

    // Comma-separated browser origins allowed by CORS (the UI dev server by default).
    CORS_ORIGIN: z
      .string()
      .default("http://localhost:5173")
      .transform((v) =>
        v
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
      ),

    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

    // Public URL of the UI; links in emails (verify email, reset password) point here.
    // When unset, the first CORS_ORIGIN is used (that is the UI's URL in every environment).
    APP_URL: z.url().optional(),
    // Product name shown in emails.
    APP_NAME: z.string().default("ERP Software"),

    // Email (SMTP: Brevo, Zoho, Gmail, Amazon SES…). Without SMTP_HOST, emails are written to the log instead.
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    // true for port 465 (implicit TLS); STARTTLS is used on 587 either way.
    SMTP_SECURE: z.stringbool().default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().default("ERP Software <no-reply@example.com>"),
    // Where "new shop registered" notices go (the platform admin). Optional.
    PLATFORM_ADMIN_NOTIFY_EMAIL: z.email().optional(),
  })
  .refine((e) => e.NODE_ENV !== "production" || e.CLIENT_ID, {
    message: "CLIENT_ID is required in production",
    path: ["CLIENT_ID"],
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = {
  ...parsed.data,
  APP_URL: parsed.data.APP_URL ?? parsed.data.CORS_ORIGIN[0] ?? "http://localhost:5173",
};
export const isProduction = env.NODE_ENV === "production";
export const isSwaggerEnabled = env.SWAGGER_ENABLED ?? !isProduction;
