import { vi } from 'vitest';

type AnyJson = Record<string, any>;

function okJson(payload: AnyJson) {
  return {
    ok: true,
    status: 200,
    json: async () => payload,
  } as Response;
}

export function installOpenLibraryFetchMock(fixtures: {
  subjects: Record<string, AnyJson>;
  works: Record<string, AnyJson>;
  ratings?: Record<string, AnyJson>;
}) {
  const fetchMock = vi.fn(async (input: any) => {
    const url = String(input);

    // Subject pages
    const subjMatch = url.match(/\/subjects\/([^/]+)\.json\?/i);
    if (subjMatch) {
      const slug = decodeURIComponent(subjMatch[1]);
      const key = slug.toLowerCase();
      return okJson(fixtures.subjects[key] ?? { works: [] });
    }

    // Work details: https://openlibrary.org/works/OLxxxW.json or /works/OLxxxW.json
    const workMatch = url.match(/openlibrary\.org\/(works\/[^/]+)\.json$/i);
    if (workMatch) {
      const workKey = workMatch[1];
      return okJson(fixtures.works[workKey] ?? { key: `/${workKey}`, title: 'Unknown' });
    }

    // Ratings: https://openlibrary.org/works/OLxxxW/ratings.json
    const ratingsMatch = url.match(/openlibrary\.org\/(works\/[^/]+)\/ratings\.json$/i);
    if (ratingsMatch) {
      const workKey = ratingsMatch[1];
      return okJson((fixtures.ratings ?? {})[workKey] ?? { summary: { average: 0, count: 0 } });
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({ error: 'not mocked' }),
    } as Response;
  });

  // @ts-expect-error test runtime
  globalThis.fetch = fetchMock;
  return fetchMock;
}

