# Atlas Build Context

Atlas coordinates property transactions in India; it owns no property and holds no money.
It joins buyers, sellers/developers, optional brokers, admins, documents, and workflow in one shared record.
The Passport is permanent; transaction history is append-only and ownership is a recorded claim.

Stack: TypeScript, Next.js App Router, Node.js 24 LTS, Express, PostgreSQL, Prisma, Clerk, private S3-compatible storage.
API base: `/api/v1`; `/health` and `/ready` are unversioned. Frontend calls backend API only.
Roles: BUYER, SELLER, BROKER, ADMIN. SYSTEM is the automatic transition actor.
Stages: INITIATED, KYC, DOCUMENTS, LOAN_REQUESTED (optional), PAYMENT, REGISTRATION, COMPLETED, CANCELLED (terminal).
Optional loan is immutable at create: DOCUMENTS routes to LOAN_REQUESTED if true, else PAYMENT.

Top invariants: BR-01 one buyer/seller and optional broker; BR-02 buyer and seller differ.
BR-06 loan_requested is immutable; BR-07 only listed transitions; BR-08 automatic transitions are engine-only.
BR-09 expected_from_stage must match; BR-11 required documents must be verified.
BR-15 no Aadhaar number/OCR and restricted file visibility; BR-16 payment is simulated only.
BR-17 completion requires deed and updates recorded owner; BR-19 DB enforces one active deal per property.
BR-20 terminal cancellation releases property; BR-22 events are append-only, IDs/enums only.
BR-23 idempotency retention is 24 hours; BR-25 local user role is authoritative.

Docs map: SPEC.md product, data, permissions, transitions, NFR, privacy, AC; transitions.yaml machine state source.
openapi.yaml API contract; schema.mmd ER diagram; DECISIONS.md decisions and assumptions.
BUILD_PLAN.md chunk map; CHUNK_PROMPT_TEMPLATE.md reusable chunk prompt; CHANGELOG.md semantic spec history.

Do not change contracts; propose spec changes separately.
