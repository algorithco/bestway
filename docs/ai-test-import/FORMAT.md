# Package format and authoring rules

This is a proposed import format. Existing per-group endpoints do not accept it. Use `mock-test.schema.json` for structure, `example-reading.json` as the copy-and-adapt template and `AI-PROMPT.md` to instruct the AI.

## Fields and identity

| Field | Meaning |
| --- | --- |
| schemaVersion | Exact string `1.0`; future versions require explicit support |
| packageId / revision | Stable source package identity and positive revision; scoped to authenticated creator |
| profile | `practice` or `full_mock`; affects publish readiness, not authentication |
| source | Staff-only provenance; provided content or original practice |
| exam | Type, title, commercial metadata and nested sections |
| sections[].key | Stable section key; each skill appears once at most |
| groups[].key | Stable group key, globally unique among groups in this package |
| questions[].key | Stable question key, globally unique among questions in this package |
| questions[].number | Global exam number 1–200, independent of source key and original label |
| questions[].sourceRef | Staff-only human-readable page/question/row locator |
| media | Filename declarations, never uploaded bytes or storage credentials |
| reviewIssues | Unresolved source problems, persisted for teacher review |

Object order has no meaning. Array order determines `sortOrder`; the server derives it starting at zero. Do not add explicit `sortOrder` fields. Text should be trimmed; whitespace-only required strings fail semantic validation. Optional fields are omitted, not null. Empty document/transcript strings mean absent content.

Package limits: 2 MiB UTF-8 serialized size, 4 skills, 50 total groups, 200 total questions, 20 media files. Counts across nested arrays require semantic validation in addition to the schema.

Global numbering follows existing exam-wide uniqueness. For a full exam with 40 Listening and 40 Reading questions, Reading uses 41–80. Keep original labels in sourceRef, and update headings/instructions/tokens consistently. Per-skill display-number resets would be a separate product/model change.

## Question types and canonical keys

| Type | Options | correctAnswers | wordLimit |
| --- | --- | --- | --- |
| multiple_choice | 2–26 unlabelled option strings | One letter, e.g. `["B"]` | Omit |
| multi_select | 2–26 option strings | Exact required set, e.g. `["A","C"]` | Omit |
| matching / matching_headings | 2–26 labels/headings in order | One letter for this numbered item | Omit |
| true_false_notgiven | `["TRUE","FALSE","NOT GIVEN"]` | One of those values | Omit |
| yes_no_notgiven | `["YES","NO","NOT GIVEN"]` | One of those values | Omit |
| sentence/note/summary/table_completion | Empty | Text alternatives, e.g. `["flower","flowers"]` | Source maximum if given |
| short_answer / map_labelling | Empty | Text answers | Source maximum if given |
| essay_task1 / essay_task2 / speaking_task | Empty | Empty | Omit |

Use exact enum names from the schema; the slash notation above abbreviates multiple completion types. Options are plain text without `A)` prefixes. Letter A maps to options[0]. Reject letters beyond the options array, duplicates after trimming, and keys incompatible with their type.

`acceptedVariants` is reserved for evidenced alternative text forms such as British/American spelling. Keep it empty for choice, TFNG/YNNG and manual tasks. Each string is one complete alternative; do not use `a/b` syntax in arrays. Optional articles may be represented as separate answers only when appropriate, with each answer respecting wordLimit.

Multi-select grading is exact-set: `["A","C"]` requires both and forbids extra choices. Do not represent two independently numbered questions as a single multi-select question unless the source scoring explicitly does so. Never run multi-select keys through text-expanding MCQ normalization. Refactor/reuse `buildCorrectAnswers` type-aware behavior during implementation rather than creating a second divergent normalizer.

Allowed skills: Listening/Reading use automatic types; Writing uses essay tasks; Speaking uses speaking_task. IELTS manual tasks have points 9. Other supported points are integers 1–20. Default automatic weight is 1 unless the source specifies otherwise. IELTS writing minimum lengths belong in instructions, not wordLimit.

## Rich documents

Example JSON string:

```json
"contentHtml": "<p>Visitors borrow <span data-gap=\"1\"></span>.</p>"
```

Allowed tags: p, br, strong, em, u, ul, ol, li, table, thead, tbody, tr, th, td, h3, h4, span. The only attribute is span's `data-gap`. No colspan/rowspan/style/class/image/link attributes in v1. Gap atoms are empty and numbered 1–200. Text containing `<`, `>` or `&` must be HTML-escaped before JSON serialization.

For every rich group, compare the token multiset with question numbers: both must contain the same numbers exactly once. Cross-group tokens are invalid. No nonempty question document without tokens in v1; ordinary groups use empty contentHtml. Rich groups support completion/short-answer/map-text only until other inline widgets are verified.

The teacher preview and student runner share GappedContent. The AI cannot claim pixel-identical reproduction of a source using unsupported merged cells or typography. Record UNSUPPORTED_LAYOUT instead. Reading passage text stays separate from its question layout. The current model has no shared-passage reference: if separate groups need the same passage, repeat it intentionally as in the example.

## Media

For an actually supplied file, declare:

```json
{
  "key": "listening-part-one",
  "kind": "audio",
  "fileName": "part-1.mp3",
  "requiredForPublish": true,
  "description": "Listening Part 1 recording"
}
```

The group uses `"audioRef": "listening-part-one"`. An image declaration works the same way with kind image and imageRef. References must resolve to a declaration of the right kind. Unused declarations are rejected in v1. Names are basenames, not directories/URLs; `.`, `..`, traversal and control characters are forbidden.

Application uploads map those keys to server-owned upload IDs outside the AI package. Do not invent IDs or duration. The server measures audioDurationSec from the uploaded media and enforces existing 1–7200 second bounds. Missing/unbound mandatory media blocks publish, not draft creation. A source that requires audio/image remains blocked even if the AI marks requiredForPublish false.

Listening partNumber is 1–4; omit it elsewhere. audioPlayLimit defaults to 1 and is only relevant to groups with audio. Do not place transcripts in passageText. Their staff-only field is audioScript.

## Profiles and single-skill packages

`profile` stays `practice` or `full_mock` and affects publish readiness, not authentication.

- `practice` accepts 1–4 skill sections. Only existing sections are validated: Reading needs passages/keys, Listening needs audio/keys, Writing needs essay prompts with manual points, Speaking needs speaking tasks. At least one section with one group and one question is required. Missing skills are never reported as blockers.
- `full_mock` keeps the strict blueprint: all required sections plus the full part/group/question counts (initial IELTS blueprint: four Listening parts/40 questions, three Reading groups/40 questions, Writing task 1/task 2). The full-test timed flow and section transitions run only for this profile.
- Do not add empty Listening, Writing or Speaking sections when the requested test contains only Reading. Never invent sections or questions to satisfy `full_mock`; report the gap with a review issue instead.

## Issues and missing information

Example issue:

```json
{
  "key": "missing-answer-one",
  "code": "MISSING_ANSWER",
  "path": "/exam/sections/0/groups/0/questions/0/correctAnswers",
  "message": "No answer key was supplied for source question 1.",
  "sourceRef": "Page 2, question 1"
}
```

Paths use JSON Pointer, zero-based array indices, `~0` for tilde and `~1` for slash in property names. Each path must resolve to an existing field/container in the package. Codes enumerate common review problems; the server independently determines blocking severity. AI cannot self-approve issues. All unresolved source issues block publish until a teacher resolves them.

Missing keys intentionally produce schema/semantic errors. The schema does not waive correctness merely because MISSING_ANSWER exists. Preserve the incomplete package for correction and do not import it until keys are supplied. A structurally valid package with missing media or uncertain transcription can be imported as a draft for teacher review.

## Schema validation versus semantic validation

JSON Schema checks types, required fields, enum values, bounds and question-local conditions. It cannot establish source fidelity or enforce all cross-tree constraints. The future validator must additionally check globally unique keys/numbers, section uniqueness, total counts, type/skill rules, IELTS points, option-letter bounds, word counts, HTML safety/mapping, media ownership/bindings, review paths and profile blueprint.

Validation is necessary, not proof of answer correctness. A human verifies provided-source fidelity and publication readiness. Import replay must preserve existing teacher edits; a new package revision creates another draft rather than updating a live exam.
