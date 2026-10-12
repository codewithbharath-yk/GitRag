import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppTheme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: AppTheme;
  actualTheme: 'dark' | 'light';
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'coderag_theme_mode_v2';

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  actualTheme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
      // Also check backwards compatibility
      const oldTheme = localStorage.getItem('coderag_theme_v1');
      if (oldTheme === 'white') return 'light';
      if (oldTheme === 'green') return 'dark';
      return 'dark'; // Dark Forest is the default theme
    } catch {
      return 'dark';
    }
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  // Listen to OS color scheme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const actualTheme: 'dark' | 'light' =
    theme === 'system' ? (systemIsDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // storage error
    }

    const root = document.documentElement;
    const body = document.body;

    root.setAttribute('data-theme', actualTheme === 'light' ? 'light' : 'dark');

    if (actualTheme === 'light') {
      root.classList.add('theme-light', 'theme-white');
      root.classList.remove('theme-dark', 'theme-green');
      body.classList.add('theme-light', 'theme-white');
      body.classList.remove('theme-dark', 'theme-green');
    } else {
      root.classList.add('theme-dark', 'theme-green');
      root.classList.remove('theme-light', 'theme-white');
      body.classList.add('theme-dark', 'theme-green');
      body.classList.remove('theme-light', 'theme-white');
    }
  }, [theme, actualTheme]);

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      const current = prev === 'system' ? (systemIsDark ? 'dark' : 'light') : prev;
      return current === 'dark' ? 'light' : 'dark';
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, actualTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
