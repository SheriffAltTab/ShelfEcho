import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import { BookCard } from '@/shared/ui/BookCard';
import { Button } from '@/shared/ui/Button';
import { searchBooks } from '@/entities/book/api/bookApi';
import type { Book } from '@/entities/book/model/types';
import { getBookColor } from '@/shared/config';
import { bookPath } from '@/shared/lib/bookKeys';

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const doSearch = useCallback(async (q: string, p: number) => {
    if (!q.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }
    setIsLoading(true);
    try {
      const data = await searchBooks(q, p);
      if (p === 1) {
        setResults(data.books);
      } else {
        setResults((prev) => [...prev, ...data.books]);
      }
      setTotal(data.total);
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    setQuery(q);
    setPage(1);
    doSearch(q, 1);
  }, [searchParams, doSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams({ q: query });
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    doSearch(query, nextPage);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-serif font-bold text-brown mb-6">Search Books</h1>
        <form onSubmit={handleSearch} className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brown/40" size={20} />
          <input
            type="text"
            placeholder="Search by title, author, or subject..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-cream border border-brown/10 rounded-xl py-4 pl-12 pr-24 text-brown text-lg placeholder:text-brown/40 focus:outline-none focus:ring-2 focus:ring-amber/50 focus:border-transparent transition-all"
            autoFocus
          />
          <Button type="submit" variant="wood" className="absolute right-2 top-1/2 -translate-y-1/2">
            Search
          </Button>
        </form>
      </div>

      {searchParams.get('q') && (
        <p className="text-brown/60">
          {isLoading && page === 1
            ? 'Searching...'
            : `Found ${total.toLocaleString()} results for "${searchParams.get('q')}"`}
        </p>
      )}

      {isLoading && page === 1 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-amber" size={40} />
        </div>
      ) : results.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {results.map((book, idx) => (
              <BookCard
                key={`${book.key}-${idx}`}
                title={book.title}
                author={book.author}
                coverId={book.coverId}
                coverColor={getBookColor(book.key)}
                onClick={() => navigate(bookPath(book.key))}
              />
            ))}
          </div>
          {results.length < total && (
            <div className="text-center pt-4">
              <Button variant="outline" onClick={handleLoadMore} isLoading={isLoading && page > 1}>
                Load More
              </Button>
            </div>
          )}
        </>
      ) : searchParams.get('q') ? (
        <div className="text-center py-16">
          <p className="text-brown/50 font-serif text-xl">No books found</p>
          <p className="text-brown/40 mt-2">Try a different search term</p>
        </div>
      ) : null}
    </div>
  );
}
