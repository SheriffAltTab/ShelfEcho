import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Loader2, SlidersHorizontal, X } from 'lucide-react';
import { BookCard } from '@/shared/ui/BookCard';
import { Button } from '@/shared/ui/Button';
import { searchBooks } from '@/entities/book/api/bookApi';
import type { Book } from '@/entities/book/model/types';
import { getBookColor } from '@/shared/config';
import { bookPath } from '@/shared/lib/bookKeys';

type SortOption = 'relevance' | 'rating_desc' | 'rating_asc';

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const doSearch = useCallback(async (q: string, p: number, sort: SortOption) => {
    if (!q.trim()) { setResults([]); setTotal(0); return; }
    setIsLoading(true);
    try {
      const apiSort = sort === 'relevance' ? undefined : 'rating';
      const data = await searchBooks(q, p, apiSort);
      if (p === 1) { setResults(data.books); } else { setResults((prev) => [...prev, ...data.books]); }
      setTotal(data.total);
    } catch { /* ignore */ } finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    setQuery(q); setPage(1); setSelectedGenres([]);
    doSearch(q, 1, sortBy);
  }, [searchParams, doSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ q: query });
  };

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    setPage(1);
    doSearch(searchParams.get('q') || '', 1, newSort);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    doSearch(query, nextPage, sortBy);
  };

  // Collect available genres from results
  const availableGenres = useMemo(() => {
    const genreSet = new Set<string>();
    results.forEach((b) => b.subjects?.forEach((s) => genreSet.add(s)));
    return [...genreSet].sort();
  }, [results]);

  const toggleGenre = (g: string) => {
    setSelectedGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  };

  // Filter + sort results locally
  const displayResults = useMemo(() => {
    let filtered = results;
    if (selectedGenres.length > 0) {
      filtered = filtered.filter((b) => b.subjects?.some((s) => selectedGenres.includes(s)));
    }
    if (sortBy === 'rating_desc') {
      filtered = [...filtered].sort((a, b) => (b.ratingsAverage || 0) - (a.ratingsAverage || 0));
    } else if (sortBy === 'rating_asc') {
      filtered = [...filtered].sort((a, b) => (a.ratingsAverage || 0) - (b.ratingsAverage || 0));
    }
    return filtered;
  }, [results, selectedGenres, sortBy]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-brown mb-6">Search Books</h1>
        <form onSubmit={handleSearch} className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brown/40" size={20} />
          <input type="text" placeholder="Search by title, author, or subject..."
            value={query} onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-cream border border-brown/10 rounded-xl py-4 pl-12 pr-24 text-brown text-lg placeholder:text-brown/40 focus:outline-none focus:ring-2 focus:ring-amber/50 focus:border-transparent transition-all"
            autoFocus />
          <Button type="submit" variant="wood" className="absolute right-2 top-1/2 -translate-y-1/2">Search</Button>
        </form>
      </div>

      {searchParams.get('q') && (
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-brown/60">
            {isLoading && page === 1 ? 'Searching...' : `Found ${total.toLocaleString()} results for "${searchParams.get('q')}"`}
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <select value={sortBy} onChange={(e) => handleSortChange(e.target.value as SortOption)}
              className="bg-cream border border-brown/10 rounded-xl py-2 px-3 text-sm text-brown focus:outline-none focus:ring-2 focus:ring-amber/50">
              <option value="relevance">Relevance</option>
              <option value="rating_desc">Rating (high to low)</option>
              <option value="rating_asc">Rating (low to high)</option>
            </select>
            <button onClick={() => setShowFilters((v) => !v)}
              className={`p-2 rounded-xl border transition-colors ${showFilters ? 'bg-amber/10 border-amber/30 text-amber-800' : 'bg-cream border-brown/10 text-brown/60 hover:text-brown'}`}>
              <SlidersHorizontal size={18} />
            </button>
          </div>
        </div>
      )}

      {showFilters && availableGenres.length > 0 && (
        <div className="bg-cream rounded-2xl p-4 border border-brown/10">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-brown">Filter by Genre</span>
            {selectedGenres.length > 0 && (
              <button onClick={() => setSelectedGenres([])} className="text-xs text-amber-700 hover:underline flex items-center gap-1">
                <X size={12} /> Clear all
              </button>
            )}
          </div>
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

      {isLoading && page === 1 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-amber" size={40} />
        </div>
      ) : displayResults.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {displayResults.map((book, idx) => (
              <BookCard key={`${book.key}-${idx}`} title={book.title} author={book.author} coverId={book.coverId}
                coverColor={getBookColor(book.key)} onClick={() => navigate(bookPath(book.key))} />
            ))}
          </div>
          {results.length < total && (
            <div className="text-center pt-4">
              <Button variant="outline" onClick={handleLoadMore} isLoading={isLoading && page > 1}>Load More</Button>
            </div>
          )}
        </>
      ) : searchParams.get('q') ? (
        <div className="text-center py-16">
          <p className="text-brown/50 font-serif text-xl">No books found</p>
          <p className="text-brown/40 mt-2">Try a different search term{selectedGenres.length > 0 ? ' or clear genre filters' : ''}</p>
        </div>
      ) : null}
    </div>
  );
}
