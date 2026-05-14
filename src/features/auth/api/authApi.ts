import apiClient from '@/shared/api/apiClient';
import type { User } from '@/entities/user/model/types';

interface AuthResponse {
  token: string;
  user: User;
}

export type RegisterResult =
  | { needsVerification: true; message: string }
  | { needsVerification: false; token: string; user: User };

function validateAuthResponse(data: unknown): AuthResponse {
  if (
    data &&
    typeof data === 'object' &&
    'token' in data &&
    'user' in data &&
    typeof (data as AuthResponse).token === 'string' &&
    (data as AuthResponse).user &&
    typeof (data as AuthResponse).user === 'object'
  ) {
    return data as AuthResponse;
  }
  throw new Error('Invalid response from server. The API may be temporarily unavailable.');
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await apiClient.post('/auth/login', { email, password });
  return validateAuthResponse(data);
}

export async function register(name: string, email: string, password: string): Promise<RegisterResult> {
  const { data, status } = await apiClient.post('/auth/register', { name, email, password });
  if (
    status === 201 &&
    data &&
    typeof data === 'object' &&
    'needsVerification' in data &&
    (data as { needsVerification?: boolean }).needsVerification === true
  ) {
    const message =
      'message' in data && typeof (data as { message?: unknown }).message === 'string'
        ? (data as { message: string }).message
        : 'Check your email to verify your account.';
    return { needsVerification: true, message };
  }
  const auth = validateAuthResponse(data);
  return { needsVerification: false, token: auth.token, user: auth.user };
}

function validateUser(data: unknown): User {
  if (
    data &&
    typeof data === 'object' &&
    'id' in data &&
    'name' in data &&
    'email' in data &&
    typeof (data as User).id === 'number' &&
    typeof (data as User).name === 'string' &&
    typeof (data as User).email === 'string'
  ) {
    return data as User;
  }
  throw new Error('Invalid user response');
}

export async function getMe(): Promise<{ user: User }> {
  const { data } = await apiClient.get('/auth/me');
  if (data && typeof data === 'object' && 'user' in data && (data as { user: unknown }).user) {
    const user = validateUser((data as { user: unknown }).user);
    return { user };
  }
  throw new Error('Invalid response from server');
}

export async function completeOnboarding(favoriteGenres: string[], readingGoal: number): Promise<void> {
  await apiClient.put('/user/onboard', { favoriteGenres, readingGoal });
}

/** Full URL to start Google OAuth (browser redirect). */
export function getGoogleAuthStartUrl(): string {
  const raw =
    typeof import.meta.env.VITE_API_URL === 'string' && import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
      : '';
  if (raw) {
    return raw.endsWith('/api') ? `${raw}/auth/google` : `${raw}/api/auth/google`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/auth/google`;
  }
  return '/api/auth/google';
}

export async function getUserStats(): Promise<{
  totalBooks: number;
  readBooks: number;
  readingBooks: number;
  wantBooks: number;
  reviews: number;
  favorites: number;
  completedFromWantList?: boolean;
  earnedAchievementIds?: number[];
  monthlyReading: { month: string; count: number }[];
}> {
  const { data } = await apiClient.get('/user/stats');
  return data;
}

export async function syncAchievements(ids: number[]): Promise<void> {
  await apiClient.post('/user/achievements/sync', { ids });
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
