import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(43200),
  VALIDATION_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(14).default(12),
  ADMIN_SEED_PASSWORD: z.string().min(8),
  BOOTSTRAP_SUPERADMIN_USER: z.string().min(3).default("superadmin"),
  BOOTSTRAP_SUPERADMIN_PASSWORD: z.string().min(6).default("superadmin"),
  BOOTSTRAP_SUPERADMIN_NAME: z.string().min(3).default("Superadmin"),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast to avoid running with partial/malformed configuration.
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const env = parsed.data;
