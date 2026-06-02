import type { Attendance, Transaction } from '../types';

interface ReceiptLine {
  label: string;
  value: string;
}

const formatMoney = (value: number) =>
  value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const formatMexicoDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Mexico_City',
  });
};

const openPrintableReceipt = (title: string, lines: ReceiptLine[]) => {
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #111; }
          .ticket { width: 320px; margin: 0 auto; }
          h1 { font-size: 18px; margin: 0 0 4px; text-align: center; }
          .brand { color: #d60000; font-weight: 800; text-align: center; margin-bottom: 18px; }
          .row { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px dashed #ddd; padding: 8px 0; font-size: 13px; }
          .row span:first-child { color: #555; }
          .row span:last-child { font-weight: 700; text-align: right; }
          .total { font-size: 20px; border-bottom: 0; margin-top: 8px; }
          .footer { margin-top: 18px; text-align: center; font-size: 11px; color: #666; }
          @media print { body { padding: 0; } .ticket { width: 72mm; } }
        </style>
      </head>
      <body>
        <div class="ticket">
          <h1>${title}</h1>
          <div class="brand">SPARTANS GYM</div>
          ${lines.map((line) => `<div class="row ${line.label === 'Total' ? 'total' : ''}"><span>${line.label}</span><span>${line.value}</span></div>`).join('')}
          <div class="footer">Gracias por tu preferencia</div>
        </div>
        <script>window.print();</script>
      </body>
    </html>
  `;

  const receiptWindow = window.open('', '_blank', 'width=420,height=640');
  if (!receiptWindow) return;
  receiptWindow.document.write(html);
  receiptWindow.document.close();
};

export const printTransactionReceipt = (transaction: Transaction) => {
  openPrintableReceipt('Recibo de pago', [
    { label: 'Folio', value: String(transaction.id) },
    { label: 'Fecha', value: `${transaction.fecha} ${transaction.hora}` },
    { label: 'Cliente', value: `${transaction.nombre} ${transaction.apellidos}` },
    { label: 'Concepto', value: transaction.concepto || 'Venta' },
    { label: 'Metodo', value: transaction.metodo },
    { label: 'Total', value: formatMoney(Number(transaction.monto || 0)) },
  ]);
};

export const printAttendanceReceipt = (attendance: Attendance) => {
  openPrintableReceipt('Comprobante de asistencia', [
    { label: 'Folio', value: String(attendance.id) },
    { label: 'Fecha', value: `${formatMexicoDateTime(attendance.fecha)} (${attendance.hora})` },
    { label: 'Socio', value: `${attendance.nombre} ${attendance.apellidos}` },
    { label: 'Plan', value: attendance.plan },
    { label: 'Estado', value: attendance.status },
  ]);
};

export const printSaleReceipt = (items: Array<{ name: string; quantity: number; price: number }>, paymentMethod: string, total: number) => {
  openPrintableReceipt('Ticket de venta', [
    { label: 'Fecha', value: new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) },
    ...items.map((item) => ({
      label: `${item.name} x${item.quantity}`,
      value: formatMoney(item.price * item.quantity),
    })),
    { label: 'Metodo', value: paymentMethod },
    { label: 'Total', value: formatMoney(total) },
  ]);
};
