import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Grid, List, Plus, Search, BookOpen, SlidersHorizontal, X } from 'lucide-react';
import { BookCard } from '@/shared/ui/BookCard';
import { Button } from '@/shared/ui/Button';
import { getReadingList } from '@/shared/lib/readingListApi';
import { getFavorites } from '@/features/favorites/api/favoritesApi';
import type { ReadingListItem, FavoriteItem } from '@/entities/book/model/types';
import { getBookCoverUrl, getBookColor } from '@/shared/config';
import { bookPath } from '@/shared/lib/bookKeys';

type ViewMode = 'grid' | 'list';
type ShelfFilter = 'all' | 'reading' | 'want' | 'read' | 'favorites';
type SortOption = 'date' | 'rating_desc';

export function MyBooksPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [activeShelf, setActiveShelf] = useState<ShelfFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [readingListBooks, setReadingListBooks] = useState<ReadingListItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [showGenreFilter, setShowGenreFilter] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [rl, fav] = await Promise.allSettled([getReadingList(), getFavorites()]);
        if (rl.status === 'fulfilled') setReadingListBooks(rl.value.books);
        if (fav.status === 'fulfilled') setFavorites(fav.value.favorites);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const currentlyReading = readingListBooks.filter((b) => b.status === 'reading');
  const wantToRead = readingListBooks.filter((b) => b.status === 'want');
  const readBooks = readingListBooks.filter((b) => b.status === 'read');

  const shelves = [
    { id: 'all' as const, label: 'All Books', count: readingListBooks.length },
    { id: 'reading' as const, label: 'Currently Reading', count: currentlyReading.length },
    { id: 'want' as const, label: 'Want to Read', count: wantToRead.length },
    { id: 'read' as const, label: 'Read', count: readBooks.length },
    { id: 'favorites' as const, label: 'Favorites', count: favorites.length },
  ];

  const filterBySearch = <T extends { title: string; author: string }>(items: T[]) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
  };

  // Collect available genres
  const availableGenres = useMemo(() => {
    const genreSet = new Set<string>();
    readingListBooks.forEach((b) => {
      try {
        const subs: string[] = JSON.parse(b.subjects || '[]');
        subs.forEach((s) => genreSet.add(s));
      } catch { /* ignore */ }
    });
    return [...genreSet].sort();
  }, [readingListBooks]);

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  };

  const filterByGenre = <T extends { subjects?: string }>(items: T[]) => {
    if (selectedGenres.length === 0) return items;
    return items.filter((b) => {
      try {
        const subs: string[] = JSON.parse((b as any).subjects || '[]');
        return subs.some((s) => selectedGenres.includes(s));
      } catch { return false; }
    });
  };

  const sortItems = <T extends { rating?: number; created_at: string }>(items: T[]) => {
    if (sortBy === 'rating_desc') {
      return [...items].sort((a, b) => ((b as any).rating || 0) - ((a as any).rating || 0));
    }
    return items; // default: date (already sorted by server)
  };

  // Get filtered items based on active shelf
  const getFilteredReadingItems = (): ReadingListItem[] => {
    let items: ReadingListItem[];
    switch (activeShelf) {
      case 'reading': items = currentlyReading; break;
      case 'want': items = wantToRead; break;
      case 'read': items = readBooks; break;
      case 'favorites': return []; // Handled separately
      default: items = readingListBooks;
    }
    return sortItems(filterByGenre(filterBySearch(items)));
  };

  const getFilteredFavorites = (): FavoriteItem[] => {
    if (activeShelf !== 'all' && activeShelf !== 'favorites') return [];
    return filterBySearch(favorites);
  };

  const filteredReadingItems = getFilteredReadingItems();
  const filteredFavorites = getFilteredFavorites();
  const hasResults = filteredReadingItems.length > 0 || filteredFavorites.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber border-t-transparent" />
      </div>
    );
  }

  const renderListItem = (book: { book_key: string; title: string; author: string; cover_id?: number | null }, status?: string, _progress?: number, totalPages?: number, pagesRead?: number) => (
    <motion.div
      key={book.book_key}
      whileHover={{ x: 4 }}
      className="bg-white rounded-xl p-4 shadow-warm border border-brown/5 flex gap-4 cursor-pointer hover:border-amber/20 transition-colors"
      onClick={() => navigate(bookPath(book.book_key))}
    >
      <div className="w-12 h-16 rounded-md overflow-hidden flex-shrink-0 shadow-sm">
        {book.cover_id ? (
          <img src={getBookCoverUrl(book.cover_id, 'S') || ''} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${getBookColor(book.book_key)}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-brown text-sm truncate">{book.title}</h3>
        <p className="text-xs text-brown/60">{book.author}</p>
        {status && (
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
            status === 'reading' ? 'bg-amber/20 text-amber-800' :
            status === 'read' ? 'bg-teal/20 text-teal-800' :
            'bg-brown/10 text-brown/60'
          }`}>
            {status === 'reading' ? 'Reading' : status === 'read' ? 'Completed' : 'Want to Read'}
          </span>
        )}
        {status === 'reading' && totalPages && totalPages > 0 && (
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 bg-brown/10 rounded-full h-1.5">
              <div className="bg-amber h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.round(((pagesRead || 0) / totalPages) * 100))}%` }} />
            </div>
            <span className="text-xs text-brown/50">{Math.min(100, Math.round(((pagesRead || 0) / totalPages) * 100))}%</span>
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-brown mb-2">My Library</h1>
          <p className="text-brown/60">Your personal collection of books</p>
        </div>
        <Button variant="wood" leftIcon={<Plus size={18} />} onClick={() => navigate('/search?q=')}>
          Add Book
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brown/40" size={18} />
          <input
            type="text"
            placeholder="Search your library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-cream border border-brown/10 rounded-xl py-3 pl-12 pr-4 text-brown placeholder:text-brown/40 focus:outline-none focus:ring-2 focus:ring-amber/50 focus:border-transparent transition-all"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'outline'}
            onClick={() => setViewMode('grid')}
            className="px-3"
          >
            <Grid size={18} />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'outline'}
            onClick={() => setViewMode('list')}
            className="px-3"
          >
            <List size={18} />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="bg-cream border border-brown/10 rounded-xl py-2 px-3 text-sm text-brown focus:outline-none focus:ring-2 focus:ring-amber/50">
          <option value="date">Date Added</option>
          <option value="rating_desc">Rating (high to low)</option>
        </select>
        {availableGenres.length > 0 && (
          <button onClick={() => setShowGenreFilter((v) => !v)}
            className={`p-2 rounded-xl border transition-colors ${showGenreFilter ? 'bg-amber/10 border-amber/30 text-amber-800' : 'bg-cream border-brown/10 text-brown/60 hover:text-brown'}`}>
            <SlidersHorizontal size={18} />
          </button>
        )}
        {selectedGenres.length > 0 && (
          <button onClick={() => setSelectedGenres([])} className="text-xs text-amber-700 hover:underline flex items-center gap-1">
            <X size={12} /> Clear filters
          </button>
        )}
      </div>

      {showGenreFilter && availableGenres.length > 0 && (
        <div className="bg-cream rounded-2xl p-4 border border-brown/10">
          <span className="text-sm font-bold text-brown mb-2 block">Filter by Genre</span>
          <div className="flex flex-wrap gap-2">
            {availableGenres.map((g) => (
              <button key={g} onClick={() => toggleGenre(g)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedGenres.includes(g) ? 'bg-amber text-white' : 'bg-white text-brown/70 border border-brown/10 hover:bg-brown/5'
                }`}>
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {shelves.map((shelf) => (
          <button
            key={shelf.id}
            onClick={() => setActiveShelf(shelf.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeShelf === shelf.id
                ? 'bg-amber text-brown-dark shadow-sm'
                : 'bg-cream text-brown/70 hover:bg-cream/80'
            }`}
          >
            {shelf.label}
            <span className={`px-2 py-0.5 rounded-full text-xs ${activeShelf === shelf.id ? 'bg-brown-dark/10' : 'bg-brown/10'}`}>
              {shelf.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filtered content */}
      {filteredReadingItems.length > 0 && (
        <>
          {/* Show section headers when viewing "all" */}
          {activeShelf === 'all' ? (
            <>
              {filterBySearch(currentlyReading).length > 0 && (
                <Section title="Currently Reading">
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filterBySearch(currentlyReading).map((book) => (
                        <ReadingCard key={book.id} book={book} onClick={() => navigate(bookPath(book.book_key))} />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filterBySearch(currentlyReading).map((book) => renderListItem(book, book.status, book.progress, book.total_pages, book.pages_read))}
                    </div>
                  )}
                </Section>
              )}
              {filterBySearch(wantToRead).length > 0 && (
                <Section title="Want to Read">
                  {viewMode === 'grid' ? (
                    <ShelfRow items={filterBySearch(wantToRead)} navigate={navigate} />
                  ) : (
                    <div className="space-y-3">
                      {filterBySearch(wantToRead).map((book) => renderListItem(book, book.status))}
                    </div>
                  )}
                </Section>
              )}
              {filterBySearch(readBooks).length > 0 && (
                <Section title="Completed">
                  {viewMode === 'grid' ? (
                    <ShelfRow items={filterBySearch(readBooks)} navigate={navigate} showRating />
                  ) : (
                    <div className="space-y-3">
                      {filterBySearch(readBooks).map((book) => renderListItem(book, book.status))}
                    </div>
                  )}
                </Section>
              )}
            </>
          ) : (
            <Section title={shelves.find((s) => s.id === activeShelf)?.label || ''}>
              {viewMode === 'grid' ? (
                activeShelf === 'reading' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredReadingItems.map((book) => (
                      <ReadingCard key={book.id} book={book} onClick={() => navigate(bookPath(book.book_key))} />
                    ))}
                  </div>
                ) : (
                  <ShelfRow items={filteredReadingItems} navigate={navigate} showRating={activeShelf === 'read'} />
                )
              ) : (
                <div className="space-y-3">
                  {filteredReadingItems.map((book) => renderListItem(book, book.status, book.progress, book.total_pages, book.pages_read))}
                </div>
              )}
            </Section>
          )}
        </>
      )}

      {/* Favorites */}
      {filteredFavorites.length > 0 && (
        <Section title="Favorites">
          {viewMode === 'grid' ? (
            <div className="relative">
              <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#8B5E3C] rounded-sm shadow-md translate-y-2 z-0" />
              <div className="absolute bottom-0 left-0 right-0 h-2 bg-[#6d4a2f] translate-y-2 z-10 opacity-50" />
              <div className="flex gap-6 overflow-x-auto pb-10 pt-4 px-2 relative z-20">
                {filteredFavorites.map((book) => (
                  <BookCard
                    key={book.id}
                    title={book.title}
                    author={book.author}
                    coverId={book.cover_id}
                    coverColor={getBookColor(book.book_key)}
                    className="hover:-translate-y-4 transition-transform duration-300"
                    onClick={() => navigate(bookPath(book.book_key))}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFavorites.map((book) => renderListItem(book))}
            </div>
          )}
        </Section>
      )}

      {!hasResults && searchQuery.trim() && (
        <div className="text-center py-16">
          <p className="text-brown/50 font-serif text-xl mb-2">No books found</p>
          <p className="text-brown/40 text-sm">Try a different search term</p>
        </div>
      )}

      {readingListBooks.length === 0 && favorites.length === 0 && !searchQuery.trim() && (
        <div className="text-center py-16">
          <p className="text-brown/50 font-serif text-xl mb-4">Your library is empty</p>
          <p className="text-brown/40 mb-6">Start by searching for books to add to your collection</p>
          <Button variant="wood" onClick={() => navigate('/search?q=')}>
            Discover Books
          </Button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6">
      <div className="flex justify-between items-end border-b border-brown/10 pb-2">
        <h2 className="text-xl font-serif font-bold text-brown">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ReadingCard({ book, onClick }: { book: ReadingListItem; onClick: () => void }) {
  const progressPercent = book.total_pages > 0
    ? Math.min(100, Math.round((book.pages_read / book.total_pages) * 100))
    : book.progress;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-white rounded-2xl p-4 shadow-warm border border-brown/5 flex gap-4 cursor-pointer"
      onClick={onClick}
    >
      <div className="w-20 h-28 rounded-lg overflow-hidden shadow-md flex-shrink-0">
        {book.cover_id ? (
          <img src={getBookCoverUrl(book.cover_id, 'M') || ''} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${getBookColor(book.book_key)} flex items-center justify-center`}>
            <BookOpen size={20} className="text-cream/80" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-brown truncate">{book.title}</h3>
        <p className="text-sm text-brown/60 mb-3">{book.author}</p>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-brown/50">
            <span>{book.total_pages > 0 ? `${book.pages_read} / ${book.total_pages} pages` : 'Progress'}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full bg-brown/10 rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-amber h-2 rounded-full"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ShelfRow({ items, navigate, showRating = false }: { items: ReadingListItem[]; navigate: (path: string) => void; showRating?: boolean }) {
  return (
    <div className="relative">
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-[#8B5E3C] rounded-sm shadow-md translate-y-2 z-0" />
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-[#6d4a2f] translate-y-2 z-10 opacity-50" />
      <div className="flex gap-6 overflow-x-auto pb-10 pt-4 px-2 relative z-20">
        {items.map((book) => (
          <BookCard
            key={book.id}
            title={book.title}
            author={book.author}
            coverId={book.cover_id}
            coverColor={getBookColor(book.book_key)}
            showRating={showRating}
            rating={book.rating}
            className="hover:-translate-y-4 transition-transform duration-300"
            onClick={() => navigate(bookPath(book.book_key))}
          />
        ))}
      </div>
    </div>
  );
}
