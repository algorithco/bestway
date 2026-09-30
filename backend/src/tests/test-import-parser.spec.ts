import { describe, expect, it } from 'vitest';
import { parseTestImport } from './test-import-parser';

describe('parseTestImport', () => {
  it('parses a multi-section test, shared material, options and an answer key', () => {
    const parsed = parseTestImport(`
[LISTENING]
Instructions: Listen and choose.
1. Where is the meeting?
A) Library
B) Station

[READING]
Passage: Solar power is increasingly common.
2. Complete: Solar power is increasingly ___.

[WRITING]
3. Discuss the advantages and disadvantages.
Score: 9

[SPEAKING]
4. Describe your hometown.

ANSWER KEY
1: B
2: common
`);

    expect(parsed.errors).toEqual([]);
    expect(parsed.sectionCounts).toEqual({ listening: 1, reading: 1, writing: 1, speaking: 1 });
    expect(parsed.questions[0]).toMatchObject({
      section: 'listening', type: 'multiple_choice', options: ['Library', 'Station'],
      correctAnswer: 'Station', instructions: 'Listen and choose.',
    });
    expect(parsed.questions[1]).toMatchObject({ section: 'reading', correctAnswer: 'common', passageText: 'Solar power is increasingly common.' });
    expect(parsed.questions[2]).toMatchObject({ section: 'writing', type: 'essay', maxScore: 9 });
    expect(parsed.questions[3]).toMatchObject({ section: 'speaking', type: 'speaking_prompt' });
  });

  it('uses a default section and accepts inline metadata', () => {
    const parsed = parseTestImport(`
1) Pick one
A. Alpha
B. Beta
Answer: A
Score: 2

2) Write one word
Answer: word | words
Type: short answer
`, 'reading');
    expect(parsed.errors).toEqual([]);
    expect(parsed.questions[0]).toMatchObject({ correctAnswer: 'Alpha', maxScore: 2 });
    expect(parsed.questions[1]).toMatchObject({ correctAnswer: 'word|words', type: 'short_answer' });
  });

  it('reports missing sections, answers, prompts, option errors and duplicate numbers', () => {
    const parsed = parseTestImport(`
1. A
1. Duplicate
[READING]
2. Multiple choice without options
Type: multiple choice
`);
    expect(parsed.errors.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      expect.stringContaining('repeated'),
      expect.stringContaining('has no section'),
      expect.stringContaining('at least 3 characters'),
      expect.stringContaining('at least two options'),
      expect.stringContaining('needs an answer'),
    ]));
  });

  it('warns about ignored preamble and extra answer rows', () => {
    const parsed = parseTestImport(`
Unlabelled introduction
[READING]
1. A valid prompt
ANSWER KEY
1: answer
9: extra
`);
    expect(parsed.errors).toEqual([]);
    expect(parsed.warnings.map((issue) => issue.message).join(' ')).toContain('ignored');
    expect(parsed.warnings.map((issue) => issue.message).join(' ')).toContain('no matching question');
  });
});
