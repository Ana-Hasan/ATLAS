import { Router } from "express";

export type ReadinessResult = "reachable" | "unavailable";
export type ReadinessCheck = () => Promise<void>;

export function createProbeRouter(version: string, readinessCheck: ReadinessCheck): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      version,
      uptime_seconds: process.uptime(),
    });
  });

  router.get("/ready", async (req, res) => {
    try {
      await readinessCheck();
      res.status(200).json({
        status: "ready",
        checks: { database: "reachable", storage: "not_configured" },
      });
    } catch {
      req.log?.warn({ request_id: req.id }, "Database readiness probe failed");
      res.status(503).json({
        status: "not_ready",
        checks: { database: "unavailable", storage: "not_configured" },
      });
    }
  });

  return router;
}
