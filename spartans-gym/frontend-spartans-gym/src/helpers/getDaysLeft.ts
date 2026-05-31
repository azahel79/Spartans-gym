export const getMembershipStatus = (vencimiento: string | undefined) => {
    if (!vencimiento || vencimiento === '-- --- ----') {
        return { daysLeft: 0, isExpired: true, isExpiringSoon: false, statusColor: 'text-slate-400', showWarning: false, canRegister: false };
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const fechaVencimiento = new Date(vencimiento);
    fechaVencimiento.setHours(0, 0, 0, 0);

    const diferenciaMs = fechaVencimiento.getTime() - hoy.getTime();
    const daysLeft = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24));

    const isExpired = daysLeft <= 0;
    const isExpiringSoon = daysLeft <= 5 && daysLeft > 0;

    let statusColor = 'text-red-600'; // Rojo por defecto para Spartans Gym
    if (isExpiringSoon) statusColor = 'text-orange-500';
    if (isExpired) statusColor = 'text-slate-400';

    return {
        daysLeft,
        isExpired,
        isExpiringSoon,
        statusColor,
        showWarning: isExpiringSoon,
        canRegister: !isExpired
    };
};

const hoy = new Date();

export const fechaFormateada = hoy.toLocaleDateString('es-MX', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric'
});