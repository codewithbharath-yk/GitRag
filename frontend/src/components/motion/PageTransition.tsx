import React from 'react';
import { useReducedMotion } from './useReducedMotion';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  viewKey?: string;
  tabKey?: string;
}

/**
 * PageTransition — Subtle fade and upward slide transition for router tab changes.
 * Avoids aggressive layout shifts; gracefully disabled when prefers-reduced-motion is active.
 */
export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  className = '',
  viewKey,
  tabKey,
}) => {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <div className={`flex-1 flex flex-col h-full overflow-hidden ${className}`}>{children}</div>;
  }

  return (
    <div
      key={viewKey || tabKey}
      className={`flex-1 flex flex-col h-full overflow-hidden animate-in fade-in duration-200 slide-in-from-bottom-1 ${className}`}
    >
      {children}
    </div>
  );
};
