// components/Sidebar.tsx
import { Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useConfigStore } from '../../store/config.store';
import { useAuthStore } from '../../store/auth.store';
import defaultLogo from '../../assets/logo.png';
import { DarkModeToggle } from '../DarkModeToogle';
export const Sidebar = () => {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { gymConfig, fetchGymConfig } = useConfigStore();

  // Cargar configuración al montar el sidebar
  useEffect(() => {
    fetchGymConfig();
  }, []);

  const menuItems = [
    { path: '/dashboard', icon: 'dashboard', label: 'Dashboard', roles: ['admin', 'recepcionista'] },
    { path: '/pos', icon: 'shopping_cart', label: 'Punto De Venta', roles: ['admin', 'recepcionista'] },
    { path: '/reception', icon: 'badge', label: 'Recepción', roles: ['admin', 'recepcionista'] },
    { path: '/history', icon: 'history', label: 'Historial', roles: ['admin', 'recepcionista'] },
    { path: '/inventory', icon: 'inventory_2', label: 'Inventario', roles: ['admin', 'recepcionista'] },
    { path: '/config', icon: 'settings', label: 'Configuración', roles: ['admin'] },
  ];

  // Filtrar menús por rol
  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(user?.role || 'recepcionista')
  );

  // Obtener nombre del gimnasio del store (con fallback)
  const gymName = gymConfig?.name || "SPARTAN'S GYM";
  
  // Separar nombre para mostrar en dos líneas
  let firstPart = "SPARTAN'S";
  let secondPart = "GYM";
  
  if (gymName) {
    const parts = gymName.split(' ');
    if (parts.length === 1) {
      firstPart = parts[0];
      secondPart = "";
    } else {
      firstPart = parts.slice(0, -1).join(' ');
      secondPart = parts[parts.length - 1];
    }
  }

  const handleLogout = () => {
    logout();
    window.location.href = '/auth';
  };

  return (
    <>
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 border-r z-40 bg-white border-outline-variant flex-col py-6">
      {/* Logo y Nombre del Gimnasio - DINÁMICO */}
      <div className="px-6 mb-8 flex items-center gap-3">
        <img 
          src={gymConfig?.logo || defaultLogo} 
          alt="Logo Gimnasio" 
          className="w-14 h-14 rounded-full object-cover"
        />
        <div className="flex flex-col">
          <h1 className="text-lg font-black text-primary font-headline leading-tight">
            {firstPart}
          </h1>
          {secondPart && (
            <span className="text-sm font-bold text-black -mt-1">
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
                ? 'bg-indigo-50 text-primary border-l-4 border-primary font-bold'
                : 'text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="text-body-md">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-auto px-4 space-y-1 pt-6 border-t border-slate-100">
        <button className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm mb-4 flex items-center justify-center gap-2 shadow-md active:scale-95 transition-transform">
          <span className="material-symbols-outlined">add</span>
          Check-in Member
        </button>

        <div className="flex items-center justify-between rounded-xl px-4 py-3 transition-colors hover:bg-surface-container-low dark:hover:bg-slate-800/70">
          <div className="flex min-w-0 items-center gap-3">
            <span className="material-symbols-outlined text-[21px] text-slate-500 dark:text-slate-400">contrast</span>
            <span className="text-sm font-medium text-on-surface-variant dark:text-slate-300">Modo Oscuro</span>
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

        {/* Mostrar email del gimnasio en footer */}
        {gymConfig?.email && (
          <div className="text-center text-[10px] text-slate-400 mt-4 pt-2 border-t border-slate-100">
            <p className="truncate">{gymConfig.email}</p>
          </div>
        )}
      </div>
    </aside>
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-outline-variant px-2 py-2 shadow-[0_-10px_30px_rgba(15,23,42,0.08)]">
      <div className="grid grid-cols-5 gap-1">
        {filteredMenuItems.slice(0, 5).map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`min-w-0 h-14 flex flex-col items-center justify-center gap-1 rounded-xl transition-all ${
              location.pathname === item.path
                ? 'bg-red-50 text-primary font-bold'
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
