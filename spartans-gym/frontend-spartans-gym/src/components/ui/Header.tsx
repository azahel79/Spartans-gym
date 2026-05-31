import React, { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useClientStore } from '../../store/client.store';
import { useHistoryStore } from '../../store/history.store';
import { useAuthStore } from '../../store/auth.store'; // 1. Importamos tu store de auth

export const Header = () => {
  const location = useLocation();
  const { clients, setSelectedClient } = useClientStore();
  const { transactions } = useHistoryStore();
  
  // 2. Extraemos el usuario y el logout de tu store real
  const { user, logout } = useAuthStore(); 
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Lógica de Notificaciones basada en el historial real
  const notificaciones = useMemo(() => {
    return transactions.slice(0, 5).map(t => ({
      id: t.id,
      titulo: t.concepto,
      subtitulo: `${t.nombre} ${t.apellidos}`,
      hora: t.hora,
      icono: t.tipo === 'MEMBRESIA' ? 'person_check' : t.tipo === 'PRODUCTO' ? 'shopping_cart' : 'add_circle',
      color: t.tipo === 'MEMBRESIA' ? 'text-blue-600' : t.tipo === 'PRODUCTO' ? 'text-green-600' : 'text-red-600'
    }));
  }, [transactions]);

  const getDynamicPlaceholder = () => {
    const path = location.pathname;
    if (path.includes('dashboard')) return "Buscar estadísticas...";
    if (path.includes('pos')) return "Buscar productos...";
    if (path.includes('reception')) return "Buscar miembro...";
    return "Buscar...";
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase().trim();
    if (location.pathname.includes('reception') && term.length >= 3) {
      const found = clients.find(c => 
        `${c.nombre} ${c.apellidos}`.toLowerCase().includes(term) || c.id.toString().includes(term)
      );
      if (found) setSelectedClient(found);
    }
  };

  // Extraemos la inicial del email para el avatar si no hay nombre
  const userInitial = user?.email?.charAt(0).toUpperCase() || 'A';

  return (
    <header className="fixed top-0 left-0 md:left-64 right-0 h-16 bg-white border-b border-slate-100 z-40 px-3 sm:px-4 md:px-8 flex items-center justify-between gap-3">
      <div className="relative flex-1 max-w-[26rem]">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
          search
        </span>
        <input 
          type="text" 
          placeholder={getDynamicPlaceholder()} 
          onChange={handleSearch}
          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:bg-white focus:border-red-600/20 transition-all"
        />
      </div>

      <div className="flex items-center gap-2 sm:gap-4 md:gap-6 shrink-0">
        {/* Notificaciones */}
        <div className="relative">
          <button 
            onClick={() => {
                setShowNotifications(!showNotifications);
                setShowProfileMenu(false);
            }}
            className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined">notifications</span>
            {transactions.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-600 rounded-full border-2 border-white"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-80 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden z-50">
              <div className="p-4 border-b border-slate-50">
                <h4 className="font-bold text-sm">Actividad en tiempo real</h4>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notificaciones.map((notif) => (
                  <div key={notif.id} className="p-4 hover:bg-slate-50 flex gap-3 border-b border-slate-50 last:border-0">
                    <span className={`material-symbols-outlined ${notif.color}`}>{notif.icono}</span>
                    <div className="flex-1">
                      <p className="text-xs font-bold">{notif.titulo}</p>
                      <p className="text-[10px] text-slate-500">{notif.subtitulo}</p>
                      <p className="text-[9px] text-slate-400">{notif.hora}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Perfil del Usuario Logueado desde useAuthStore */}
        <div className="relative">
          <div 
            className="flex items-center gap-3 pl-4 border-l border-slate-100 cursor-pointer group"
            onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowNotifications(false);
            }}
          >
            <div className="text-right hidden md:block">
              <p className="text-xs font-black text-slate-900 leading-none group-hover:text-red-600 transition-colors">
                {user?.email.split('@')[0] || "Invitado"}
              </p>
              <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">
                Administrador
              </p>
            </div>
            
            <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-red-600/20 group-hover:scale-105 transition-transform">
              {userInitial}
            </div>
          </div>

          {/* Menu Desplegable de Perfil */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden z-50">
              <div className="p-3 border-b border-slate-50 bg-slate-50/50">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Sesión iniciada</p>
                <p className="text-xs font-bold text-slate-700 truncate">{user?.email}</p>
              </div>
              <button className="w-full text-left px-4 py-3 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">settings</span>
                Ajustes
              </button>
              <button 
                onClick={() => logout()}
                className="w-full text-left px-4 py-3 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-50"
              >
                <span className="material-symbols-outlined text-sm">logout</span>
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
