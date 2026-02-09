import apiClient from '@/shared/api/apiClient';
import type { FavoriteItem } from '@/entities/book/model/types';

export async function getFavorites(): Promise<{ favorites: FavoriteItem[] }> {
  const { data } = await apiClient.get('/favorites');
  return data;
}

export async function addFavorite(bookKey: string, title: string, author: string, coverId?: number | null): Promise<void> {
  await apiClient.post('/favorites', { bookKey, title, author, coverId });
}

export async function removeFavorite(bookKey: string): Promise<void> {
  await apiClient.delete('/favorites/item', { params: { key: bookKey } });
}

export async function checkFavorite(bookKey: string): Promise<boolean> {
  const { data } = await apiClient.get('/favorites/check', { params: { key: bookKey } });
  return data.isFavorite;
}
