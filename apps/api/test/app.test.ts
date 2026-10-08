import { Router } from "express";
import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { AppConfig } from "../src/config/env.js";
import { createApp } from "../src/app.js";

const config = {
  NODE_ENV: "test",
  PORT: 4000,
  DATABASE_URL: "postgresql://atlas:atlas@localhost:5432/atlas",
  CLERK_SECRET_KEY: "sk_test_replace-me",
  CLERK_PUBLISHABLE_KEY: "pk_test_replace-me",
  CLERK_ISSUER_URL: "https://clerk.example.invalid",
  OBJECT_STORAGE_ENDPOINT: "https://s3.example.invalid",
  OBJECT_STORAGE_REGION: "us-east-1",
  OBJECT_STORAGE_BUCKET: "atlas-private",
  OBJECT_STORAGE_ACCESS_KEY_ID: "replace-me",
  OBJECT_STORAGE_SECRET_ACCESS_KEY: "replace-me",
  CORS_ALLOWED_ORIGINS: "http://localhost:3000,https://atlas.example.invalid",
  RATE_LIMIT_REDIS_URL: "redis://localhost:6379",
  LOG_LEVEL: "silent",
  APP_BASE_URL: "http://localhost:3000",
} satisfies AppConfig;

function makeApp(options: {
  readinessCheck?: () => Promise<void>;
  rateLimitOverride?: { windowMs: number; limit: number };
  testRoutes?: Router;
} = {}) {
  return createApp({
    config,
    logger: pino({ level: "silent" }),
    version: "1.0.0",
    readinessCheck: options.readinessCheck ?? (async () => undefined),
    rateLimitOverride: options.rateLimitOverride,
    testRoutes: options.testRoutes,
  });
}

describe("operational API", () => {
  it("GET /health returns the documented shape and status", async () => {
    const response = await request(makeApp()).get("/health").expect(200);
    expect(response.body).toEqual({
      status: "ok",
      version: "1.0.0",
      uptime_seconds: expect.any(Number),
    });
  });

  it("GET /ready returns 200 when the injected database check succeeds", async () => {
    const response = await request(makeApp({ readinessCheck: async () => undefined })).get("/ready").expect(200);
    expect(response.body).toEqual({
      status: "ready",
      checks: { database: "reachable", storage: "not_configured" },
    });
  });

  it("GET /ready returns 503 when the injected database check fails", async () => {
    const response = await request(makeApp({ readinessCheck: async () => { throw new Error("db offline"); } }))
      .get("/ready")
      .expect(503);
    expect(response.body).toEqual({
      status: "not_ready",
      checks: { database: "unavailable", storage: "not_configured" },
    });
  });

  it("sets X-Request-Id on responses and echoes a valid UUID", async () => {
    const supplied = "a2e79f18-55bb-4b55-9863-4e053d521633";
    const response = await request(makeApp()).get("/health").set("X-Request-Id", supplied).expect(200);
    expect(response.headers["x-request-id"]).toBe(supplied);
  });

  it("replaces an invalid incoming request ID", async () => {
    const response = await request(makeApp()).get("/health").set("X-Request-Id", "not-a-uuid").expect(200);
    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(response.headers["x-request-id"]).not.toBe("not-a-uuid");
  });

  it("returns the shared error envelope for unknown routes", async () => {
    const response = await request(makeApp()).get("/missing").expect(404);
    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        details: {},
        request_id: response.headers["x-request-id"],
      },
    });
  });

  it("returns VALIDATION_FAILED for malformed JSON", async () => {
    const response = await request(makeApp())
      .post("/health")
      .set("Content-Type", "application/json")
      .send("{bad json")
      .expect(400);
    expect(response.body.error).toMatchObject({
      code: "VALIDATION_FAILED",
      request_id: response.headers["x-request-id"],
      details: {},
    });
    expect(response.body.error.message).toBe("Malformed JSON request body");
  });

  it("returns INTERNAL without leaking a thrown error stack", async () => {
    const routes = Router();
    routes.get("/__test/error", () => { throw new Error("private implementation detail"); });
    const response = await request(makeApp({ testRoutes: routes })).get("/__test/error").expect(500);
    expect(response.body).toEqual({
      error: {
        code: "INTERNAL",
        message: "Internal server error",
        details: {},
        request_id: response.headers["x-request-id"],
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("private implementation detail");
    expect(JSON.stringify(response.body)).not.toContain("stack");
  });

  it("allows configured CORS origins", async () => {
    const response = await request(makeApp()).get("/health").set("Origin", "http://localhost:3000").expect(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("rejects unlisted origins without granting CORS access", async () => {
    const response = await request(makeApp()).get("/health").set("Origin", "https://attacker.example").expect(403);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.body.error).toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns RATE_LIMITED in the error envelope when the IP limit is exceeded", async () => {
    const app = makeApp({ rateLimitOverride: { windowMs: 60_000, limit: 1 } });
    await request(app).get("/health").expect(200);
    const response = await request(app).get("/health").expect(429);
    expect(response.body).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "Request rate limit exceeded",
        details: {},
        request_id: response.headers["x-request-id"],
      },
    });
  });
});
