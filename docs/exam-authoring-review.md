# Exam authoring review

Scope: backend test/exam authoring and the admin exam builder.

## Findings and changes

1. **Slow, partial saves.** All five block editors sent a metadata request, then sequential per-question updates/deletions and a separate batch insert. Each mutation invalidated the exam query. A 40-question existing block needed 41 write requests before media. The editors now send one content request, with a single cache invalidation per affected query.
2. **New IDs were lost in local state.** Editors retained unsaved question identities after insertion. Subsequent saves, especially after media failures, could reinsert them. The save response now updates local question IDs before media upload.
3. **Writing/speaking creation rejected its own placeholder.** Section panels created a group and then submitted an empty prompt rejected by the question DTO. They now open the empty group directly; the task editor collects the prompt before saving.
4. **Repeated structural setup.** Exam setup now offers an editable starter structure, created with one nested database write. IELTS gets four listening, three reading, two writing and three speaking blocks. Multilevel gets one block per skill for customization. No answer keys or placeholder questions are fabricated. Blank creation remains available and the API default remains blank.

## Save contract

`PUT /v1/mock/groups/:groupId/content` accepts group metadata, the question list (existing questions carry IDs), and explicit `deletedQuestionIds`.

The backend validates the complete batch before writes, checks teacher ownership, rejects foreign/stale IDs and duplicate exam-wide numbering, and saves in a serializable PostgreSQL transaction. Existing IDs remain stable. Ordering follows the submitted list. Missing option/answer arrays are cleared; an omitted word limit clears that limit. New IDs are returned in submitted order.

The endpoint rejects published exams and exams with student attempts: unpublish an unused exam or clone an exam already used by students. Existing legacy mutation endpoints retain their previous behavior; this change is not a platform-wide content-lock policy.

Media remains a separate upload; its failure does not roll back the saved text. Local IDs are retained for retry. Concurrent edits to the same existing question do not yet have revision-token protection. Newly added or foreign question IDs are checked, but this is not complete collaborative editing support.

## Verification

- Backend regression tests cover ownership, IDs, validation before writes, duplicate numbering, explicit deletion, content protection and starter structures.
- `backend/scripts/verify-authoring.cjs` checks the compiled service against the local PostgreSQL database, including a 40-question save and an injected insert failure to verify actual rollback. It deletes its temporary exam in a finally block.
- Existing frontend tests, TypeScript and production builds are run separately.

Verified in this run: 21 backend tests, 15 frontend tests, production builds, targeted frontend lint and the PostgreSQL integration check all passed. The integration fixture was removed afterwards.

From the repository root in PowerShell, rerun the database check against local Docker:

```powershell
Get-Content -Raw backend/scripts/verify-authoring.cjs | docker compose run --rm --no-deps -T backend node
```

## Remaining opportunities

- The older `/tests` question-bank workflow now includes Smart Paste: admins can paste complete mixed-section tests, validate a preview, and insert the batch atomically. Manual entry remains available for individual additions and edits.
- Existing paste/import and clone features are already available. Import writes instructions separately from questions, and cloning intentionally omits media; both deserve a separate pass.
- Consistent revision checks and content-edit protection across all older authoring endpoints would make multi-admin editing safer.

Request-count reductions are established from the implementation; no measured end-to-end latency improvement is claimed.
