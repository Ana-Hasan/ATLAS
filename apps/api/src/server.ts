import { createServer } from "node:http";
import { Pool } from "pg";
import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { createLogger } from "./lib/logger.js";

function start(): void {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid environment configuration");
    process.exitCode = 1;
    return;
  }

  const logger = createLogger(config.LOG_LEVEL);
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    connectionTimeoutMillis: 1_000,
    max: 5,
  });
  const app = createApp({
    config,
    logger,
    version: process.env.npm_package_version ?? "1.0.0",
    readinessCheck: async () => {
      await pool.query("SELECT 1");
    },
  });
  const server = createServer(app);

  server.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "Atlas API listening");
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Graceful shutdown started");
    const forceClose = setTimeout(() => {
      logger.error({ signal }, "Graceful shutdown timed out; closing remaining connections");
      server.closeAllConnections();
    }, 30_000);
    forceClose.unref();

    server.close((error) => {
      clearTimeout(forceClose);
      void pool.end().then(() => {
        if (error) {
          logger.error({ err: error, signal }, "HTTP server shutdown failed");
          process.exitCode = 1;
          return;
        }
        logger.info({ signal }, "Graceful shutdown complete");
      }).catch((poolError: unknown) => {
        logger.error({ err: poolError, signal }, "Database pool shutdown failed");
        process.exitCode = 1;
      });
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start();
