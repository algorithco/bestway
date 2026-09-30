# AI-assisted JSON test import — implementation specification

Status: proposed v1, 2026-09-30. These are design artifacts, not an implemented API. Scope: Mock (`/exam-builder`, `/v1/mock/*`); legacy Tests remains out of scope.

## Outcome

Source material + answer key + media → AI-prepared JSON → authenticated browser import → validation → atomic draft creation → teacher editing and student preview → publish.

Deploy the import feature once. Subsequent tests and teacher edits require no deployment. AI runs outside the production application in v1; no paid LLM service is required. The AI prepares data, not executable pages or arbitrary scripts. Missing official answers and unsupported layouts are reported, never invented or silently discarded.

## Contract artifacts

- `mock-test.schema.json`: strict JSON Schema draft-07, package version `1.0`.
- `AI-PROMPT.md`: reusable prompt for the assistant preparing JSON.
- `example-reading.json`: complete original Reading practice example, not a full IELTS exam.
- `FORMAT.md`: field semantics, answer conventions and rules beyond structural validation.

Schema and semantics jointly define the contract. During implementation, add shared fixtures to keep schema and Nest DTO validation aligned. Unknown fields and unsupported versions fail explicitly.

## Verified foundations and required changes

| Area | Existing code | Required work |
| --- | --- | --- |
| Auth | HttpOnly cookie → Next proxy → backend Bearer token; refresh retry | Reuse session; verify origin/CSRF checks for import writes |
| Save | Transactional group save; teacher ownership checks | Atomic whole-exam importer using shared validation |
| Documents | `contentHtml`, sanitizer, gap mapping, shared renderer | Validate imported documents and student preview |
| Numbering | Exam-wide number checks, range 1–200; unique skill per exam | Global numbering and stable source-key mappings |
| Grading | `buildCorrectAnswers`, type-specific answer checking | Canonical letters and exact-set multi-select normalization |
| Readiness | Advisory checklist with full-test assumptions | Profile-aware server-enforced publish gate |
| Media | Group audio/image; duration drives Listening timing | Owned staged uploads and validated bindings |
| Revisions | No whole-package import ledger | Add replay protection, revisions and edit concurrency checks |

Code references: `backend/src/mock/{mock-authoring.service.ts,mock-parse.ts,mock-answer.ts,mock-content.ts,mock-shape.ts}`, `backend/src/mock/dto/mock.dto.ts`, `backend/prisma/schema.prisma`, `frontend/src/app/api/backend/[...path]/route.ts`, `frontend/src/components/exam-builder/*`.

Grading review finding: `mock-answer.ts` adds accepted variants to both compared variant sets. Before sign-off, add a regression proving an unrelated response cannot pass merely because variants exist; fix any reproduced defect separately. Also do not expand multi-select option letters into option words: the current grader compares their exact union.

## User experience

1. Owner provides source, intended profile, answer key and media. AI returns JSON with source locators and review issues.
2. Teacher or authorized browser-connected assistant opens “Import JSON”, uploads/pastes JSON, and selects Validate.
3. The report shows field-path errors, warnings, skill/question counts, sanitizer changes and missing media. No exam exists yet.
4. User binds declared media keys to uploaded files. Server verifies ownership, content type, limits and actual duration.
5. Import creates an unpublished draft atomically and opens its editor.
6. Teacher edits/adds/reorders questions, replaces media, resolves review issues and previews the actual student rendering.
7. Publish reruns validation against the current database state and requires an explicit teacher action.

States: idle, parsing, validating, corrections required, ready, importing, imported, session expired and retryable failure. Retain JSON in memory on recoverable errors; do not autosave answer keys into shared-browser localStorage. Provide status lookup/retry after an uncertain timeout.

Cookies stay in the browser, never in AI output, chat, files or logs. The assistant uses supported browser controls or an explicitly supported authenticated integration. If such integration is unavailable, the owner uploads the generated JSON through the same screen. A raw cookie is not an API product interface.

## Proposed endpoints

Backend routes carry `/v1`; browser requests go through `/api/backend`. Use the existing `success/data/error` envelope. These routes do not exist yet.

| Operation | Route | Result |
| --- | --- | --- |
| Dry-run | `POST /mock/exam-imports/validate` | normalized package, checksum, issues, counts, canImport/canPublish |
| Stage media | `POST /mock/exam-imports/media` multipart | opaque owned upload ID, detected metadata, expiry |
| Create draft | `POST /mock/exam-imports` | exam/import IDs, revision, replay flag, editor URL |
| Recover result | `GET /mock/exam-imports/by-package/:packageId/revisions/:revision` | authorized import result or not found |

Validation body: `{ "package": <AI package>, "mediaBindings": { "source-key": "server-upload-id" } }`.

Commit body: the same plus `validatedChecksum` from dry-run. Bindings and checksum are application-generated, not AI guesses. Server revalidates and recomputes the checksum. Package input cannot set creator, database IDs, published state, storage paths or overwrite an existing exam. Existing authoring permissions govern commercial metadata such as price.

Issue example: `{ "code": "GAP_QUESTION_MISMATCH", "path": "/exam/sections/0/groups/0/contentHtml", "message": "...", "blocks": ["import", "publish"], "sourceKey": "table-a" }`. Codes are stable; messages localized. Reports have deterministic ordering and a 500-issue cap with totals and a truncation flag. Reports are staff-only.

Status codes: malformed JSON 400; unauthenticated/forbidden 401/403; conflicts 409; too large 413; commit validation failure 422; new draft 201; replay 200. Dry-run returns a report for parseable invalid packages rather than persisting data.

Proposed bounds: 2 MiB UTF-8 package body, 1–4 distinct skills, 50 total groups, 200 total questions and 20 media declarations. Apply limits before buffering in proxy/Next/Nest. Field limits are in the schema. Reject duplicate JSON object keys and numeric-string coercion. Current non-upload proxy timeout is 8 seconds: benchmark maximum-sized packages and adjust only import routing if needed.

## Validation and publish rules

Malformed fields, invalid type/skill, missing auto-graded keys, number collisions and incorrect gap mapping block import. Missing required media and unresolved source-review issues can remain in a draft but block publish. AI leaves missing keys empty and records a review issue; it must not invent keys to pass validation.

Sanitize on the server and at render. Return sanitizer differences for review; material content loss requires acknowledgement before publish. Only allowed document tags survive. Media is uploaded separately, never fetched from arbitrary AI URLs.

Profiles:

- `practice`: one or more selected skills; require valid material/keys and necessary media, without requiring all IELTS parts. Only existing sections are validated and published; missing skills are never blockers. Full-test timed flow is unavailable for this profile.
- `full_mock`: require an approved blueprint. Initial IELTS blueprint: four Listening parts/40 questions, three Reading groups/40 questions, Writing task 1/task 2; Speaking inclusion is explicit. Define the center's full Multilevel blueprint before enabling that profile for Multilevel. Do not guess its counts.
- Do not add empty Listening, Writing or Speaking sections when the requested test contains only Reading. Never invent sections or questions to satisfy `full_mock`; report the gap with a review issue instead.

IELTS manual questions use 9 points. `wordLimit` is a maximum short-answer limit, not an essay minimum. Reading passage remains in `passageText`; question layout is in `contentHtml`. Transcripts stay in staff-only `audioScript`.

In a nonempty rich group, every question must have exactly one gap token. V1 rich groups contain text-completion questions; choice/matching/manual questions use ordinary groups with empty `contentHtml`. Split mixed source blocks carefully. Shared-audio mixed blocks need a verified playback/timing design before full-test pilot; do not duplicate playback accidentally. Unsupported table merging/styles must be reported.

## Persistence and recovery

Proposed additive entities (reuse equivalents if implementation discovers them):

- `MockExamImport`: creator, packageId, revision, raw canonical checksum, normalized checksum, exam ID, schema version, timestamps; unique `(createdById, packageId, revision)`.
- `MockImportSourceMap`: import, entity kind, source key, database ID.
- `MockImportReviewIssue`: source reference, code, resolution state, resolving actor/time.
- `MockStagedMedia`: owner, opaque storage reference, file checksum, verified metadata, expiry and claimed state.
- Exam metadata: profile, blueprint reference and content version for optimistic concurrency.

Canonical checksums sort object keys, preserve array order and ignore JSON formatting whitespace. Actor scopes package identity. Identical replay returns the original exam without modifying teacher edits. Same revision with changed content returns 409. Higher revision creates a separate draft; no automatic merge/overwrite in v1. Enforce uniqueness in the database and test concurrent commits, not only preflight queries.

Create exam rows, import ledger, source mappings, issues and media claims in one transaction. Write audit transactionally or through an outbox. Media transfers happen before the transaction. Staged-file cleanup must not remove claimed files. A lost response after commit is recovered by replay/status lookup. A stale teacher save returns a visible version conflict.

Ownership comes from the session. Admin assignment to another teacher must be an explicit authorized application operation. AI JSON cannot choose its creator. Published/attempted content is preserved; structural edits requiring changes to attempted questions create a new draft copy.

## Milestones and acceptance gates

| Milestone | Work | Exit gate |
| --- | --- | --- |
| 1. Contract | schema/DTO alignment, pure validators, shared normalization, fixtures | every type and invalid fixture verified; grading regressions resolved |
| 2. Import | additive migration, service/controller, ledger, source maps, audit | failures leave no partial exam; concurrent retry creates one draft; permissions pass |
| 3. Media/UI | staged uploads, authenticated JSON screen, TanStack hooks, en/uz | expired sessions, mismatched media, upload failures and network recovery verified |
| 4. Teacher workflow | editor integration, issue resolution, concurrency, publish gate | edit/add/preview/publish without deploy; invalid DB content cannot publish |
| 5. Pilot | original Reading and Listening samples, then full blueprint | import → edit → publish → student attempt → grading; replay preserves edits |
| 6. Rollout | feature flag, staff pilot, monitoring, separate obsolete-UI cleanup | safe disable of new import; existing exams remain usable |

Run backend/frontend tests, typechecks, lint and builds at each implementation milestone. Use a disposable DB for transaction/concurrency tests. Keep existing authoring until pilot acceptance. No destructive production migration.

## Verification matrix

- Contract: all enums, unknown fields, duplicate object keys, unsupported version, excessive size, number/string mismatch.
- Content: table/list/paragraph tokens, duplicate/missing gaps, unsafe HTML, word limits, option bounds.
- Grading: MCQ letter mapping; exact-set multi-select; unrelated answers with variants; manual point rules.
- Auth: absent/expired session, student, unrelated teacher, admin, cross-origin requests, guessed media IDs.
- Recovery: double click, concurrent commit, changed revision payload, failed write, lost response, media expiry.
- Privacy: keys, transcripts and source-review metadata absent from all student responses/static assets.
- Teacher: add/delete/reorder updates tokens; stale save conflict; issue resolution audited.
- Runtime: mobile tables, keyboard controls, actual practice/timed attempts, audio duration and existing autosave.

Observe import latency, validation codes, retry counts, media failures and publish blocks; log identifiers/counts rather than JSON or credentials. Verify a 200-question import stays within the deployed timeout before rollout.

## Decisions and open input

Decided: external AI, cookie-authenticated browser session, JSON data only, draft first, separate publish, no redeploy per test, no automatic overwrite. Reuse committed Phase 1/2 foundations; Phase 3 paste-editor work stays reverted.

Nonblocking input: exact full Multilevel blueprint and optional admin-to-teacher assignment UX. Default to practice imports and current-actor ownership. This document does not claim production endpoints exist or authorize a live import/publication.
