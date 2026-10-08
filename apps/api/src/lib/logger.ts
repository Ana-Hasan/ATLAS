import pino, { type Logger } from "pino";

export function createLogger(level: string): Logger {
  return pino({
    level,
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie", "*.CLERK_SECRET_KEY", "*.OBJECT_STORAGE_SECRET_ACCESS_KEY"],
      censor: "[REDACTED]",
    },
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
