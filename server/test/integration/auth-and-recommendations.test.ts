import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers/testApp.js';
import { installOpenLibraryFetchMock } from '../helpers/openLibraryMock.js';

async function registerAndLogin(app: any, user: { name: string; email: string; password: string }) {
  const register = await request(app).post('/api/auth/register').send(user);
  expect(register.status).toBe(201);

  const login = await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });
  expect(login.status).toBe(200);
  expect(login.body?.token).toBeTruthy();
  return login.body.token as string;
}

describe('auth + recommendations (integration)', () => {
  it('registers and logs in without email verification in test mode', async () => {
    const { app } = await createTestApp();
    const token = await registerAndLogin(app, { name: 'Test User', email: 'test@example.com', password: 'password123' });

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body?.user?.email).toBe('test@example.com');
  });

  it('featured recommendations reflect onboarding genres and change after adding 10 favorites', async () => {
    const fixturesA = {
      subjects: {
        fantasy: {
          works: Array.from({ length: 12 }, (_, i) => ({
            key: `/works/OLFAN${i}W`,
            title: `Fantasy ${i}`,
            authors: [{ name: 'F Author' }],
            cover_id: 100 + i,
            subject: ['Fantasy', 'Epic'],
          })),
        },
        mystery: {
          works: Array.from({ length: 12 }, (_, i) => ({
            key: `/works/OLMYS${i}W`,
            title: `Mystery ${i}`,
            authors: [{ name: 'M Author' }],
            cover_id: 200 + i,
            subject: ['Mystery', 'Crime'],
          })),
        },
        romance: {
          works: Array.from({ length: 12 }, (_, i) => ({
            key: `/works/OLROM${i}W`,
            title: `Romance ${i}`,
            authors: [{ name: 'R Author' }],
            cover_id: 300 + i,
            subject: ['Romance'],
          })),
        },
      },
      works: {},
      ratings: {},
    };
    installOpenLibraryFetchMock(fixturesA);

    const { app } = await createTestApp();
    const token = await registerAndLogin(app, { name: 'Rec User', email: 'rec@example.com', password: 'password123' });

    // Onboarding: choose genres
    const favoriteGenres = ['Fantasy', 'Mystery'];
    const onboard = await request(app)
      .put('/api/user/onboard')
      .set('Authorization', `Bearer ${token}`)
      .send({ favoriteGenres, readingGoal: 12 });
    expect(onboard.status).toBe(200);

    const rec1 = await request(app)
      .get('/api/recommendations/featured?page=0&pageSize=12&refresh=seed1')
      .set('Authorization', `Bearer ${token}`);
    expect(rec1.status).toBe(200);
    expect(Array.isArray(rec1.body?.books)).toBe(true);

    const books1 = rec1.body.books as Array<{ key: string; subjects?: string[] }>;
    const allSubjects1 = new Set((books1.flatMap((b) => b.subjects || [])).map((s) => String(s).toLowerCase()));
    const overlap1 = favoriteGenres.filter((g) => allSubjects1.has(g.toLowerCase())).length;
    expect(overlap1).toBeGreaterThanOrEqual(1);

    // Add 10 favorites with different genres/subjects to shift profile (subject union)
    const favoritePayloads = [
      { bookKey: 'works/OLROM0W', title: 'Romance 0', author: 'R Author', coverId: 300 },
      { bookKey: 'works/OLROM1W', title: 'Romance 1', author: 'R Author', coverId: 301 },
      { bookKey: 'works/OLROM2W', title: 'Romance 2', author: 'R Author', coverId: 302 },
      { bookKey: 'works/OLROM3W', title: 'Romance 3', author: 'R Author', coverId: 303 },
      { bookKey: 'works/OLROM4W', title: 'Romance 4', author: 'R Author', coverId: 304 },
      { bookKey: 'works/OLROM5W', title: 'Romance 5', author: 'R Author', coverId: 305 },
      { bookKey: 'works/OLROM6W', title: 'Romance 6', author: 'R Author', coverId: 306 },
      { bookKey: 'works/OLROM7W', title: 'Romance 7', author: 'R Author', coverId: 307 },
      { bookKey: 'works/OLROM8W', title: 'Romance 8', author: 'R Author', coverId: 308 },
      { bookKey: 'works/OLROM9W', title: 'Romance 9', author: 'R Author', coverId: 309 },
    ];
    for (const p of favoritePayloads) {
      const r = await request(app).post('/api/favorites').set('Authorization', `Bearer ${token}`).send(p);
      expect([201, 409]).toContain(r.status);
    }

    const rec2 = await request(app)
      .get('/api/recommendations/featured?page=0&pageSize=12&refresh=seed2')
      .set('Authorization', `Bearer ${token}`);
    expect(rec2.status).toBe(200);
    const books2 = rec2.body.books as Array<{ key: string }>;

    // We expect recommendations list to change (seed + cache invalidation) after new favorites
    const set1 = new Set(books1.map((b) => b.key));
    const overlapKeys = books2.filter((b) => set1.has(b.key)).length;
    expect(overlapKeys).toBeLessThan(books2.length);
  });
});

