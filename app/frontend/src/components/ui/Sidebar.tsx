import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useConfigStore } from '../../store/config.store';
import { isAdminRole, useAuthStore, type UserRole } from '../../store/auth.store';
import { DarkModeToggle } from '../DarkModeToogle';
import { normalizeAppearance } from '../../config/appearance';
import { BrandLogo } from '../BrandLogo';

type MenuItem = {
  path: string;
  icon: string;
  label: string;
  roles: UserRole[];
};

export const Sidebar = () => {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { gymConfig, fetchGymConfig } = useConfigStore();
  const appearance = normalizeAppearance(gymConfig.appearance);
  const brandedSidebar = appearance.sidebarStyle !== 'light';
  const logoInkColor = brandedSidebar ? '#ffffff' : appearance.secondaryColor;

  useEffect(() => {
    fetchGymConfig();
  }, [fetchGymConfig]);

  const menuItems: MenuItem[] = [
    { path: '/dashboard', icon: 'dashboard', label: 'Dashboard', roles: ['admin', 'recepcionista'] },
    { path: '/pos', icon: 'shopping_cart', label: 'Punto De Venta', roles: ['admin', 'recepcionista'] },
    { path: '/reception', icon: 'badge', label: 'Recepción', roles: ['admin', 'recepcionista'] },
    { path: '/cash-closing', icon: 'point_of_sale', label: 'Corte de Caja', roles: ['admin', 'recepcionista'] },
    { path: '/history', icon: 'history', label: 'Historial', roles: ['admin', 'recepcionista'] },
    { path: '/inventory', icon: 'inventory_2', label: 'Inventario', roles: ['admin', 'recepcionista'] },
    { path: '/training', icon: 'fitness_center', label: 'Rutinas', roles: ['admin', 'entrenador'] },
    { path: '/config', icon: 'settings', label: 'Configuración', roles: ['admin'] },
  ];

  const filteredMenuItems = menuItems.filter(item =>
    item.roles.includes(user?.role || 'recepcionista') || (isAdminRole(user?.role) && item.roles.includes('admin'))
  );

  const gymName = gymConfig?.name || "SPARTAN'S GYM";
  const parts = gymName.split(' ');
  const firstPart = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(' ');
  const secondPart = parts.length === 1 ? '' : parts[parts.length - 1];

  const handleLogout = () => {
    logout();
    window.location.href = '/auth';
  };

  return (
    <>
      <aside
        className={`hidden md:flex fixed left-0 top-0 h-screen w-64 border-r z-40 border-outline-variant flex-col py-6 bg-cover bg-center ${appearance.sidebarStyle === 'dark' ? 'bg-slate-950' : appearance.sidebarStyle === 'light' ? 'bg-white' : ''}`}
        style={{
          backgroundColor: appearance.sidebarStyle === 'brand' ? appearance.primaryColor : undefined,
          backgroundImage: appearance.sidebarBackground ? `linear-gradient(rgba(0,0,0,.5),rgba(0,0,0,.5)),url(${appearance.sidebarBackground})` : undefined,
        }}
      >
        <div className="px-5 mb-8 flex items-center gap-3">
          <div
            className="flex h-[66px] w-[66px] shrink-0 items-center justify-center rounded-2xl border p-1.5"
            style={{
              borderColor: `color-mix(in srgb, ${appearance.primaryColor} 45%, transparent)`,
              background: gymConfig?.logo
                ? 'linear-gradient(145deg, rgba(255,255,255,.98), rgba(226,232,240,.94))'
                : brandedSidebar
                  ? 'rgba(255,255,255,.08)'
                  : `color-mix(in srgb, ${appearance.primaryColor} 8%, white)`,
              boxShadow: `0 12px 28px color-mix(in srgb, ${appearance.primaryColor} 22%, transparent)`,
            }}
          >
            <BrandLogo
              customLogo={gymConfig?.logo}
              primaryColor={appearance.primaryColor}
              inkColor={logoInkColor}
              alt={`Logo de ${gymName}`}
              className="h-full w-full object-contain drop-shadow-sm"
            />
          </div>
          <div className="flex flex-col">
            <h1 className={`text-lg font-black font-headline leading-tight ${brandedSidebar ? 'text-white' : 'text-primary'}`}>
              {firstPart}
            </h1>
            {secondPart && (
              <span className={`text-sm font-bold -mt-1 ${brandedSidebar ? 'text-white/85' : 'text-black'}`}>
                {secondPart}
              </span>
            )}
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {filteredMenuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-4 py-3 flex items-center gap-3 transition-all rounded-r-lg ${
                location.pathname === item.path
                  ? 'brand-soft brand-border border-l-4 font-bold'
                  : brandedSidebar
                    ? 'text-white/80 hover:bg-white/10'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="text-body-md">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto px-4 space-y-1 pt-6 border-t border-slate-100">
          {user?.role !== 'entrenador' && (
            <Link to="/reception" className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm mb-4 flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform">
              <span className="material-symbols-outlined">add</span>
              Check-in Member
            </Link>
          )}

          <div className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition-colors ${brandedSidebar ? 'text-white hover:bg-white/10' : 'hover:bg-surface-container-low dark:hover:bg-slate-800/70'}`}>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="material-symbols-outlined text-[21px] text-slate-500 dark:text-slate-400">contrast</span>
              <span className={`whitespace-nowrap text-sm font-medium ${brandedSidebar ? 'text-white/80' : 'text-on-surface-variant dark:text-slate-300'}`}>Modo oscuro</span>
            </div>
            <DarkModeToggle />
          </div>

          <div
            onClick={handleLogout}
            className="text-slate-500 px-4 py-3 flex items-center gap-3 hover:bg-red-50 hover:text-red-600 cursor-pointer transition-all duration-200 ease-in-out rounded-lg"
          >
            <span className="material-symbols-outlined">logout</span>
            <span className="font-medium">Logout</span>
          </div>

          {gymConfig?.email && (
            <div className="text-center text-[10px] text-slate-400 mt-4 pt-2 border-t border-slate-100">
              <p className="truncate">{gymConfig.email}</p>
            </div>
          )}
        </div>
      </aside>

      <nav className="mobile-navigation md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-outline-variant px-2 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)]">
        <div className="grid grid-cols-6 gap-1">
          {filteredMenuItems.slice(0, 6).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`min-w-0 h-14 flex flex-col items-center justify-center gap-1 rounded-xl transition-all ${
                location.pathname === item.path
                  ? 'brand-soft font-bold'
                  : 'text-on-surface-variant active:bg-surface-container-low'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              <span className="text-[10px] leading-none truncate max-w-full px-1">{item.label.replace('Punto De Venta', 'Venta')}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
};
