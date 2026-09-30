# AI-assisted Mock test authoring redesign

The detailed specification and current v1 contract are in [IMPLEMENTATION-PLAN.md](ai-test-import/IMPLEMENTATION-PLAN.md). Use its companion JSON Schema, AI prompt, format guide and validated example for implementation. This document remains the initial direction summary; the detailed specification takes precedence where it refines the design.

Status: proposal only. The unfinished Phase 3 visual-paste changes have been rolled back. Implementation of this redesign has not started.

## Product flow

Source document + answer key + media → AI-prepared JSON → authenticated browser session → server validation → transactional draft import → student preview and teacher editing → publish.

Updated direction: AI prepares JSON and submits it through the owner's authenticated browser session. Adding a test requires no redeploy. AI means the coding assistant preparing tests from supplied material; a paid production LLM API is not required. Missing answers and ambiguous source content remain review issues rather than being presented as verified facts.

The existing frontend uses session cookies and a same-origin `/api/backend/*` proxy. Keep HttpOnly cookies in the browser: do not copy cookies into chat, JSON, source code or logs. Browser requests use the active session, and the proxy handles backend authentication. Session expiry requires login again. Apply existing authoring role/ownership checks, and verify origin/CSRF protection for the new mutating endpoint.

Teachers can edit text, instructions, question types, choices, correct answers, accepted variants, points, word limits, audio and images; they can also add/remove/reorder questions and groups. Teacher edits save to the database and do not require a redeploy.

## 1. Define the test package contract

- Define a versioned, validated data format for a complete Mock exam: metadata, sections, groups, sanitized document HTML, questions, answer keys and media references.
- Give each package, section, group and question a stable source key, separate from display numbers and database IDs.
- Keep presentation data separate from answer keys. Authorized staff can submit and review keys, but packages must never be bundled into public frontend assets or exposed through student endpoints.
- Use existing question types, grading rules and `buildCorrectAnswers` normalization. Preserve meaningful prompts for review and grading.
- Represent unsupported or ambiguous source material as review issues. AI must not invent missing official answers.

Acceptance: one original Listening table and one Reading sample validate, render with the existing shared renderer, and produce the expected grading results.

## 2. Build a repeatable AI preparation workflow

- The owner supplies source material, answer keys and audio/images to the assistant.
- The assistant produces a test package and a review report listing uncertain text, missing media, missing answers and numbering problems.
- Run deterministic validation for package shape, supported question types, answer normalization, gap-to-question mapping, numbering, word limits and media references.
- Return a normalized preview from dry-run, then show the actual student preview after draft import. New layout capabilities are implemented once in the shared renderer rather than as arbitrary executable code per test.

Acceptance: an invalid package cannot reach publish; each issue identifies the affected question or group.

## 3. Import JSON through the authenticated session

- Add an authenticated whole-exam JSON import endpoint with dry-run support, exposed through the existing same-origin proxy. Proposed route: `POST /mock/exams/import-json`; confirm naming against existing routes before implementation.
- Provide an authorized staff JSON upload/paste screen so a browser-connected assistant can submit through normal application controls. Do not rely on cookie extraction or unrestricted browser scripting.
- Dry-run returns all validation issues with field paths, normalized data and question counts. Actual import returns the draft exam ID and editor URL. Set explicit payload/question limits and audit the operation without logging secrets or full answer keys.
- Stage media and verify references before importing exam data. Keep upload failures from leaving a published partial exam.
- Import a complete exam as a draft in a transaction, reusing authoring validation and audit conventions. The existing group sync endpoint is useful but is not by itself an atomic whole-exam importer.
- Record package ID, revision, checksum, importing actor and database mappings. Reimporting an identical revision is a no-op.
- A changed package creates a new draft revision/copy for review. It does not overwrite teacher edits or mutate questions attached to existing attempts.
- Submission sequence: prepare JSON → dry-run → fix validation errors → upload media → import draft → teacher review → publish. Deploy the importer once; subsequent test additions need no deployment.

Acceptance: repeated submissions or network retries create no duplicates; failed imports leave no partial exam; revised imports preserve teacher changes and previous attempts. Unauthorized or expired sessions cannot import.

## 4. Redesign the teacher editor

- Replace the current complex paste/detection entry point with a test library and a clear editor for AI-prepared drafts.
- Provide section/part navigation, material and media editing, question editing, add/reorder controls, and a student preview using the same renderer as the runner.
- Use existing save, dirty-state and permission mechanisms. Save teacher changes through the transactional authoring API.
- Surface readiness issues with links to the affected content. Audio scripts and answer keys follow existing staff visibility rules.
- Keep old authoring routes working until this path is verified; remove superseded UI in a separate change.

Acceptance: a teacher can correct an AI-prepared question, add an extra question, replace audio and publish without code changes or deployment.

## 5. Verify and migrate

- Test schema validation, sanitization, permissions, key visibility, import idempotency, transaction rollback, media failures, revision handling and grading.
- Exercise the complete flow: prepare JSON → authenticated dry-run → import → teacher edit → publish → student attempt → grade → retry/reimport without overwriting edits.
- Run frontend/backend tests, typechecks, lint and builds. Check keyboard and mobile editing and preview.
- Use only additive database migrations. Existing Mock exams remain available. The legacy Tests subsystem stays out of scope.

## Reuse and rollback scope

Retain the committed Phase 1 shared renderer/sanitizer/data fields and Phase 2 group sync endpoint; both support this design. Their retention does not imply that whole-exam import or revision support already exists.

Roll back the uncommitted Phase 3 detector, answer-key parser, TipTap table integration, confidence controls and associated host/type/message changes. Keep the unrelated missing-translation and Turbopack root fixes from the reported development log.

Implement these milestones only after the new plan is accepted. The next implementation milestone is the package contract and one validated sample, followed by the importer, then the teacher editor.
