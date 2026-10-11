import React, { useRef, useState, useCallback } from 'react';
import { useReducedMotion, useIsTouchDevice } from './useReducedMotion';

interface SpotlightProps {
  children: React.ReactNode;
  className?: string;
  size?: number;
  strength?: number;
  variant?: 'teal' | 'white' | 'emerald' | 'subtle';
  color?: string;
  onClick?: () => void;
}

/**
 * Spotlight — Cursor-following soft ambient glow on selected cards, panels, or hero surfaces.
 * - Derived strictly from CodeRAG's four-colour palette (#295255, #F0F5F7, #162623, #577877).
 * - pointer-events-none guarantees zero interference with click targets or text selection.
 * - Automatically disabled on touch screens and when prefers-reduced-motion is active.
 */
export const Spotlight: React.FC<SpotlightProps> = ({
  children,
  className = '',
  size = 340,
  strength = 0.14,
  variant = 'teal',
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

  // Variant gradient calculation
  const getGradient = (x: number, y: number) => {
    if (color) {
      return `radial-gradient(${size}px circle at ${x}px ${y}px, ${color}, transparent 75%)`;
    }
    switch (variant) {
      case 'emerald':
        return `radial-gradient(${size}px circle at ${x}px ${y}px, rgba(109, 190, 155, ${strength * 1.5}), rgba(41, 82, 85, ${strength}) 45%, transparent 75%)`;
      case 'white':
        return `radial-gradient(${size}px circle at ${x}px ${y}px, rgba(240, 245, 247, ${strength * 1.2}), rgba(87, 120, 119, ${strength}) 45%, transparent 75%)`;
      case 'subtle':
        return `radial-gradient(${size}px circle at ${x}px ${y}px, rgba(87, 120, 119, ${strength * 0.8}), rgba(41, 82, 85, ${strength * 0.5}) 45%, transparent 75%)`;
      case 'teal':
      default:
        return `radial-gradient(${size}px circle at ${x}px ${y}px, rgba(87, 120, 119, ${strength * 1.6}), rgba(41, 82, 85, ${strength}) 45%, transparent 75%)`;
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
