export const COVER_URL = 'https://covers.openlibrary.org/b/id';

export function getBookCoverUrl(coverId: number | null | undefined, size: 'S' | 'M' | 'L' = 'M'): string {
  if (!coverId) return '';
  return `${COVER_URL}/${coverId}-${size}.jpg`;
}

export const BOOK_COLORS = [
  'from-amber-700 to-amber-900',
  'from-orange-400 to-orange-600',
  'from-gray-400 to-gray-600',
  'from-slate-800 to-slate-900',
  'from-yellow-500 to-yellow-700',
  'from-indigo-800 to-indigo-950',
  'from-blue-300 to-blue-500',
  'from-cyan-500 to-blue-600',
  'from-emerald-600 to-emerald-800',
  'from-pink-400 to-pink-600',
  'from-green-700 to-green-900',
  'from-red-400 to-red-600',
  'from-teal-500 to-teal-700',
  'from-purple-500 to-purple-700',
  'from-rose-400 to-rose-600',
];

export function getBookColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return BOOK_COLORS[Math.abs(hash) % BOOK_COLORS.length];
}
