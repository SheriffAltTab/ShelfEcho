import { formatBookDescription } from '@/shared/lib/formatBookDescription';

interface BookDescriptionProps {
  text: string;
  className?: string;
  /** If true, limit to a few lines (e.g. for cards) */
  clamp?: boolean;
}

export function BookDescription({ text, className = '', clamp = false }: BookDescriptionProps) {
  const blocks = formatBookDescription(text);

  return (
    <div className={className}>
      {blocks.map((block, i) =>
        block.type === 'h3' ? (
          <h3
            key={i}
            className="font-serif font-bold text-brown mt-4 mb-2 text-lg first:mt-0"
          >
            {block.text}
          </h3>
        ) : (
          <p
            key={i}
            className={`text-brown/80 leading-relaxed font-serif ${clamp ? 'line-clamp-4 sm:line-clamp-6' : ''}`}
          >
            {block.text}
          </p>
        )
      )}
    </div>
  );
}
