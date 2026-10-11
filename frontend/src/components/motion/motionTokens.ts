/**
 * CodeRAG Global Motion System Tokens
 * Standardized easing curves, durations, and springs for premium developer UI.
 */

export const motionTokens = {
  // Durations
  duration: {
    instant: '100ms',
    fast: '180ms',
    normal: '280ms',
    smooth: '400ms',
    entrance: '500ms',
    slow: '700ms',
  },

  // Easing curves
  easing: {
    // Crisp deceleration for entrances
    outDecel: 'cubic-bezier(0.16, 1, 0.3, 1)',
    // Standard cubic for smooth elements
    easeOut: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
    // Spring physics curve
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.2)',
    // Smooth standard
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Stagger intervals (milliseconds)
  stagger: {
    textWord: 28,
    textChar: 14,
    listItem: 36,
    gridCard: 50,
  },

  // Perspective settings
  perspective: {
    default: 1000,
    subtle: 1200,
  },

  // Transitions classes
  classes: {
    interactive: 'transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.99]',
    button: 'transition-all duration-180 ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[#295255]',
    card: 'transition-all duration-250 ease-out hover:shadow-lg',
  },
} as const;
