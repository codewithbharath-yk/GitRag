import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  showLabel = false,
}) => {
  const { actualTheme, toggleTheme } = useTheme();
  const isLight = actualTheme === 'light';

  return (
    <button
      onClick={toggleTheme}
      type="button"
      title={isLight ? 'Switch to Dark Ink mode' : 'Switch to Warm Beige light mode'}
      aria-label={isLight ? 'Switch to Dark Ink mode' : 'Switch to Warm Beige light mode'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer text-xs font-medium select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F9B318] ${
        isLight
          ? 'bg-white hover:bg-[#EBEAE3] text-[#111318] border-[#D8D7D0] shadow-xs'
          : 'bg-[#181B22] hover:bg-[#262B37] text-[#EDECE6] border-white/10 shadow-xs'
      } ${className}`}
    >
      {isLight ? (
        <>
          <Moon className="w-3.5 h-3.5 text-[#1546D9]" />
          {showLabel && <span>Dark Ink</span>}
        </>
      ) : (
        <>
          <Sun className="w-3.5 h-3.5 text-[#F9B318]" />
          {showLabel && <span>Warm Beige</span>}
        </>
      )}
    </button>
  );
};
