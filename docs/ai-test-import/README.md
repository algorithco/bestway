# AI JSON import design kit

Proposed contract only. No endpoint, database migration or production import is implemented by these documents.

1. Read [the implementation plan](IMPLEMENTATION-PLAN.md).
2. Give the AI [the reusable prompt](AI-PROMPT.md), [the schema](mock-test.schema.json), [the format guide](FORMAT.md), and the source test/key/media.
3. Use [the complete original JSON example](example-reading.json) as a copy-and-adapt template. It demonstrates table completion, MCQ, TFNG, short answer and multi-select.
4. Validate the generated package before submitting it to the future Import JSON screen. The teacher reviews and publishes the imported draft separately.

Verify the supplied artifacts from the repository root, using the existing frontend dependencies:

```powershell
node docs/ai-test-import/validate-artifacts.cjs
```

The script checks the schema, example, selected semantic invariants and deliberately invalid mutations. It is not the future production semantic validator and does not prove that an import API exists.

Full Listening/Reading papers must use the existing global question numbering. Media references require real uploaded-file bindings. Cookie values never appear in AI packages. Missing official answers remain errors; do not invent them to satisfy validation.
