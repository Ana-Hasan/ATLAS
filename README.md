# Atlas

Atlas is a spec-driven property transaction orchestration platform for India. This repository contains the Next.js web app, Express API, and shared TypeScript workspace package.

## Run locally

Use Node.js `24.21.0` and pnpm `11.19.0`. From the repository root, copy the API and web example files to local environment files, then start PostgreSQL and both apps:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
docker compose up -d postgres
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The API listens on port `4000`. Local API checks require PostgreSQL; set the `DATABASE_URL` in `apps/api/.env` to the local compose database. Example Clerk and object storage values are validation-only until those integrations are implemented.

Run either app individually from the repository root:

```powershell
pnpm --filter @atlas/api dev
pnpm --filter @atlas/web dev
```

## Quality commands

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Folder map

- `apps/api`: Express API, environment validation, operational probes, middleware, and API tests.
- `apps/web`: Next.js App Router status page and UI smoke test.
- `packages/shared`: shared TypeScript package placeholder.
- `docs`: frozen product, API, state-machine, data, and build specifications.
- `.github/workflows/ci.yml`: pull request and main branch checks.
- `DEPLOY.md`: ordered Railway and Vercel deployment checklist.
