import { motion } from 'framer-motion';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'amber' | 'rose' | 'teal' | 'outline';
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}

export function Badge({
  children,
  variant = 'default',
  className = '',
  onClick,
  selected,
}: BadgeProps) {
  const variants = {
    default: 'bg-brown/10 text-brown',
    amber: 'bg-amber/20 text-brown-dark border-amber/30',
    rose: 'bg-rose/20 text-brown-dark border-rose/30',
    teal: 'bg-teal/20 text-brown-dark border-teal/30',
    outline: 'border border-brown/20 text-brown bg-transparent',
  };

  const selectedStyles = selected
    ? 'ring-2 ring-offset-1 ring-amber bg-amber text-brown-dark font-semibold shadow-sm'
    : '';

  return (
    <motion.span
      whileHover={onClick ? { scale: 1.05 } : {}}
      whileTap={onClick ? { scale: 0.95 } : {}}
      onClick={onClick}
      className={`
        inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-all
        ${variants[variant]} 
        ${selectedStyles}
        ${onClick ? 'cursor-pointer hover:shadow-sm' : ''}
        ${className}
      `}
    >
      {children}
    </motion.span>
  );
}
