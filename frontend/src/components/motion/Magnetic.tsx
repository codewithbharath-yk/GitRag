import React, { useRef, useState, useCallback } from 'react';
import { useReducedMotion, useIsTouchDevice } from './useReducedMotion';

interface MagneticProps {
  children: React.ReactNode;
  className?: string;
  pullStrength?: number; // Subtle pull factor (default 0.2)
  maxDistance?: number;  // Pixel clamp limit (default 6px)
  disabled?: boolean;
}

/**
 * Magnetic — Subtle cursor attraction for high-value primary action buttons and CTAs.
 * - Gentle pull towards cursor within clamped bounds (maximum 6-8px).
 * - Instant spring back to rest position on mouse leave.
 * - Never interferes with click events, form submissions, or touch gestures.
 * - Automatically disabled when prefers-reduced-motion is active.
 */
export const Magnetic: React.FC<MagneticProps> = ({
  children,
  className = '',
  pullStrength = 0.2,
  maxDistance = 6,
  disabled = false,
}) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const prefersReduced = useReducedMotion();
  const isTouch = useIsTouchDevice();
  const isDisabled = disabled || prefersReduced || isTouch;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDisabled || !buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = (e.clientX - centerX) * pullStrength;
      const deltaY = (e.clientY - centerY) * pullStrength;

      const clampedX = Math.max(-maxDistance, Math.min(maxDistance, deltaX));
      const clampedY = Math.max(-maxDistance, Math.min(maxDistance, deltaY));

      setOffset({ x: clampedX, y: clampedY });
    },
    [isDisabled, pullStrength, maxDistance]
  );

  const handleMouseLeave = useCallback(() => {
    setOffset({ x: 0, y: 0 });
  }, []);

  return (
    <div
      ref={buttonRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`inline-block transition-transform duration-150 ease-out will-change-transform ${className}`}
      style={{
        transform: isDisabled
          ? undefined
          : `translate3d(${offset.x}px, ${offset.y}px, 0)`,
      }}
    >
      {children}
    </div>
  );
};
