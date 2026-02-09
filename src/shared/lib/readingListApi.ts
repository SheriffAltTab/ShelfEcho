import apiClient from '@/shared/api/apiClient';
import type { ReadingListItem } from '@/entities/book/model/types';

export async function getReadingList(status?: string): Promise<{ books: ReadingListItem[] }> {
  const { data } = await apiClient.get('/reading-list', { params: status ? { status } : {} });
  return data;
}

export async function addToReadingList(
  bookKey: string,
  title: string,
  author: string,
  coverId?: number | null,
  status = 'want',
): Promise<void> {
  await apiClient.post('/reading-list', { bookKey, title, author, coverId, status });
}

export async function updateReadingItem(
  bookKey: string,
  updates: { status?: string; progress?: number; rating?: number; totalPages?: number; pagesRead?: number },
): Promise<void> {
  await apiClient.put('/reading-list/item', updates, { params: { key: bookKey } });
}

export async function removeFromReadingList(bookKey: string): Promise<void> {
  await apiClient.delete('/reading-list/item', { params: { key: bookKey } });
}

export async function checkReadingList(bookKey: string): Promise<{
  inList: boolean;
  status: string | null;
  progress: number;
  totalPages: number;
  pagesRead: number;
}> {
  const { data } = await apiClient.get('/reading-list/check', { params: { key: bookKey } });
  return data;
}
