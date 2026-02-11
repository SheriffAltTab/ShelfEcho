export interface Book {
  key: string;
  title: string;
  author: string;
  authors?: string[];
  authorKey?: string | null;
  coverId?: number | null;
  firstPublishYear?: number;
  subjects?: string[];
  ratingsAverage?: number;
  editionCount?: number;
  pageCount?: number;
}

export interface BookDetails {
  key: string;
  title: string;
  author: string;
  authorKey?: string;
  description: string;
  subjects: string[];
  coverId?: number | null;
  firstPublishDate: string;
  ratingsAverage: number;
  ratingsCount: number;
}

export interface ReadingListItem {
  id: number;
  user_id: number;
  book_key: string;
  title: string;
  author: string;
  cover_id: number | null;
  status: 'reading' | 'want' | 'read';
  progress: number;
  total_pages: number;
  pages_read: number;
  rating: number;
  subjects?: string;
  created_at: string;
}

export interface FavoriteItem {
  id: number;
  user_id: number;
  book_key: string;
  title: string;
  author: string;
  cover_id: number | null;
  created_at: string;
}
