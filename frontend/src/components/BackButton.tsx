import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigation, type NavigationState } from '../context/NavigationContext';

export interface BackButtonProps {
  label?: string;
  onClick?: () => void;
  fallback?: Partial<NavigationState>;
  className?: string;
  title?: string;
  tooltip?: string;
  size?: 'sm' | 'md';
  variant?: 'pill' | 'subtle' | 'ghost';
  disabled?: boolean;
}

export const BackButton: React.FC<BackButtonProps> = ({
  label = 'Back',
  onClick,
  fallback,
  className = '',
  title,
  tooltip: customTooltip,
  size = 'md',
  variant = 'pill',
  disabled = false,
}) => {
  const { goBack } = useNavigation();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (onClick) {
      onClick();
    } else {
      goBack(fallback);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (disabled) return;
      if (onClick) {
        onClick();
      } else {
        goBack(fallback);
      }
    }
  };

  const tooltip = customTooltip || title || (typeof label === 'string' ? `Return: ${label}` : 'Return to previous screen');

  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-[11px] gap-1.5' : 'px-3 py-1.5 text-xs gap-2';

  const variantClasses =
    variant === 'ghost'
      ? 'bg-transparent hover:bg-black/10 dark:hover:bg-white/10 text-current border border-transparent'
      : variant === 'subtle'
      ? 'bg-[var(--bg-card)] hover:bg-[#D4A373] hover:text-[#1F3B2C] border border-[var(--border-subtle)] hover:border-[#D4A373]'
      : 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[#D4A373] hover:text-[#1F3B2C] hover:border-[#D4A373] shadow-xs';

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      title={tooltip}
      aria-label={tooltip}
      className={`inline-flex items-center font-medium rounded-xl transition-all duration-180 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A373] focus-visible:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] ${sizeClasses} ${variantClasses} ${className}`}
    >
      <ArrowLeft className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:-translate-x-0.5" />
      {label && <span>{label}</span>}
    </button>
  );
};
