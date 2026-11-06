// components/StatCard.tsx
import React from 'react';

interface StatCardProps {
  icon: string;
  iconBg: string;
  iconColor: string;
  value: string | number;
  label: string;
}

export const StatCard = React.memo(({ icon, iconBg, iconColor, value, label }: StatCardProps) => {
  return (
    <div className="bg-white border border-slate-200 rounded-[24px] p-6 card-shadow">
      <div className={`w-12 h-12 ${iconBg} ${iconColor} rounded-full flex items-center justify-center mb-4`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <p className="text-display font-display text-on-surface text-3xl">{value}</p>
      <p className="text-label-lg font-label-lg text-on-surface-variant">{label}</p>
    </div>
  );
});

StatCard.displayName = 'StatCard';