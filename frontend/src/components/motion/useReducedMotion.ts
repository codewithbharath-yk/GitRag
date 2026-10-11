import { useState, useEffect } from 'react';

/**
 * useReducedMotion — Hook to detect user preferences for reduced motion or touch inputs.
 * Respects OS/browser 'prefers-reduced-motion' and cleans up listeners reliably.
 */
export const useReducedMotion = (): boolean => {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(listener);
      return () => mediaQuery.removeListener(listener);
    }
  }, []);

  return prefersReduced;
};

/**
 * useIsTouchDevice — Detects if current device is a touch screen to disable hover-following physics.
 */
export const useIsTouchDevice = (): boolean => {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    setIsTouch(touch);
  }, []);

  return isTouch;
};
