import React, { useRef, useState, useCallback } from 'react';
import { useReducedMotion, useIsTouchDevice } from './useReducedMotion';

interface TiltProps {
  children: React.ReactNode;
  className?: string;
  maxAngle?: number;
  perspective?: number;
  scale?: number;
}

/**
 * Tilt — Controlled, subtle 3D perspective tilt on interactive cards.
 * - Restrained maximum angle (default 4deg) prevents exaggerated perspective or distortion.
 * - Smooth transition reset on mouse leave with no layout shifts.
 * - Keyboard tabs and touch users retain full standard interaction without 3D rotation.
 * - Automatically disabled when prefers-reduced-motion is active.
 */
export const Tilt: React.FC<TiltProps> = ({
  children,
  className = '',
  maxAngle = 4,
  perspective = 1000,
  scale = 1.01,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('');
  const prefersReduced = useReducedMotion();
  const isTouch = useIsTouchDevice();
  const isDisabled = prefersReduced || isTouch;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDisabled || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -maxAngle;
      const rotateY = ((x - centerX) / centerX) * maxAngle;

      setTransform(
        `perspective(${perspective}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`
      );
    },
    [isDisabled, maxAngle, perspective, scale]
  );

  const handleMouseLeave = useCallback(() => {
    setTransform(`perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`);
  }, [perspective]);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`transition-transform duration-200 ease-out will-change-transform ${className}`}
      style={{
        transform: isDisabled ? undefined : transform,
        transformStyle: 'preserve-3d',
      }}
    >
      {children}
    </div>
  );
};
