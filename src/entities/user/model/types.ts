export interface User {
  id: number;
  name: string;
  email: string;
  onboarded: boolean;
  avatar: string;
  favoriteGenres: string[];
  readingGoal: number;
  createdAt?: string;
}

export interface UserStats {
  totalBooks: number;
  readBooks: number;
  reviews: number;
  favorites: number;
}
