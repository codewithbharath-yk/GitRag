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
      title={isLight ? 'Switch to Dark Mode (Emerald Night)' : 'Switch to Light Mode (Silk Beige)'}
      aria-label={isLight ? 'Switch to Dark Mode (Emerald Night)' : 'Switch to Light Mode (Silk Beige)'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer text-xs font-semibold select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A373] ${
        isLight
          ? 'bg-white hover:bg-[#EFE3D5] text-[#1F3B2C] border-[#D4C3AF] shadow-xs'
          : 'bg-[#244433] hover:bg-[#315C46] text-[#F1E3D3] border-white/10 shadow-xs'
      } ${className}`}
    >
      {isLight ? (
        <>
          <Moon className="w-3.5 h-3.5 text-[#1F3B2C]" />
          {showLabel && <span>Dark Mode</span>}
        </>
      ) : (
        <>
          <Sun className="w-3.5 h-3.5 text-[#D4A373]" />
          {showLabel && <span>Light Mode</span>}
        </>
      )}
    </button>
  );
};
