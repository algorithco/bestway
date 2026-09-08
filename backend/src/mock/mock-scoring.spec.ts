import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BAND_TABLES,
  bandFromRaw,
  overallBand,
} from './mock-scoring';

describe('bandFromRaw', () => {
  it('attempted zero raw maps to the table zero-row (listening → 2)', () => {
    expect(bandFromRaw('listening', 'ielts_academic', 0, 40, DEFAULT_BAND_TABLES, true)).toBe(2);
  });

  it('unattempted zero raw returns 0 deliberately', () => {
    expect(bandFromRaw('listening', 'ielts_academic', 0, 40, DEFAULT_BAND_TABLES, false)).toBe(0);
  });

  it('academic reading attempted zero returns 2', () => {
    expect(bandFromRaw('reading', 'ielts_academic', 0, 40, DEFAULT_BAND_TABLES, true)).toBe(2);
  });

  it('general reading attempted zero returns 2', () => {
    expect(bandFromRaw('reading', 'ielts_general', 0, 40, DEFAULT_BAND_TABLES, true)).toBe(2);
  });

  it('negative score never crashes (clamped, attempted → table zero-row)', () => {
    expect(bandFromRaw('listening', 'ielts_academic', -5, 40, DEFAULT_BAND_TABLES, true)).toBe(2);
  });

  it('max=0 returns 0 regardless of attempted flag', () => {
    expect(bandFromRaw('listening', 'ielts_academic', 0, 0, DEFAULT_BAND_TABLES, true)).toBe(0);
    expect(bandFromRaw('listening', 'ielts_academic', 5, 0, DEFAULT_BAND_TABLES, false)).toBe(0);
  });

  it('mid-range scores follow the correct table per skill/type', () => {
    // 30/40: listening [30,7], academic [30,7], general [30,6]
    expect(bandFromRaw('listening', 'ielts_academic', 30, 40)).toBe(7);
    expect(bandFromRaw('reading', 'ielts_academic', 30, 40)).toBe(7);
    expect(bandFromRaw('reading', 'ielts_general', 30, 40)).toBe(6);
  });

  it('non-40 max scales to /40 (15/20 ≡ 30/40)', () => {
    expect(bandFromRaw('listening', 'ielts_academic', 15, 20)).toBe(
      bandFromRaw('listening', 'ielts_academic', 30, 40),
    );
  });

  it('custom table zero-row is honored, not hard-coded to 2', () => {
    const tables = {
      ...DEFAULT_BAND_TABLES,
      listening: [
        [40, 9],
        [0, 1],
      ] as const,
    };
    expect(bandFromRaw('listening', 'ielts_academic', 0, 40, tables, true)).toBe(1);
  });

  it('overallBand reflects attempted-zero (2) instead of understated 0', () => {
    // Two zero-raw auto skills + two mid skills: new mean uses 2s, old code used 0s.
    expect(overallBand([2, 2, 5, 5])).toBe(3.5);
    expect(overallBand([2, 2, 5, 5], { fixedDivisor: 4 })).toBe(3.5);
    expect(overallBand([0, 0, 5, 5], { fixedDivisor: 4 })).toBe(2.5);
  });
});
