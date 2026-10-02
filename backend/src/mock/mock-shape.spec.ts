import { describe, expect, it } from 'vitest';
import { GroupRow, shapeGroup } from './mock-shape';

function group(): GroupRow {
  return {
    id: 'group-1',
    sortOrder: 0,
    title: 'Questions 1–2',
    instructions: 'Write one word.',
    passageText: 'Legacy fallback',
    contentHtml: '<p>Room <span data-gap="1"></span></p>',
    audioScript: '<p>Staff transcript</p>',
    contentLayout: 'table',
    audioKey: null,
    imageKey: null,
    partNumber: 1,
    audioDurationSec: null,
    audioPlayLimit: 1,
    questions: [{
      id: 'q-1',
      number: 1,
      sortOrder: 0,
      type: 'table_completion',
      prompt: 'Room',
      options: null,
      correctAnswers: ['library'],
      acceptedVariants: ['the library'],
      points: 1,
      wordLimit: 1,
    }],
  };
}

describe('gapped document response shaping', () => {
  it('sends sanitized content but hides keys and audioScript from students', () => {
    const shaped = shapeGroup(group(), false, '/v1');
    expect(shaped.contentHtml).toContain('data-gap="1"');
    expect(shaped.contentLayout).toBe('table');
    expect(shaped).not.toHaveProperty('audioScript');
    expect(shaped.questions[0]).not.toHaveProperty('correctAnswers');
    expect(shaped.questions[0]).not.toHaveProperty('acceptedVariants');
  });

  it('includes staff-only transcript and answer keys for authoring', () => {
    const shaped = shapeGroup(group(), true, '/v1');
    expect(shaped.audioScript).toBe('<p>Staff transcript</p>');
    expect(shaped.questions[0].correctAnswers).toEqual(['library']);
    expect(shaped.questions[0].acceptedVariants).toEqual(['the library']);
  });

  it('preserves the legacy passage shape when contentHtml is absent', () => {
    const row = group();
    row.contentHtml = null;
    const shaped = shapeGroup(row, false, '/v1');
    expect(shaped.contentHtml).toBeNull();
    expect(shaped.passageText).toBe('Legacy fallback');
  });
});
