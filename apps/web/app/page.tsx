"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type CheckState = "loading" | "ok" | "error";

type HealthPayload = {
  status?: string;
  version?: string;
  uptime_seconds?: number;
};

type ReadinessPayload = {
  status?: string;
  checks?: {
    database?: string;
    storage?: string;
  };
};

type Probe<T> = {
  state: CheckState;
  payload?: T;
  message?: string;
};

const emptyProbe = <T,>(): Probe<T> => ({ state: "loading" });

function apiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/$/, "");
}

async function checkEndpoint<T>(url: string): Promise<Probe<T>> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    const payload = (await response.json()) as T;

    if (!response.ok) {
      return {
        state: "error",
        payload,
        message: response.status === 503 ? "A dependency is unavailable." : `Request failed (${response.status}).`,
      };
    }

    return { state: "ok", payload };
  } catch {
    return { state: "error", message: "Could not reach the API. Check the service and try again." };
  } finally {
    window.clearTimeout(timeout);
  }
}

function StatusDot({ state }: { state: CheckState }) {
  return <span aria-hidden="true" className={`status-dot status-dot--${state}`} />;
}

function StateLabel({ state }: { state: CheckState }) {
  const label = state === "loading" ? "Checking" : state === "ok" ? "Operational" : "Unavailable";
  return (
    <span className={`state-label state-label--${state}`}>
      <StatusDot state={state} />
      {label}
    </span>
  );
}

function formatUptime(seconds?: number) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.floor(seconds);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m ${total % 60}s`;
}

export default function StatusPage() {
  const [health, setHealth] = useState<Probe<HealthPayload>>(() => emptyProbe<HealthPayload>());
  const [readiness, setReadiness] = useState<Probe<ReadinessPayload>>(() => emptyProbe<ReadinessPayload>());
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    const base = apiBaseUrl();
    setRefreshing(true);

    if (!base) {
      const error = { state: "error" as const, message: "Set NEXT_PUBLIC_API_BASE_URL to connect Atlas." };
      setHealth(error);
      setReadiness(error);
      setLastChecked(new Date());
      setRefreshing(false);
      return;
    }

    setHealth(emptyProbe<HealthPayload>());
    setReadiness(emptyProbe<ReadinessPayload>());
    const [healthResult, readinessResult] = await Promise.all([
      checkEndpoint<HealthPayload>(`${base}/health`),
      checkEndpoint<ReadinessPayload>(`${base}/ready`),
    ]);
    setHealth(healthResult);
    setReadiness(readinessResult);
    setLastChecked(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const platformState: CheckState =
    health.state === "loading" || readiness.state === "loading"
      ? "loading"
      : health.state === "ok" && readiness.state === "ok"
        ? "ok"
        : "error";

  const checkedLabel = useMemo(() => {
    if (!lastChecked) return "Waiting for first check";
    return `Last checked ${new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }).format(lastChecked)}`;
  }, [lastChecked]);

  const db = readiness.payload?.checks?.database;
  const storage = readiness.payload?.checks?.storage;

  return (
    <main className="status-shell">
      <aside className="rail" aria-label="Atlas">
        <a className="brand" href="#overview" aria-label="Atlas status home">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>
          <span className="brand-name">atlas</span>
        </a>
        <div className="rail-divider" />
        <div className="rail-section-label">PLATFORM</div>
        <a className="rail-link rail-link--active" href="#overview" aria-current="page">
          <span className="rail-icon" aria-hidden="true">◉</span>
          <span>Status</span>
        </a>
        <div className="rail-bottom">
          <span className="rail-live-dot" />
          <span>System monitor</span>
        </div>
      </aside>

      <div className="main-column" id="overview">
        <header className="topbar">
          <div className="breadcrumb"><span>Atlas</span><span className="crumb-slash">/</span><strong>Status</strong></div>
          <div className="topbar-meta"><span className="environment-dot" />Service monitor</div>
        </header>

        <div className="page-content">
          <section className="intro">
            <div>
              <div className="eyebrow">PLATFORM HEALTH</div>
              <h1>System status</h1>
              <p className="intro-copy">A live view of Atlas availability and service readiness.</p>
            </div>
            <button className="refresh-button" onClick={() => void refresh()} disabled={refreshing}>
              <svg className={refreshing ? "refresh-icon is-spinning" : "refresh-icon"} viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M16.1 8.1A6.4 6.4 0 0 0 4.2 6.3L3 7.5M3 7.5V4.1M3 7.5h3.4M3.9 11.9a6.4 6.4 0 0 0 11.9 1.8l1.2-1.2m0 0v3.4m0-3.4h-3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{refreshing ? "Checking" : "Refresh"}</span>
            </button>
          </section>

          <section className={`overall-card overall-card--${platformState}`} aria-live="polite">
            <div className="overall-symbol">
              {platformState === "ok" ? (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 12.5 3.2 3.2L17.5 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" /></svg>
              ) : platformState === "loading" ? (
                <span className="loading-ring" aria-hidden="true" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 8v5m0 3h.01M10.3 4.9 2.8 18a1.5 1.5 0 0 0 1.3 2.2h15.8a1.5 1.5 0 0 0 1.3-2.2L13.7 4.9a2 2 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
            </div>
            <div className="overall-copy">
              <div className="overall-kicker">CURRENT STATUS</div>
              <h2>{platformState === "ok" ? "All systems operational" : platformState === "loading" ? "Checking platform health" : "Service interruption detected"}</h2>
              <p>{platformState === "ok" ? "Atlas services are responding normally." : platformState === "loading" ? "Connecting to the Atlas API and checking dependencies." : "One or more services could not be reached. Details are below."}</p>
            </div>
            <div className="overall-time">{checkedLabel}</div>
          </section>

          <section className="section-heading">
            <div>
              <h2>Services</h2>
              <p>Live checks from the Atlas API</p>
            </div>
            <span className="refresh-cadence"><span className="pulse-dot" />On demand</span>
          </section>

          <section className="service-grid" aria-label="Service checks">
            <article className="service-card">
              <div className="service-card-top">
                <span className="service-icon service-icon--black" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M4 12h4l2.1-6 3.8 12 2.1-6H20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <StateLabel state={health.state} />
              </div>
              <div className="service-title-row"><h3>API</h3><span className="service-path">/health</span></div>
              <p className="service-description">Application process and HTTP endpoint.</p>
              <div className="metric-row">
                <div><span className="metric-label">VERSION</span><span className="metric-value">{health.payload?.version ?? "—"}</span></div>
                <div><span className="metric-label">UPTIME</span><span className="metric-value">{formatUptime(health.payload?.uptime_seconds)}</span></div>
              </div>
              {health.message && <p className="service-error">{health.message}</p>}
            </article>

            <article className="service-card">
              <div className="service-card-top">
                <span className="service-icon service-icon--outline" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none"><ellipse cx="12" cy="5.5" rx="7.5" ry="3" stroke="currentColor" strokeWidth="1.5" /><path d="M4.5 5.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6M4.5 11.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6" stroke="currentColor" strokeWidth="1.5" /></svg>
                </span>
                <StateLabel state={readiness.state} />
              </div>
              <div className="service-title-row"><h3>Dependencies</h3><span className="service-path">/ready</span></div>
              <p className="service-description">Database connectivity and storage availability.</p>
              <div className="dependency-list">
                <div className="dependency-row"><span className="dependency-name"><span className={`mini-dot ${db === "reachable" ? "mini-dot--ok" : db === "unavailable" ? "mini-dot--error" : "mini-dot--muted"}`} />Database</span><span className="dependency-state">{db === "reachable" ? "Reachable" : db === "unavailable" ? "Unavailable" : readiness.state === "loading" ? "Checking" : "Unknown"}</span></div>
                <div className="dependency-row"><span className="dependency-name"><span className="mini-dot mini-dot--muted" />Object storage</span><span className="dependency-state">{storage === "not_configured" ? "Not configured" : storage ?? "—"}</span></div>
              </div>
              {readiness.message && <p className="service-error">{readiness.message}</p>}
            </article>
          </section>

          <section className="info-strip">
            <span className="info-icon" aria-hidden="true">i</span>
            <p><strong>About these checks</strong><span>The health check confirms the API process is running. Readiness checks the database separately; object storage is not configured in this deployment.</span></p>
          </section>

          <footer className="page-footer"><span>ATLAS PLATFORM</span><span>Operational overview</span></footer>
        </div>
      </div>
    </main>
  );
}
