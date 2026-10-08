import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StatusPage from "../app/page";

const health = { status: "ok", version: "1.0.0", uptime_seconds: 63 };
const ready = { status: "ready", checks: { database: "reachable", storage: "not_configured" } };

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("status page", () => {
  it("renders the loading state while probes are pending", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.invalid");
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    render(<StatusPage />);
    expect(screen.getByText("Checking platform health")).toBeInTheDocument();
    expect(screen.getAllByText("Checking").length).toBeGreaterThan(0);
  });

  it("renders the healthy state and probe details", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.invalid");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const body = String(input).endsWith("/health") ? health : ready;
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    render(<StatusPage />);
    expect(await screen.findByText("All systems operational")).toBeInTheDocument();
    expect(screen.getByText("1.0.0")).toBeInTheDocument();
    expect(screen.getByText("Reachable")).toBeInTheDocument();
    expect(screen.getByText("Not configured")).toBeInTheDocument();
  });

  it("renders the error state when the API cannot be reached", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.invalid");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    render(<StatusPage />);
    expect(await screen.findByText("Service interruption detected")).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Could not reach the API. Check the service and try again.").length).toBe(2);
  });
});
