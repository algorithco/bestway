/* Documentation artifact checks only; not the production import validator. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

// Reuse the already installed frontend tooling dependency, without installing packages.
const frontendRequire = createRequire(path.resolve(__dirname, '../../frontend/package.json'));
const Ajv = frontendRequire('ajv');
const read = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const schema = read('mock-test.schema.json');
const sample = read('example-reading.json');
const ajv = new Ajv({ allErrors: true });
assert.equal(ajv.validateSchema(schema), true, JSON.stringify(ajv.errors));
const validate = ajv.compile(schema);
assert.equal(validate(sample), true, JSON.stringify(validate.errors));

const invalidMutations = [
  ['cookie injection', (p) => { p.cookie = 'not-allowed'; }],
  ['wrong number type', (p) => { p.exam.sections[0].groups[0].questions[0].number = '1'; }],
  ['MCQ option text instead of letter', (p) => { p.exam.sections[0].groups[1].questions[0].correctAnswers = ['Upstairs']; }],
  ['combined multi-select letters', (p) => { p.exam.sections[0].groups[1].questions[3].correctAnswers = ['A,C']; }],
  ['missing automatic key', (p) => { p.exam.sections[0].groups[0].questions[0].correctAnswers = []; }],
  ['unknown version', (p) => { p.schemaVersion = '2.0'; }],
  ['publish injection', (p) => { p.exam.isPublished = true; }],
  ['invalid TFNG shorthand', (p) => { p.exam.sections[0].groups[1].questions[1].correctAnswers = ['F']; }],
  ['remote media path', (p) => { p.media = [{ key: 'audio', kind: 'audio', fileName: 'https://example.invalid/a.mp3', requiredForPublish: true }]; }],
];
for (const [name, mutate] of invalidMutations) {
  const copy = JSON.parse(JSON.stringify(sample));
  mutate(copy);
  assert.equal(validate(copy), false, `Invalid fixture accepted: ${name}`);
}

const numbers = new Set();
const questionKeys = new Set();
const groupKeys = new Set();
const skills = new Set();
for (const section of sample.exam.sections) {
  assert.ok(!skills.has(section.skill), 'Duplicate skill');
  skills.add(section.skill);
  for (const group of section.groups) {
    assert.ok(!groupKeys.has(group.key), 'Duplicate group key');
    groupKeys.add(group.key);
    for (const question of group.questions) {
      assert.ok(!questionKeys.has(question.key), 'Duplicate question key');
      assert.ok(!numbers.has(question.number), 'Duplicate number');
      questionKeys.add(question.key);
      numbers.add(question.number);
      if (['multiple_choice', 'multi_select', 'matching', 'matching_headings'].includes(question.type)) {
        for (const answer of question.correctAnswers) {
          assert.ok(answer.charCodeAt(0) - 65 < question.options.length, 'Option letter out of range');
        }
      }
    }
    if (group.contentHtml) {
      const tokens = [...group.contentHtml.matchAll(/data-gap="([0-9]+)"/g)].map((match) => Number(match[1]));
      assert.deepEqual(tokens, group.questions.map((q) => q.number), 'Sample gap mapping mismatch');
    }
  }
}
assert.ok(numbers.size <= 200 && groupKeys.size <= 50);
assert.ok(Buffer.byteLength(JSON.stringify(sample), 'utf8') <= 2 * 1024 * 1024);
console.log(`Schema and sample valid; ${numbers.size} questions; gap/key/number checks passed; ${invalidMutations.length} invalid fixtures rejected.`);
console.log('These checks do not verify source fidelity, authentication, actual import, rendering or grading.');
