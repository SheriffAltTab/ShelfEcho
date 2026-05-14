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

export type PrimarySignal = 'genre' | 'subject' | 'author' | 'collaborative';

export interface FeaturedBook {
  key: string;
  title: string;
  author: string;
  coverId?: number | null;
  description: string;
  subjects: string[];
  ratingsAverage: number;
  ratingsCount: number;
  primarySignal?: PrimarySignal;
  explanationTags?: string[];
  hybridScore?: number;
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
  excludeKeys: string[] = [],
): Promise<{ books: FeaturedBook[]; page: number; pageSize: number; hasMore: boolean }> {
  const params: Record<string, string | number> = { page, pageSize };
  if (excludeKeys.length > 0) {
    params.exclude = excludeKeys.join(',');
  }
  const { data } = await apiClient.get('/recommendations/featured', { params });
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
