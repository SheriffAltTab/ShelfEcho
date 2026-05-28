import { describe, expect, it } from 'vitest';
import { normalizedRecWeights, sanitizeRecWeights } from '../../src/lib/recWeightsCore.js';

describe('recWeights', () => {
  it('sanitizeRecWeights clamps and rounds to [0..100]', () => {
    expect(
      sanitizeRecWeights({
        genre_weight: 101.2,
        author_weight: -5,
        subject_weight: '33.7',
        collaborative_weight: NaN,
      }),
    ).toEqual({
      genre_weight: 100,
      author_weight: 0,
      subject_weight: 34,
      collaborative_weight: 50,
    });
  });

  it('normalizedRecWeights sums to ~1 when sum>0', () => {
    const n = normalizedRecWeights({
      genre_weight: 10,
      author_weight: 20,
      subject_weight: 30,
      collaborative_weight: 40,
    });
    const sum = n.g + n.a + n.s + n.c;
    expect(sum).toBeCloseTo(1, 12);
    expect(n).toEqual({ g: 0.1, a: 0.2, s: 0.3, c: 0.4 });
  });

  it('normalizedRecWeights falls back to equal weights when all zeros', () => {
    expect(
      normalizedRecWeights({
        genre_weight: 0,
        author_weight: 0,
        subject_weight: 0,
        collaborative_weight: 0,
      }),
    ).toEqual({ g: 0.25, a: 0.25, s: 0.25, c: 0.25 });
  });
});

