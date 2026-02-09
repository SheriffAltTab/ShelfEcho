import { useEffect, useState } from 'react';
import { ArrowRight, Flame, Quote } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { BookCard } from '@/shared/ui/BookCard';
import { Link, useNavigate } from 'react-router-dom';
import { getTrendingBooks, getBooksBySubject } from '@/entities/book/api/bookApi';
import type { Book } from '@/entities/book/model/types';
import { getBookColor, getBookCoverUrl } from '@/shared/config';
import { useAuth } from '@/features/auth/model/authContext';
import { getReadingList } from '@/shared/lib/readingListApi';
import type { ReadingListItem } from '@/entities/book/model/types';
import { bookPath } from '@/shared/lib/bookKeys';

interface ShelfData {
  title: string;
  subject: string;
  books: Book[];
  loaded: boolean;
}

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trendingBooks, setTrendingBooks] = useState<Book[]>([]);
  const [trendingLoaded, setTrendingLoaded] = useState(false);
  const [shelves, setShelves] = useState<ShelfData[]>([
    { title: 'Fantasy Adventures', subject: 'fantasy', books: [], loaded: false },
    { title: 'Mystery & Thriller', subject: 'mystery', books: [], loaded: false },
  ]);
  const [currentlyReading, setCurrentlyReading] = useState<ReadingListItem[]>([]);

  // Load trending first (fastest), then subjects one-by-one
  useEffect(() => {
    // Load trending + reading list in parallel
    Promise.allSettled([
      getTrendingBooks(),
      getReadingList('reading'),
    ]).then(([trending, reading]) => {
      if (trending.status === 'fulfilled') setTrendingBooks(trending.value.books.slice(0, 8));
      setTrendingLoaded(true);
      if (reading.status === 'fulfilled') setCurrentlyReading(reading.value.books.slice(0, 3));
    });
  }, []);

  // Load subjects incrementally after trending
  useEffect(() => {
    if (!trendingLoaded) return;

    shelves.forEach((shelf, idx) => {
      if (shelf.loaded) return;
      getBooksBySubject(shelf.subject, 8)
        .then(({ books }) => {
          setShelves((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], books: books.slice(0, 8), loaded: true };
            return next;
          });
        })
        .catch(() => {
          setShelves((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], loaded: true };
            return next;
          });
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendingLoaded]);

  const featuredBook = trendingBooks[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-8 space-y-12">
        {/* Hero — trending */}
        {!trendingLoaded ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber border-t-transparent mx-auto mb-4" />
              <p className="text-brown/60 font-serif text-lg">Loading your bookshelf...</p>
            </div>
          </div>
        ) : featuredBook ? (
          <section className="relative bg-cream rounded-3xl p-8 sm:p-12 overflow-hidden shadow-warm border border-white/50">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex flex-col sm:flex-row gap-8 items-center">
              <div className="flex-1 space-y-6 text-center sm:text-left">
                <span className="inline-block px-3 py-1 bg-rose/20 text-brown-dark rounded-full text-sm font-serif italic">
                  Trending Today
                </span>
                <h1 className="text-4xl sm:text-5xl font-serif font-bold text-brown leading-tight">
                  {featuredBook.title}
                </h1>
                <p className="text-lg text-brown/70">by {featuredBook.author}</p>
                <div className="flex gap-4 justify-center sm:justify-start">
                  <Button variant="wood" size="lg" onClick={() => navigate(bookPath(featuredBook.key))}>
                    Pick This Up
                  </Button>
                </div>
              </div>
              <div className="flex-shrink-0 relative group">
                <div className="absolute inset-0 bg-amber/20 blur-xl rounded-full transform group-hover:scale-110 transition-transform duration-500" />
                <BookCard
                  title={featuredBook.title}
                  author={featuredBook.author}
                  coverId={featuredBook.coverId}
                  coverColor={getBookColor(featuredBook.key)}
                  className="w-48 sm:w-56 transform rotate-3 group-hover:rotate-0 transition-all duration-500"
                  onClick={() => navigate(bookPath(featuredBook.key))}
                />
              </div>
            </div>
          </section>
        ) : null}

        {/* Trending shelf */}
        {trendingBooks.length > 0 && (
          <section className="space-y-6">
            <div className="flex justify-between items-end border-b border-brown/10 pb-2">
              <h2 className="text-2xl font-serif font-bold text-brown">Trending Now</h2>
              <Button
                variant="ghost"
                size="sm"
                rightIcon={<ArrowRight size={14} />}
                onClick={() => navigate('/search?q=trending')}
              >
                View All
              </Button>
            </div>
            <div className="relative">
              <div className="absolute bottom-0 left-0 right-0 h-4 bg-[#8B5E3C] rounded-sm shadow-md translate-y-2 z-0" />
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#6d4a2f] translate-y-2 z-10 opacity-50" />
              <div className="flex gap-6 overflow-x-auto pb-8 pt-4 px-2 scrollbar-hide relative z-20">
                {trendingBooks.map((book) => (
                  <BookCard
                    key={book.key}
                    title={book.title}
                    author={book.author}
                    coverId={book.coverId}
                    coverColor={getBookColor(book.key)}
                    className="hover:-translate-y-4 transition-transform duration-300"
                    onClick={() => navigate(bookPath(book.key))}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Subject shelves — load incrementally */}
        {shelves.map((shelf) => (
          <section key={shelf.subject} className="space-y-6">
            <div className="flex justify-between items-end border-b border-brown/10 pb-2">
              <h2 className="text-2xl font-serif font-bold text-brown">{shelf.title}</h2>
              <Button
                variant="ghost"
                size="sm"
                rightIcon={<ArrowRight size={14} />}
                onClick={() => navigate(`/search?q=${encodeURIComponent(shelf.subject)}`)}
              >
                View All
              </Button>
            </div>

            {!shelf.loaded ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-3 border-amber border-t-transparent" />
              </div>
            ) : shelf.books.length > 0 ? (
              <div className="relative">
                <div className="absolute bottom-0 left-0 right-0 h-4 bg-[#8B5E3C] rounded-sm shadow-md translate-y-2 z-0" />
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#6d4a2f] translate-y-2 z-10 opacity-50" />
                <div className="flex gap-6 overflow-x-auto pb-8 pt-4 px-2 scrollbar-hide relative z-20">
                  {shelf.books.map((book) => (
                    <BookCard
                      key={book.key}
                      title={book.title}
                      author={book.author}
                      coverId={book.coverId}
                      coverColor={getBookColor(book.key)}
                      className="hover:-translate-y-4 transition-transform duration-300"
                      onClick={() => navigate(bookPath(book.key))}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ))}
      </div>

      {/* Right Sidebar */}
      <div className="lg:col-span-4 space-y-8">
        {currentlyReading.length > 0 && (
          <div className="bg-white p-6 rounded-2xl shadow-warm border border-brown/5">
            <h3 className="font-serif font-bold text-xl text-brown mb-4 flex items-center gap-2">
              Reading Nook
            </h3>
            {currentlyReading.map((book) => {
              const coverUrl = getBookCoverUrl(book.cover_id, 'M');
              const progressPct = book.total_pages > 0
                ? Math.min(100, Math.round((book.pages_read / book.total_pages) * 100))
                : book.progress;
              return (
                <Link key={book.id} to={bookPath(book.book_key)}>
                  <div className="flex gap-4 mb-4">
                    <div className="w-16 h-24 rounded shadow-md flex-shrink-0 overflow-hidden">
                      {coverUrl ? (
                        <img src={coverUrl} alt={book.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${getBookColor(book.book_key)}`} />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-brown">{book.title}</h4>
                      <p className="text-sm text-brown/60 mb-2">{book.author}</p>
                      <div className="text-xs text-amber-700 font-medium">{progressPct}% complete</div>
                    </div>
                  </div>
                  <div className="w-full bg-brown/10 rounded-full h-2 mb-4">
                    <div className="bg-amber h-2 rounded-full" style={{ width: `${progressPct}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="bg-amber/10 p-6 rounded-2xl border border-amber/20 flex items-center justify-between">
          <div>
            <p className="text-sm text-brown/60 uppercase tracking-wider font-bold">Reading Goal</p>
            <p className="text-3xl font-serif font-bold text-brown">{user?.readingGoal || 12} Books</p>
          </div>
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm">
            <Flame className="text-orange-500 fill-orange-500" />
          </div>
        </div>

        <div className="bg-teal/10 p-6 rounded-2xl border border-teal/20 relative overflow-hidden">
          <Quote className="absolute top-4 left-4 text-teal/20 w-12 h-12 transform -scale-x-100" />
          <div className="relative z-10 pt-4">
            <p className="font-serif italic text-lg text-brown/80 mb-4 leading-relaxed">
              "A reader lives a thousand lives before he dies. The man who never reads lives only one."
            </p>
            <p className="text-sm font-bold text-teal-800">— George R.R. Martin</p>
          </div>
        </div>
      </div>
    </div>
  );
}
