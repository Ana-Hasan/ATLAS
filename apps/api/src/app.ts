import cors from "cors";
import express, { type Express, type Router } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { createRequire } from "node:module";
import type { Logger } from "pino";
import type { AppConfig } from "./config/env.js";
import { allowedOrigins } from "./config/env.js";
import { ApiError, errorHandler, errorPayload, notFoundHandler } from "./middleware/errors.js";
import { requestId } from "./middleware/request-id.js";
import { createProbeRouter, type ReadinessCheck } from "./routes/probes.js";

const require = createRequire(import.meta.url);
const pinoHttp = require("pino-http") as (
  options: import("pino-http").Options<import("express").Request, import("express").Response>,
) => import("pino-http").HttpLogger<import("express").Request, import("express").Response>;

type AppOptions = {
  config: AppConfig;
  logger: Logger;
  readinessCheck: ReadinessCheck;
  version: string;
  rateLimitOverride?: { windowMs: number; limit: number };
  testRoutes?: Router;
};

export function createApp(options: AppOptions): Express {
  const app = express();
  app.set("trust proxy", 1);

  app.use(requestId);
  app.use(pinoHttp({
    logger: options.logger,
    genReqId: (req) => (req as typeof req & { requestId: string }).requestId,
    customProps: (req) => ({ request_id: (req as typeof req & { requestId: string }).requestId }),
    serializers: {
      req: (req) => ({ method: req.method, request_id: (req as typeof req & { requestId: string }).requestId }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }));
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins(options.config).includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new ApiError(403, "FORBIDDEN", "Origin is not allowed"));
    },
    credentials: true,
    optionsSuccessStatus: 204,
  }));
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(rateLimit({
    windowMs: options.rateLimitOverride?.windowMs ?? 60_000,
    limit: options.rateLimitOverride?.limit ?? 120,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler(req, res) {
      res.status(429).json(errorPayload("RATE_LIMITED", "Request rate limit exceeded", req.requestId));
    },
  }));

  app.use(createProbeRouter(options.version, options.readinessCheck));
  if (options.testRoutes) app.use(options.testRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler(options.logger));
  return app;
}
