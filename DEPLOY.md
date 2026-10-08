# Deployment Checklist

Deploy the API on Railway and the web app on Vercel. Do not deploy from CI. Complete the steps in order so the API CORS allowlist contains the final Vercel production origin.

## 1. Create the Railway project and PostgreSQL

1. Create a Railway project from the Atlas GitHub repository.
2. Add the Railway PostgreSQL plugin to the project.
3. Confirm the plugin provides a private connection URL. Map that URL to `DATABASE_URL` on the API service in the next section.

## 2. Create the Railway API service

1. Add a service from the same repository.
2. Set the service root directory to the repository root: `.`. The pnpm workspace and `pnpm-lock.yaml` live there.
3. Set the install command to `pnpm install --frozen-lockfile`.
4. Set the build command to `pnpm --filter @atlas/api build`.
5. Set the start command to `pnpm --filter @atlas/api start`.
6. Set the health check path to `/health`.
7. Set the API service variables by name. Use Railway's Postgres connection value for `DATABASE_URL`; use secret values for credentials. Do not paste secrets into this file or source control.

   - `NODE_ENV`
   - `PORT`
   - `DATABASE_URL`
   - `CLERK_SECRET_KEY`
   - `CLERK_PUBLISHABLE_KEY`
   - `CLERK_ISSUER_URL`
   - `OBJECT_STORAGE_ENDPOINT`
   - `OBJECT_STORAGE_REGION`
   - `OBJECT_STORAGE_BUCKET`
   - `OBJECT_STORAGE_ACCESS_KEY_ID`
   - `OBJECT_STORAGE_SECRET_ACCESS_KEY`
   - `CORS_ALLOWED_ORIGINS`
   - `RATE_LIMIT_REDIS_URL`
   - `LOG_LEVEL`
   - `APP_BASE_URL`

   All listed values must be present and valid for the API process to start. For the initial deployment, set `CORS_ALLOWED_ORIGINS` to any temporary exact HTTPS origin; step 4 replaces it with the Vercel production URL. Chunk 1 does not connect Clerk, object storage, or Redis. The rate limiter uses its in-process store. The `RATE_LIMIT_REDIS_URL` is reserved for a later distributed store; configure a syntactically valid Redis URL if required by validation, but no Redis service is needed for this chunk.
8. Deploy the service and wait for `/health` to pass. The API process uses the Railway-provided `PORT`.

## 3. Create the Vercel web project

1. Import the same GitHub repository as a new Vercel project.
2. Set Root Directory to `apps/web` and select the Next.js framework preset.
3. Use the default pnpm install and Next.js build commands detected by Vercel. If commands are requested explicitly, use `pnpm install --frozen-lockfile` at the workspace root and `pnpm --filter @atlas/web build` for the build.
4. Add `NEXT_PUBLIC_API_BASE_URL` to the Vercel Production environment. Set it to the Railway API's public origin, without a trailing slash or `/api/v1` suffix, because `/health` and `/ready` are unversioned.
5. Deploy the project and record its production HTTPS origin, for example `https://atlas.example.com`.

## 4. Set the API CORS allowlist

1. Return to the Railway API service variables.
2. Set `CORS_ALLOWED_ORIGINS` to the exact Vercel production origin, including scheme and host and with no path or trailing slash. For example: `https://atlas.example.com`.
3. If a separate Vercel preview origin must call the production API, add that exact HTTPS origin as a comma-separated entry. Do not use `*`.
4. Set `APP_BASE_URL` to the Vercel production origin.
5. Redeploy the API so the new allowlist is active.

## 5. Verify the deployment

1. Open `https://<railway-api-host>/health`. Confirm HTTP 200 and JSON fields `status`, `version`, and `uptime_seconds`.
2. Open `https://<railway-api-host>/ready`. Confirm HTTP 200 and `checks.database=reachable`; `checks.storage` is `not_configured` in Chunk 1.
3. Open the Vercel production URL. Confirm the status page loads and reports the API and database checks as operational.
4. Confirm browser requests go to the Railway host from `NEXT_PUBLIC_API_BASE_URL` and receive `X-Request-Id`.
5. In browser developer tools, verify that an unlisted origin does not receive `Access-Control-Allow-Origin`.
6. Confirm GitHub Actions passed lint, typecheck, test, and build. CI does not deploy either service.

## Rollback

- **Railway:** Open the API service deployment history, select the last healthy deployment, and use Railway's rollback/redeploy action. Keep the previous healthy deployment available until `/health` and `/ready` pass after the rollback.
- **Vercel:** Open the project's Deployments, select the last healthy production deployment, and promote it to Production. Verify the status page and API checks again.

Chunk 1 has no database migrations. Later chunks must use backward-compatible expand/contract migrations and document any database rollback constraints before release.
