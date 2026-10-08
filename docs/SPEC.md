# ATLAS Product Specification

Version: 1.0.0  
Status: Batch 1 specification. Machine-readable transitions are defined in `docs/transitions.yaml` in Batch 2; that file is authoritative for transition behavior.  
API base path: `/api/v1`.

## CONFLICTS

1. The original product context lists five tables (`users`, `properties`, `transactions`, `documents`, `events`). Binding answers additionally require persisted notifications, pre-registration broker provisioning, and 24-hour idempotency replay. These requirements cannot be implemented reliably using only the five listed tables. This specification adds `notifications`, `broker_provisions`, and `idempotency_records`; they must appear in the Batch 3 schema diagram.
2. The binding endpoint hard cap includes both original endpoints and required additions, plus two operational endpoints described as unversioned. This specification counts 23 versioned API operations and 2 operational operations; `/health` and `/ready` are outside `/api/v1` and outside the versioned cap.
3. The binding answer calls `PARTICIPANT_CONFIRMED` an event while participant confirmation is per-participant data (`confirmed_at`). The event records that fact; it does not create an event-sourced participant entity. Transaction participant columns are the current state; the event is immutable history.
4. `REGISTERED_SALE_DEED` verification and ADMIN completion must both occur while the transaction is in `REGISTRATION`. Verification is a document action, not a stage transition.

## Overview and non-goals

Atlas coordinates property transaction workflows among buyers, sellers/developers, optional brokers, and internal administrators in India. It maintains property passports, transaction stages, documents, events, and in-app notifications. The backend is the authority for permissions, workflow transitions, document status, and ownership claims.

Atlas does not own property, hold or transfer money, provide banking, provide legal services, certify legal ownership, replace government systems, or make government records authoritative. MVP payment is simulated. Lawyers and banks are not platform roles. DigiLocker and other government integrations are future extensions.

## Glossary

| Term | Meaning |
|---|---|
| Active transaction | Transaction whose `stage` is not `COMPLETED` or `CANCELLED`. |
| Actor | Authenticated user or the workflow engine (`SYSTEM`) responsible for an action. |
| Broker ID | Unique platform identifier in `BRK-XXXXXX` format assigned to a provisioned broker. |
| Deal | One transaction on one property with exactly one buyer, one seller, and at most one broker. |
| Event | Append-only record of a consequential action. |
| Milestone event | `STAGE_CHANGED` event that exposes only the reached stage and timestamp to a non-party property reader. |
| Participant | Buyer, seller, or attached broker on a transaction. |
| Passport | Property core fields and authorized views of its transaction history and documents. |
| Required document | Document type, uploader role, and verification condition required by the current stage. |
| Stage | The transaction step currently in progress; leaving a stage means that step is complete. |
| Transition | A permitted change from one stage to another. |

## Personas

| Persona | Role and purpose |
|---|---|
| Buyer | Starts a deal, uploads buyer documents, requests a loan, records simulated payment, and participates in registration. |
| Seller | Confirms participation, uploads seller documents, and participates in registration. |
| Broker | Optional participant who confirms attachment and tracks only attached deals. |
| ADMIN | Internal operator who verifies documents, corrects records, provisions brokers, and oversees transactions. |
| SYSTEM | Non-human workflow engine actor that performs automatic transitions atomically with the triggering action. |

## Canonical stages

The ordered stage enum is `INITIATED`, `KYC`, `DOCUMENTS`, `LOAN_REQUESTED`, `PAYMENT`, `REGISTRATION`, `COMPLETED`, `CANCELLED`. `LOAN_REQUESTED` is optional. At transaction creation, immutable `loan_requested` chooses whether `DOCUMENTS` advances to `LOAN_REQUESTED` or `PAYMENT`. No other stage is skippable. `COMPLETED` and `CANCELLED` are terminal. No `status` field exists inside a stage; participant confirmation and document verification are derived from their respective fields.

`INITIATED` begins at creation. The engine advances automatically to `KYC` after seller and, if attached, broker confirmation. The engine advances automatically from `KYC` after required KYC documents are verified. The engine advances automatically from `DOCUMENTS` after required documents for that stage are verified. In the loan path, the buyer explicitly completes `LOAN_REQUESTED` by supplying `lender_name` and a reference string. The buyer explicitly advances `PAYMENT` by recording a simulated payment reference. In `REGISTRATION`, an authorized participant uploads the registered sale deed and records `registration_reference`; ADMIN verifies the deed and explicitly completes the deal.

Automatic transitions execute as actor `SYSTEM` in the same database transaction as the action satisfying the precondition. Clients cannot request automatic transitions. Explicit transitions are requested through `PATCH /api/v1/transactions/{id}/stage`, with `expected_from_stage`; server state is never set directly by the client. Any pair not listed in `docs/transitions.yaml` is rejected with `409 ILLEGAL_TRANSITION`. A stale expected stage is rejected with `409 STAGE_CONFLICT`. No backward transition or reopening exists in MVP; see Proposed additions.

## Document requirements

| Stage | Type | Required | Allowed uploader | Completion condition |
|---|---|---:|---|---|
| KYC | `PAN` | Yes | BUYER | At least one active replacement-chain document is `VERIFIED`. |
| KYC | `AADHAAR` | No | BUYER | Never blocks a transition. |
| DOCUMENTS | `PROPERTY_TAX_RECEIPT` | Yes | SELLER | At least one active replacement-chain document is `VERIFIED`. |
| DOCUMENTS | `AGREEMENT` | Yes | BUYER or SELLER | At least one active replacement-chain document is `VERIFIED`. |
| REGISTRATION | `REGISTERED_SALE_DEED` | Yes | BUYER or SELLER | At least one active replacement-chain document is `VERIFIED`; `registration_reference` is present. |

Allowed document types are exactly `PAN`, `AADHAAR`, `PROPERTY_TAX_RECEIPT`, `AGREEMENT`, `REGISTERED_SALE_DEED`. Verification values are exactly `PENDING`, `VERIFIED`, `REJECTED`. ADMIN alone changes verification. Rejection requires a non-empty reason; the reason is kept on the document row. A rejected document is not edited or deleted; its replacement is a new row pointing to it through `supersedes_document_id`. Only the latest non-rejected replacement-chain item satisfies a requirement. Upload accepts PDF, JPEG, and PNG only, validates magic bytes, enforces a 10 MiB maximum, and stores SHA-256. Atlas stores no Aadhaar number and performs no OCR.

## Entities and enums

All UUIDs are generated by the backend. All timestamps are UTC `timestamptz`. All entity rows have `created_at NOT NULL DEFAULT now()` unless otherwise stated. Enum-like fields use `TEXT` with database `CHECK` constraints. Adding an enum value is a non-breaking migration; removing or reinterpreting a value is breaking. `updated_at` is set by the backend on mutable rows. No API supports hard deletion.

### `users`

| Field | Type | Null/default | Constraint | Meaning |
|---|---|---|---|---|
| `id` | UUID | NOT NULL / generated | PK | Local user ID. |
| `clerk_user_id` | TEXT | NOT NULL | UNIQUE | Clerk identity key. |
| `email` | TEXT | NOT NULL | Unique, Clerk-verified, normalized lowercase | Account email. |
| `display_name` | TEXT | NOT NULL | 1–120 chars | Display name. |
| `role` | TEXT | NOT NULL | `BUYER`, `SELLER`, `BROKER`, `ADMIN` | Single platform role, read locally on every request. |
| `broker_id` | TEXT | NULL / NULL | UNIQUE when non-null; `BRK-` plus six uppercase alphanumeric characters | Broker identifier. Required for BROKER only. |
| `consent_version` | TEXT | NOT NULL | 1–40 chars | Accepted data-processing consent version. |
| `consent_at` | TIMESTAMPTZ | NOT NULL | UTC | Time consent was recorded. |
| `deactivated_at` | TIMESTAMPTZ | NULL / NULL | — | Soft deactivation time. |
| `created_at` | TIMESTAMPTZ | NOT NULL / now() | UTC | Creation time. |
| `updated_at` | TIMESTAMPTZ | NOT NULL / now() | UTC | Last mutable-row update. |

### `properties`

| Field | Type | Null/default | Constraint | Meaning |
|---|---|---|---|---|
| `id` | UUID | NOT NULL / generated | PK | Permanent internal property ID. |
| `address` | TEXT | NOT NULL | 1–1000 chars | Human-readable address. |
| `pincode` | TEXT | NOT NULL | Exactly six digits | Indian postal PIN code. |
| `unit` | TEXT | NULL / NULL | At most 120 chars | Flat, unit, or plot identifier. |
| `normalized_address_key` | TEXT | NOT NULL | Unique where `deleted_at IS NULL` | Lowercase whitespace-collapsed address + pincode + unit deduplication key. |
| `property_type` | TEXT | NOT NULL | `APARTMENT`, `HOUSE`, `PLOT`, `COMMERCIAL`, `OTHER` | Property classification. |
| `current_owner_user_id` | UUID | NULL / NULL | FK `users.id` | Current recorded ownership claim; not legally verified. |
| `created_by_user_id` | UUID | NOT NULL | FK `users.id` | Creator. |
| `deleted_at` | TIMESTAMPTZ | NULL / NULL | — | Soft deletion time. |
| `created_at` | TIMESTAMPTZ | NOT NULL / now() | UTC | Creation time. |
| `updated_at` | TIMESTAMPTZ | NOT NULL / now() | UTC | Last mutable-row update. |

Property workflow status is derived from its active transaction's `stage`, or `NONE` if no active transaction exists. Do not persist another status copy. Core property reads are available to authenticated BUYER, SELLER, and BROKER users.

### `transactions`

| Field | Type | Null/default | Constraint | Meaning |
|---|---|---|---|---|
| `id` | UUID | NOT NULL / generated | PK | Deal ID. |
| `property_id` | UUID | NOT NULL | FK `properties.id`; partial unique index where `stage` is nonterminal | Property in this deal. |
| `buyer_user_id` | UUID | NOT NULL | FK `users.id` | Sole buyer. |
| `seller_user_id` | UUID | NOT NULL | FK `users.id`; distinct from buyer | Sole seller. |
| `broker_user_id` | UUID | NULL / NULL | FK `users.id`; distinct from buyer and seller | Optional broker. |
| `buyer_confirmed_at` | TIMESTAMPTZ | NOT NULL / now() | UTC | Buyer's confirmation at creation. |
| `seller_confirmed_at` | TIMESTAMPTZ | NULL / NULL | UTC | Seller's confirmation. |
| `broker_confirmed_at` | TIMESTAMPTZ | NULL / NULL | UTC | Attached broker's confirmation; null if no broker. |
| `loan_requested` | BOOLEAN | NOT NULL / false | Immutable after create | Chooses the optional loan path. |
| `stage` | TEXT | NOT NULL / `INITIATED` | Stage enum | Current stage. |
| `lender_name` | TEXT | NULL / NULL | Required to leave `LOAN_REQUESTED`; 1–200 chars | Buyer-entered lender name; not verified. |
| `loan_reference` | TEXT | NULL / NULL | Required to leave `LOAN_REQUESTED`; 1–200 chars | Buyer-entered lender reference. |
| `payment_is_simulated` | BOOLEAN | NOT NULL / true | CHECK true | Marks the MVP payment as simulated. |
| `payment_reference` | TEXT | NULL / NULL | `SIM-` plus eight uppercase alphanumeric characters when set | Simulated payment reference; no amount is stored. |
| `registration_reference` | TEXT | NULL / NULL | 1–200 chars when set | Registration reference entered by a participant. |
| `cancellation_reason` | TEXT | NULL / NULL | Required at cancellation; enum below | Cancellation reason code. |
| `cancellation_note` | TEXT | NULL / NULL | At most 500 chars | Optional cancellation note, not copied to events. |
| `version` | INTEGER | NOT NULL / 1 | Positive; incremented on every stage change | Optimistic concurrency version. |
| `created_by_user_id` | UUID | NOT NULL | FK `users.id` | Buyer who started the deal. |
| `deleted_at` | TIMESTAMPTZ | NULL / NULL | — | Soft deletion time; transactions with history are retained. |
| `created_at` | TIMESTAMPTZ | NOT NULL / now() | UTC | Creation time. |
| `updated_at` | TIMESTAMPTZ | NOT NULL / now() | UTC | Last mutable-row update. |

`cancellation_reason` values: `BUYER_WITHDREW`, `SELLER_WITHDREW`, `DOCUMENT_ISSUE`, `FINANCING_UNAVAILABLE`, `REGISTRATION_ISSUE`, `DUPLICATE_DEAL`, `OTHER`. Reason is required, including when `OTHER` is chosen. Every state-changing POST accepts `Idempotency-Key`; retention is 24 hours and a replay with the same key and same request returns the original status and response. A reused key with a different request returns `409 STAGE_CONFLICT`.

`pending_action` is derived by a pure function of stage, participants, and documents, never stored. It is either null or `{awaiting_role, action_code}`. `awaiting_role` is one of `BUYER`, `SELLER`, `BROKER`, `ADMIN`; action codes are `CONFIRM_PARTICIPATION`, `UPLOAD_KYC`, `UPLOAD_DOCUMENTS`, `RECORD_LOAN`, `RECORD_PAYMENT`, `UPLOAD_REGISTRATION_DEED`, `VERIFY_REGISTRATION_DEED`, `COMPLETE_REGISTRATION`, `CANCEL_TRANSACTION`. If several same-stage actions are outstanding, the engine exposes each as a list in deterministic role order BUYER, SELLER, BROKER, ADMIN.

### `documents`

| Field | Type | Null/default | Constraint | Meaning |
|---|---|---|---|---|
| `id` | UUID | NOT NULL / generated | PK | Document record ID. |
| `transaction_id` | UUID | NOT NULL | FK `transactions.id` | Deal containing this document. |
| `property_id` | UUID | NOT NULL | FK `properties.id` | Property passport association. |
| `uploaded_by_user_id` | UUID | NOT NULL | FK `users.id` | Uploader. |
| `type` | TEXT | NOT NULL | Document type enum | Document classification. |
| `verification_status` | TEXT | NOT NULL / `PENDING` | `PENDING`, `VERIFIED`, `REJECTED` | ADMIN verification result. |
| `verification_reason` | TEXT | NULL / NULL | Required when REJECTED; at most 500 chars | ADMIN rejection reason. |
| `verified_by_user_id` | UUID | NULL / NULL | FK `users.id`; ADMIN only | Verifying or rejecting administrator. |
| `verified_at` | TIMESTAMPTZ | NULL / NULL | UTC | Verification decision time. |
| `supersedes_document_id` | UUID | NULL / NULL | FK `documents.id`; same transaction and type | Earlier rejected document replaced by this upload. |
| `storage_key` | TEXT | NOT NULL | Unique opaque key; private storage only | Object location, never exposed to clients. |
| `original_filename` | TEXT | NOT NULL | 1–255 chars; sanitized | Display filename. |
| `media_type` | TEXT | NOT NULL | `application/pdf`, `image/jpeg`, `image/png` | Verified content type. |
| `size_bytes` | BIGINT | NOT NULL | 1 through 10,485,760 | File size. |
| `sha256_checksum` | TEXT | NOT NULL | 64 lowercase hexadecimal characters | Content checksum. |
| `deleted_at` | TIMESTAMPTZ | NULL / NULL | — | Soft deletion time. |
| `created_at` | TIMESTAMPTZ | NOT NULL / now() | UTC | Upload time. |
| `updated_at` | TIMESTAMPTZ | NOT NULL / now() | UTC | Last mutable-row update. |

Documents are never overwritten or hard-deleted. Retention continues until ADMIN processes a deletion request; processing soft-deletes the file and writes an event. Aadhaar files are subject to the access rule below; no Aadhaar number or OCR output is stored.

### `events`

| Field | Type | Null/default | Constraint | Meaning |
|---|---|---|---|---|
| `id` | UUID | NOT NULL / generated | PK | Event ID. |
| `property_id` | UUID | NOT NULL | FK `properties.id` | Related property. |
| `transaction_id` | UUID | NULL / NULL | FK `transactions.id` | Related deal, if any. |
| `actor_user_id` | UUID | NULL / NULL | FK `users.id`; null only for SYSTEM | User actor. |
| `actor_type` | TEXT | NOT NULL | `USER`, `SYSTEM` | Actor category. |
| `type` | TEXT | NOT NULL | Event enum below | Event classification. |
| `payload` | JSONB | NOT NULL / `{}` | IDs and enum values only; no PII or free text | Minimal event facts. |
| `created_at` | TIMESTAMPTZ | NOT NULL / now() | UTC | Event time. |

Event types: `PROPERTY_CREATED`, `TRANSACTION_CREATED`, `PARTICIPANT_CONFIRMED`, `STAGE_CHANGED`, `TRANSACTION_CANCELLED`, `DOCUMENT_UPLOADED`, `DOCUMENT_VERIFIED`, `DOCUMENT_REJECTED`, `DOCUMENT_ACCESSED`, `ASSIGNMENT_CORRECTED`, `OWNERSHIP_UPDATED`, `BROKER_PROVISIONED`, `PROPERTY_UPDATED`, `DOCUMENT_DELETED`, `NOTIFICATION_READ`. The database rejects UPDATE and DELETE through a trigger; the application database role has no UPDATE or DELETE grants on this table. Event payloads contain identifiers and enum values only. PII and free text, including cancellation notes and rejection reasons, are prohibited.

### `notifications`

| Field | Type | Null/default | Constraint | Meaning |
|---|---|---|---|---|
| `id` | UUID | NOT NULL / generated | PK | Notification ID. |
| `recipient_user_id` | UUID | NOT NULL | FK `users.id` | Sole recipient. |
| `event_id` | UUID | NOT NULL | FK `events.id`; unique with recipient | Event that caused this notification. |
| `read_at` | TIMESTAMPTZ | NULL / NULL | UTC | Read time. |
| `created_at` | TIMESTAMPTZ | NOT NULL / now() | UTC | Notification time. |

Notifications are in-app records. There is exactly one row per recipient per notifying event. No email, SMS, or push delivery occurs in MVP.

### `broker_provisions`

| Field | Type | Null/default | Constraint | Meaning |
|---|---|---|---|---|
| `id` | UUID | NOT NULL / generated | PK | Provision record ID. |
| `email` | TEXT | NOT NULL | Unique normalized email | Clerk-verified email expected at registration. |
| `display_name` | TEXT | NOT NULL | 1–120 chars | Provisioned broker display name. |
| `broker_id` | TEXT | NOT NULL | Unique `BRK-` plus six uppercase alphanumeric characters | Broker ID assigned before account registration. |
| `created_by_user_id` | UUID | NOT NULL | FK `users.id`, ADMIN | Provisioning administrator. |
| `claimed_by_user_id` | UUID | NULL / NULL | FK `users.id`; unique when non-null | User account that claimed this provision. |
| `created_at` | TIMESTAMPTZ | NOT NULL / now() | UTC | Provisioning time. |

### `idempotency_records`

| Field | Type | Null/default | Constraint | Meaning |
|---|---|---|---|---|
| `id` | UUID | NOT NULL / generated | PK | Idempotency record ID. |
| `actor_user_id` | UUID | NOT NULL | FK `users.id` | Requesting user. |
| `idempotency_key` | TEXT | NOT NULL | 1–128 chars; unique with actor and route | Client-supplied key. |
| `route_key` | TEXT | NOT NULL | Stable route and resource key | Operation scope. |
| `request_hash` | TEXT | NOT NULL | SHA-256 of canonical request | Detects changed payload under a reused key. |
| `response_status` | INTEGER | NOT NULL | HTTP status | Original result status. |
| `response_body` | JSONB | NOT NULL | Original response | Replay result. |
| `expires_at` | TIMESTAMPTZ | NOT NULL | `created_at` + 24 hours | Retention deadline. |
| `created_at` | TIMESTAMPTZ | NOT NULL / now() | UTC | First request time. |

Expired records may be removed by scheduled maintenance after expiry. Idempotency response bodies must not contain document contents, signed URLs, secrets, or unnecessary PII.

## Transition contract

`docs/transitions.yaml` is the machine-readable source of truth. The table below summarizes its required transitions; Batch 2 must use the same IDs and semantics. Allowed roles list initiating human roles; `SYSTEM` executes AUTOMATIC transitions. For all transitions, successful state change increments `transactions.version`, updates `transactions.updated_at`, writes the listed event(s), and applies listed notifications in the same database transaction. A precondition failure returns `422 PRECONDITION_FAILED` with missing requirement identifiers. Notification recipient lists are exact; empty means no notification.

| ID | from_stage | to_stage | Trigger / allowed_roles | Preconditions | Side effects and exact notifications |
|---|---|---|---|---|---|
| T-01 | INITIATED | KYC | AUTOMATIC / SYSTEM | Seller confirmed; attached broker confirmed if present. | Set stage; write `STAGE_CHANGED`; notify BUYER and ADMIN. |
| T-02 | KYC | DOCUMENTS | AUTOMATIC / SYSTEM | Required `PAN` uploaded by BUYER and VERIFIED. | Set stage; write `STAGE_CHANGED`; notify BUYER and SELLER. |
| T-03 | DOCUMENTS | LOAN_REQUESTED | AUTOMATIC / SYSTEM | `loan_requested=true`; verified `PROPERTY_TAX_RECEIPT` and `AGREEMENT`. | Set stage; write `STAGE_CHANGED`; notify BUYER. |
| T-04 | DOCUMENTS | PAYMENT | AUTOMATIC / SYSTEM | `loan_requested=false`; verified `PROPERTY_TAX_RECEIPT` and `AGREEMENT`. | Set stage; write `STAGE_CHANGED`; notify BUYER. |
| T-05 | LOAN_REQUESTED | PAYMENT | EXPLICIT / BUYER | `lender_name` and `loan_reference` present. | Set stage and lender fields; write `STAGE_CHANGED`; notify SELLER and ADMIN. |
| T-06 | PAYMENT | REGISTRATION | EXPLICIT / BUYER | A new valid simulated reference is supplied; format `SIM-` + eight uppercase alphanumeric characters. | Set stage and payment reference; write `STAGE_CHANGED`; notify SELLER and ADMIN. |
| T-07 | REGISTRATION | COMPLETED | EXPLICIT / ADMIN | `registration_reference` present; `REGISTERED_SALE_DEED` VERIFIED by ADMIN. | Set stage; write `STAGE_CHANGED` and `OWNERSHIP_UPDATED`; set property `current_owner_user_id=buyer_user_id`; notify BUYER, SELLER, and attached BROKER. |
| T-08 | INITIATED | CANCELLED | EXPLICIT / BUYER, SELLER, ADMIN | Valid cancellation reason. | Set terminal stage and cancellation fields; write `TRANSACTION_CANCELLED`; release property; notify BUYER, SELLER, attached BROKER, and ADMIN, excluding actor. |
| T-09 | KYC | CANCELLED | EXPLICIT / BUYER, SELLER, ADMIN | Valid cancellation reason. | As T-08. |
| T-10 | DOCUMENTS | CANCELLED | EXPLICIT / BUYER, SELLER, ADMIN | Valid cancellation reason. | As T-08. |
| T-11 | LOAN_REQUESTED | CANCELLED | EXPLICIT / BUYER, SELLER, ADMIN | Valid cancellation reason. | As T-08. |
| T-12 | PAYMENT | CANCELLED | EXPLICIT / ADMIN | Valid cancellation reason. | As T-08. |
| T-13 | REGISTRATION | CANCELLED | EXPLICIT / ADMIN | Valid cancellation reason. | As T-08. |

Broker cannot cancel. BUYER and SELLER can cancel only in `INITIATED`, `KYC`, `DOCUMENTS`, or `LOAN_REQUESTED`. ADMIN can cancel every nonterminal stage. Cancellation releases the property's active-transaction slot. The canceling actor is excluded from cancellation notifications; all other listed recipients are notified. Events and notification rows commit atomically with the transition.

### Notification rules

| Trigger | Exact notified roles/recipients |
|---|---|
| T-01 | BUYER and ADMIN users; ADMIN recipient is the configured active admin group. |
| T-02 | BUYER and SELLER users on the transaction. |
| T-03 | BUYER user on the transaction. |
| T-04 | BUYER user on the transaction. |
| T-05 | SELLER user and ADMIN group. |
| T-06 | SELLER user and ADMIN group. |
| T-07 | BUYER, SELLER, and attached BROKER users. |
| T-08 through T-13 | BUYER, SELLER, attached BROKER, and ADMIN group, excluding the acting user. |
| Participant confirmation | Transaction creator (BUYER) and ADMIN group; when buyer confirms at creation, notify SELLER and attached BROKER if present. |
| Document uploaded | ADMIN group for required document types; no notification for optional AADHAAR. |
| Document verified/rejected | Uploader and other transaction party roles allowed to see that document. For PAN/AADHAAR only BUYER uploader; ADMIN action does not notify another role. |
| Broker provisioned | No notification; provision is claimed during matching-email registration. |
| Assignment corrected | All newly assigned participants and ADMIN group, excluding acting ADMIN. |
| Property updated | No notification. |
| Document accessed | No notification. |
| Notification read | No notification. |

An ADMIN group is the set of active users whose local `role=ADMIN`. A transition notification records one notification row per recipient user. The next-action `pending_action` is response data and does not itself create a notification.

## Permission matrix

`C/R/U/D` means create/read/update/delete capability. Delete is unavailable through API for every resource. Soft deletion or deactivation is used where applicable. A caller who is not allowed to know whether a resource exists receives `404 NOT_FOUND`, not `403 FORBIDDEN`. ADMIN reads and writes are audited where the operation changes consequential data.

| ID | Resource | BUYER | SELLER | BROKER | ADMIN | Row-level rule |
|---|---|---|---|---|---|---|
| P-01 | User profile | R/U self | R/U self | R/U self | C/R/U any | User cannot change own role, Clerk ID, consent, or broker ID. |
| P-02 | User lookup | R | R | R | R | Authenticated BUYER/SELLER/BROKER; exact email; rate-limited; response only `id`, `display_name`, `role`; no directory search. |
| P-03 | Property core | C/R | C/R | R | C/R/U | Authenticated BUYER/SELLER/BROKER read core fields. BUYER/SELLER may create. Only ADMIN may update. No user can delete via API. |
| P-04 | Passport history | R | R | R | R | Transaction parties and ADMIN see full history; other authenticated property readers see only stage + timestamp milestones with no party identities. |
| P-05 | Transaction | C/R | R | R | C/R/U | Buyer sees deals where buyer; seller sees deals where seller; broker sees only attached deals; ADMIN sees all. Create by BUYER only. |
| P-06 | Transaction stage | U | U | — | U | Only explicit transitions, per transition role and preconditions. SYSTEM alone executes automatic transitions. |
| P-07 | Participant confirmation | U self | U self | U self | U any | Participant confirms own assignment; ADMIN may correct assignments but cannot impersonate confirmation. |
| P-08 | Broker attachment | U | U | — | U | Buyer or seller can attach a Broker ID only in `INITIATED`; broker confirms own attachment. ADMIN can correct assignment. |
| P-09 | Document upload | C/R | C/R | R | C/R | Upload only allowed document type/uploader role at the relevant deal stage; BROKER cannot upload buyer/seller-only docs. |
| P-10 | PAN and AADHAAR | C/R uploader only | — | — | R | Visible only to uploading BUYER and ADMIN; never to SELLER or BROKER. |
| P-11 | Other deal documents | C/R | C/R | R | C/R/U | Deal parties, attached broker, and ADMIN; passport list filters to caller's own authorized transaction documents. |
| P-12 | Document verification | — | — | — | U | ADMIN only; PENDING to VERIFIED or REJECTED; rejection requires reason; no overwriting file. |
| P-13 | Notifications | R/U own | R/U own | R/U own | R/U own | Recipient reads and marks own notifications only. |
| P-14 | Broker provisioning | — | — | — | C/R | ADMIN creates provisioning record and unique Broker ID. |
| P-15 | Admin transaction list | — | — | — | R | ADMIN only; cursor-paginated, filterable by stage and `inactive_days`. |
| P-16 | Assignment correction | — | — | — | U | ADMIN only; changes buyer/seller/broker assignments with `ASSIGNMENT_CORRECTED`; cannot violate one buyer/one seller/optional broker. |
| P-17 | Event log | R own transaction events | R own transaction events | R attached-deal events | R all | No API role can update or delete events. Non-party property readers receive filtered milestones only. |

## Business rules and invariants

- BR-01. A deal has exactly one BUYER, exactly one SELLER, and zero or one BROKER.
- BR-02. Buyer and seller user IDs are distinct; broker user ID, when present, differs from both.
- BR-03. Only BUYER creates a transaction; buyer confirmation is recorded at creation.
- BR-04. Seller confirmation is required before automatic T-01; attached broker confirmation is also required.
- BR-05. Broker attachment is allowed only while stage is `INITIATED` and requires a provisioned Broker ID.
- BR-06. `loan_requested` is set at creation and cannot change.
- BR-07. A transaction transition is accepted only if present in `docs/transitions.yaml` and its actor, trigger, and preconditions match.
- BR-08. Automatic transitions run as SYSTEM atomically with the action satisfying their preconditions; clients cannot request them.
- BR-09. Stage change requires exact `expected_from_stage`; successful stage changes increment `version` once.
- BR-10. Only explicit transitions accept `PATCH /api/v1/transactions/{id}/stage`.
- BR-11. Required documents must be uploaded by an allowed role and verified by ADMIN before the corresponding automatic transition.
- BR-12. A rejected document cannot be changed; replacement is a new document linked by `supersedes_document_id`.
- BR-13. File type is established by magic bytes; only PDF, JPEG, PNG up to 10 MiB are accepted.
- BR-14. Each document stores a SHA-256 checksum; storage is private.
- BR-15. Aadhaar number is never stored or extracted; Aadhaar file access is limited to uploader BUYER and ADMIN.
- BR-16. `payment_is_simulated` is always true in MVP; payment references match `SIM-` followed by eight uppercase alphanumeric characters; no amount is stored.
- BR-17. Completion requires verified registered sale deed and registration reference; completion sets property `current_owner_user_id` to buyer.
- BR-18. A property's workflow status is derived from its active transaction or `NONE`.
- BR-19. No property has more than one active transaction; a database partial unique index enforces it.
- BR-20. CANCELLED releases the property's active transaction slot; COMPLETED and CANCELLED cannot transition again.
- BR-21. Cancellation requires an allowed actor, reason enum, and optional note up to 500 characters; reason and note are stored on transaction, not event payload.
- BR-22. Event rows are append-only at database and grant levels; payload contains identifiers and enum values only, never PII or free text.
- BR-23. Every state-changing POST accepts an idempotency key retained 24 hours; same key and same request replays the original response; changed request under the same key is rejected.
- BR-24. No API hard-deletes users, properties, transactions, documents, or events.
- BR-25. User role comes from local `users.role` on every request; client input and token role claims are ignored.
- BR-26. Self-registration can create BUYER or SELLER only. Broker role is granted only by matching a Clerk-verified email to a provision; ADMIN is granted only through the `promote-admin <email>` CLI script.
- BR-27. A property duplicate key is normalized lowercase whitespace-collapsed address + pincode + unit and is unique among non-deleted properties.
- BR-28. A caller cannot infer existence of a protected transaction/document by response status; inaccessible or unknown rows return 404.
- BR-29. Every response includes `X-Request-Id`; errors use `{error:{code,message,details,request_id}}`.
- BR-30. Lists use cursor pagination, default limit 25, maximum 100, stable sort by `created_at DESC, id DESC` unless endpoint specifies another sort.
- BR-31. Every stage change and consequential document, assignment, ownership, property creation, and broker provisioning action writes an event.
- BR-32. Every notifying event creates exactly one notification per specified recipient.
- BR-33. `pending_action` is derived and not persisted.
- BR-34. All database and API timestamps use UTC; display conversion to IST is a frontend concern.
- BR-35. Read/write endpoints authorize rows before returning data or signed download URLs; document download URLs expire within five minutes.

## Acceptance scenarios

Scenarios use the canonical seed personas and records described below. Error classes mean the documented shared error code and HTTP mapping.

| ID | Given / When / Then |
|---|---|
| AC-01 | Given an initiated deal with seller and attached broker unconfirmed, when either confirms, then its confirmation timestamp and `PARTICIPANT_CONFIRMED` event are stored; when all confirm, T-01 runs atomically and notifies BUYER and ADMIN. |
| AC-02 | Given KYC with no verified PAN, when any actor attempts an automatic stage change, then the client request is rejected as `ILLEGAL_TRANSITION`; when buyer uploads PAN and ADMIN verifies it, T-02 runs and notifies BUYER and SELLER. |
| AC-03 | Given verified required KYC and `loan_requested=false`, when the final required DOCUMENTS item becomes verified, then T-04 moves directly to PAYMENT. |
| AC-04 | Given verified required KYC and `loan_requested=true`, when the final required DOCUMENTS item becomes verified, then T-03 moves to LOAN_REQUESTED; buyer supplies lender name and reference through T-05 and PAYMENT begins. |
| AC-05 | Given PAYMENT, when BUYER submits a valid simulated reference through T-06, then REGISTRATION begins, reference is stored, and SELLER and ADMIN are notified. |
| AC-06 | Given REGISTRATION without verified deed, when ADMIN attempts T-07, then `PRECONDITION_FAILED` lists deed verification; after a participant uploads the deed, ADMIN verifies it, and ADMIN triggers T-07, ownership claim changes to buyer and parties plus attached broker are notified. |
| AC-07 | Given each nonterminal stage, when an authorized actor cancels with a valid reason under T-08 through T-13, then transaction is terminal, property slot is released, actor is excluded from cancellation notification, and all other specified recipients are notified. |
| AC-08 | Given a completed or cancelled deal, when any actor attempts another transition, then response is `ILLEGAL_TRANSITION`. |
| AC-09 | Given a client expected stage that differs from actual current stage, when PATCH stage is submitted, then response is `STAGE_CONFLICT` and no row, event, or notification changes. |
| AC-10 | Given a successful state-changing POST with an idempotency key, when identical request is replayed within 24 hours, then original status and body are returned and no duplicate event or notification is created. |
| AC-11 | Given an idempotency key already used by the same actor and route, when a different canonical request is submitted, then request is rejected and original result remains unchanged. |
| AC-12 | Given two concurrent transaction creations for one property, when both attempt commit, then at most one succeeds; the other receives `STAGE_CONFLICT` and cannot create an event for a nonexistent deal. |
| AC-13 | Given a property with an active transaction, when another transaction is created, then it is rejected; given its transaction is cancelled, a subsequent transaction can be created. |
| AC-14 | Given a rejected required document, when a new upload references it with `supersedes_document_id`, then the original remains unchanged and only a later VERIFIED replacement can satisfy the requirement. |
| AC-15 | Given PAN uploaded by BUYER, when SELLER or attached BROKER requests its metadata or download URL, then response is `NOT_FOUND`; BUYER uploader and ADMIN can read it. |
| AC-16 | Given a non-party authenticated property reader, when reading passport history, then only milestone stage and timestamp are returned without party identity; party and ADMIN receive full history. |
| AC-17 | Given a user lookup request, when the caller is authenticated and supplies exact email, then only id, display_name, and role are returned; non-exact search input is rejected, and rate limit returns `RATE_LIMITED`. |
| AC-18 | Given an unregistered or unauthenticated caller, when a protected endpoint is called, then `UNAUTHENTICATED` is returned; given an authenticated wrong role, forbidden action returns `FORBIDDEN`; given a protected row not visible to caller, `NOT_FOUND` is returned. |
| AC-19 | Given malformed fields, oversized upload, and disallowed media type, when submitted, then responses are respectively `VALIDATION_FAILED`, `PAYLOAD_TOO_LARGE`, and `UNSUPPORTED_MEDIA_TYPE`, with no partial document or event. |
| AC-20 | Given duplicate normalized address key, when property is created, then `DUPLICATE_PROPERTY` returns existing ID and creates no duplicate property. |
| AC-21 | Given storage outage, when non-document API reads/writes are called, then they continue to function; document upload/download endpoints fail with `INTERNAL`, without partial rows. |
| AC-22 | Given ADMIN assignment correction, when a valid reassignment occurs, then `ASSIGNMENT_CORRECTED` is written and newly assigned participants plus other ADMIN users are notified. |
| AC-23 | Given a document access authorization, when a download URL is issued, then a short-lived URL no longer than five minutes is returned and `DOCUMENT_ACCESSED` is written. |
| AC-24 | Given any role attempts API hard delete or event mutation, then no delete route exists and event UPDATE/DELETE is denied by database trigger and grants. |

## Canonical seed dataset

Seed data is development-only and contains synthetic identities and addresses. It creates seven properties and seven deals, one deal at each stage enum value. `CANCELLED` and `COMPLETED` are terminal examples. The `LOAN_REQUESTED` deal has `loan_requested=true`; the `PAYMENT` and later examples use `loan_requested=false` unless marked otherwise. The `KYC` and `DOCUMENTS` examples include their already satisfied preceding requirements. The `INITIATED` deal includes unconfirmed seller and broker where broker is attached. The `COMPLETED` deal includes verified deed, registration reference, and buyer as recorded current owner. The `CANCELLED` deal is additionally retained as the cancellation example. All documents use synthetic content and valid test checksums; no real PAN/Aadhaar values or personal data are seeded.

## API and platform conventions

The versioned API base is `/api/v1`. The complete endpoint contract is defined in Batch 2 `docs/openapi.yaml`; it is the source of truth for request and response validation schemas. The hard-capped versioned set is: `POST /api/v1/auth/register`, `GET /api/v1/me`, `POST /api/v1/properties`, `GET /api/v1/properties`, `GET /api/v1/properties/{id}`, `GET /api/v1/users/lookup`, `POST /api/v1/transactions`, `GET /api/v1/transactions`, `GET /api/v1/transactions/{id}`, `PATCH /api/v1/transactions/{id}/stage`, `POST /api/v1/transactions/{id}/participants/confirm`, `POST /api/v1/transactions/{id}/broker`, `GET /api/v1/transactions/{id}/documents`, `POST /api/v1/documents/upload`, `GET /api/v1/documents/{id}/download-url`, `PATCH /api/v1/documents/{id}/verification`, `GET /api/v1/admin/documents`, `GET /api/v1/admin/transactions`, `GET /api/v1/notifications`, `PATCH /api/v1/notifications/{id}/read`, `POST /api/v1/admin/brokers`, `PATCH /api/v1/admin/properties/{id}`, `PATCH /api/v1/admin/transactions/{id}/assignments`. Operational endpoints outside the versioned set are `GET /health` and `GET /ready`.

Required additions to the deck endpoints and justification: `GET /me` reads the local role/profile; `GET /properties` selects/searches a property; `GET /users/lookup` resolves exact-email seller; transaction list/detail reads expose shared workflow state; participant confirm records seller/broker confirmations; broker attach records optional assignment; transaction document list scopes passport documents; download URL provides authorized private access; document verification updates manual ADMIN decision; admin document list serves verification queue; notification list/read supports persisted in-app notifications; broker provision assigns Broker ID before registration; admin property correction and transaction assignment correction fulfill oversight requirements. `/health` provides liveness; `/ready` reports database and storage readiness separately.

All endpoints require Clerk authentication except `/health` and `/ready`. `POST /auth/register` uses Clerk identity and verified email; authorization role is loaded from local `users`. Lists use cursor pagination, `limit` default 25/max 100, with filters and stable sorting defined per OpenAPI operation. Every response includes `X-Request-Id`. Errors use `{error:{code,message,details,request_id}}` with mappings: `VALIDATION_FAILED` 400, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `PAYLOAD_TOO_LARGE` 413, `UNSUPPORTED_MEDIA_TYPE` 415, `STAGE_CONFLICT` 409, `ILLEGAL_TRANSITION` 409, `DUPLICATE_PROPERTY` 409, `PRECONDITION_FAILED` 422, `RATE_LIMITED` 429, `INTERNAL` 500. A resource the caller may not know exists returns 404 instead of 403.

## Non-functional requirements

- NFR-01. Monthly API availability target is 99.5%.
- NFR-02. If object storage is unavailable, only document endpoints fail; other API functions remain available.
- NFR-03. At 50 concurrent users, read endpoint p95 latency is below 500 ms and non-upload write endpoint p95 latency is below 1 second.
- NFR-04. Database backups run at least daily; recovery point objective is at most 24 hours and recovery time objective at most 4 hours.
- NFR-05. A restore procedure must document restoring database and private object storage, validating integrity, and resuming service within the stated recovery targets.
- NFR-06. Database migrations use expand/contract compatibility and execute as a release step; deployment requires no downtime.
- NFR-07. Rate limits are per IP and authenticated user: general API 120 requests/minute/IP and 120 requests/minute/user; `POST /auth/register` 5 requests/hour/IP and 5/hour/user; `GET /users/lookup` 10 requests/minute/IP and 10/minute/user. Exceeding a limit returns 429 `RATE_LIMITED`.
- NFR-08. Logs are structured JSON and include `request_id`; logs exclude PII, document contents, tokens, and signed URLs.
- NFR-09. CORS uses an explicit deployment allowlist; wildcard origins with credentials are forbidden.
- NFR-10. Responses set security headers including HSTS, content-type nosniff, and a restrictive frame policy.
- NFR-11. All traffic uses HTTPS. Database and documents are encrypted at rest by managed database and object-storage provider encryption; provider-managed encryption is an MVP assumption.
- NFR-12. All persisted and API timestamps are UTC. Frontend display conversion to IST is not an API behavior.
- NFR-13. Environment variables are supplied through deployment secrets and are named in `.env.example`; the file contains names and safe descriptions, never secret values.
- NFR-14. API operations use cursor pagination with page size at most 100.

Environment variable contract (names only): `NODE_ENV`, `PORT`, `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_ISSUER_URL`, `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_REGION`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_ACCESS_KEY_ID`, `OBJECT_STORAGE_SECRET_ACCESS_KEY`, `CORS_ALLOWED_ORIGINS`, `RATE_LIMIT_REDIS_URL`, `LOG_LEVEL`, `APP_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`.

`NEXT_PUBLIC_API_BASE_URL` is the public base URL of the Atlas API consumed by the frontend. The frontend app example file includes this variable; it is not a server secret.

## Privacy and compliance

PII is never written to events or application logs. Database and private document storage are encrypted at rest by the configured provider; all network traffic uses HTTPS. Document retention continues until ADMIN processes a deletion request. Processing soft-deletes the object and document row and writes `DOCUMENT_DELETED`; the event contains IDs only. This MVP has no public deletion-request endpoint; ADMIN processes requests through an operational procedure.

PAN and Aadhaar documents are visible only to the uploading BUYER and ADMIN. Sellers and brokers never see them. Atlas stores Aadhaar image/PDF only when supplied; it stores no Aadhaar number and performs no OCR. A downloadable URL is issued only after authorization and expires within five minutes.

### Compliance review required before production

Obtain legal review of the Digital Personal Data Protection Act, 2023 (DPDP Act) obligations and applicable Aadhaar collection, storage, access, and use restrictions before production. This is a review flag, not legal advice. Confirm consent wording/versioning, retention/deletion duties, breach processes, data processor terms, and whether each document collection is permitted for the relevant workflow.

## Security, operation, and evolution

Clerk authenticates requests. The backend loads local `users.role` on every request and does not trust client-supplied roles or token role claims. Frontend code never connects directly to PostgreSQL. The backend is the only API-to-database path. Document upload is backend-proxied multipart; backend validates size, media magic bytes, authorization, and checksum before private storage write and row creation. Download URLs require authorization and create a `DOCUMENT_ACCESSED` event.

The `GET /health` liveness check reports process health. `GET /ready` reports database readiness and object-storage readiness as separate fields. The backend must preserve non-document availability during storage outage. Migrations are backward compatible and run as a release step. A restore runbook must meet NFR-04 and NFR-05.

## Out of scope / future

| Capability | MVP behavior | Extension point |
|---|---|---|
| Real payments and payment-provider integration | No money movement, no amount fields; simulated stage action only. | Replace simulated payment action behind the explicit PAYMENT transition with a payment provider adapter; retain transaction and event contracts. |
| Loan application, approval, or bank integration | Buyer records lender name and reference only; no approval or verification. | Add lender integration and loan decision records behind the optional loan path; do not reinterpret current `loan_requested`. |
| DigiLocker/government verification | No integration; manual ADMIN document verification. | Add a verification adapter that can produce the existing document verification outcome with source metadata. |
| Legal services and lawyers | No platform role or legal advice. | Separate future product scope and permission review. |
| Broker listings and buyer invitations | Not available. Broker only tracks deals to which attached. | Proposed additions only. |
| Automatic expiry of abandoned deals | ADMIN filters by `inactive_days` and cancels manually. | Proposed addition: scheduled expiry policy with notice and appeal path. |
| Transaction-scoped roles | One platform role per user. | Proposed addition: role assignments per transaction if multi-role users are required. |
| Reopen or backward stage transition | Not supported. | Proposed addition: explicit compensating workflow with audit and authorization rules. |

### Proposed additions

The following are explicitly not MVP contracts: reopen/backward transitions; automatic expiry of stale deals; broker listings; broker-driven buyer invitations; transaction-scoped roles; self-service deletion request endpoint; external notification delivery; government/DigiLocker verification. Each requires a separately versioned specification change before implementation.
