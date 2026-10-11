import React, { useEffect, useState, useRef } from 'react';
import { useReducedMotion } from './useReducedMotion';
import { motionTokens } from './motionTokens';

export type TextEffectVariant = 'blur-up' | 'fade-slide' | 'word' | 'char';

interface TextEffectProps {
  children: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'p' | 'span' | 'div';
  className?: string;
  staggerMs?: number;
  variant?: TextEffectVariant;
  mode?: 'word' | 'char'; // Backward compatibility
  delayMs?: number;
}

/**
 * TextEffect — Staggered reveal for prominent titles, headings, and empty state intros.
 * - Word-by-word or character-by-character reveal with subtle upward blur transition.
 * - Fully accessible: screen-readers receive the full text via aria-label.
 * - Automatically respects 'prefers-reduced-motion'.
 * - Stable: Avoids unnecessary re-renders when parent states update.
 */
export const TextEffect: React.FC<TextEffectProps> = ({
  children,
  as: Component = 'h1',
  className = '',
  staggerMs,
  variant = 'blur-up',
  mode,
  delayMs = 40,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [hasAnimated, setHasAnimated] = useState(false);
  const prevChildrenRef = useRef(children);

  const activeMode = mode || (variant === 'char' ? 'char' : 'word');
  const defaultStagger =
    staggerMs ?? (activeMode === 'char' ? motionTokens.stagger.textChar : motionTokens.stagger.textWord);

  useEffect(() => {
    // If text changed, re-trigger animation
    if (prevChildrenRef.current !== children) {
      prevChildrenRef.current = children;
      setHasAnimated(false);
    }

    const timer = setTimeout(() => {
      setHasAnimated(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [children, delayMs]);

  // Reduced motion fallback: Render immediately without delays or transforms
  if (prefersReducedMotion) {
    return <Component className={className}>{children}</Component>;
  }

  // Ensure children is stringifiable; fallback directly to children if React elements
  const isStringOrNumber = typeof children === 'string' || typeof children === 'number';
  if (!isStringOrNumber) {
    return <Component className={className}>{children}</Component>;
  }

  const text = String(children);
  const items = activeMode === 'word' ? text.split(' ') : text.split('');

  return (
    <Component className={`inline-block ${className}`} aria-label={text}>
      {items.map((item, index) => (
        <span
          key={`${item}-${index}`}
          className="inline-block transition-all ease-out"
          style={{
            transitionDuration: motionTokens.duration.smooth,
            transitionTimingFunction: motionTokens.easing.outDecel,
            opacity: hasAnimated ? 1 : 0,
            transform: hasAnimated ? 'translateY(0)' : 'translateY(8px)',
            filter: hasAnimated ? 'blur(0px)' : 'blur(4px)',
            transitionDelay: `${index * defaultStagger}ms`,
            marginRight: activeMode === 'word' && index < items.length - 1 ? '0.28em' : undefined,
          }}
          aria-hidden="true"
        >
          {item}
        </span>
      ))}
    </Component>
  );
};
