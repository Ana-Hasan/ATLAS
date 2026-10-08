import { describe, expect, it } from "vitest";
import { ConfigValidationError, loadConfig } from "../src/config/env.js";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

describe("environment configuration", () => {
  it("reports every missing variable without exposing supplied secret values", () => {
    const privateValue = "do-not-print-this-secret-value";
    try {
      loadConfig({ CLERK_SECRET_KEY: privateValue } as NodeJS.ProcessEnv);
      throw new Error("Expected invalid config to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      const message = (error as Error).message;
      for (const name of [
        "NODE_ENV", "PORT", "DATABASE_URL", "CLERK_PUBLISHABLE_KEY", "CLERK_ISSUER_URL",
        "OBJECT_STORAGE_ENDPOINT", "OBJECT_STORAGE_REGION", "OBJECT_STORAGE_BUCKET",
        "OBJECT_STORAGE_ACCESS_KEY_ID", "OBJECT_STORAGE_SECRET_ACCESS_KEY", "CORS_ALLOWED_ORIGINS",
        "RATE_LIMIT_REDIS_URL", "LOG_LEVEL", "APP_BASE_URL",
      ]) {
        expect(message).toContain(name);
      }
      expect(message).not.toContain(privateValue);
    }
  });

  it("fails API startup with every missing name and no secret value", () => {
    const apiDirectory = fileURLToPath(new URL("../", import.meta.url));
    const result = spawnSync(process.execPath, ["--import", "tsx", "src/server.ts"], {
      cwd: resolve(apiDirectory),
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
      },
      encoding: "utf8",
      timeout: 10_000,
    });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

    expect(result.status).toBe(1);
    for (const name of ["NODE_ENV", "DATABASE_URL", "CLERK_SECRET_KEY", "CORS_ALLOWED_ORIGINS", "APP_BASE_URL"]) {
      expect(output).toContain(name);
    }
    expect(output).not.toMatch(/sk_(test|live)_[A-Za-z0-9]+/);
  });

  it("rejects wildcard CORS origins", () => {
    expect(() => loadConfig({
      NODE_ENV: "test",
      PORT: "4000",
      DATABASE_URL: "postgresql://atlas:atlas@localhost:5432/atlas",
      CLERK_SECRET_KEY: "sk_test_example",
      CLERK_PUBLISHABLE_KEY: "pk_test_example",
      CLERK_ISSUER_URL: "https://clerk.example.invalid",
      OBJECT_STORAGE_ENDPOINT: "https://s3.example.invalid",
      OBJECT_STORAGE_REGION: "us-east-1",
      OBJECT_STORAGE_BUCKET: "atlas-private",
      OBJECT_STORAGE_ACCESS_KEY_ID: "example",
      OBJECT_STORAGE_SECRET_ACCESS_KEY: "example",
      CORS_ALLOWED_ORIGINS: "*",
      RATE_LIMIT_REDIS_URL: "redis://localhost:6379",
      LOG_LEVEL: "silent",
      APP_BASE_URL: "http://localhost:3000",
    } as NodeJS.ProcessEnv)).toThrow(ConfigValidationError);
  });
});
