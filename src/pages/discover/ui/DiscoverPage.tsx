import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, BookOpen, Star, Users, ArrowRight, ThumbsDown,
  ChevronRight, Loader2, RefreshCw, ChevronLeft,
} from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { BookCard } from '@/shared/ui/BookCard';
import { getBookCoverUrl, getBookColor } from '@/shared/config';
import { bookPath } from '@/shared/lib/bookKeys';
import { addToReadingList } from '@/shared/lib/readingListApi';
import {
  getFeaturedRecommendations,
  getContentBasedRecommendations,
  getCollaborativeRecommendations,
  markNotInterested,
  type FeaturedBook,
  type ContentBasedSection,
  type RecBook,
} from '@/features/recommendations/api/recommendationsApi';
import { BookDescription } from '@/shared/ui/BookDescription';

export function DiscoverPage() {
  const navigate = useNavigate();

  // State
  const [featuredBooks, setFeaturedBooks] = useState<FeaturedBook[]>([]);
  const [featuredPage, setFeaturedPage] = useState(0);
  const [featuredHasMore, setFeaturedHasMore] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const featured = featuredBooks[carouselIndex] ?? null;

  useEffect(() => {
    setCarouselIndex(0);
  }, [featuredBooks]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [contentSections, setContentSections] = useState<ContentBasedSection[]>([]);
  const [contentLoading, setContentLoading] = useState(true);
  const [collabBooks, setCollabBooks] = useState<RecBook[]>([]);
  const [collabLoading, setCollabLoading] = useState(true);
  const [featuredAction, setFeaturedAction] = useState<'idle' | 'adding' | 'dismissing'>('idle');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const featuredPageRef = useRef(0);

  // Load all recommendations in parallel
  const loadRecommendations = useCallback((bumpFeaturedPage = false) => {
    setFeaturedLoading(true);
    setContentLoading(true);
    setCollabLoading(true);

    const fp = bumpFeaturedPage ? featuredPageRef.current + 1 : 0;
    featuredPageRef.current = fp;
    setFeaturedPage(fp);

    getFeaturedRecommendations(fp, 8)
      .then(({ books, hasMore }) => {
        setFeaturedBooks(books);
        setFeaturedHasMore(hasMore);
      })
      .catch(() => {
        setFeaturedBooks([]);
        setFeaturedHasMore(false);
      })
      .finally(() => setFeaturedLoading(false));

    getContentBasedRecommendations()
      .then(({ sections }) => setContentSections(sections))
      .catch(() => setContentSections([]))
      .finally(() => setContentLoading(false));

    getCollaborativeRecommendations()
      .then(({ books }) => setCollabBooks(books))
      .catch(() => setCollabBooks([]))
      .finally(() => setCollabLoading(false));
  }, []);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  // Handlers
  const handleWantToRead = async () => {
    if (!featured || featuredAction !== 'idle') return;
    setFeaturedAction('adding');
    try {
      await addToReadingList(
        featured.key,
        featured.title,
        featured.author,
        featured.coverId,
        'want',
      );
      // Refresh featured to get a new book
      setFeaturedLoading(true);
      const { books } = await getFeaturedRecommendations(featuredPageRef.current, 8);
      setFeaturedBooks(books);
    } catch { /* ignore */ }
    setFeaturedAction('idle');
    setFeaturedLoading(false);
  };

  const handleNotInterested = async () => {
    if (!featured || featuredAction !== 'idle') return;
    setFeaturedAction('dismissing');
    try {
      await markNotInterested(
        featured.key,
        featured.title,
        featured.author,
        featured.coverId,
      );
      // Refresh featured
      setFeaturedLoading(true);
      const { books } = await getFeaturedRecommendations(featuredPageRef.current, 8);
      setFeaturedBooks(books);
    } catch { /* ignore */ }
    setFeaturedAction('idle');
    setFeaturedLoading(false);
  };

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-brown flex items-center gap-3">
            <Sparkles className="text-amber" size={28} />
            Discover
          </h1>
          <p className="text-brown/60 mt-1">
            Personalized recommendations just for you
            <span className="ml-2 text-xs text-brown/40">(set #{featuredPage + 1})</span>
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<RefreshCw size={14} />}
          onClick={() => loadRecommendations(true)}
          title={featuredHasMore ? 'Load the next set of recommendations' : 'Reload recommendations (next set when available)'}
        >
          Refresh
        </Button>
      </div>

      {/* ─── Featured Recommendation Card ──────────────────────────── */}
      <AnimatePresence mode="wait">
        {featuredLoading ? (
          <motion.div
            key="featured-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-3xl shadow-warm border border-brown/5 p-8 sm:p-12"
          >
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-amber" size={32} />
              <span className="ml-3 text-brown/60 font-serif">Finding your next great read...</span>
            </div>
          </motion.div>
        ) : featured ? (
          <motion.div
            key={`featured-${featured.key}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="bg-white rounded-3xl shadow-warm border border-brown/5 overflow-hidden relative"
          >
            {featuredBooks.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous recommendation"
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/90 shadow border border-brown/10 text-brown hover:bg-cream transition"
                  onClick={() => setCarouselIndex((i) => (i - 1 + featuredBooks.length) % featuredBooks.length)}
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  type="button"
                  aria-label="Next recommendation"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/90 shadow border border-brown/10 text-brown hover:bg-cream transition"
                  onClick={() => setCarouselIndex((i) => (i + 1) % featuredBooks.length)}
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}
            <div className="flex flex-col md:flex-row">
              {/* Cover */}
              <div className="md:w-72 lg:w-80 flex-shrink-0 relative">
                <div className="aspect-[2/3] md:aspect-auto md:h-full w-full max-w-[280px] mx-auto md:max-w-none">
                  {featured.coverId ? (
                    <img
                      src={getBookCoverUrl(featured.coverId, 'L')}
                      alt={featured.title}
                      className="w-full h-full object-cover md:rounded-l-3xl"
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${getBookColor(featured.key)} md:rounded-l-3xl flex items-center justify-center p-8`}>
                      <h2 className="text-white font-serif text-2xl text-center font-bold">{featured.title}</h2>
                    </div>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="flex-1 p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
                <div>
                  {/* Reason badge */}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber/15 text-amber-800 rounded-full text-xs font-medium mb-4">
                    <Sparkles size={12} />
                    {featured.matchingGenres && featured.matchingGenres.length > 0
                      ? `Matches your favorite genres: ${featured.matchingGenres.join(', ')}`
                      : featured.reason ?? 'Recommended for you'}
                  </span>

                  <h2
                    className="text-2xl sm:text-3xl font-serif font-bold text-brown leading-tight cursor-pointer hover:text-amber-800 transition-colors"
                    onClick={() => navigate(bookPath(featured.key))}
                  >
                    {featured.title}
                  </h2>
                  <p className="text-lg text-brown/70 mt-1">by {featured.author}</p>

                  {/* Ratings */}
                  {featured.ratingsCount > 0 && (
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={16}
                            className={
                              star <= Math.round(featured.ratingsAverage)
                                ? 'fill-amber text-amber'
                                : 'text-brown/20'
                            }
                          />
                        ))}
                      </div>
                      <span className="text-sm text-brown/60">
                        {featured.ratingsAverage.toFixed(1)} ({featured.ratingsCount} ratings)
                      </span>
                    </div>
                  )}

                  {/* Subjects */}
                  {featured.subjects.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {featured.subjects.map((s) => (
                        <span
                          key={s}
                          className="px-2.5 py-0.5 bg-cream text-brown/70 rounded-full text-xs font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Description */}
                  {featured.description && (
                    <div className="mt-4 text-brown/70">
                      <BookDescription text={featured.description} clamp />
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-brown/5">
                  <Button
                    variant="wood"
                    size="lg"
                    leftIcon={<BookOpen size={18} />}
                    onClick={handleWantToRead}
                    isLoading={featuredAction === 'adding'}
                  >
                    Want to Read
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    leftIcon={<ThumbsDown size={16} />}
                    onClick={handleNotInterested}
                    isLoading={featuredAction === 'dismissing'}
                    className="text-brown/50 hover:text-brown/80"
                  >
                    Not Interested
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    rightIcon={<ChevronRight size={16} />}
                    onClick={() => navigate(bookPath(featured.key))}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </div>
            {featuredBooks.length > 1 && (
              <div className="flex justify-center gap-2 py-3 border-t border-brown/5 bg-cream/30">
                {featuredBooks.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Go to recommendation ${i + 1}`}
                    className={`h-2 rounded-full transition-all ${i === carouselIndex ? 'w-8 bg-amber' : 'w-2 bg-brown/25 hover:bg-brown/40'}`}
                    onClick={() => setCarouselIndex(i)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="no-featured"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-3xl shadow-warm border border-brown/5 p-8 text-center"
          >
            <Sparkles className="mx-auto text-amber/40 mb-4" size={48} />
            <h3 className="text-xl font-serif font-bold text-brown mb-2">
              Add books to get recommendations
            </h3>
            <p className="text-brown/60 mb-4">
              Start by adding some books to your reading list or marking favorites genres.
            </p>
            <Button variant="wood" onClick={() => navigate('/search?q=popular')}>
              Browse Books
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Content-Based Filtering: "Because you liked..." ──────── */}
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <BookOpen size={22} className="text-amber" />
          <h2 className="text-2xl font-serif font-bold text-brown">Because You Liked</h2>
        </div>

        {contentLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-amber" size={24} />
            <span className="ml-2 text-brown/60">Analyzing your taste...</span>
          </div>
        ) : contentSections.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-warm border border-brown/5 p-8 text-center">
            <p className="text-brown/60">
              Read or add some books to get personalized content-based recommendations.
            </p>
          </div>
        ) : (
          contentSections.map((section) => {
            const sectionKey = section.sourceBook.key;
            const isExpanded = expandedSection === sectionKey;
            const displayBooks = isExpanded ? section.books : section.books.slice(0, 6);

            return (
              <div key={sectionKey} className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-serif font-bold text-brown/80">
                    Because you liked{' '}
                    <span
                      className="text-amber-700 cursor-pointer hover:underline"
                      onClick={() => navigate(bookPath(section.sourceBook.key))}
                    >
                      {section.sourceBook.title}
                    </span>
                  </h3>
                  {section.books.length > 6 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      rightIcon={<ArrowRight size={14} />}
                      onClick={() =>
                        setExpandedSection(isExpanded ? null : sectionKey)
                      }
                    >
                      {isExpanded ? 'Show Less' : 'View All'}
                    </Button>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute bottom-0 left-0 right-0 h-4 bg-[#8B5E3C] rounded-sm shadow-md translate-y-2 z-0" />
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#6d4a2f] translate-y-2 z-10 opacity-50" />
                  <div className="flex gap-6 overflow-x-auto pb-8 pt-4 px-2 scrollbar-hide relative z-20">
                    {displayBooks.map((book) => (
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
              </div>
            );
          })
        )}
      </section>

      {/* ─── Collaborative Filtering: "Readers Like You" ──────────── */}
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Users size={22} className="text-teal" />
          <h2 className="text-2xl font-serif font-bold text-brown">
            Readers Like You Also Enjoyed
          </h2>
        </div>

        {collabLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-teal" size={24} />
            <span className="ml-2 text-brown/60">Finding like-minded readers...</span>
          </div>
        ) : collabBooks.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-warm border border-brown/5 p-8 text-center">
            <Users className="mx-auto text-teal/40 mb-4" size={48} />
            <p className="text-brown/60">
              As more readers join ShelfEcho, we'll be able to recommend books from people with similar taste.
            </p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-[#8B5E3C] rounded-sm shadow-md translate-y-2 z-0" />
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#6d4a2f] translate-y-2 z-10 opacity-50" />
            <div className="flex gap-6 overflow-x-auto pb-8 pt-4 px-2 scrollbar-hide relative z-20">
              {collabBooks.map((book) => (
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
        )}
      </section>
    </div>
  );
}
