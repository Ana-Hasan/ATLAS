# Decisions

This register records the defaults, Phase A answers, explicit overrides, and additional binding choices. Version 1.0.0 is the initial contract.

## Product and data decisions

| ID | Decision | Choice | Reason | Alternatives rejected |
|---|---|---|---|---|
| D-01 | Implementation language | TypeScript for frontend and backend. | One language and strict contracts across layers. | JavaScript, separate languages. |
| D-02 | API and frontend stack | Next.js App Router; Node.js with Express; PostgreSQL. | Proposed product stack. | Different frontend, API, or database platform. |
| D-03 | ORM and migrations | Prisma and Prisma migrations. | Default decision; typed database access and tracked migrations. | Raw SQL-only migration workflow, other ORM. |
| D-04 | Primary keys and time | UUID IDs; UTC timestamps in DB and API; frontend handles IST display. | Stable identifiers and consistent time semantics. | Local-time persistence, numeric IDs. |
| D-05 | Authentication | Clerk authenticates. Backend reads role from local `users` row on every request; token/client role claims are ignored. | Local role is authoritative and auditable. | Role authorization from client or token claims. |
| D-06 | Platform roles | One platform role per user: BUYER, SELLER, BROKER, or ADMIN. Future transaction-scoped roles are a proposed addition. | Binding Phase A choice. | Multiple simultaneous platform roles. |
| D-07 | Seller and buyer accounts | Participants must have accounts. Exact verified email lookup only; no invitations. | Binding Phase A choice. | Email invitation flow or searchable directory. |
| D-08 | Broker provisioning | ADMIN provisions normalized email and display name; ID format `BRK-XXXXXX`; verified-email registration claims provision. | Broker IDs must be unique and brokers are not self-created. | Open broker registration. |
| D-09 | ADMIN provisioning | Only `promote-admin <email>` CLI script can promote an ADMIN. No API promotion. | Limits privilege escalation surface. | Public or admin API promotion. |
| D-10 | Deal participants | Exactly one buyer, exactly one seller, optional one broker; buyer and seller differ. | Binding default and Phase A answers. | Multiple buyers, sellers, or brokers. |
| D-11 | Property passport | One permanent property row can have multiple transactions. Current owner is a recorded claim, not legal verification. COMPLETED sets owner to buyer. | Defines ownership update without implying legal authority. | Atlas certification of title. |
| D-12 | Property deduplication | Normalized lowercase, whitespace-collapsed address + pincode + unit key; unique among non-deleted properties. | Avoid duplicate passports. | No uniqueness or fuzzy match. |
| D-13 | Property workflow state | Derived from active transaction stage; `NONE` without active deal. No separate persisted property status. | Prevents drift. | Duplicated mutable property status. |
| D-14 | Active transaction constraint | Partial unique index on `property_id` where stage is nonterminal. | Enforces one active transaction at database level. | Application-only check. |
| D-15 | Stage model | `INITIATED`, `KYC`, `DOCUMENTS`, optional `LOAN_REQUESTED`, `PAYMENT`, `REGISTRATION`, terminal `COMPLETED` and `CANCELLED`. Confirmation is participant data, not a stage. | Resolves narrative/diagram mismatch and accepted Phase A override. | Separate `PARTICIPANTS_CONFIRMED` stage. |
| D-16 | Optional loan path | Immutable `loan_requested` at creation; DOCUMENTS routes to LOAN_REQUESTED if true, otherwise PAYMENT. Buyer records lender name and reference; no approval. | Minimal optional path. | Bank approval in MVP; changing path mid-deal. |
| D-17 | Transaction status | No status within a stage. Confirmation and document states are their own fields. | Prevents ambiguous duplicated state. | Stored Pending/Verified transaction status. |
| D-18 | Transition authority | `docs/transitions.yaml` is machine-readable source of truth. Automatic changes run as SYSTEM atomically with triggering write; only explicit transitions are client-requestable. | Deterministic engine and replayable acceptance. | Client-driven automatic transitions or duplicated rules. |
| D-19 | Expected stage and version | Stage PATCH carries `expected_from_stage`; transactions have optimistic integer `version` incremented per stage change. | Detects stale writes. | Last-write-wins. |
| D-20 | Cancellation | Buyer/seller can cancel through LOAN_REQUESTED; only ADMIN after PAYMENT begins; ADMIN any active stage; reason enum required and optional note max 500; broker cannot cancel. | Binding Phase A override. | Broker cancellation or unrestricted post-payment cancellation. |
| D-21 | Reopening | No backward transition or reopening in MVP. | No compensation behavior was defined. | Implicit reopen. |
| D-22 | Document types | PAN, AADHAAR, PROPERTY_TAX_RECEIPT, AGREEMENT, REGISTERED_SALE_DEED. Required roles and stages are specified in SPEC.md. | Fixed MVP list. | Unbounded types. |
| D-23 | Document verification | ADMIN manual only; PENDING/VERIFIED/REJECTED; rejected document is immutable and replacement links via `supersedes_document_id`. | Government verification is future scope. | Self-verification or overwrite. |
| D-24 | File validation | PDF/JPEG/PNG, magic-byte validation, max 10 MiB, SHA-256, backend-proxied upload, private S3-compatible storage. | Keeps validation and authorization server-side. | Extension-only validation, public bucket, direct upload URL. |
| D-25 | Aadhaar handling | No Aadhaar number field and no OCR. Aadhaar file only visible to uploading BUYER and ADMIN. | Binding privacy constraint. | Number extraction or wider visibility. |
| D-26 | Payment | Simulated only; `payment_is_simulated=true`; `SIM-` plus eight uppercase alphanumeric reference; no amount. | No money movement in MVP. | Real payment integration or amount record. |
| D-27 | Registration completion | Participant uploads registered deed and records reference; ADMIN verifies deed and explicitly completes. | Makes the ownership update gated and auditable. | Automatic ownership update on upload. |
| D-28 | Events | Append-only events table with DB trigger and no UPDATE/DELETE grant; payload contains IDs and enums only. | Preserves history without copying PII. | Mutable activity log. |
| D-29 | Notifications | Persisted in-app rows, one recipient per notifying event; no external delivery in MVP. | Binding Phase A override. | Email/SMS/push. |
| D-30 | Pending action | Derived pure function of stage, participants, and documents; not stored. | Prevents another source of workflow truth. | Persisted action queue state. |
| D-31 | Idempotency | State-changing POST and stage PATCH use `Idempotency-Key`; 24-hour retention; same request replays status/body; changed body for same actor/route/key returns STAGE_CONFLICT. | Handles safe retries and duplicate writes. | No replay protection or indefinite retention. |
| D-32 | API versioning | Versioned API base `/api/v1`; `/health` and `/ready` are unversioned. | Modifiability and operational probe compatibility. | Original unversioned `/api` paths. |
| D-33 | Pagination | Cursor pagination, default 25, max 100; stable `created_at DESC, id DESC` unless specified. | Bounded list responses. | Offset-only pagination or unbounded lists. |
| D-34 | Error contract | Shared `{error:{code,message,details,request_id}}`; every response has `X-Request-Id`; protected unknown/inaccessible resources return 404. | Consistent client behavior and no existence leaks. | Per-endpoint ad hoc errors or 403 existence leaks. |
| D-35 | Event types | Include required events from Section 9 of SPEC.md plus PROPERTY_UPDATED, DOCUMENT_DELETED, NOTIFICATION_READ. | Captures required operational changes. | Unlogged corrections or access. |
| D-36 | Supporting persistence | Add `notifications`, `broker_provisions`, and `idempotency_records` tables beyond the original deck; the required workflow cannot meet its persistence promises with only original five tables. | Explicit conflict resolution, recorded in SPEC.md CONFLICTS. | Volatile notification/provision/replay state. |
| D-37 | Enums | Use TEXT plus database CHECK constraints. Adding values is non-breaking; removal or reinterpretation is breaking. | Easier compatible extension with explicit checks. | Native database enums. |
| D-38 | Soft deletion | No API hard deletes. Soft-delete/deactivate supported records; event table is never deleted. | Retains audit and passport continuity. | Hard delete. |
| D-39 | Retention | Documents retained until ADMIN processes deletion request; soft-delete file and row and write DOCUMENT_DELETED. No self-service endpoint in MVP. | Binding retention choice and current endpoint cap. | Automatic expiry or unlogged deletion. |
| D-40 | Encryption assumption | Managed DB and object-storage provider encryption at rest; HTTPS for traffic. | Provider-level assumption for the proposed hosting stack. | Atlas-managed encryption key lifecycle in MVP. |
| D-41 | Compliance | Production launch requires legal review of DPDP Act 2023 and Aadhaar handling restrictions. | Compliance must be validated by qualified counsel. | Treating this spec as legal advice. |
| D-42 | Admin stale-deal operation | Admin transaction list supports `inactive_days`; ADMIN cancels manually. Automatic expiry remains future. | Avoids indefinite property lock without defining automated policy. | Unspecified automatic cancellation. |
| D-43 | Node runtime | Pin Node.js major 24 in `.nvmrc` and package `engines`; use current 24.x patch from the Node.js download page at implementation time. | Node 24 is LTS as of the spec date and remains supported through April 2028. | Node 20 (EOL) or Current-only major 26. |
| D-44 | Operational probes | `GET /health` returns `{status:"ok",version,uptime_seconds}`. `GET /ready` returns status and database/storage checks; database failure is 503; storage is `not_configured` in MVP. | Explicitly defines health schemas absent from original SPEC. | Dependency checks in liveness or hidden storage state. |
| D-45 | Spec versioning | Start at 1.0.0; semantic versioning. Breaking means incompatible field/path/enum/permission/transition/error behavior or removal/meaning change. | Enables chunk-by-chunk traceability. | Unversioned spec changes. |
| D-46 | Frontend API origin | `NEXT_PUBLIC_API_BASE_URL` is the environment-supplied public base URL used by the status page and future frontend API client. | Prevents hard-coded API hosts and lets Vercel target the deployed API. | Reusing `APP_BASE_URL`, which names the frontend application's own URL. |

## Phase A response record

| Phase A item | Recorded outcome |
|---|---|
| Assumptions 1–8 and 10–12 | Accepted subject to explicit modifications below. |
| Assumption 9 | Replaced: notifications are persisted in `notifications`; delivery is in-app only. |
| Q1 | Replaced by seven active stages plus terminal CANCELLED; PARTICIPANTS_CONFIRMED removed; loan path selected at creation. |
| Q2 | Accepted; exact required-document rules are in SPEC.md. |
| Q3 | Accepted with role-by-stage cancellation restrictions and reason fields on transaction. |
| Q4 | Replaced with account-required participation, exact email lookup, Broker ID attachment and confirmation, no invitations. |
| Q5 | Accepted with normalized-address deduplication and duplicate response. |
| Q6 | Replaced with local role authority, broker provision claim, CLI-only ADMIN promotion, consent recording. |
| Q7 | Replaced with exact five document types, uploader roles, verification states, upload constraints, and Aadhaar restrictions. |
| Q8 | Accepted with fixed simulated payment reference and no amount. |
| Q9 | Replaced with three-tier property/history/document visibility. |
| Q10 | Replaced with `expected_from_stage`, explicit-only client transition, per-transition data, and idempotency. |
| Q11 | Replaced with backend-proxied multipart upload and authorized signed download URL. |
| Q12 | Replaced with notifications table, exact recipients, and derived `pending_action`. |

## API rate limits

General API: 120 requests/minute per IP and per authenticated user. `POST /auth/register`: 5 requests/hour per IP and user. `GET /users/lookup`: 10 requests/minute per IP and user. Exceeded limits return 429 RATE_LIMITED.

## Health schema and Node pin

`/health` is unversioned, independent of dependencies, and responds 200 with `status` equal to `ok`, deployed `version`, and non-negative `uptime_seconds`. `/ready` is unversioned; it checks database connectivity and reports storage independently. A reachable database returns 200, `status=ready`, database `reachable`, storage `not_configured`. An unreachable database returns 503, `status=not_ready`, database `unavailable`, storage `not_configured`.

Node major 24 is the minimum pinned runtime line. Pin the current Node 24.x patch at implementation and keep `engines.node` on `24.x`. Node.js official release status lists v24 as LTS; its LTS support is scheduled through April 2028 ([Node.js releases](https://nodejs.org/en/about/previous-releases), [Node.js v22 to v24 migration](https://nodejs.org/en/blog/migrations/v22-to-v24)).

## Known contract issues to resolve before implementation

1. In SPEC.md, `pending_action` is described as either null or one object, then says multiple simultaneous actions are returned as a list. OpenAPI 3.1 currently accepts null, object, or list to represent both statements. A later spec revision should choose one stable response shape.
2. SPEC.md says only users with `role=ADMIN` can use admin operations, while a newly registered broker is assigned BROKER at registration. The registration operation's role is determined after matching the provision record, so operation-level role metadata must define an unregistered authenticated caller in OpenAPI. Resolve this edge case in a breaking-free spec correction before implementing registration authorization.
3. Stable `INV-*` IDs were requested for invariants, but SPEC.md labels its numbered invariant-like statements only as `BR-*`. Acceptance scenarios use existing IDs. Do not invent replacement IDs in implementation; revise SPEC.md and all docs together in a future spec version.
