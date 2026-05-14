import apiClient from '@/shared/api/apiClient';

export interface RecBook {
  key: string;
  title: string;
  author: string;
  coverId?: number | null;
  subjects?: string[];
  userCount?: number;
}

export interface ContentBasedSection {
  sourceBook: {
    key: string;
    title: string;
    author: string;
    coverId?: number;
  };
  books: RecBook[];
}

export interface FeaturedBook {
  key: string;
  title: string;
  author: string;
  coverId?: number | null;
  description: string;
  subjects: string[];
  ratingsAverage: number;
  ratingsCount: number;
  reason: string | null;
  matchingGenres?: string[];
}

export async function getContentBasedRecommendations(): Promise<{ sections: ContentBasedSection[] }> {
  const { data } = await apiClient.get('/recommendations/content-based');
  return data;
}

export async function getCollaborativeRecommendations(): Promise<{ books: RecBook[] }> {
  const { data } = await apiClient.get('/recommendations/collaborative');
  return data;
}

export async function getFeaturedRecommendations(
  page = 0,
  pageSize = 8,
): Promise<{ books: FeaturedBook[]; page: number; pageSize: number; hasMore: boolean }> {
  const { data } = await apiClient.get('/recommendations/featured', {
    params: { page, pageSize },
  });
  return data;
}

export async function markNotInterested(
  bookKey: string,
  title: string,
  author: string,
  coverId?: number | null,
): Promise<void> {
  await apiClient.post('/recommendations/not-interested', { bookKey, title, author, coverId });
}
