# Build Plan

Each chunk implements only its listed scope. Tests named by an acceptance scenario must pass before the chunk is complete. Contracts are frozen; propose changes separately.

## Chunk 1: skeleton + deploy

- **Goal:** Create pnpm monorepo, strict TypeScript, API probes, status page, CI, local Postgres option, and deploy instructions.
- **Spec IDs:** BR-29, AC-18, AC-21; NFR-01 through NFR-14 and API conventions.
- **Dependencies:** None.
- **Expected files:** workspace manifests/configs; `apps/api` health/readiness, middleware, tests; `apps/web` status page; `packages/shared`; CI workflow; `.env.example`; `.gitignore`; `docker-compose.yml`; README; DEPLOY guide.
- **Acceptance scenarios:** AC-18, AC-21.
- **Do NOT do:** Auth integration, Clerk SDK, ORM, migrations, tables, business endpoints, roles, storage integration, extra UI, docs changes.

## Chunk 2: database + migrations + seed

- **Goal:** Add PostgreSQL schema, Prisma migrations, constraints, append-only event protection, and synthetic canonical seed data.
- **Spec IDs:** BR-01, BR-02, BR-14, BR-18, BR-19, BR-22, BR-24, BR-27, AC-12, AC-13, AC-24.
- **Dependencies:** Chunk 1.
- **Expected files:** Prisma schema and migrations; seed script; database setup documentation outside `docs/` only if needed by SPEC.
- **Acceptance scenarios:** AC-12, AC-13, AC-24.
- **Do NOT do:** Auth flow, workflow engine, business UI, external storage, real personal data in seeds.

## Chunk 3: auth + roles

- **Goal:** Integrate Clerk; create local user upsert; enforce local role authority; implement profile, exact email lookup, broker claim, and CLI ADMIN promotion.
- **Spec IDs:** BR-25, BR-26, P-01, P-02, AC-17, AC-18.
- **Dependencies:** Chunks 1–2.
- **Expected files:** API auth/config/middleware/routes/services; user tests; env docs outside `docs/`.
- **Acceptance scenarios:** AC-17, AC-18.
- **Do NOT do:** Trust token role claims, invite flows, user directory search, multiple roles per user, admin promotion endpoint.

## Chunk 4: property passport

- **Goal:** Implement property creation, search/read, address deduplication, derived workflow status, and passport visibility.
- **Spec IDs:** BR-12, BR-18, BR-27, P-03, P-04, AC-16, AC-20.
- **Dependencies:** Chunks 1–3.
- **Expected files:** API property routes/services/repository; property tests; passport read UI.
- **Acceptance scenarios:** AC-16, AC-20.
- **Do NOT do:** Legal ownership verification, separate stored workflow status, hard delete, buyer deal flow.

## Chunk 5: transaction engine (backend only)

- **Goal:** Implement pure state-machine module driven by `docs/transitions.yaml`, atomic writes, version checks, idempotency, participant confirmation, broker assignment, and transaction reads.
- **Spec IDs:** T-01 through T-13, BR-01 through BR-10, BR-19 through BR-23, P-05 through P-08, AC-01 through AC-13.
- **Dependencies:** Chunks 1–4.
- **Expected files:** API transaction routes/services; pure engine module; YAML loader/validation; transactional repositories; state and concurrency tests.
- **Acceptance scenarios:** AC-01, AC-03, AC-04, AC-05, AC-07 through AC-13.
- **Do NOT do:** Frontend buyer flow, document binary storage, stage transitions not in YAML, automatic expiry, backward transitions.

## Chunk 6: buyer flow UI

- **Goal:** Build buyer property selection, deal creation, tracker, pending action, optional loan choice, simulated payment, and registration progress screens.
- **Spec IDs:** BR-03, BR-06, BR-09, BR-16, BR-30, P-05, P-06.
- **Dependencies:** Chunks 1–5.
- **Expected files:** `apps/web` buyer routes/components/data client and UI tests.
- **Acceptance scenarios:** AC-03 through AC-10, AC-13.
- **Do NOT do:** Client-side database access, client-authored stage changes, real payments, seller/admin portal.

## Chunk 7: document vault

- **Goal:** Implement backend-proxied upload, type/size/checksum validation, private storage, authorization-checked signed downloads, manual verification, and replacement chain.
- **Spec IDs:** BR-11 through BR-15, BR-35, P-09 through P-12, AC-02, AC-06, AC-14, AC-15, AC-19, AC-23.
- **Dependencies:** Chunks 1–5.
- **Expected files:** API document routes/storage adapter; storage configuration; upload/download/verification tests; buyer/seller upload UI.
- **Acceptance scenarios:** AC-02, AC-06, AC-14, AC-15, AC-19, AC-21, AC-23.
- **Do NOT do:** Public buckets, signed direct uploads, Aadhaar OCR/number extraction, file overwrite, automatic government verification.

## Chunk 8: seller and broker portals

- **Goal:** Build seller confirmation/document tasks and broker attachment confirmation/deal tracking with row-level filtering.
- **Spec IDs:** BR-04, BR-05, P-05, P-07, P-08, P-11, AC-01, AC-16.
- **Dependencies:** Chunks 1–7.
- **Expected files:** `apps/web` seller and broker routes/components/data client and UI tests.
- **Acceptance scenarios:** AC-01, AC-15, AC-16.
- **Do NOT do:** Broker listings, invitations, viewing unattached transactions, cancellation by broker.

## Chunk 9: admin dashboard

- **Goal:** Build document verification queue, transaction oversight/inactive filter, assignment/property correction, broker provisioning, and completion/cancellation controls.
- **Spec IDs:** BR-20, BR-21, P-12, P-14 through P-16, T-07 through T-13, AC-06 through AC-08, AC-22.
- **Dependencies:** Chunks 1–8.
- **Expected files:** API admin routes/services if unfinished; `apps/web` admin routes/components; admin tests.
- **Acceptance scenarios:** AC-06, AC-07, AC-08, AC-22.
- **Do NOT do:** ADMIN self-service promotion, automatic stale-deal cancellation, unlogged corrections, real payment operations.

## Chunk 10: notifications

- **Goal:** Persist notification rows per specified recipient/event and expose list/read operations with caller-only access.
- **Spec IDs:** BR-31, BR-32, P-13, T-01 through T-13.
- **Dependencies:** Chunks 1–9.
- **Expected files:** API notification routes/services; notification UI; delivery and authorization tests.
- **Acceptance scenarios:** AC-01, AC-05, AC-06, AC-07, AC-22.
- **Do NOT do:** Email, SMS, push, duplicate recipient rows, separate persisted pending_action.

## Chunk 11: hardening and end-to-end test

- **Goal:** Verify all role boundaries, error contracts, rate limits, data privacy, performance/recovery targets, and full workflows; address defects without changing contracts.
- **Spec IDs:** BR-07 through BR-35, P-01 through P-17, AC-01 through AC-24, NFR-01 through NFR-14.
- **Dependencies:** Chunks 1–10.
- **Expected files:** E2E/security/performance tests, operational runbooks, CI refinements, deployment configuration.
- **Acceptance scenarios:** AC-01 through AC-24.
- **Do NOT do:** Spec changes without a separate versioned proposal; real payments; legal/government integrations; unapproved scope additions.
