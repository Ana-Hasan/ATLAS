# Atlas Specification Changelog

This changelog tracks contract versions, not implementation releases.

## 1.0.1 — 2026-10-08

- Added `NEXT_PUBLIC_API_BASE_URL` to the environment variable contract for the frontend's API origin.
- Clarified that this public URL is frontend configuration, not a server secret.

## 1.0.0 — 2026-10-05

- Initial specification for property passports, transaction state machine, document vault, permissions, notifications, and API.
- Defined canonical stages, optional loan branch, terminal states, and transition IDs T-01 through T-13.
- Added database-level active-transaction uniqueness, append-only events, persisted notification and idempotency records.
- Added versioned API base `/api/v1`, shared error envelope, role/row-level access, upload constraints, privacy rules, and non-functional targets.
- Defined Node.js 24 LTS pin and operational probe schemas in DECISIONS.md.

## Versioning policy

Use semantic versions. A major version is required for a breaking contract change: removing or renaming a field/path/enum/role/transition/error; changing requiredness or meaning; changing authorization, visibility, transition preconditions, notification recipients, or error semantics incompatibly; or changing an existing response shape incompatibly. A minor version adds backward-compatible optional capabilities. A patch version clarifies wording or fixes documentation without changing behavior.
