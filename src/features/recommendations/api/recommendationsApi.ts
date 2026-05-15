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
  page?: number;
  pageSize?: number;
  total?: number;
  hasMore?: boolean;
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
  whyThisBook?: string;
  hybridScore?: number;
}

export async function getContentBasedRecommendations(
  page = 0,
  pageSize = 10,
): Promise<{ sections: ContentBasedSection[]; page: number; pageSize: number }> {
  const { data } = await apiClient.get('/recommendations/content-based', { params: { page, pageSize } });
  return data;
}

export async function getCollaborativeRecommendations(
  page = 0,
  pageSize = 10,
): Promise<{ books: RecBook[]; page: number; pageSize: number; total: number; hasMore: boolean }> {
  const { data } = await apiClient.get('/recommendations/collaborative', { params: { page, pageSize } });
  return data;
}

export async function getFeaturedRecommendations(
  page = 0,
  pageSize = 8,
  excludeKeys: string[] = [],
  refreshKey = '',
): Promise<{ books: FeaturedBook[]; page: number; pageSize: number; total: number; hasMore: boolean }> {
  const params: Record<string, string | number> = { page, pageSize };
  if (excludeKeys.length > 0) {
    params.exclude = excludeKeys.join(',');
  }
  if (refreshKey) params.refresh = refreshKey;
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
