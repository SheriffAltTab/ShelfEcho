import apiClient from '@/shared/api/apiClient';
import type { User } from '@/entities/user/model/types';

interface AuthResponse {
  token: string;
  user: User;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post('/auth/login', { email, password });
  return data;
}

export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post('/auth/register', { name, email, password });
  return data;
}

export async function getMe(): Promise<{ user: User }> {
  const { data } = await apiClient.get('/auth/me');
  return data;
}

export async function completeOnboarding(favoriteGenres: string[], readingGoal: number): Promise<void> {
  await apiClient.put('/user/onboard', { favoriteGenres, readingGoal });
}

export async function getUserStats() {
  const { data } = await apiClient.get('/user/stats');
  return data;
}

export async function getGenreBreakdown(): Promise<{ genres: { name: string; count: number; percent: number }[] }> {
  const { data } = await apiClient.get('/user/genre-breakdown');
  return data;
}

export async function updateProfile(updates: {
  name?: string;
  avatar?: string;
  favoriteGenres?: string[];
  readingGoal?: number;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}): Promise<{ user: User }> {
  const { data } = await apiClient.put('/user/profile', updates);
  return data;
}
