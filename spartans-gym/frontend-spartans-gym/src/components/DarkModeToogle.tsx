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
      className={`group relative h-8 w-[72px] rounded-full border p-1 transition-all duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-500/20 ${
        isDark
          ? 'border-slate-700 bg-slate-950 shadow-inner shadow-black/40'
          : 'border-slate-200 bg-slate-100 shadow-inner shadow-slate-200'
      }`}
    >
      <span
        className={`absolute left-2.5 top-1/2 -translate-y-1/2 transition-colors duration-300 ${
          isDark ? 'text-slate-600' : 'text-slate-700'
        }`}
      >
        <span className="material-symbols-outlined text-[14px]">light_mode</span>
      </span>
      <span
        className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors duration-300 ${
          isDark ? 'text-white' : 'text-slate-400'
        }`}
      >
        <span className="material-symbols-outlined text-[14px]">dark_mode</span>
      </span>
      <span
        className={`relative z-10 flex h-6 w-8 items-center justify-center rounded-full shadow-md ring-1 ring-black/5 transition-all duration-300 group-active:scale-95 ${
          isDark ? 'translate-x-8 bg-red-600 text-white' : 'translate-x-0 bg-white text-slate-700'
        }`}
      >
        <span className="material-symbols-outlined text-[15px]">{isDark ? 'dark_mode' : 'light_mode'}</span>
      </span>
    </button>
  );
};
