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
      title={isLight ? 'Switch to Dark Forest mode' : 'Switch to Soft White light mode'}
      aria-label={isLight ? 'Switch to Dark Forest mode' : 'Switch to Soft White light mode'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer text-xs font-medium select-none ${
        isLight
          ? 'bg-white hover:bg-slate-100 text-[#162623] border-slate-300 shadow-xs'
          : 'bg-[#1B2D2A] hover:bg-[#243D39] text-[#F0F5F7] border-[#577877]/40 shadow-xs'
      } ${className}`}
    >
      {isLight ? (
        <>
          <Moon className="w-3.5 h-3.5 text-[#295255]" />
          {showLabel && <span>Dark Forest</span>}
        </>
      ) : (
        <>
          <Sun className="w-3.5 h-3.5 text-[#6DBE9B]" />
          {showLabel && <span>Light Mode</span>}
        </>
      )}
    </button>
  );
};
