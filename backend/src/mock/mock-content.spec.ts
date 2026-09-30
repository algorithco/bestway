import { describe, expect, it } from 'vitest';
import {
  assertGappedDocumentQuestions,
  gapNumbersFromHtml,
  sanitizeMockContent,
} from './mock-content';

describe('mock rich content sanitizer', () => {
  it('keeps the document allow-list and canonical gap atoms', () => {
    const clean = sanitizeMockContent(
      '<h3 style="color:red">Notes</h3><table onclick="bad()"><tbody><tr><td><strong>keen</strong> <span data-gap="12">source text</span></td></tr></tbody></table>',
    );
    expect(clean).toBe(
      '<h3>Notes</h3><table><tbody><tr><td><strong>keen</strong> <span data-gap="12"></span></td></tr></tbody></table>',
    );
    expect(gapNumbersFromHtml(clean)).toEqual([12]);
  });

  it('removes scripts, event handlers, styles, links and remote images', () => {
    const clean = sanitizeMockContent(
      '<p onmouseover="steal()" style="position:fixed">Hello<script>alert(1)</script><a href="javascript:alert(2)">link</a><img src="https://evil.test/x.png"></p>',
    );
    expect(clean).toBe('<p>Hellolink</p>');
    expect(clean).not.toMatch(/script|onmouseover|style|href|img|evil/i);
  });

  it('drops malformed or out-of-range gap attributes', () => {
    expect(sanitizeMockContent('<p><span data-gap="0"></span><span data-gap="201"></span><span data-gap="1" class="x"></span></p>'))
      .toBe('<p><span data-gap="1"></span></p>');
  });
});

describe('gapped document question validation', () => {
  it('accepts an exact one-to-one number mapping', () => {
    expect(() => assertGappedDocumentQuestions(
      '<p><span data-gap="1"></span> and <span data-gap="2"></span></p>',
      [1, 2],
    )).not.toThrow();
  });

  it('rejects duplicate gap markers', () => {
    expect(() => assertGappedDocumentQuestions(
      '<p><span data-gap="1"></span><span data-gap="1"></span></p>',
      [1],
    )).toThrowError(expect.objectContaining({ code: 'GAP_TOKEN_DUPLICATE' }));
  });

  it('rejects missing questions, missing markers and duplicate question numbers', () => {
    expect(() => assertGappedDocumentQuestions('<p><span data-gap="2"></span></p>', [1]))
      .toThrowError(expect.objectContaining({ code: 'GAP_QUESTION_MISMATCH' }));
    expect(() => assertGappedDocumentQuestions('<p><span data-gap="1"></span></p>', [1, 1]))
      .toThrowError(expect.objectContaining({ code: 'GAP_QUESTION_MISMATCH' }));
  });

  it('keeps legacy groups without contentHtml valid', () => {
    expect(() => assertGappedDocumentQuestions(null, [1, 2])).not.toThrow();
  });
});
