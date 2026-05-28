import { describe, expect, it } from 'vitest';
import { featuredRawMetrics, scoreFeaturedCandidatePool } from '../../src/lib/hybridRecScore.js';

describe('hybridRecScore', () => {
  it('featuredRawMetrics computes overlaps and collaborative score', () => {
    const favSet = new Set(['fantasy', 'mystery']);
    const subjectUnion = new Set(['fantasy', 'epic', 'space']);
    const userAuthors = new Set(['isaac asimov']);
    const collabMap = new Map([['works/OL1W', 0.7]]);

    const m = featuredRawMetrics(
      { key: '/works/OL1W', title: 'X', author: 'Isaac Asimov', subjects: ['Fantasy', 'Robots'] },
      favSet,
      subjectUnion,
      userAuthors,
      collabMap,
    );

    expect(m.genreOverlap).toBeCloseTo(0.5, 12); // 1/2
    expect(m.subjectOverlap).toBeCloseTo(0.5, 12); // fantasy matches
    expect(m.authorMatch).toBe(1);
    expect(m.collaborative).toBeCloseTo(0.7, 12);
  });

  it('scoreFeaturedCandidatePool ranks by weighted normalized metrics', () => {
    const rows = [
      { book: { key: '/works/OL1W', title: 'A', author: 'Author 1', subjects: ['Fantasy', 'Epic'] }, subject: 'fantasy' },
      { book: { key: '/works/OL2W', title: 'B', author: 'Author 2', subjects: ['Romance'] }, subject: 'romance' },
      { book: { key: '/works/OL3W', title: 'C', author: 'Author 3', subjects: ['Mystery', 'Crime'] }, subject: 'mystery' },
    ];

    const nw = { g: 0.6, a: 0.0, s: 0.4, c: 0.0 };
    const favoriteGenres = ['Fantasy', 'Mystery'];
    const favSet = new Set(favoriteGenres.map((x) => x.toLowerCase()));
    const userSubjectUnion = new Set(['fantasy', 'epic', 'mystery', 'crime']);
    const scored = scoreFeaturedCandidatePool(rows, nw, favoriteGenres, favSet, userSubjectUnion, new Set(), new Map());

    expect(scored.length).toBe(3);
    expect(scored[0].book.key).toMatch(/OL1W|OL3W/);
    expect(scored[scored.length - 1].book.key).toContain('OL2W'); // Romance should be last
    expect(scored[0].finalScore).toBeGreaterThanOrEqual(scored[1].finalScore);
  });
});

