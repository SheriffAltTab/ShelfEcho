import apiClient from '@/shared/api/apiClient';
import type { Book, BookDetails } from '../model/types';

export async function searchBooks(query: string, page = 1, sort?: string): Promise<{ total: number; books: Book[] }> {
  const params: Record<string, any> = { q: query, page, limit: 20 };
  if (sort) params.sort = sort;
  const { data } = await apiClient.get('/books/search', { params });
  return data;
}

export async function getBookDetails(workId: string): Promise<BookDetails> {
  const { data } = await apiClient.get('/books/details', { params: { key: workId } });
  return data;
}

export async function getTrendingBooks(): Promise<{ books: Book[] }> {
  const { data } = await apiClient.get('/books/trending');
  return data;
}

export async function getPopularNowBooks(): Promise<{ books: Book[] }> {
  const { data } = await apiClient.get('/books/popular-now');
  return data;
}

export async function getDailyQuote(): Promise<{ quote: string; author: string }> {
  const { data } = await apiClient.get('/quotes/daily');
  return data;
}

export async function getBooksBySubject(subject: string, limit = 10): Promise<{ books: Book[]; name: string }> {
  const { data } = await apiClient.get(`/books/subject/${subject}`, { params: { limit } });
  return data;
}
