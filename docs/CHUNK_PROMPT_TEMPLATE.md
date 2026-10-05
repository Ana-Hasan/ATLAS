# Reusable Chunk Prompt

You are implementing one chunk of PROJECT ATLAS. The documents in `docs/` are the frozen source of truth. Read `docs/CONTEXT.md`, `docs/SPEC.md`, `docs/openapi.yaml`, `docs/transitions.yaml`, `docs/DECISIONS.md`, and the applicable `docs/BUILD_PLAN.md` entry before editing.

## Context block

Paste the complete contents of `docs/CONTEXT.md` here:

```text
[CONTEXT]
```

## Chunk assignment

- Chunk number and name: `[CHUNK]`
- Goal: `[GOAL]`
- Spec IDs in scope: `[SPEC_IDS]`
- Dependencies already complete: `[DEPENDENCIES]`
- Files allowed to touch: `[FILES_TO_TOUCH]`
- Acceptance scenario IDs that must pass: `[AC_IDS]`
- Explicit do NOT do list: `[DO_NOT_DO]`

## Work rules

1. Implement exactly the assigned chunk. Do not implement adjacent chunks.
2. Read the cited contracts before editing. If they conflict or are incomplete, stop and report the exact file, section, and conflicting statements.
3. Write or update tests first, or alongside implementation, for every assigned acceptance scenario.
4. Keep frontend requests behind the backend API. Do not add unlisted endpoints, fields, enum values, roles, transitions, or behavior.
5. Do not edit `docs/` or change contracts; propose spec changes separately.
6. Run the relevant lint, typecheck, tests, and build commands. Report actual command results; never claim an unobserved pass.

## Definition of done

- All assigned acceptance scenarios pass.
- Lint, typecheck, tests, and build pass for affected packages.
- No out-of-scope files or behavior were added.
- Authorization and error behavior match the current API contract.
- Changes are reviewable and no secret or personal data is committed.

## Required closing checklist

Report:

1. What was built and the file tree changed.
2. Commands run and their real results.
3. Spec IDs and acceptance scenario IDs satisfied, and any not satisfied with reasons.
4. Spec ambiguity, contradiction, or proposed contract change encountered.
5. Dependencies added with one-line justifications.
6. Manual steps remaining.
7. Risks or uncertainties.
8. A concise suggested commit message.
