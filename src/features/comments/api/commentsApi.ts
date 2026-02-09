import apiClient from '@/shared/api/apiClient';

export interface Comment {
  id: number;
  user_id: number;
  book_key: string;
  text: string;
  rating: number;
  user_name: string;
  user_avatar: string;
  created_at: string;
}

export async function getComments(bookKey: string): Promise<{ comments: Comment[] }> {
  const { data } = await apiClient.get('/comments', { params: { key: bookKey } });
  return data;
}

export async function addComment(bookKey: string, text: string, rating: number): Promise<{ comment: Comment; updated?: boolean }> {
  const { data } = await apiClient.post('/comments', { text, rating }, { params: { key: bookKey } });
  return data;
}

export async function editComment(id: number, text: string, rating: number): Promise<{ comment: Comment }> {
  const { data } = await apiClient.put(`/comments/${id}`, { text, rating });
  return data;
}

export async function deleteComment(id: number): Promise<void> {
  await apiClient.delete(`/comments/${id}`);
}
