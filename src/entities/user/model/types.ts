export type UserRole = 'user' | 'moderator' | 'content_manager' | 'superadmin';

export interface User {
  id: number;
  name: string;
  email: string;
  onboarded: boolean;
  avatar: string;
  favoriteGenres: string[];
  readingGoal: number;
  createdAt?: string;
  role?: UserRole;
  isGoogleUser?: boolean;
}

export interface UserStats {
  totalBooks: number;
  readBooks: number;
  reviews: number;
  favorites: number;
}
