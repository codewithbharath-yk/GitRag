import React, { useRef, useState, useCallback } from 'react';
import { useReducedMotion, useIsTouchDevice } from './useReducedMotion';

interface SpotlightProps {
  children: React.ReactNode;
  className?: string;
  size?: number;
  strength?: number;
  variant?: 'gold' | 'cobalt' | 'yellow' | 'beige' | 'subtle' | 'teal' | 'white' | 'emerald';
  color?: string;
  onClick?: () => void;
}

/**
 * Spotlight — Cursor-following soft ambient glow on selected cards, panels, or hero surfaces.
 * - Derived from CodeRAG's official 3-color brand palette:
 *   #1F3B2C Emerald Night, #D4A373 Antique Gold, #F1E3D3 Silk Beige.
 * - pointer-events-none guarantees zero interference with click targets or text selection.
 * - Automatically disabled on touch screens and when prefers-reduced-motion is active.
 */
export const Spotlight: React.FC<SpotlightProps> = ({
  children,
  className = '',
  size = 340,
  strength = 0.14,
  variant = 'cobalt',
  color,
  onClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const prefersReduced = useReducedMotion();
  const isTouch = useIsTouchDevice();
  const isDisabled = prefersReduced || isTouch;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDisabled || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    [isDisabled]
  );

  const handleMouseLeave = useCallback(() => {
    setPosition(null);
  }, []);

  // Variant gradient calculation using the official four colours
  const getGradient = (x: number, y: number) => {
    if (color) {
      return `radial-gradient(${size}px circle at ${x}px ${y}px, ${color}, transparent 75%)`;
    }
    switch (variant) {
      case 'gold':
      case 'yellow':
      case 'cobalt':
      case 'teal':
      default:
        return `radial-gradient(${size}px circle at ${x}px ${y}px, rgba(212, 163, 115, ${strength * 1.4}), rgba(31, 59, 44, ${strength * 0.4}) 50%, transparent 75%)`;
      case 'beige':
      case 'white':
        return `radial-gradient(${size}px circle at ${x}px ${y}px, rgba(241, 227, 211, ${strength * 1.2}), transparent 75%)`;
      case 'emerald':
        return `radial-gradient(${size}px circle at ${x}px ${y}px, rgba(31, 59, 44, ${strength * 1.5}), rgba(212, 163, 115, ${strength * 0.3}) 50%, transparent 75%)`;
      case 'subtle':
        return `radial-gradient(${size}px circle at ${x}px ${y}px, rgba(212, 163, 115, ${strength * 0.8}), transparent 75%)`;
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`relative overflow-hidden ${className}`}
    >
      {!isDisabled && position && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-0"
          style={{
            background: getGradient(position.x, position.y),
          }}
          aria-hidden="true"
        />
      )}
      <div className="relative z-1">{children}</div>
    </div>
  );
};
