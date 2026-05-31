// components/RecentAttendanceItem.tsx
import React from 'react';
import type  { Client } from '../types';

interface RecentAttendanceItemProps {
  client: Client;
  isSelected: boolean;
  onSelect: (client: Client) => void;
}

export const RecentAttendanceItem = React.memo(({ client, isSelected, onSelect }: RecentAttendanceItemProps) => {
  return (
    <div
      onClick={() => onSelect(client)}
      className={`flex items-center gap-4 p-3 rounded-2xl transition-all cursor-pointer group ${
        isSelected ? 'bg-primary/5 border border-primary/10' : 'hover:bg-slate-50 border border-transparent'
      }`}
    >
      <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
        <img
          className="w-full h-full object-cover"
          src={
            client.fotoUrl ||
            'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1470&auto=format&fit=crop'
          }
          alt="Avatar"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-on-surface truncate">
          {client.nombre} {client.apellidos}
        </p>
        <p className="text-xs text-on-surface-variant">
          Plan {client.plan} • {client.metodoPago}
        </p>
      </div>
      <div className="text-right">
        <p className="font-bold text-primary">{client.ultimaVisita}</p>
        <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
      </div>
    </div>
  );
});

RecentAttendanceItem.displayName = 'RecentAttendanceItem';