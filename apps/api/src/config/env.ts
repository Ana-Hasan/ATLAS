import { z } from "zod";

const originList = z.string().min(1).refine((value) => {
  const origins = value.split(",").map((origin) => origin.trim());
  if (origins.some((origin) => origin === "*" || origin.length === 0)) return false;

  return origins.every((origin) => {
    try {
      const parsed = new URL(origin);
      return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.origin === origin;
    } catch {
      return false;
    }
  });
}, "must be a comma-separated list of exact HTTP or HTTPS origins without wildcards");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().min(1).max(65_535),
  DATABASE_URL: z.string().min(1).refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "postgres:" || url.protocol === "postgresql:";
    } catch {
      return false;
    }
  }, "must be a PostgreSQL connection URL"),
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_ISSUER_URL: z.string().url(),
  OBJECT_STORAGE_ENDPOINT: z.string().url(),
  OBJECT_STORAGE_REGION: z.string().min(1),
  OBJECT_STORAGE_BUCKET: z.string().min(1),
  OBJECT_STORAGE_ACCESS_KEY_ID: z.string().min(1),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  CORS_ALLOWED_ORIGINS: originList,
  RATE_LIMIT_REDIS_URL: z.string().url().refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "redis:" || protocol === "rediss:";
  }, "must use redis or rediss protocol"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]),
  APP_BASE_URL: z.string().url(),
});

export type AppConfig = z.infer<typeof envSchema>;

export class ConfigValidationError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Invalid environment configuration:\n${problems.map((problem) => `- ${problem}`).join("\n")}`);
    this.name = "ConfigValidationError";
    this.problems = problems;
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const key = issue.path.length > 0 ? issue.path.join(".") : "environment";
      return `${key}: ${issue.message}`;
    });
    throw new ConfigValidationError(problems);
  }

  return result.data;
}

export function allowedOrigins(config: AppConfig): string[] {
  return config.CORS_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim());
}
