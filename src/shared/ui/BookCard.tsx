import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { getBookCoverUrl } from '@/shared/config';

interface BookCardProps {
  title: string;
  author: string;
  coverColor?: string;
  coverId?: number | null;
  rating?: number;
  className?: string;
  onClick?: () => void;
  showRating?: boolean;
  isLiked?: boolean;
  loading?: 'lazy' | 'eager';
  onLike?: (e: React.MouseEvent) => void;
}

export function BookCard({
  title,
  author,
  coverColor = 'from-amber-700 to-amber-900',
  coverId,
  rating,
  className = '',
  onClick,
  showRating = false,
  isLiked = false,
  loading = 'lazy',
  onLike,
}: BookCardProps) {
  const coverUrl = getBookCoverUrl(coverId, 'M');

  return (
    <motion.div
      whileHover={{
        y: -8,
        rotate: -2,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      }}
      className={`relative group cursor-pointer w-36 sm:w-44 flex-shrink-0 ${className}`}
      onClick={onClick}
    >
      <div className="absolute left-0 top-0 bottom-0 w-3 bg-black/10 z-10 rounded-l-md" />

      <div
        className={`
          h-56 sm:h-64 rounded-r-md rounded-l-sm shadow-warm flex flex-col justify-between overflow-hidden
          ${coverId ? '' : `bg-gradient-to-br ${coverColor} p-4`}
        `}
      >
        {coverId && coverUrl ? (
          <img
            src={coverUrl}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover rounded-r-md rounded-l-sm"
            decoding="async"
            loading={loading}
            width={176}
            height={256}
            srcSet={`${getBookCoverUrl(coverId, 'S')} 200w, ${getBookCoverUrl(coverId, 'M')} 400w, ${getBookCoverUrl(coverId, 'L')} 800w`}
            sizes="(max-width: 640px) 144px, 176px"
          />
        ) : (
          <>
            <div className="text-cream/90 font-serif border-b border-cream/20 pb-2">
              <h3 className="text-lg leading-tight font-bold line-clamp-3">{title}</h3>
            </div>
            <div className="space-y-2">
              <p className="text-cream/80 text-sm font-sans italic">{author}</p>
              {showRating && (
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Heart
                      key={star}
                      size={12}
                      className={star <= (rating || 0) ? 'fill-cream text-cream' : 'text-cream/40'}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {coverId && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
            <h3 className="text-white text-sm font-bold line-clamp-2 leading-tight">{title}</h3>
            <p className="text-white/70 text-xs mt-1">{author}</p>
          </div>
        )}

        <div className="absolute inset-0 bg-black/[0.02] pointer-events-none rounded-r-md rounded-l-sm" />
      </div>

      {onLike && (
        <motion.button
          initial={{ opacity: 0 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          animate={{ opacity: isLiked ? 1 : 0 }}
          className="absolute -top-2 -right-2 bg-cream p-2 rounded-full shadow-md text-rose opacity-0 group-hover:opacity-100 transition-opacity z-20"
          onClick={onLike}
        >
          <Heart size={16} className={isLiked ? 'fill-rose' : ''} />
        </motion.button>
      )}
    </motion.div>
  );
}
