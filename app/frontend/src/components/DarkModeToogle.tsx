import React from 'react';
import { useDarkMode } from '../hooks/useDarkMode';

export const DarkModeToggle: React.FC = () => {
  const { isDark, toggle } = useDarkMode();

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={isDark ? 'Modo oscuro activo' : 'Modo claro activo'}
      className={`group relative h-7 w-14 shrink-0 overflow-hidden rounded-full border transition-all duration-300 focus:outline-none focus-visible:ring-4 ${
        isDark
          ? 'brand-soft-border bg-slate-950 shadow-inner shadow-black/50 focus-visible:ring-primary/25'
          : 'border-amber-200 bg-amber-50 shadow-inner shadow-amber-100 focus-visible:ring-amber-300/30'
      }`}
    >
      <span
        className={`absolute left-2 top-1/2 -translate-y-1/2 transition-all duration-300 ${
          isDark ? 'scale-75 text-amber-300/35' : 'scale-100 text-amber-500'
        }`}
      >
        <span className="material-symbols-outlined block text-[15px]">light_mode</span>
      </span>
      <span
        className={`absolute right-2 top-1/2 -translate-y-1/2 transition-all duration-300 ${
          isDark ? 'scale-100 text-indigo-200' : 'scale-75 text-slate-400/50'
        }`}
      >
        <span className="material-symbols-outlined block text-[15px]">dark_mode</span>
      </span>
      <span
        className={`absolute left-0.5 top-0.5 z-10 flex h-6 w-6 items-center justify-center rounded-full shadow-md ring-1 ring-black/10 transition-all duration-300 ease-out group-active:scale-90 ${
          isDark
            ? 'translate-x-7 brand-bg text-white'
            : 'translate-x-0 bg-white text-amber-500'
        }`}
      >
        <span className="material-symbols-outlined text-[14px]">{isDark ? 'dark_mode' : 'light_mode'}</span>
      </span>
    </button>
  );
};
