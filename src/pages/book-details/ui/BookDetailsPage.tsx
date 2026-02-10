import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Heart, BookOpen, Share2, ArrowLeft, Send, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { BookCard } from '@/shared/ui/BookCard';
import { getBookDetails, getBooksBySubject } from '@/entities/book/api/bookApi';
import type { BookDetails } from '@/entities/book/model/types';
import type { Book } from '@/entities/book/model/types';
import { getBookCoverUrl, getBookColor } from '@/shared/config';
import { addFavorite, removeFavorite, checkFavorite } from '@/features/favorites/api/favoritesApi';
import { addToReadingList, checkReadingList, updateReadingItem } from '@/shared/lib/readingListApi';
import { getComments, addComment, editComment, deleteComment, type Comment } from '@/features/comments/api/commentsApi';
import { bookPath } from '@/shared/lib/bookKeys';
import { useAuth } from '@/features/auth/model/authContext';
import { BookDescription } from '@/shared/ui/BookDescription';

export function BookDetailsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [book, setBook] = useState<BookDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [inReadingList, setInReadingList] = useState(false);
  const [readingStatus, setReadingStatus] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [similarBooks, setSimilarBooks] = useState<Book[]>([]);
  const [actionLoading, setActionLoading] = useState('');

  // Reading progress
  const [totalPages, setTotalPages] = useState(0);
  const [pagesRead, setPagesRead] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [progressSaving, setProgressSaving] = useState(false);

  // Edit review
  const [editingReview, setEditingReview] = useState<Comment | null>(null);
  const [editText, setEditText] = useState('');
  const [editRating, setEditRating] = useState(5);

  const workId = location.pathname.replace(/^\/book\//, '');

  // Check if current user already has a review
  const userReview = comments.find((c) => c.user_id === user?.id);

  useEffect(() => {
    if (!workId) return;

    async function loadData() {
      setIsLoading(true);
      try {
        const details = await getBookDetails(workId);
        setBook(details);

        const [favCheck, rlCheck, commentsRes] = await Promise.allSettled([
          checkFavorite(workId),
          checkReadingList(workId),
          getComments(workId),
        ]);

        if (favCheck.status === 'fulfilled') setIsFavorite(favCheck.value);
        if (rlCheck.status === 'fulfilled') {
          setInReadingList(rlCheck.value.inList);
          setReadingStatus(rlCheck.value.status);
          if (rlCheck.value.totalPages) setTotalPages(rlCheck.value.totalPages);
          if (rlCheck.value.pagesRead) setPagesRead(rlCheck.value.pagesRead);
        }
        if (commentsRes.status === 'fulfilled') setComments(commentsRes.value.comments);

        if (details.subjects?.length > 0) {
          try {
            const subject = details.subjects[0].toLowerCase().replace(/\s+/g, '_');
            const { books } = await getBooksBySubject(subject, 6);
            setSimilarBooks(books.filter((b) => b.key !== workId));
          } catch { /* ignore */ }
        }
      } catch (err) {
        console.error('Failed to load book details:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [workId]);

  const handleToggleFavorite = async () => {
    if (!book) return;
    setActionLoading('fav');
    try {
      if (isFavorite) {
        await removeFavorite(workId);
        setIsFavorite(false);
      } else {
        await addFavorite(workId, book.title, book.author, book.coverId);
        setIsFavorite(true);
      }
    } catch { /* ignore */ }
    setActionLoading('');
  };

  const handleChangeStatus = async (status: 'reading' | 'want' | 'read') => {
    if (!book) return;
    setActionLoading(status);
    try {
      if (inReadingList) {
        await updateReadingItem(workId, { status });
      } else {
        await addToReadingList(workId, book.title, book.author, book.coverId, status);
      }
      setInReadingList(true);
      setReadingStatus(status);
    } catch { /* ignore */ }
    setActionLoading('');
  };

  const handleRemoveFromShelf = async () => {
    setActionLoading('remove');
    try {
      const { removeFromReadingList } = await import('@/shared/lib/readingListApi');
      await removeFromReadingList(workId);
      setInReadingList(false);
      setReadingStatus(null);
      setTotalPages(0);
      setPagesRead(0);
    } catch { /* ignore */ }
    setActionLoading('');
  };

  const handleSaveProgress = async () => {
    setProgressSaving(true);
    try {
      await updateReadingItem(workId, { totalPages, pagesRead });
      setShowProgress(false);
    } catch { /* ignore */ }
    setProgressSaving(false);
  };

  const progressPercent = totalPages > 0 ? Math.min(100, Math.round((pagesRead / totalPages) * 100)) : 0;

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const { comment, updated } = await addComment(workId, newComment.trim(), newRating);
      if (updated) {
        setComments((prev) => prev.map((c) => c.user_id === user?.id ? comment : c));
      } else {
        setComments([comment, ...comments]);
      }
      setNewComment('');
      setNewRating(5);
    } catch { /* ignore */ }
    setSubmittingComment(false);
  };

  const handleStartEdit = (review: Comment) => {
    setEditingReview(review);
    setEditText(review.text);
    setEditRating(review.rating);
  };

  const handleSaveEdit = async () => {
    if (!editingReview) return;
    try {
      const { comment } = await editComment(editingReview.id, editText, editRating);
      setComments((prev) => prev.map((c) => c.id === editingReview.id ? comment : c));
      setEditingReview(null);
    } catch { /* ignore */ }
  };

  const handleDeleteReview = async (id: number) => {
    try {
      await deleteComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch { /* ignore */ }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber border-t-transparent" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-serif font-bold text-brown mb-4">Book not found</h2>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const coverUrl = getBookCoverUrl(book.coverId, 'L');

  return (
    <div className="max-w-5xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-brown/60 hover:text-brown mb-6 transition-colors"
      >
        <ArrowLeft size={18} /> Back
      </button>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
        <div className="md:col-span-4 flex flex-col items-center">
          <div className="relative w-full max-w-xs aspect-[2/3] mb-8 group">
            <div className="absolute inset-0 bg-brown/20 translate-y-4 translate-x-4 rounded-r-lg rounded-l-sm blur-sm" />
            <div className="relative h-full w-full rounded-r-lg rounded-l-sm shadow-2xl overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-4 bg-black/20 z-10" />
              {coverUrl ? (
                <img src={coverUrl} alt={book.title} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${getBookColor(workId)} p-6 flex flex-col justify-between`}>
                  <div className="relative z-20 text-cream text-center mt-8">
                    <h1 className="font-serif text-3xl font-bold leading-tight mb-2">{book.title}</h1>
                    <p className="font-sans text-cream/80 italic">{book.author}</p>
                  </div>
                  <div className="relative z-20 flex justify-center pb-4">
                    <div className="w-12 h-12 rounded-full bg-cream/10 backdrop-blur-sm flex items-center justify-center">
                      <BookOpen className="text-cream" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status selector */}
          <div className="w-full max-w-xs space-y-3">
            <div className="flex gap-2">
              {(['reading', 'want', 'read'] as const).map((status) => {
                const labels = { reading: 'Reading', want: 'Want to Read', read: 'Completed' };
                const isActive = readingStatus === status;
                return (
                  <Button
                    key={status}
                    variant={isActive ? 'wood' : 'outline'}
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => handleChangeStatus(status)}
                    isLoading={actionLoading === status}
                  >
                    {labels[status]}
                  </Button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 px-3"
                onClick={handleToggleFavorite}
                isLoading={actionLoading === 'fav'}
              >
                <Heart size={18} className={isFavorite ? 'fill-rose text-rose' : ''} />
                <span className="ml-2 text-sm">{isFavorite ? 'Liked' : 'Like'}</span>
              </Button>
              <Button variant="outline" className="px-3" onClick={() => navigator.clipboard.writeText(window.location.href)}>
                <Share2 size={18} />
              </Button>
            </div>

            {inReadingList && (
              <button
                onClick={handleRemoveFromShelf}
                className="w-full text-xs text-brown/40 hover:text-rose transition-colors py-1"
              >
                Remove from shelf
              </button>
            )}

            {/* Reading progress for "currently reading" */}
            {readingStatus === 'reading' && (
              <div className="bg-cream rounded-xl p-4 border border-brown/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-brown">Progress</span>
                  {totalPages > 0 && (
                    <span className="text-sm font-bold text-amber-700">{progressPercent}%</span>
                  )}
                </div>

                {totalPages > 0 && (
                  <div className="w-full bg-brown/10 rounded-full h-2 mb-3">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      className="bg-amber h-2 rounded-full"
                    />
                  </div>
                )}

                {showProgress ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-brown/50">Pages read</label>
                        <input
                          type="number"
                          min="0"
                          max={totalPages || 99999}
                          value={pagesRead || ''}
                          onChange={(e) => setPagesRead(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full bg-linen border border-brown/10 rounded-lg py-1.5 px-2 text-sm text-brown"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-brown/50">Total pages</label>
                        <input
                          type="number"
                          min="1"
                          value={totalPages || ''}
                          onChange={(e) => setTotalPages(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full bg-linen border border-brown/10 rounded-lg py-1.5 px-2 text-sm text-brown"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShowProgress(false)} className="flex-1 text-xs">Cancel</Button>
                      <Button variant="wood" size="sm" onClick={handleSaveProgress} isLoading={progressSaving} className="flex-1 text-xs">Save</Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowProgress(true)}
                    className="text-xs text-amber-700 hover:text-amber-800 font-medium"
                  >
                    {totalPages > 0 ? `${pagesRead} / ${totalPages} pages` : 'Set page progress'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-8 space-y-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-brown mb-2">{book.title}</h1>
            <div className="flex items-center gap-4 mb-6">
              <span className="text-lg text-brown/80 font-medium">{book.author}</span>
              {book.ratingsAverage > 0 && (
                <>
                  <span className="text-brown/30">&bull;</span>
                  <div className="flex items-center gap-1 text-amber-600 font-bold">
                    <Star className="fill-amber-500 text-amber-500" size={16} />
                    {book.ratingsAverage.toFixed(1)}
                    <span className="text-brown/40 text-sm font-normal">({book.ratingsCount})</span>
                  </div>
                </>
              )}
            </div>

            {book.subjects.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {book.subjects.map((tag, i) => (
                  <Badge key={tag} variant={i % 3 === 0 ? 'amber' : i % 3 === 1 ? 'rose' : 'teal'}>
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {book.description && (
              <div className="mb-8 text-lg">
                <BookDescription text={book.description} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 border-y border-brown/10 py-6">
              {book.firstPublishDate && (
                <div className="text-center">
                  <p className="text-xs text-brown/50 uppercase tracking-wider font-bold mb-1">Published</p>
                  <p className="font-serif font-bold text-xl text-brown">{book.firstPublishDate}</p>
                </div>
              )}
              {book.subjects[0] && (
                <div className="text-center">
                  <p className="text-xs text-brown/50 uppercase tracking-wider font-bold mb-1">Genre</p>
                  <p className="font-serif font-bold text-xl text-brown">{book.subjects[0]}</p>
                </div>
              )}
            </div>
          </div>

          {/* Reviews Section */}
          <div>
            <h3 className="text-2xl font-serif font-bold text-brown mb-6">Reader Notes</h3>

            {/* Show form only if user hasn't reviewed yet */}
            {!userReview ? (
              <form onSubmit={handleSubmitComment} className="mb-6 bg-cream p-4 rounded-2xl border border-brown/10">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium text-brown">Your rating:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" onClick={() => setNewRating(star)} className="focus:outline-none">
                        <Star size={18} className={star <= newRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share your thoughts about this book..."
                    className="flex-1 bg-linen border border-brown/10 rounded-xl py-2 px-4 text-brown placeholder:text-brown/40 focus:outline-none focus:ring-2 focus:ring-amber/50"
                  />
                  <Button type="submit" variant="wood" isLoading={submittingComment} disabled={!newComment.trim()}>
                    <Send size={16} />
                  </Button>
                </div>
              </form>
            ) : (
              <p className="text-sm text-brown/50 mb-4 italic">You have already reviewed this book. You can edit or delete your review below.</p>
            )}

            {comments.length === 0 ? (
              <p className="text-brown/50 text-center py-6 font-serif italic">
                No reviews yet. Be the first to share your thoughts!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {comments.map((review, i) => {
                  const isOwn = review.user_id === user?.id;
                  const isEditing = editingReview?.id === review.id;

                  return (
                    <motion.div
                      key={review.id}
                      whileHover={{ rotate: 0, scale: 1.02 }}
                      className={`bg-white p-6 shadow-md border ${isOwn ? 'border-amber/30 ring-1 ring-amber/20' : 'border-brown/5'} ${i % 2 === 0 ? '-rotate-1' : 'rotate-1'}`}
                      style={{ borderRadius: '2px 2px 2px 20px' }}
                    >
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button key={star} type="button" onClick={() => setEditRating(star)} className="focus:outline-none">
                                <Star size={14} className={star <= editRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'} />
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full bg-linen border border-brown/10 rounded-lg py-2 px-3 text-sm text-brown focus:outline-none focus:ring-2 focus:ring-amber/50"
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditingReview(null)}>Cancel</Button>
                            <Button variant="wood" size="sm" onClick={handleSaveEdit}>Save</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-3">
                            <span className="font-bold text-brown font-serif">{review.user_name}</span>
                            <div className="flex items-center gap-2">
                              <div className="flex">
                                {[...Array(5)].map((_, idx) => (
                                  <Star key={idx} size={12} className={idx < review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'} />
                                ))}
                              </div>
                              {isOwn && (
                                <div className="flex gap-1 ml-2">
                                  <button onClick={() => handleStartEdit(review)} className="text-brown/40 hover:text-brown transition-colors" title="Edit">
                                    <Edit2 size={14} />
                                  </button>
                                  <button onClick={() => handleDeleteReview(review.id)} className="text-brown/40 hover:text-rose transition-colors" title="Delete">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="text-brown/70 italic font-serif leading-relaxed">"{review.text}"</p>
                          <p className="text-xs text-brown/40 mt-2">
                            {new Date(review.created_at).toLocaleDateString()}
                            {isOwn && <span className="ml-2 text-amber-600 font-medium">Your review</span>}
                          </p>
                        </>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {similarBooks.length > 0 && (
        <div className="border-t border-brown/10 pt-12">
          <h3 className="text-2xl font-serif font-bold text-brown mb-8">Readers Also Loved</h3>
          <div className="flex gap-6 overflow-x-auto pb-8 px-2">
            {similarBooks.map((b) => (
              <BookCard
                key={b.key}
                title={b.title}
                author={b.author}
                coverId={b.coverId}
                coverColor={getBookColor(b.key)}
                className="hover:-translate-y-2 transition-transform"
                onClick={() => navigate(bookPath(b.key))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
