import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { BookCard } from '@/shared/ui/BookCard';
import { getBookColor } from '@/shared/config';
import { bookPath } from '@/shared/lib/bookKeys';
import apiClient from '@/shared/api/apiClient';
import { BookDescription } from '@/shared/ui/BookDescription';

interface AuthorBook {
  key: string;
  title: string;
  coverId: number | null;
  firstPublishYear: string;
}

interface AuthorData {
  key: string;
  name: string;
  bio: string;
  photoId: number | null;
  birthDate: string;
  books: AuthorBook[];
  totalWorks: number;
}

export function AuthorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const authorKey = location.pathname.replace(/^\/author\//, '');

  const [author, setAuthor] = useState<AuthorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authorKey) {
      setIsLoading(false);
      setError('Invalid author');
      return;
    }

    async function loadAuthor() {
      setIsLoading(true);
      setError(null);
      try {
        const { data } = await apiClient.get<AuthorData>('/books/author-info', { params: { key: authorKey } });
        setAuthor(data);
      } catch (err: unknown) {
        const msg = err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
        setError(msg || 'Failed to load author');
      } finally {
        setIsLoading(false);
      }
    }

    loadAuthor();
  }, [authorKey]);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-amber" size={32} />
          <span className="ml-3 text-brown/60 font-serif">Loading author...</span>
        </div>
      </div>
    );
  }

  if (error || !author) {
    return (
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-brown/60 hover:text-brown mb-6 transition-colors"
        >
          <ArrowLeft size={18} /> Back
        </button>
        <div className="text-center py-24">
          <h2 className="text-2xl font-serif font-bold text-brown mb-4">
            {error || 'Author not found'}
          </h2>
          <button
            onClick={() => navigate(-1)}
            className="text-brown/70 hover:text-brown font-serif underline"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const photoUrl = author.photoId
    ? `https://covers.openlibrary.org/a/id/${author.photoId}-L.jpg`
    : null;

  return (
    <div className="max-w-5xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-brown/60 hover:text-brown mb-6 transition-colors"
      >
        <ArrowLeft size={18} /> Back
      </button>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
          <div className="md:col-span-4 flex flex-col items-center">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={author.name}
                className="w-full max-w-xs aspect-square object-cover rounded-2xl shadow-warm mb-6"
              />
            ) : (
              <div className="w-full max-w-xs aspect-square rounded-2xl shadow-warm bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center mb-6">
                <span className="text-cream/90 font-serif text-4xl font-bold">
                  {author.name.charAt(0)}
                </span>
              </div>
            )}

            <div className="w-full space-y-2 text-center md:text-left">
              {author.birthDate && (
                <p className="text-brown/70 font-serif text-sm">
                  Born {author.birthDate}
                </p>
              )}
            </div>
          </div>

          <div className="md:col-span-8">
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-brown mb-4">
              {author.name}
            </h1>

            {author.bio && (
              <div className="mb-8">
                <BookDescription text={author.bio} />
              </div>
            )}

            <h2 className="text-xl font-serif font-bold text-brown mb-4">
              Works ({author.totalWorks})
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {author.books.map((book) => (
            <BookCard
              key={book.key}
              title={book.title}
              author={author.name}
              coverId={book.coverId}
              coverColor={getBookColor(book.key)}
              onClick={() => navigate(bookPath(book.key))}
            />
          ))}
        </div>

        {author.books.length === 0 && (
          <p className="text-brown/60 font-serif text-center py-12">
            No books found for this author.
          </p>
        )}
      </motion.div>
    </div>
  );
}
